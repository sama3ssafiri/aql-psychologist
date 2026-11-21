(() => {
  const root = document.querySelector(".cv-page");
  if (!root) return;
  const links = [...root.querySelectorAll(".cv-toc a")];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const progress = root.querySelector(".cv-scroll-progress > span");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = -1, scrollFrame = 0;
  const story = root.querySelector(".cv-story");
  const thread = root.querySelector(".cv-reading-thread > span");
  const process = [...root.querySelectorAll(".cv-process li")];
  const clamp = value => Math.max(0, Math.min(1, value));
  const revealItems = [...root.querySelectorAll(".cv-section-heading, .cv-presentation-grid, .cv-approach, .cv-process li, .cv-example, .cv-resource, .cv-roles li, .cv-closing")];
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("cv-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: "0px 0px 24px 0px" });
    revealItems.forEach(item => { item.classList.add("cv-reveal"); observer.observe(item); });
  }
  root.addEventListener("focusin", event => {
    event.target.closest(".cv-reveal")?.classList.add("cv-revealed");
  });
  function showEverything() { revealItems.forEach(item => item.classList.add("cv-revealed")); }

  function update() {
    scrollFrame = 0;
    const readingLine = innerHeight * 0.36;
    let next = 0;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= readingLine) next = i; });
    if (next !== active) {
      active = next;
      sections.forEach((section, i) => section?.classList.toggle("cv-section-active", i === active));
      links.forEach((link, i) => {
        if (i === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

    }
    const bounds = root.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, -bounds.top / Math.max(1, bounds.height - innerHeight)));
    progress.style.transform = `scaleX(${fraction})`;
    if (thread && story) {
      const rect = story.getBoundingClientRect();
      const distance = clamp((readingLine - rect.top) / Math.max(1, rect.height));
      thread.style.transform = `scaleY(${distance})`;
      thread.parentElement.style.setProperty("--thread-position", `${distance * 100}%`);
    }
    process.forEach(step => {
      const rect = step.getBoundingClientRect();
      const amount = reduceMotion.matches ? 1 : clamp((innerHeight * .82 - rect.top) / Math.max(100, rect.height));
      step.style.setProperty("--wire-progress", amount);
      step.classList.toggle("cv-step-active", rect.top < innerHeight * .65 && rect.bottom > innerHeight * .25);
    });
  }

  function schedule() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  reduceMotion.addEventListener("change", () => { if (reduceMotion.matches) showEverything(); schedule(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  new ResizeObserver(schedule).observe(root);
  update();

  // Keep a printable CV useful even when the on-screen examples are collapsed.
  const details = [...root.querySelectorAll("details")];
  let printState = null;
  window.addEventListener("beforeprint", () => {
    showEverything();
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
