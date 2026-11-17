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

  // Two lobulated hemispheres form an illustrative shell around interior markers.
  function shell(a, b, side) {
    const ring = Math.sin(a);
    const fold = 1 + 0.045 * Math.sin(12 * b + 4 * a) * Math.sin(8 * a - 2 * b);
    const x = 1.12 * ring * Math.cos(b) * fold;
    const y = -0.75 * Math.cos(a) * fold + 0.09 * Math.max(0, -x);
    const z = side * (0.025 + 0.66 * ring * Math.sin(b) * fold);
    return [x, y, z];
  }

  const paths = [];
  for (const side of [-1, 1]) {
    for (let row = 1; row < 19; row++) {
      paths.push(Array.from({ length: 51 }, (_, i) => shell(row * Math.PI / 19, i * Math.PI / 50, side)));
    }
    for (let col = 0; col <= 22; col++) {
      paths.push(Array.from({ length: 43 }, (_, i) => shell(i * Math.PI / 42, col * Math.PI / 22, side)));
    }
  }

  function project([x, y, z]) {
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const vertical = y * Math.cos(pitch) - depth * Math.sin(pitch);
    const perspective = 4 / (4 - y * Math.sin(pitch) - depth * Math.cos(pitch));
    const scale = Math.min(width / 2.7, height / 1.9) * perspective;
    return [width / 2 + side * scale, height / 2 + vertical * scale];
  }

  function draw() {
    if (!ctx || !width || !height) return;
    const theme = getComputedStyle(explorer);
    const accent = theme.getPropertyValue("--accent").trim();
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.65;
    ctx.globalAlpha = 0.46;
    for (const path of paths) {
      ctx.beginPath();
      path.forEach((point, i) => {
        const [x, y] = project(point);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    targets = markers.map((marker) => {
      const [x, y] = project(marker.point);
      const chosen = marker.button === active;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, chosen ? 25 : 17);
      glow.addColorStop(0, accent);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = chosen ? 0.9 : 0.62;
      ctx.fillStyle = glow;
      ctx.fillRect(x - 25, y - 25, 50, 50);
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.strokeStyle = theme.getPropertyValue("--background").trim();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, chosen ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return { x, y, button: marker.button };
    });
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
    note.textContent = button ? button.textContent + " — " + button.dataset.note : "Select a region to see what was reported.";
    draw();
  }

  function changeExperience(next) {
    experience = next;
    for (const section of sections) section.hidden = section.dataset.experience !== next;
    const shown = sections.find((section) => !section.hidden);
    markers = [...shown.querySelectorAll("[data-point]")].map((button) => ({
      button, point: button.dataset.point.split(",").map(Number),
    }));
    select(null);
    updateScenario();
  }

  explorer.addEventListener("change", (event) => {
    if (event.target.name === "brain-experience") changeExperience(event.target.value);
  });
  explorer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-point]");
    if (button) select(button);
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
      draw();
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
    let closest;
    let threshold = 17;
    for (const target of targets) {
      const distance = Math.hypot(target.x - x, target.y - y);
      if (distance < threshold) {
        closest = target;
        threshold = distance;
      }
    }
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
    draw();
  });
  resize();
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
