(() => {
  const root = document.querySelector(".cv-page");
  if (!root) return;
  const links = [...root.querySelectorAll(".cv-toc a")];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const progress = root.querySelector(".cv-scroll-progress > span");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = root.querySelector(".cv-neural-background");
  const ctx = canvas?.getContext("2d");
  let active = 0, scrollFrame = 0;
  let width = 0, height = 0, nodes = [], segments = [];
  let accent = "#b6a5ff";

  // One continuous neural route in document space, rather than a floating sidebar object.
  function buildNetwork() {
    if (!ctx) return;
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    const bounds = root.getBoundingClientRect();
    const count = Math.max(5, Math.ceil(bounds.height / 650));
    const mobile = width < 761;
    nodes = Array.from({ length: count }, (_, i) => ({
      x: width * (i % 2 ? (mobile ? .94 : .92) : (mobile ? .06 : .12)),
      y: 140 + i * (bounds.height - 280) / (count - 1),
      r: mobile ? 26 : 43,
    }));
    segments = nodes.slice(1).map((node, i) => {
      const from = nodes[i];
      return { from, to: node, points: Array.from({ length: 81 }, (_, j) => {
        const t = j / 80, ease = t * t * (3 - 2 * t);
        return { x: from.x + (node.x - from.x) * ease, y: from.y + (node.y - from.y) * t };
      }) };
    });
  }
  function stroke(points, alpha, lineWidth = 1) {
    if (!points.length) return;
    ctx.globalAlpha = alpha; ctx.lineWidth = lineWidth; ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  }
  function drawNetwork(bounds, fraction) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (bounds.bottom < 0 || bounds.top > height) return;
    ctx.save(); ctx.translate(0, bounds.top); ctx.strokeStyle = accent; ctx.fillStyle = accent;
    // The reading position moves the signal down the connected route; stopping scroll stops it.
    const position = fraction * segments.length;
    segments.forEach((segment, index) => {
      if (segment.to.y + bounds.top < -100 || segment.from.y + bounds.top > height + 100) return;
      // A small physical gap in each axon makes the synaptic connection legible.
      stroke(segment.points.slice(4, 39), .12);
      stroke(segment.points.slice(41, 77), .12);
      if (!reduceMotion.matches && position >= index && position < index + 1) {
        const head = Math.round((position - index) * 80);
        for (let j = Math.max(4, head - 12); j < Math.min(head, 76); j++) {
          if (j === 38 || j === 39 || j === 40) continue;
          const strength = (j - head + 13) / 13;
          ctx.shadowColor = accent; ctx.shadowBlur = 9 * strength;
          stroke(segment.points.slice(j, j + 2), .5 * strength, 1.6);
        }
        ctx.shadowBlur = 0;
      }
    });
    nodes.forEach((node, i) => {
      if (node.y + bounds.top < -180 || node.y + bounds.top > height + 180) return;
      const ring = Array.from({ length: 8 }, (_, j) => {
        const angle = j * Math.PI / 4 + i * .3;
        return { x: node.x + Math.cos(angle) * node.r, y: node.y + Math.sin(angle) * node.r * .75 };
      });
      const energized = !reduceMotion.matches && Math.abs(position - i) < .14;
      stroke([...ring, ring[0]], energized ? .38 : .19);
      ring.forEach((p, j) => {
        stroke([p, ring[(j + 3) % 8]], .085);
        const angle = j * Math.PI / 4 + i * .3;
        const tip = { x: node.x + Math.cos(angle) * node.r * 2.7, y: node.y + Math.sin(angle) * node.r * 2.5 };
        const bend = { x: (p.x + tip.x) / 2 + Math.sin(i + j) * 12, y: (p.y + tip.y) / 2 };
        stroke([p, bend, tip], .16);
        if (j % 2 === 0) stroke([bend, { x: tip.x + 15 * Math.sin(j + i), y: tip.y - 20 }], .12);
      });
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function update() {
    scrollFrame = 0;
    const readingLine = innerHeight * 0.36;
    let next = 0;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= readingLine) next = i; });
    if (next !== active) {
      active = next;
      links.forEach((link, i) => {
        if (i === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

    }
    const bounds = root.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - innerHeight)));
    drawNetwork(bounds, fraction);
    progress.style.transform = `scaleY(${fraction})`;
  }

  function schedule() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => { buildNetwork(); schedule(); });
  reduceMotion.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  new ResizeObserver(() => { buildNetwork(); schedule(); }).observe(root);
  new MutationObserver(() => { buildNetwork(); schedule(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  buildNetwork();
  update();

  // Keep a printable CV useful even when the on-screen examples are collapsed.
  const details = [...root.querySelectorAll("details")];
  let printState = null;
  window.addEventListener("beforeprint", () => {
    if (printState) return;
    printState = details.map(detail => detail.open);
    details.forEach(detail => detail.open = true);
  });
  window.addEventListener("afterprint", () => {
    if (!printState) return;
    details.forEach((detail, i) => detail.open = printState[i]);
    printState = null;
  });
  const print = root.querySelector("#cv-print");
  if (print) {
    print.hidden = false;
    print.addEventListener("click", () => window.print());
  }
})();
