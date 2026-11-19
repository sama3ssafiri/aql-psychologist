(() => {
  const root = document.querySelector(".cv-page");
  if (!root) return;
  const links = [...root.querySelectorAll(".cv-toc a")];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const progress = root.querySelector(".cv-scroll-progress > span");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = 0, scrollFrame = 0;

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
    progress.style.transform = `scaleY(${fraction})`;
  }

  function schedule() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reduceMotion.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  new ResizeObserver(schedule).observe(root);
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
