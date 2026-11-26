(() => {
  const explorer = document.querySelector('.dsm');
  if (!explorer) return;

  const search = explorer.querySelector('#dsm-search');
  const status = explorer.querySelector('.dsm-count');
  const panel = explorer.querySelector('.dsm-panel');
  const heading = panel.querySelector('h3');
  const selection = panel.querySelector('.dsm-selection');
  const branches = [...explorer.querySelectorAll('.dsm-branch')];
  const wide = matchMedia('(min-width: 760px)');
  const saved = new Map();
  let active;

  function titleOf(detail) {
    return detail.querySelector('summary').firstChild.textContent.trim();
  }

  function select(entry) {
    active?.removeAttribute('data-selected');
    active = entry;
    entry?.setAttribute('data-selected', '');
    heading.textContent = entry ? titleOf(entry) : 'Choose a diagnosis';
    selection.replaceChildren();
    if (entry) selection.append(entry.querySelector('.dsm-entry-content').cloneNode(true));
  }

  function setLayout() {
    panel.hidden = !wide.matches;
    explorer.classList.toggle('dsm-wide', wide.matches);
  }

  explorer.querySelectorAll('.dsm-entry').forEach(entry => {
    entry.addEventListener('toggle', () => {
      if (entry.open) {
        const previous = active;
        select(entry);
        if (previous && previous !== entry) previous.open = false;
      } else if (active === entry) select(null);
    });
  });

  function filter() {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const branch of branches) {
      let matches = 0;
      const chapter = titleOf(branch).toLowerCase();
      for (const item of branch.querySelectorAll('li')) {
        const title = titleOf(item.querySelector('details')).toLowerCase();
        const visible = words.every(word => (chapter + ' ' + title).includes(word));
        item.hidden = !visible;
        if (visible) matches += 1;
      }
      branch.hidden = matches === 0;
      count += matches;
      if (words.length) {
        if (!saved.has(branch)) saved.set(branch, branch.open);
        branch.open = matches > 0;
      } else if (saved.has(branch)) {
        branch.open = saved.get(branch);
      }
    }
    if (!words.length) saved.clear();
    if (active?.closest('li').hidden) {
      active.open = false;
      select(null);
    }
    status.textContent = words.length ? count + (count === 1 ? ' matching entry' : ' matching entries') : '';
  }

  explorer.querySelector('.dsm-tools').hidden = false;
  search.addEventListener('input', filter);
  wide.addEventListener('change', setLayout);
  setLayout();
})();
