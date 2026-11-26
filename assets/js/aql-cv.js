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
  // Text is present from the start; only its first visual entrance is animated.
  const revealItems = [...root.querySelectorAll(".cv-section-heading > *, .cv-card, .cv-approach, .cv-subheading, .cv-process li, .cv-example, .cv-resource, .cv-roles li, .cv-closing")];
  let revealObserver;
  function reveal(item, instant = false) {
    if (instant) item.classList.add("cv-write-instant");
    item.classList.add("cv-written");
    revealObserver?.unobserve(item);
  }
  function showEverything() { revealItems.forEach(item => reveal(item, true)); }
  const headings = root.querySelectorAll(".cv-section-heading h2, .cv-closing h3");
  headings.forEach(heading => heading.classList.add("cv-shimmer-title"));
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
    }, { threshold: 0, rootMargin: "0px 0px -28px 0px" });
    revealItems.forEach((item, index) => {
      // Content already visible on load never has to wait to become readable.
      const rect = item.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) return;
      item.style.setProperty("--cv-write-delay", `${(index % 3) * 45}ms`);
      item.classList.add("cv-write-ready");
      revealObserver.observe(item);
    });
  }
  root.addEventListener("focusin", event => {
    const item = event.target.closest(".cv-write-ready");
    if (item) reveal(item, true);
  });
  function revealAnchor() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    revealItems.filter(item => item === target || target.contains(item) || item.contains(target)).forEach(item => reveal(item, true));
  }
  window.addEventListener("hashchange", revealAnchor);
  links.forEach(link => link.addEventListener("click", () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target) revealItems.filter(item => target.contains(item)).forEach(item => reveal(item, true));
  }));
  document.addEventListener("beforematch", showEverything);
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") showEverything();
  });
  revealAnchor();

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
    if (progress) progress.style.transform = `scaleX(${fraction})`;
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
