(() => {
  const figure = document.querySelector(".neuron");
  const canvas = figure.querySelector("canvas");
  const surface = document.createElement("canvas");
  surface.className = "neuron-surface";
  surface.setAttribute("aria-hidden", "true");
  const context = surface.getContext("2d");
  if (!context) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const button = figure.querySelector("button");
  const tau = Math.PI * 2;
  const wash = document.createElement("div");
  wash.className = "neuron-wash";
  wash.setAttribute("aria-hidden", "true");
  document.body.append(wash, surface);
  const signalDuration = 1850;
  const illuminatedText = [...document.querySelectorAll(
    ".brand, .hero h1, .hero-intro, .hero-credentials, .home-posts h2, .home-posts h3, .home-posts .post-list p"
  )];
  let waveExtent = 0;
  let lightTargets = [];
  let seed = Math.floor(Math.random() * 4294967296);
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

  const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));

  function addBranch(points, weight, tip, offset) {
    const distances = [offset];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i - 1] + distance(points[i - 1], points[i]));
    }
    branches.push({ points, weight, tip, distances });
    return distances;
  }

  function grow(start, end, bend, depth, weight, offset = distance(origin, start)) {
    const points = curve(start, end, bend);
    const distances = addBranch(points, weight, depth === 0, offset);
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
      grow(root, child, [0, (random() - 0.5) * 0.12, (random() - 0.5) * 0.13], depth - 1, weight * 0.68, distances[startIndex]);
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

  // Keep the radial silhouette, but vary each trunk's heading, reach and depth.
  for (const [template, bend] of trunks) {
    const angle = (random() - 0.5) * 0.34;
    const length = 0.83 + random() * 0.32;
    const dx = template[0] - origin[0];
    const dy = template[1] - origin[1];
    const end = [
      origin[0] + (dx * Math.cos(angle) - dy * Math.sin(angle)) * length,
      origin[1] + (dx * Math.sin(angle) + dy * Math.cos(angle)) * length,
      template[2] + (random() - 0.5) * 0.22,
    ];
    grow(mix(origin, end, 0.21), end, bend.map(value => value * (0.8 + random() * 0.4)), 2, 1.6);
  }

  const axonStart = [-0.03, 0.08, 0.015];
  const axonEnd = [-1.1 - random() * 0.14, 0.35 + random() * 0.25, (random() - 0.5) * 0.35];
  const axonBend = [-0.03, -0.15, 0.16];
  const axon = curve(axonStart, axonEnd, axonBend, 46);
  const axonDistance = addBranch(axon, 1.6, false, distance(origin, axonStart)).at(-1);
  grow(axonEnd, [-1.32, 0.61, 0.04], [0, -0.03, 0.02], 1, 0.8, axonDistance);
  grow(axonEnd, [-1.31, 0.35, 0.13], [0, 0.06, -0.03], 1, 0.8, axonDistance);

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

  const baseCount = branches.length;
  const baseReach = Math.max(...branches.map((branch) => branch.distances.at(-1)));
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const splitLimit = 10;
  const splitTips = [];
  const resetDuration = 1900;
  const growthDuration = 700;
  let reach = baseReach;
  let resetStarted = null;

  function splitTip() {
    const tips = branches.filter((branch) => branch.tip && !branch.splitAt);
    const count = Math.min(tips.length, 2 + Math.floor(Math.random() * 3));
    splitTips.push([]);
    splitTips.at(-1).startedAt = performance.now();
    for (let i = 0; i < count; i++) {
      const [parent] = tips.splice(Math.floor(Math.random() * tips.length), 1);
      splitTips.at(-1).push(parent);
      const growthOffset = i * 0.1;
      const end = parent.points.at(-1);
      const previous = parent.points.at(-3);
      const heading = Math.atan2(end[1] - previous[1], end[0] - previous[0]) + (Math.random() - 0.5) * 0.28;
      const length = parent.growthStep
        ? Math.max(0.15, distance(parent.points[0], end) / goldenRatio)
        : 0.38 + Math.random() * 0.33;
      const side = Math.random() < 0.5 ? -1 : 1;
      const angle = 0.35 + Math.random() * 0.15;
      const depth = (Math.random() - 0.5) * length * 0.65;
      parent.splitAt = splitTips.length;

      for (const longer of [true, false]) {
        const branchLength = longer ? length : length / goldenRatio;
        const branchAngle = heading + (longer ? side * angle : -side * angle * goldenRatio);
        const tip = [
          end[0] + Math.cos(branchAngle) * branchLength,
          end[1] + Math.sin(branchAngle) * branchLength,
          end[2] + (longer ? depth : -depth / goldenRatio),
        ];
        const bend = (longer ? side : -side) * branchLength * 0.11;
        const distances = addBranch(curve(end, tip, [0, bend, depth * 0.15], 16), longer ? 0.85 : 0.62, true, parent.distances.at(-1));
        branches.at(-1).growthStep = splitTips.length;
        branches.at(-1).growthOffset = growthOffset;
        reach = Math.max(reach, distances.at(-1));
      }
    }
  }

  function resetGrowth() {
    for (const tip of splitTips.flat()) delete tip.splitAt;
    splitTips.length = 0;
    branches.length = baseCount;
    reach = baseReach;
    resetStarted = null;
  }

  let ratio = 1;
  let box;
  let width = 0;
  let height = 0;
  let yaw = -0.22 + (random() - 0.5) * 0.3;
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

  function glow(points, weight, travelled, front, strength = 1) {
    const envelope = reduceMotion.matches ? 1 : Math.max(0, 1 - Math.abs(travelled - front) / 0.29);
    const intensity = envelope * strength;
    if (intensity < 0.02) return;
    const fraction = Math.min(1, travelled / reach);
    const lightMode = document.documentElement.dataset.theme === "light";
    const lightness = lightMode ? 45 : 69;
    context.strokeStyle = `hsl(266 100% ${lightness}%)`;
    line(points, weight + 5, intensity * 0.23);
    context.strokeStyle = `hsl(266 100% ${lightness + fraction * 9}%)`;
    line(points, weight + 1.5, intensity);
  }

  function branchFraction(branch, remaining) {
    if (!branch.growthStep) return 1;
    const offset = branch.growthOffset;
    const elapsed = reduceMotion.matches ? 1 : (performance.now() - splitTips[branch.growthStep - 1].startedAt) / growthDuration;
    const growth = (elapsed - offset) / (1 - offset);
    const retraction = (remaining - branch.growthStep + 1 - offset) / (1 - offset);
    return Math.max(0, Math.min(1, growth, retraction));
  }

  function draw(progress = null, remaining = splitTips.length) {
    if (!box) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, surface.width, surface.height);
    context.setTransform(ratio, 0, 0, ratio, box.left * ratio, box.top * ratio);
    context.strokeStyle = accent;
    context.fillStyle = accent;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const edge of mesh) line(edge, 0.65, 0.45);
    for (const branch of branches) {
      const fraction = branchFraction(branch, remaining);
      if (fraction <= 0) continue;
      const end = fraction * (branch.points.length - 1);
      const index = Math.floor(end);
      const points = branch.points.slice(0, index + 1);
      if (end > index) points.push(mix(branch.points[index], branch.points[index + 1], end - index));
      line(points, branch.weight, 0.78);
      if (branch.tip && (!branch.splitAt || remaining <= branch.splitAt - 1 || (!reduceMotion.matches && performance.now() <= splitTips[branch.splitAt - 1].startedAt))) dot(points.at(-1), 1.45, 0.84);
    }
    if (progress !== null) {
      const front = progress * (reach + 0.29);
      for (const edge of mesh) {
        glow(edge, 0.65, distance(origin, edge[0]) * 0.62, front, 0.9);
      }
      for (const branch of branches) {
        const { points, distances, weight } = branch;
        const fraction = branchFraction(branch, remaining);
        const end = Math.floor(fraction * (points.length - 1));
        for (let i = 1; i <= end; i++) {
          glow([points[i - 1], points[i]], weight, (distances[i - 1] + distances[i]) / 2, front);
        }
      }
    }
    context.globalAlpha = 1;
  }

  function drawWash(progress) {
    if (progress === null || reduceMotion.matches) {
      wash.style.opacity = "0";
      for (const { element } of lightTargets) element.style.removeProperty("--neuron-light");
      if (progress === null) lightTargets = [];
      return;
    }

    const radius = (0.07 + progress * 1.14) * waveExtent;
    const intensity = Math.sin(progress * Math.PI) ** 0.7;
    wash.style.setProperty("--wave-radius", `${radius}px`);
    wash.style.opacity = String(intensity);
    for (const { element, distanceFromNeuron } of lightTargets) {
      const proximity = Math.max(0, 1 - Math.abs(radius - waveExtent * 0.105 - distanceFromNeuron) / (waveExtent * 0.21));
      element.style.setProperty("--neuron-light", `${Math.round(proximity * intensity * 100)}%`);
    }
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
    const drifting = !pointer && !reduceMotion.matches;
    if (drifting) yaw += elapsed * 0.00009;
    const duration = reduceMotion.matches ? 220 : signalDuration;
    if (pulse !== null && now - pulse >= duration) pulse = null;
    const growing = !reduceMotion.matches && splitTips.some(group => now - group.startedAt < growthDuration);
    if (splitTips.length === splitLimit && resetStarted === null && !growing) {
      pulse = null;
      drawWash(null);
      if (reduceMotion.matches) resetGrowth();
      else resetStarted = now;
    }
    if (resetStarted !== null && (reduceMotion.matches || now - resetStarted >= resetDuration)) resetGrowth();
    const remaining = resetStarted === null ? splitTips.length : splitLimit * (1 - (now - resetStarted) / resetDuration);
    const progress = pulse === null ? null : Math.max(0, (now - pulse) / duration);
    draw(progress, remaining);
    drawWash(progress);
    if (drifting || coasting || growing || pulse !== null || resetStarted !== null) frame = requestAnimationFrame(animate);
  }

  function start() {
    if (!frame) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(animate);
    }
  }

  function signal() {
    if (splitTips.length === splitLimit) return;
    splitTip();
    // Growth and the page-wide wave have independent clocks.
    if (pulse !== null) { start(); return; }
    box = canvas.getBoundingClientRect();
    const [x, y] = project(origin);
    const waveX = box.left + x;
    const waveY = box.top + y;
    waveExtent = Math.hypot(Math.max(waveX, innerWidth - waveX), Math.max(waveY, innerHeight - waveY));
    wash.style.setProperty("--wave-x", `${waveX}px`);
    wash.style.setProperty("--wave-y", `${waveY}px`);
    lightTargets = reduceMotion.matches ? [] : illuminatedText.map((element) => {
      const area = element.getBoundingClientRect();
      return { element, distanceFromNeuron: Math.hypot(area.left + area.width / 2 - waveX, area.top + area.height / 2 - waveY) };
    });
    pulse = performance.now();
    start();
  }

  function resize() {
    box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    ratio = Math.min(devicePixelRatio || 1, 2);
    surface.width = Math.round(innerWidth * ratio);
    surface.height = Math.round(innerHeight * ratio);
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
  start();
  reduceMotion.addEventListener("change", start);
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", () => {
    box = canvas.getBoundingClientRect();
    start();
  }, { passive: true });
  new MutationObserver(refreshAccent).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();
