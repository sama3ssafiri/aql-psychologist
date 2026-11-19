(() => {
  const explorer = document.querySelector(".brain-explorer");
  const canvas = explorer.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const sections = [...explorer.querySelectorAll("[data-experience]")];
  const note = explorer.querySelector(".brain-region-note");
  const practice = explorer.querySelector(".brain-practice-copy");
  const experiences = Object.fromEntries(JSON.parse(explorer.querySelector(".brain-copy").textContent).map(entry => [entry.id, entry]));
  let experience = explorer.querySelector("#brain-scenario-select").value;
  let markers = [];
  let active = null;
  let yaw = -0.35;
  let pitch = 0.14;
  let width = 0;
  let height = 0;
  let pointer;
  let targets = [];

  let anatomy = null;
  let surfaceRenderer = null;
  let signalStarted = -Infinity;
  let signalPaths = [];
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
    const vertices = [anatomical([center[0], center[1], center[2] + radii[2]])];
    const faces = [], columns = 24, rows = 11;
    for (let row = 1; row <= rows; row++) {
      const latitude = row * Math.PI / (rows + 1);
      for (let column = 0; column < columns; column++) {
        const longitude = column * Math.PI * 2 / columns;
        vertices.push(anatomical([
          center[0] + radii[0] * Math.sin(latitude) * Math.cos(longitude),
          center[1] + radii[1] * Math.sin(latitude) * Math.sin(longitude),
          center[2] + radii[2] * Math.cos(latitude),
        ]));
      }
    }
    const bottom = vertices.push(anatomical([center[0], center[1], center[2] - radii[2]])) - 1;
    for (let column = 0; column < columns; column++) {
      const next = (column + 1) % columns;
      faces.push([0, 1 + column, 1 + next]);
      for (let row = 0; row < rows - 1; row++) {
        const a = 1 + row * columns + column, b = 1 + row * columns + next;
        faces.push([a, a + columns, b], [b, a + columns, b + columns]);
      }
      faces.push([bottom, 1 + (rows - 1) * columns + next, 1 + (rows - 1) * columns + column]);
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

  function prepareSurface(mesh) {
    const normals = mesh.vertices.map(() => [0, 0, 0]);
    const neighbours = mesh.vertices.map(() => new Set());
    for (const [a, b, c] of mesh.faces) {
      const p = mesh.vertices[a], q = mesh.vertices[b], r = mesh.vertices[c];
      const u = q.map((n, i) => n - p[i]), v = r.map((n, i) => n - p[i]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      for (const index of [a, b, c]) {
        normal.forEach((n, i) => normals[index][i] += n);
        for (const other of [a, b, c]) if (other !== index) neighbours[index].add(other);
      }
    }
    mesh.neighbours = neighbours.map(set => [...set]);
    mesh.normals = normals.map(normal => {
      const length = Math.hypot(...normal) || 1;
      return normal.map(n => n / length);
    });
    // Local concavity darkens the grooves while leaving the ridges illuminated.
    mesh.occlusion = mesh.vertices.map((point, index) => {
      const average = [0, 0, 0];
      for (const other of neighbours[index]) mesh.vertices[other].forEach((n, i) => average[i] += n);
      const concavity = average.reduce((sum, n, i) => sum + (n / (neighbours[index].size || 1) - point[i]) * mesh.normals[index][i], 0);
      return 1 - Math.min(0.42, Math.max(0, concavity) * 12);
    });
  }

  function createSurfaceRenderer(meshes) {
    const surface = document.createElement("canvas");
    let gl;
    try {
      gl = surface.getContext("webgl", { alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch (error) { return null; }
    if (!gl || typeof gl.createShader !== "function") return null;
    const derivatives = Boolean(gl.getExtension("OES_standard_derivatives"));
    const vertexSource = `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec3 a_barycentric;
      attribute float a_occlusion;
      uniform vec2 u_size;
      uniform vec2 u_turn;
      varying mediump vec3 v_normal;
      varying mediump vec3 v_barycentric;
      varying mediump float v_occlusion;
      vec3 rotate(vec3 p) {
        float cy = cos(u_turn.x), sy = sin(u_turn.x);
        float cp = cos(u_turn.y), sp = sin(u_turn.y);
        float side = p.x * cy + p.z * sy;
        float depth = -p.x * sy + p.z * cy;
        return vec3(side, p.y * cp - depth * sp, p.y * sp + depth * cp);
      }
      void main() {
        vec3 p = rotate(a_position);
        float scale = min(u_size.x / 2.6, u_size.y / 2.35) * 0.92 * 5.0 / (5.0 - p.z);
        vec2 pixel = vec2(u_size.x * 0.5 + p.x * scale, u_size.y * 0.47 + p.y * scale);
        gl_Position = vec4(pixel.x / u_size.x * 2.0 - 1.0, 1.0 - pixel.y / u_size.y * 2.0, -p.z / 5.0, 1.0);
        v_normal = rotate(a_normal);
        v_barycentric = a_barycentric;
        v_occlusion = a_occlusion;
      }
    `;
    const fragmentSource = `
      ${derivatives ? "#extension GL_OES_standard_derivatives : enable" : ""}
      precision mediump float;
      uniform float u_light;
      varying mediump vec3 v_normal;
      varying mediump vec3 v_barycentric;
      varying mediump float v_occlusion;
      void main() {
        vec3 normal = normalize(v_normal);
        if (normal.z < 0.0) normal = -normal;
        vec3 light = normalize(vec3(-0.45, -0.7, 1.0));
        float diffuse = max(dot(normal, light), 0.0);
        float shine = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * 0.09;
        vec3 material = mix(vec3(0.40, 0.34, 0.53), vec3(0.82, 0.79, 0.88), u_light);
        float ambient = mix(0.29, 0.58, u_light);
        vec3 shaded = material * (ambient + (1.0 - ambient) * diffuse) * v_occlusion + shine;
        vec3 edgeWidth = ${derivatives ? "fwidth(v_barycentric) * 0.7" : "vec3(0.024)"};
        vec3 interior = smoothstep(vec3(0.0), edgeWidth, v_barycentric);
        float wire = 1.0 - min(min(interior.x, interior.y), interior.z);
        vec3 ink = mix(vec3(0.68, 0.60, 0.88), vec3(0.40, 0.30, 0.58), u_light);
        gl_FragColor = vec4(mix(shaded, ink, wire * 0.38), 1.0);
      }
    `;
    let program, buffer;
    const shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        shaders.push(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Surface shader unavailable");
      }
      program = gl.createProgram();
      shaders.forEach(shader => gl.attachShader(program, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Surface renderer unavailable");
      const values = [];
      for (const mesh of meshes.filter(mesh => !mesh.internal)) {
        for (const face of mesh.faces) face.forEach((index, corner) => {
          values.push(...mesh.vertices[index], ...mesh.normals[index], Number(corner === 0), Number(corner === 1), Number(corner === 2), mesh.occlusion[index]);
        });
      }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      gl.useProgram(program);
      for (const [name, size, offset] of [["a_position", 3, 0], ["a_normal", 3, 12], ["a_barycentric", 3, 24], ["a_occlusion", 1, 36]]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 40, offset);
      }
      const sizeUniform = gl.getUniformLocation(program, "u_size");
      const turnUniform = gl.getUniformLocation(program, "u_turn");
      const lightUniform = gl.getUniformLocation(program, "u_light");
      const count = values.length / 10;
      surface.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        surfaceRenderer = null;
        draw();
      });
      return {
        draw(light) {
          if (gl.isContextLost()) return false;
          if (surface.width !== canvas.width || surface.height !== canvas.height) {
            surface.width = canvas.width;
            surface.height = canvas.height;
          }
          gl.viewport(0, 0, surface.width, surface.height);
          gl.enable(gl.DEPTH_TEST);
          gl.depthFunc(gl.LEQUAL);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.useProgram(program);
          gl.uniform2f(sizeUniform, width, height);
          gl.uniform2f(turnUniform, yaw, pitch);
          gl.uniform1f(lightUniform, Number(light));
          gl.drawArrays(gl.TRIANGLES, 0, count);
          ctx.globalAlpha = 1;
          ctx.drawImage(surface, 0, 0, width, height);
          return true;
        },
      };
    } catch (error) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      return null;
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }

  function surfaceShade(mesh, face, light) {
    const normal = [0, 0, 0];
    for (const index of face) mesh.normals[index].forEach((n, i) => normal[i] += n / 3);
    const [x, y, z] = normal;
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const vertical = y * Math.cos(pitch) - depth * Math.sin(pitch);
    const facing = y * Math.sin(pitch) + depth * Math.cos(pitch);
    const diffuse = Math.max(0, (-0.45 * side - 0.7 * vertical + facing) / (Math.hypot(side, vertical, facing) * Math.hypot(0.45, 0.7, 1) || 1));
    const ambient = light ? 0.58 : 0.29;
    const shade = (ambient + (1 - ambient) * diffuse) * face.reduce((sum, i) => sum + mesh.occlusion[i] / 3, 0);
    return `rgb(${(light ? [209, 201, 224] : [102, 87, 135]).map(n => Math.round(n * shade)).join(",")})`;
  }

  function beginSignal(key) {
    signalPaths = [];
    if (!anatomy || reduceMotion.matches) return;
    const region = anatomy.regions[key];
    if (!region) return;
    const indices = new Set(region.indices.flatMap(index => region.mesh.faces[index]));
    const origin = [0, 0, 0];
    for (const index of indices) region.mesh.vertices[index].forEach((n, i) => origin[i] += n / indices.size);
    const mesh = region.mesh.name.includes("cortex") ? region.mesh : anatomy.meshes[1];
    const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
    let root = 0;
    mesh.vertices.forEach((point, i) => { if (distance(point, origin) < distance(mesh.vertices[root], origin)) root = i; });
    const previous = new Int32Array(mesh.vertices.length).fill(-1);
    previous[root] = root;
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      for (const next of mesh.neighbours[queue[i]]) if (previous[next] === -1) {
        previous[next] = queue[i];
        queue.push(next);
      }
    }
    const endpoints = Array(6).fill(null);
    mesh.vertices.forEach((point, index) => {
      if (previous[index] === -1) return;
      const length = distance(point, origin);
      if (length < 0.3 || length > 1.15) return;
      const angle = Math.atan2(point[1] - origin[1], point[0] - origin[0]) + Math.PI;
      const sector = Math.min(5, Math.floor(angle / (Math.PI * 2) * 6));
      if (!endpoints[sector] || length > endpoints[sector].length) endpoints[sector] = { index, length };
    });
    for (const endpoint of endpoints.filter(Boolean)) {
      const points = [];
      let index = endpoint.index;
      while (index !== root && points.length < mesh.vertices.length) {
        points.push(mesh.vertices[index]);
        index = previous[index];
      }
      points.push(mesh.vertices[root], origin);
      points.reverse();
      const distances = [0];
      for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + distance(points[i], points[i - 1]));
      signalPaths.push({ points, distances, length: distances.at(-1) });
    }
    signalStarted = performance.now();
  }

  function renderSignals(now, accent) {
    if (reduceMotion.matches || !signalPaths.length) return;
    const elapsed = (now - signalStarted) / 1800;
    if (elapsed < 0 || elapsed > 1.25) return;
    signalPaths.forEach((path, index) => {
      const progress = elapsed - index * 0.035;
      if (progress <= 0 || progress >= 1) return;
      const head = progress * path.length;
      const tail = Math.max(0, head - path.length * 0.18);
      const points = [];
      for (let i = 1; i < path.points.length; i++) {
        const from = Math.max(tail, path.distances[i - 1]);
        const to = Math.min(head, path.distances[i]);
        if (to <= from) continue;
        const span = path.distances[i] - path.distances[i - 1];
        const at = value => path.points[i - 1].map((n, axis) => n + (path.points[i][axis] - n) * (value - path.distances[i - 1]) / span);
        if (!points.length) points.push(project(at(from)));
        points.push(project(at(to)));
      }
      if (!points.length) return;
      ctx.beginPath();
      points.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.65;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.9;
      ctx.stroke();
      const tip = points.at(-1);
      ctx.beginPath();
      ctx.arc(tip[0], tip[1], 1.6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  function render(now) {
    if (!ctx || !anatomy || !width || !height) return;
    const theme = getComputedStyle(explorer);
    const accent = theme.getPropertyValue("--accent").trim();
    const light = document.documentElement.dataset.theme === "light";
    const breathing = reduceMotion.matches ? 0.55 : (1 - Math.cos(now * Math.PI * 2 / 3600)) / 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (geometryDirty) {
      ctx.clearRect(0, 0, width, height);
      const projected = new Map(anatomy.meshes.map(mesh => [mesh, mesh.vertices.map(project)]));
      const accelerated = surfaceRenderer?.draw(light);
      const visible = [];
      for (const mesh of accelerated ? [] : anatomy.meshes.filter(mesh => !mesh.internal)) {
        const points = projected.get(mesh);
        for (const face of mesh.faces) {
          const triangle = face.map(index => points[index]);
          const [a, b, c] = triangle;
          const facing = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (facing <= 0) continue;
          visible.push({ triangle, depth: (a[2] + b[2] + c[2]) / 3, shade: surfaceShade(mesh, face, light) });
        }
      }
      visible.sort((a, b) => a.depth - b.depth);
      // Software fallback keeps directional shading when hardware rendering is unavailable.
      for (const { triangle, shade } of visible) {
        ctx.beginPath();
        traceTriangle(triangle);
        ctx.globalAlpha = 1;
        ctx.fillStyle = shade;
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
        const centre = region.mesh.vertices.reduce((sum, point) => sum.map((n, i) => n + point[i] / region.mesh.vertices.length), [0, 0, 0]);
        return [key, { triangles, paths: outlinePaths(outline, points), centre: project(centre) }];
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
      if (marker.key === "hypothalamus") {
        const [x, y] = region.centre;
        const radius = 13 + breathing * 6;
        const halo = ctx.createRadialGradient(x, y, 1, x, y, radius);
        halo.addColorStop(0, "rgba(255,255,255,0.85)");
        halo.addColorStop(0.35, "rgba(255,255,255,0.25)");
        halo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = halo;
        ctx.globalAlpha = strength * (0.5 + breathing * 0.35);
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
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
      targets.push({ triangles, button: marker.button, centre: region.centre, small: marker.key === "hypothalamus" });
    }
    renderSignals(now, accent);
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
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function select(button) {
    active = button === active ? null : button;
    markers.forEach((marker) => marker.button.setAttribute("aria-pressed", String(marker.button === active)));
    note.textContent = active ? active.textContent + " — " + active.dataset.note : "Choose a glowing area or its name to learn more.";
    if (active) beginSignal(active.dataset.region);
    else signalPaths = [];
    render(performance.now());
    startBreathing();
  }

  function changeExperience(next) {
    if (!Object.hasOwn(experiences, next)) return;
    experience = next;
    const entry = experiences[next];
    for (const section of sections) section.hidden = section.dataset.experience !== entry.group;
    const shown = sections.find(section => !section.hidden);
    markers = [...shown.querySelectorAll("[data-region]")].map(button => ({ button, key: button.dataset.region }));
    practice.textContent = entry.practice;
    direction.textContent = entry.evidence;
    active = null;
    select(markers[0]?.button || null);
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
      pitch -= dy * 0.012;
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
    const closest = targets.slice().reverse().find(target => target.triangles.some(inside) || (target.small && Math.hypot(target.centre[0] - x, target.centre[1] - y) < 14));
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
    pitch -= y * 0.14;
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
      meshes.forEach(prepareSurface);
      anatomy = { meshes, regions };
      surfaceRenderer = createSurfaceRenderer(meshes);
      if (active) beginSignal(active.dataset.region);
      status.textContent = "Choose an area to learn more. Select it again to see all the related areas.";
      resize();
    } catch (error) {
      status.textContent = "The brain picture could not load. You can still read the explanations and practice ideas.";
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
