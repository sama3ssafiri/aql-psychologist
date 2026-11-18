(() => {
  const explorer = document.querySelector(".brain-explorer");
  const canvas = explorer.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const sections = [...explorer.querySelectorAll("[data-experience]")];
  const slider = explorer.querySelector("#brain-intensity");
  const output = explorer.querySelector("output");
  const scenario = explorer.querySelector("#brain-scenario");
  const note = explorer.querySelector(".brain-region-note");
  const levels = ["Mild", "Moderate", "Strong"];
  const stories = {
    rejection: [
      "An unanswered message stings a little. You notice it and get back to what you were doing.",
      "Someone important stops replying after a difficult conversation. It hurts, and you keep returning to what was said.",
      "Someone important cuts off contact after a conflict. The hurt feels overwhelming and makes it hard to focus on anything else.",
    ],
    comfort: [
      "A familiar person reaches for your hand before something stressful. You feel a little more settled.",
      "While you wait for difficult news, someone you trust sits close and holds your hand. Your shoulders start to relax.",
      "After an intensely stressful moment, someone you trust stays with you. The relief feels strong and you can finally catch your breath.",
    ],
  };

  let experience = "rejection";
  let markers = [];
  let active = null;
  let yaw = -0.35;
  let pitch = 0.14;
  let width = 0;
  let height = 0;
  let pointer;
  let targets = [];

  let anatomy = null;
  const status = explorer.querySelector(".brain-model-status");
  const direction = explorer.querySelector(".brain-direction");
  const viewButtons = [...explorer.querySelectorAll("[data-view]")];
  const views = { right: -0.18, left: Math.PI + 0.18, front: -Math.PI / 2 };
  yaw = views.right;
  pitch = 0.04;
  let pendingFrame = 0;
  let lastPaint = 0;
  let inView = true;
  let geometryDirty = true;
  let regionViews = new Map();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const baseCanvas = document.createElement("canvas");
  const baseContext = baseCanvas.getContext("2d");

  function unpack(encoded, Type) {
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return new Type(bytes.buffer);
  }

  // FreeSurfer/MNI RAS millimetres -> screen-friendly anatomical coordinates.
  function anatomical([x, y, z]) {
    return [-(y + 18) / 90, -(z - 5) / 90, x / 90];
  }

  function makeRegion(mesh, indices) {
    const edges = new Map();
    for (const index of indices) {
      const face = mesh.faces[index];
      for (let i = 0; i < 3; i++) {
        const a = face[i], b = face[(i + 1) % 3];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        const edge = edges.get(key);
        if (edge) { edge.count++; edge.faces.push(index); }
        else edges.set(key, { a, b, count: 1, faces: [index] });
      }
    }
    return { mesh, indices, edges: [...edges.values()], boundary: [...edges.values()].filter(edge => edge.count === 1) };
  }

  function locationMesh(center, radii) {
    const vertices = [], faces = [];
    for (let row = 0; row <= 12; row++) {
      const latitude = row * Math.PI / 12;
      for (let column = 0; column < 24; column++) {
        const longitude = column * Math.PI / 12;
        vertices.push(anatomical([
          center[0] + radii[0] * Math.sin(latitude) * Math.cos(longitude),
          center[1] + radii[1] * Math.sin(latitude) * Math.sin(longitude),
          center[2] + radii[2] * Math.cos(latitude),
        ]));
        if (row < 12) {
          const a = row * 24 + column, b = row * 24 + (column + 1) % 24;
          faces.push([a, a + 24, b], [b, a + 24, b + 24]);
        }
      }
    }
    return { vertices, faces, name: "Approximate hypothalamus location" };
  }

  function project(point) {
    const [x, y, z] = point;
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const vertical = y * Math.cos(pitch) - depth * Math.sin(pitch);
    const rotatedDepth = y * Math.sin(pitch) + depth * Math.cos(pitch);
    const perspective = 5 / (5 - rotatedDepth);
    const scale = Math.min(width / 2.6, height / 2.35) * 0.92 * perspective;
    return [width / 2 + side * scale, height * 0.47 + vertical * scale, rotatedDepth];
  }

  function traceTriangle(points) {
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.lineTo(points[2][0], points[2][1]);
    ctx.closePath();
  }

  function outlinePaths(edges, points) {
    const links = new Map();
    edges.forEach(({ a, b }, index) => {
      for (const vertex of [a, b]) {
        if (!links.has(vertex)) links.set(vertex, []);
        links.get(vertex).push(index);
      }
    });
    const visited = new Set();
    const paths = [];
    edges.forEach((edge, index) => {
      if (visited.has(index)) return;
      const vertices = [edge.a];
      let next = edge.b;
      visited.add(index);
      while (next !== vertices[0]) {
        vertices.push(next);
        const adjacent = links.get(next).find(i => !visited.has(i));
        if (adjacent === undefined) break;
        visited.add(adjacent);
        const edge = edges[adjacent];
        next = edge.a === next ? edge.b : edge.a;
      }
      paths.push({ points: vertices.map(i => points[i]), closed: next === vertices[0] });
    });
    return paths;
  }

  function traceOutline(paths) {
    ctx.beginPath();
    for (const { points, closed } of paths) {
      if (points.length < 2) continue;
      if (!closed || points.length < 4) {
        ctx.moveTo(points[0][0], points[0][1]);
        points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
        if (closed) ctx.closePath();
        continue;
      }
      const last = points.at(-1);
      ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
      points.forEach(([x, y], i) => {
        const next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(x, y, (x + next[0]) / 2, (y + next[1]) / 2);
      });
      ctx.closePath();
    }
  }

  function render(now) {
    if (!ctx || !anatomy || !width || !height) return;
    const theme = getComputedStyle(explorer);
    const accent = theme.getPropertyValue("--accent").trim();
    const background = theme.getPropertyValue("--background").trim();
    const light = document.documentElement.dataset.theme === "light";
    const breathing = reduceMotion.matches ? 0.55 : (1 - Math.cos(now * Math.PI * 2 / 3600)) / 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (geometryDirty) {
      ctx.clearRect(0, 0, width, height);
      const projected = new Map(anatomy.meshes.map(mesh => [mesh, mesh.vertices.map(project)]));
      const visible = [];
      for (const mesh of anatomy.meshes.filter(mesh => !mesh.internal)) {
        const points = projected.get(mesh);
        for (const face of mesh.faces) {
          const triangle = face.map(index => points[index]);
          const [a, b, c] = triangle;
          const facing = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (facing <= 0) continue;
          visible.push({ triangle, depth: (a[2] + b[2] + c[2]) / 3 });
        }
      }
      visible.sort((a, b) => a.depth - b.depth);
      // A subdued wireframe keeps the anatomical folds without competing with regions.
      for (const { triangle } of visible) {
        ctx.beginPath();
        traceTriangle(triangle);
        ctx.globalAlpha = 1;
        ctx.fillStyle = background;
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.globalAlpha = light ? 0.025 : 0.03;
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = light ? 0.23 : 0.19;
        ctx.lineWidth = 0.45;
        ctx.stroke();
      }
      baseContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseContext.drawImage(canvas, 0, 0);
      regionViews = new Map(Object.entries(anatomy.regions).map(([key, region]) => {
        const points = projected.get(region.mesh) || region.mesh.vertices.map(project);
        const triangles = region.indices.map(index => region.mesh.faces[index].map(i => points[i]));
        const outline = region.boundary.length ? region.boundary : region.edges.filter(edge => {
          const facing = edge.faces.map(index => {
            const [a, b, c] = region.mesh.faces[index].map(i => points[i]);
            return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
          });
          return facing.some(Boolean) && facing.some(value => !value);
        });
        return [key, { triangles, paths: outlinePaths(outline, points) }];
      }));
      geometryDirty = false;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.drawImage(baseCanvas, 0, 0, width, height);
    targets = [];
    for (const marker of markers) {
      const region = regionViews.get(marker.key);
      if (!region) continue;
      const chosen = marker.button === active;
      const strength = !active || chosen ? 1 : 0.22;
      const { triangles, paths } = region;
      // No second wire mesh inside the highlight: one soft wash and a clean outline.
      ctx.beginPath();
      for (const triangle of triangles) traceTriangle(triangle);
      ctx.fillStyle = light ? accent : "#ffffff";
      ctx.globalAlpha = strength * (0.025 + breathing * 0.045);
      ctx.fill();
      traceOutline(paths);
      if (marker.key === "hypothalamus") ctx.setLineDash([3, 3]);
      // Violet underlay keeps the white outline legible in the light theme too.
      ctx.strokeStyle = accent;
      ctx.globalAlpha = strength * 0.65;
      ctx.lineWidth = chosen ? 3 : 2.4;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = strength * (0.55 + breathing * 0.4);
      ctx.lineWidth = chosen ? 1.7 : 1.2;
      ctx.shadowColor = light ? accent : "#ffffff";
      ctx.shadowBlur = (light ? 4 : 7) + breathing * (chosen ? 12 : 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      targets.push({ triangles, button: marker.button });
    }
    ctx.globalAlpha = 1;
  }

  function canBreathe() {
    return anatomy && !reduceMotion.matches && inView && !document.hidden;
  }

  function startBreathing() {
    if (!pendingFrame && canBreathe()) pendingFrame = requestAnimationFrame(breathe);
  }

  function breathe(now) {
    pendingFrame = 0;
    if (!canBreathe()) return;
    // Only the cached white overlays animate; the anatomical surface is reused.
    if (now - lastPaint >= 1000 / 30) {
      render(now);
      lastPaint = now;
    }
    startBreathing();
  }

  function draw() {
    geometryDirty = true;
    render(performance.now());
    startBreathing();
  }

  function requestDraw() {
    geometryDirty = true;
    if (reduceMotion.matches) draw();
    else startBreathing();
  }

  function updateMotion() {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    if (document.hidden || !inView) return;
    render(performance.now());
    startBreathing();
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function updateScenario() {
    const value = Number(slider.value);
    output.textContent = levels[value];
    slider.setAttribute("aria-valuetext", levels[value]);
    scenario.textContent = stories[experience][value];
  }

  function select(button) {
    active = button === active ? null : button;
    markers.forEach((marker) => marker.button.setAttribute("aria-pressed", String(marker.button === active)));
    note.textContent = active ? active.textContent + " — " + active.dataset.note : "Select an outline or region name to explore the finding.";
    draw();
  }

  function changeExperience(next) {
    experience = next;
    for (const section of sections) section.hidden = section.dataset.experience !== next;
    const shown = sections.find((section) => !section.hidden);
    markers = [...shown.querySelectorAll("[data-region]")].map((button) => ({
      button, key: button.dataset.region,
    }));
    direction.textContent = next === "comfort"
      ? "↓ Reduced threat-related activity was associated with higher marital quality during spousal hand-holding."
      : "Regions consistently recruited while participants relived rejection by a significant other.";
    select(markers[0]?.button || null);
    updateScenario();
  }

  explorer.addEventListener("change", (event) => {
    if (event.target.name === "brain-experience") changeExperience(event.target.value);
  });
  explorer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-region]");
    if (button) select(button);
    const view = event.target.closest("[data-view]");
    if (view) {
      yaw = views[view.dataset.view];
      pitch = 0.04;
      viewButtons.forEach(button => button.setAttribute("aria-pressed", String(button === view)));
      draw();
    }
  });
  slider.addEventListener("input", updateScenario);
  changeExperience(experience);

  if (!ctx) {
    explorer.querySelector(".brain-model").hidden = true;
    return;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.moved += Math.hypot(dx, dy);
    if (pointer.moved > 4) {
      yaw += dx * 0.012;
      pitch += dy * 0.012;
      viewButtons.forEach(button => button.setAttribute("aria-pressed", "false"));
      requestDraw();
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const { moved } = pointer;
    pointer = null;
    if (moved > 4) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    function inside([a, b, c]) {
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.01) return false;
      const cross = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
      const d = [cross(a, b), cross(b, c), cross(c, a)];
      return !(d.some(n => n < 0) && d.some(n => n > 0));
    }
    const closest = targets.slice().reverse().find(target => target.triangles.some(inside));
    if (closest) select(closest.button);
  });
  function release(event) {
    if (pointer?.id === event.pointerId) pointer = null;
  }
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("keydown", (event) => {
    const turns = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!Object.hasOwn(turns, event.key)) return;
    event.preventDefault();
    const [x, y] = turns[event.key];
    yaw += x * 0.14;
    pitch += y * 0.14;
    viewButtons.forEach(button => button.setAttribute("aria-pressed", "false"));
    draw();
  });
  async function loadAnatomy() {
    try {
      const response = await fetch(canvas.dataset.anatomyUrl);
      if (!response.ok) throw new Error("Anatomy request failed");
      const data = await response.json();
      if (data.format !== 1) throw new Error("Unsupported anatomy format");
      const meshes = data.meshes.map(mesh => {
        const packed = unpack(mesh.vertices, Int16Array);
        const indices = unpack(mesh.faces, Uint16Array);
        const vertices = Array.from({ length: packed.length / 3 }, (_, i) => anatomical(Array.from(packed.slice(i * 3, i * 3 + 3), n => n / 10)));
        const faces = Array.from({ length: indices.length / 3 }, (_, i) => Array.from(indices.slice(i * 3, i * 3 + 3)));
        return { name: mesh.name, vertices, faces, internal: mesh.name === "caudate" };
      });
      const regions = Object.fromEntries(Object.entries(data.regions).map(([key, region]) => {
        const mesh = region.approximate ? locationMesh(region.center, region.radii) : meshes[region.mesh];
        return [key, makeRegion(mesh, region.faces || mesh.faces.map((_, i) => i))];
      }));
      anatomy = { meshes, regions };
      status.textContent = "White glow highlights a related region. Select another region name to explore, or select the active name again to see all.";
      resize();
    } catch (error) {
      status.textContent = "The anatomical model could not load. The study findings and region descriptions are still available below.";
      canvas.hidden = true;
      explorer.querySelector(".brain-views").hidden = true;
    }
  }
  loadAnatomy();
  resize();
  new ResizeObserver(resize).observe(canvas);
  reduceMotion.addEventListener("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      updateMotion();
    }).observe(canvas);
  }
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
