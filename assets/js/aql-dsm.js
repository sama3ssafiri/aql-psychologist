(() => {
  const explorer = document.querySelector('.dsm');
  if (!explorer) return;

  const search = explorer.querySelector('#dsm-search');
  const wheel = explorer.querySelector('.dsm-wheel');
  const count = explorer.querySelector('.dsm-count');
  const panel = explorer.querySelector('#dsm-entry-panel');
  const heading = panel.querySelector('h3');
  const selection = panel.querySelector('.dsm-selection');
  const open = explorer.querySelector('.dsm-open');
  const prev = explorer.querySelector('.dsm-prev');
  const next = explorer.querySelector('.dsm-next');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const index = [...explorer.querySelectorAll('.dsm-entry')].map(entry => ({
    name: entry.querySelector('summary').textContent.trim(),
    chapter: entry.closest('.dsm-branch').querySelector('summary').textContent.trim(),
    content: entry.querySelector('.dsm-entry-content')
  }));
  let visible = [];
  let rows = [];
  let current = 0;
  let frame = 0;

  function sync() {
    frame = 0;
    if (!rows.length) return;
    const distance = rows[0].offsetHeight;
    const position = distance ? wheel.scrollTop / distance : 0;
    current = Math.max(0, Math.min(rows.length - 1, Math.round(position)));
    rows.forEach((row, i) => {
      const weight = Math.max(0, 1 - Math.abs(position - i) / 1.5);
      row.style.setProperty('--weight', weight.toFixed(2));
      if (i === current) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    prev.disabled = current === 0;
    next.disabled = current === rows.length - 1;
  }

  function centre(i, smooth = true) {
    if (!rows.length) return;
    const target = Math.max(0, Math.min(rows.length - 1, i));
    wheel.scrollTo({ top: target * rows[0].offsetHeight, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
  }

  function close(restoreFocus = false) {
    panel.hidden = true;
    selection.replaceChildren();
    open.setAttribute('aria-expanded', 'false');
    if (restoreFocus) open.focus();
  }

  function show(i) {
    const entry = visible[i];
    if (!entry) return;
    centre(i, false);
    sync();
    heading.textContent = entry.name;
    selection.replaceChildren(entry.content.cloneNode(true));
    panel.hidden = false;
    open.setAttribute('aria-expanded', 'true');
    heading.focus();
  }

  function filter() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    visible = index.filter(entry => words.every(word => (entry.name + ' ' + entry.chapter).toLowerCase().includes(word)));
    rows = visible.map((entry, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.name;
      button.addEventListener('click', () => show(i));
      return button;
    });
    wheel.replaceChildren(...rows);
    wheel.hidden = !rows.length;
    open.parentElement.hidden = !rows.length;
    count.textContent = words.length ? visible.length + (visible.length === 1 ? ' matching entry' : ' matching entries') : '';
    close();
    centre(0, false);
    sync();
  }

  wheel.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
  }, { passive: true });
  wheel.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      centre(current + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && event.target === wheel) {
      event.preventDefault();
      show(current);
    }
  });
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && rows.length) show(current);
  });
  prev.addEventListener('click', () => centre(current - 1));
  next.addEventListener('click', () => centre(current + 1));
  open.addEventListener('click', () => show(current));
  panel.querySelector('.dsm-close').addEventListener('click', () => close(true));
  explorer.querySelector('.dsm-tools').hidden = false;
  filter();
  explorer.querySelector('.dsm-tree').hidden = true;
})();
