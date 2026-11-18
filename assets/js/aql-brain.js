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

  function traceEdges(edges, points) {
    ctx.beginPath();
    for (const { a, b } of edges) {
      ctx.moveTo(points[a][0], points[a][1]);
      ctx.lineTo(points[b][0], points[b][1]);
    }
  }

  function draw() {
    if (!ctx || !anatomy || !width || !height) return;
    const theme = getComputedStyle(explorer);
    const accent = theme.getPropertyValue("--accent").trim();
    const background = theme.getPropertyValue("--background").trim();
    const light = document.documentElement.dataset.theme === "light";
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
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
    // Opaque face underlays preserve the actual folds instead of showing a cage.
    for (const { triangle } of visible) {
      ctx.beginPath();
      traceTriangle(triangle);
      ctx.globalAlpha = 1;
      ctx.fillStyle = background;
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.globalAlpha = light ? 0.055 : 0.08;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = active ? 0.22 : 0.36;
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
    targets = [];
    for (const marker of markers) {
      const region = anatomy.regions[marker.key];
      if (!region) continue;
      const chosen = marker.button === active;
      const points = projected.get(region.mesh) || region.mesh.vertices.map(project);
      const triangles = region.indices.map(index => region.mesh.faces[index].map(i => points[i]));
      ctx.beginPath();
      for (const triangle of triangles) traceTriangle(triangle);
      ctx.fillStyle = accent;
      ctx.globalAlpha = chosen ? 0.3 : (active ? 0.075 : 0.16);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = chosen ? 0.75 : (active ? 0.23 : 0.5);
      ctx.lineWidth = 0.65;
      traceEdges(region.edges, points);
      ctx.stroke();
      // Closed cortical atlas boundaries; deep structures use their view silhouette.
      const outline = region.boundary.length ? region.boundary : region.edges.filter(edge => {
        const facing = edge.faces.map(index => {
          const [a, b, c] = region.mesh.faces[index].map(i => points[i]);
          return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
        });
        return facing.some(Boolean) && facing.some(value => !value);
      });
      ctx.globalAlpha = chosen || !active ? 0.95 : 0.35;
      ctx.lineWidth = chosen ? 2.1 : 1.35;
      ctx.shadowColor = accent;
      ctx.shadowBlur = light ? 4 : (chosen ? 18 : 10);
      if (marker.key === "hypothalamus") ctx.setLineDash([3, 3]);
      traceEdges(outline, points);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      targets.push({ triangles, button: marker.button });
    }
    ctx.globalAlpha = 1;
  }

  function requestDraw() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; draw(); });
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
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
    active = button;
    markers.forEach((marker) => marker.button.setAttribute("aria-pressed", String(marker.button === button)));
    note.textContent = button ? button.textContent + " — " + button.dataset.note : "Select an outline or region name to explore the finding.";
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
    select(null);
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
      status.textContent = "Anatomical template · transparent region overlays reveal deeper structures";
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
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
