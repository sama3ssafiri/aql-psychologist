(() => {
  const root = document.querySelector(".cv-page");
  if (!root) return;
  const links = [...root.querySelectorAll(".cv-toc a")];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const paths = [...root.querySelectorAll(".cv-vector-lines path")];
  const tips = [...root.querySelectorAll(".cv-vector-tips circle")];
  const caption = root.querySelector(".cv-stage-caption");
  const progress = root.querySelector(".cv-scroll-progress > span");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const shapes = [
    [[150,150,112,150,92,82,48,60],[150,150,188,150,208,82,252,60],[150,150,112,150,92,218,48,240],[150,150,188,150,208,218,252,240]],
    [[150,150,88,162,96,76,40,98],[150,150,212,162,204,76,260,98],[150,150,116,178,70,214,96,254],[150,150,184,178,230,214,204,254]],
    [[150,150,80,150,150,55,68,55],[150,150,220,150,150,55,232,55],[150,150,80,150,150,245,68,245],[150,150,220,150,150,245,232,245]],
    [[150,150,88,180,62,112,40,78],[150,150,172,92,220,95,258,48],[150,150,102,215,80,236,42,224],[150,150,210,195,224,218,262,190]],
    [[150,150,70,105,100,42,148,40],[150,150,195,70,258,100,260,148],[150,150,230,195,200,258,152,260],[150,150,105,230,42,200,40,152]],
  ];
  let current = shapes[0].map(path => [...path]);
  let active = 0;
  let scrollFrame = 0;
  let morphFrame = 0;

  function paint(points) {
    points.forEach((p, i) => {
      paths[i]?.setAttribute("d", `M${p[0]} ${p[1]} C${p[2]} ${p[3]} ${p[4]} ${p[5]} ${p[6]} ${p[7]}`);
      tips[i]?.setAttribute("cx", p[6]);
      tips[i]?.setAttribute("cy", p[7]);
    });
  }

  function morph(index) {
    if (morphFrame) cancelAnimationFrame(morphFrame);
    morphFrame = 0;
    const target = shapes[index % shapes.length];
    if (reduceMotion.matches || document.hidden) {
      current = target.map(path => [...path]);
      paint(current);
      return;
    }
    const from = current.map(path => [...path]);
    const start = performance.now();
    function frame(now) {
      const elapsed = Math.min(1, Math.max(0, (now - start) / 650));
      const eased = 1 - (1 - elapsed) ** 3;
      current = from.map((path, i) => path.map((n, j) => n + (target[i][j] - n) * eased));
      paint(current);
      morphFrame = elapsed < 1 ? requestAnimationFrame(frame) : 0;
    }
    morphFrame = requestAnimationFrame(frame);
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
      caption.textContent = links[active].dataset.caption;
      morph(active);
    }
    const bounds = root.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - innerHeight)));
    progress.style.transform = `scaleY(${fraction})`;
  }

  function schedule() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reduceMotion.addEventListener("change", () => morph(active));
  document.addEventListener("visibilitychange", () => morph(active));
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
