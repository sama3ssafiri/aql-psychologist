(() => {
  const figure = document.querySelector(".neuron");
  const canvas = figure.querySelector("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const button = figure.querySelector("button");
  const tau = Math.PI * 2;
  let seed = 7139;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const origin = [0.19, -0.02, 0];
  const branches = [];
  const mesh = [];

  const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

  function curve(start, end, bend, segments = 16) {
    return Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments;
      const wave = Math.sin(t * Math.PI);
      return mix(start, end, t).map((value, axis) => value + bend[axis] * wave);
    });
  }

  function grow(start, end, bend, depth, weight) {
    const points = curve(start, end, bend);
    branches.push({ points, weight, tip: depth === 0 });
    if (depth === 0) return;

    for (const side of [-1, 1]) {
      const startIndex = side === -1 ? 11 : 16;
      const root = points[startIndex];
      const heading = Math.atan2(end[1] - start[1], end[0] - start[0]);
      const angle = heading + side * (0.32 + random() * 0.49);
      const length = (depth === 2 ? 0.31 : 0.17) * (0.7 + random() * 0.6);
      const child = [
        root[0] + Math.cos(angle) * length,
        root[1] + Math.sin(angle) * length,
        root[2] + (random() - 0.5) * length,
      ];
      grow(root, child, [0, (random() - 0.5) * 0.12, (random() - 0.5) * 0.13], depth - 1, weight * 0.68);
    }
  }

  const trunks = [
    [[-0.38, -0.62, -0.22], [-0.08, 0.18, 0.07]],
    [[0.40, -0.70, 0.24], [-0.12, 0.01, -0.08]],
    [[0.86, -0.41, -0.13], [-0.02, 0.13, 0.11]],
    [[0.97, 0.12, 0.16], [-0.03, 0.12, -0.03]],
    [[0.65, 0.55, -0.29], [-0.05, 0.09, 0.08]],
    [[0.15, 0.55, 0.31], [0.13, 0.02, -0.05]],
    [[-0.15, 0.37, -0.30], [-0.10, -0.02, 0.05]],
  ];

  for (const [end, bend] of trunks) {
    grow(mix(origin, end, 0.21), end, bend, 2, 1.6);
  }

  const axonStart = [-0.03, 0.08, 0.015];
  const axonEnd = [-1.16, 0.49, 0.14];
  const axonBend = [-0.03, -0.15, 0.16];
  const axon = curve(axonStart, axonEnd, axonBend, 46);
  branches.push({ points: axon, weight: 1.6, tip: false });
  grow(axonEnd, [-1.32, 0.61, 0.04], [0, -0.03, 0.02], 1, 0.8);
  grow(axonEnd, [-1.31, 0.35, 0.13], [0, 0.06, -0.03], 1, 0.8);

  // Staggered rings join into an irregular triangulated cell body.
  const rings = Array.from({ length: 9 }, (_, row) => {
    const latitude = 0.18 + row * (Math.PI - 0.36) / 8;
    return Array.from({ length: 13 }, (_, column) => {
      const angle = (column + (row % 2) * 0.5) * tau / 13;
      const radius = 0.20 * (1 + 0.08 * Math.sin(angle * 3 + latitude * 4));
      return [
        origin[0] + Math.cos(angle) * Math.sin(latitude) * radius * 1.24,
        origin[1] + Math.cos(latitude) * radius * 0.88,
        origin[2] + Math.sin(angle) * Math.sin(latitude) * radius,
      ];
    });
  });

  rings.forEach((ring, row) => ring.forEach((point, column) => {
    const next = (column + 1) % ring.length;
    mesh.push([point, ring[next]]);
    if (row + 1 < rings.length) {
      const adjacent = rings[row + 1];
      const diagonal = (column + (row % 2 ? 1 : ring.length - 1)) % ring.length;
      mesh.push([point, adjacent[column]], [point, adjacent[diagonal]]);
    }
  }));

  let width = 0;
  let height = 0;
  let yaw = -0.22;
  let pitch = 0.12;
  let velocityX = 0;
  let velocityY = 0;
  let pointer = null;
  let pulse = null;
  let frame = 0;
  let lastFrame = 0;
  let accent = "";

  function project(point) {
    const [x, y, z] = point;
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const vertical = y * Math.cos(pitch) - depth * Math.sin(pitch);
    const rotatedDepth = y * Math.sin(pitch) + depth * Math.cos(pitch);
    const scale = Math.min(width / 3.2, height / 2.04) * 4 / (4 - rotatedDepth);
    return [width / 2 + side * scale, height / 2 + vertical * scale];
  }

  function line(points, weight, opacity) {
    context.globalAlpha = opacity;
    context.lineWidth = weight;
    context.beginPath();
    points.forEach((point, i) => {
      const [x, y] = project(point);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  function dot(point, radius, opacity) {
    context.globalAlpha = opacity;
    context.beginPath();
    context.arc(...project(point), radius, 0, tau);
    context.fill();
  }

  function draw(progress = null) {
    context.clearRect(0, 0, width, height);
    context.strokeStyle = accent;
    context.fillStyle = accent;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const edge of mesh) line(edge, 0.65, 0.45);
    for (const branch of branches) {
      line(branch.points, branch.weight, 0.78);
      if (branch.tip) dot(branch.points.at(-1), 1.45, 0.84);
    }
    if (progress !== null) {
      const head = progress * (axon.length - 1);
      for (let tail = 5; tail >= 0; tail--) {
        const position = Math.max(0, head - tail * 0.7);
        const index = Math.min(axon.length - 2, Math.floor(position));
        const point = mix(axon[index], axon[index + 1], position - index);
        dot(point, 3.8 - tail * 0.45, 1 - tail * 0.15);
      }
    }
    context.globalAlpha = 1;
  }

  function animate(now) {
    frame = 0;
    const elapsed = Math.min(32, Math.max(0, now - lastFrame));
    lastFrame = now;
    const coasting = !pointer && Math.hypot(velocityX, velocityY) > 0.00006 && !reduceMotion.matches;
    if (coasting) {
      yaw += velocityX * elapsed;
      pitch += velocityY * elapsed;
      const decay = Math.pow(0.88, elapsed / 16.7);
      velocityX *= decay;
      velocityY *= decay;
    }
    if (pulse !== null && now - pulse >= 1050) pulse = null;
    draw(pulse === null ? null : reduceMotion.matches ? 1 : Math.max(0, (now - pulse) / 1050));
    if (coasting || pulse !== null) frame = requestAnimationFrame(animate);
  }

  function start() {
    if (!frame) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function signal() {
    pulse = performance.now() - (reduceMotion.matches ? 930 : 0);
    start();
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function refreshAccent() {
    accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || pointer) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, time: event.timeStamp };
    velocityX = velocityY = 0;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const elapsed = Math.max(8, event.timeStamp - pointer.time);
    pointer.distance += Math.hypot(dx, dy);
    yaw += dx * 0.009;
    pitch += dy * 0.009;
    velocityX = Math.max(-0.012, Math.min(0.012, dx * 0.009 / elapsed));
    velocityY = Math.max(-0.012, Math.min(0.012, dy * 0.009 / elapsed));
    Object.assign(pointer, { x: event.clientX, y: event.clientY, time: event.timeStamp });
    start();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const { distance, time } = pointer;
    pointer = null;
    if (distance < 5) signal();
    else {
      if (event.timeStamp - time > 75) velocityX = velocityY = 0;
      start();
    }
  });

  function cancelPointer(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer = null;
    velocityX = velocityY = 0;
    start();
  }
  canvas.addEventListener("pointercancel", cancelPointer);
  canvas.addEventListener("lostpointercapture", cancelPointer);

  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    yaw += (Number(event.key === "ArrowRight") - Number(event.key === "ArrowLeft")) * 0.16;
    pitch += (Number(event.key === "ArrowDown") - Number(event.key === "ArrowUp")) * 0.16;
    velocityX = velocityY = 0;
    start();
  });

  button.addEventListener("click", signal);
  figure.hidden = false;
  refreshAccent();
  resize();
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(refreshAccent).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();
