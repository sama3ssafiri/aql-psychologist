(() => {
  const explorer = document.querySelector('.dsm');
  if (!explorer) return;

  const search = explorer.querySelector('#dsm-search');
  const status = explorer.querySelector('.dsm-count');
  const map = explorer.querySelector('.dsm-map');
  const path = explorer.querySelector('.dsm-path');
  const reset = explorer.querySelector('.dsm-reset');
  const manual = explorer.querySelector('.dsm-sources a');
  const titleOf = details => details.querySelector('summary').firstChild.textContent.trim();
  const chapters = [...explorer.querySelectorAll('.dsm-branch')].map(branch => ({
    title: titleOf(branch),
    entries: [...branch.querySelectorAll('.dsm-entry')].map(entry => ({
      title: titleOf(entry),
      evidence: entry.querySelector('.dsm-entry-content'),
      hasEvidence: !!entry.querySelector('.dsm-evidence-mark')
    }))
  }));

  const prompts = new Map([
    ['Post-traumatic stress disorder (PTSD)', 'What would help you distinguish trauma reminders from current danger? What might you miss if you only ask about intrusive memories?'],
    ['Obsessive-compulsive disorder (OCD)', 'What happens immediately after a ritual? How might that short-term relief help explain why the cycle continues?'],
    ['Major depressive disorder', 'Which routines or relationships have become harder to engage with? What information would help you explore the timing of those changes?'],
    ['Schizophrenia', 'How could you understand what an experience means to the person while also exploring its effect on their everyday life?']
  ]);
  const topics = ['Assessment', 'Discussion', 'Treatment evidence'];
  let chapter = null;
  let entry = null;
  let topic = null;
  let firstResult;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function column(label, items, selected, onSelect, getTitle = item => item.title) {
    const region = element('section', 'dsm-map-column');
    region.append(element('h3', '', label));
    const list = element('ul', 'dsm-nodes');
    for (const item of items) {
      const row = element('li', '');
      const button = element('button', 'dsm-node', getTitle(item));
      button.type = 'button';
      button.setAttribute('aria-expanded', String(item === selected));
      if (item.hasEvidence) {
        const mark = element('span', 'dsm-evidence-mark', '●');
        mark.setAttribute('aria-label', 'Treatment evidence available');
        button.append(mark);
      }
      button.addEventListener('click', () => onSelect(item));
      row.append(button);
      list.append(row);
    }
    region.append(list);
    map.append(region);
    return region;
  }

  function showTopic() {
    const region = element('section', 'dsm-map-column dsm-map-reading');
    const heading = element('h3', '', topic);
    heading.tabIndex = -1;
    region.append(heading, element('p', 'dsm-chapter', entry.title));
    if (topic === 'Treatment evidence') {
      const evidence = entry.evidence.cloneNode(true);
      evidence.querySelector('.dsm-chapter')?.remove();
      evidence.querySelector('h4')?.remove();
      region.append(evidence);
    } else if (topic === 'Assessment') {
      region.append(element('p', '', 'What would you need to clarify about the person’s history, context and everyday functioning before interpreting this presentation?'));
      region.append(manual.cloneNode(true));
    } else {
      region.append(element('p', '', prompts.get(entry.title) ??
        'What else could explain a similar presentation? What information would help you distinguish those possibilities?'));
      region.append(element('p', 'dsm-chapter', 'A study prompt for notes or supervision.'));
    }
    map.append(region);
    return heading;
  }

  function render(focusLevel) {
    const priorOffset = map.scrollLeft;
    const listOffsets = [...map.querySelectorAll('.dsm-nodes')].map(list => list.scrollTop);
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const results = chapters.map(group => ({
      group,
      entries: group.entries.filter(item => words.every(word =>
        (group.title + ' ' + item.title).toLowerCase().includes(word)
      ))
    })).filter(result => result.entries.length);
    const current = results.find(result => result.group === chapter);
    if (!current) chapter = entry = topic = null;
    else if (!current.entries.includes(entry)) entry = topic = null;

    status.textContent = words.length
      ? results.reduce((total, result) => total + result.entries.length, 0) + ' matching entries'
      : '';
    path.textContent = ['DSM‑5‑TR', chapter?.title, entry?.title, topic].filter(Boolean).join(' / ');
    map.replaceChildren();
    firstResult = results[0]?.group;
    const levels = [];
    const chaptersColumn = column('Chapters', results.map(result => result.group), chapter, chosen => {
      chapter = chapter === chosen ? null : chosen;
      entry = topic = null;
      render(chapter ? 1 : 0);
    });
    levels.push(chaptersColumn);
    if (!results.length) chaptersColumn.append(element('p', '', 'No matches. Try a different term.'));
    if (chapter) levels.push(column('Entries', current.entries, entry, chosen => {
      entry = entry === chosen ? null : chosen;
      topic = null;
      render(entry ? 2 : 1);
    }));
    if (entry) levels.push(column('Explore this entry', topics, topic, chosen => {
      topic = topic === chosen ? null : chosen;
      render(topic ? 3 : 2);
    }, item => item));
    if (topic) levels.push(showTopic());

    map.querySelectorAll('.dsm-nodes').forEach((list, index) => {
      if (focusLevel === undefined || index < focusLevel) list.scrollTop = listOffsets[index] ?? 0;
    });
    map.scrollLeft = priorOffset;
    const level = levels[focusLevel];
    const target = level?.matches('h3') ? level : (level?.querySelector('[aria-expanded="true"]') ?? level?.querySelector('.dsm-node'));
    if (target) {
      target.focus({ preventScroll: true });
      const columnBounds = level.getBoundingClientRect();
      const mapBounds = map.getBoundingClientRect();
      if (columnBounds.right > mapBounds.right || columnBounds.left < mapBounds.left) {
        map.scrollLeft += columnBounds.left - mapBounds.left;
      }
    }
  }

  search.addEventListener('input', () => render());
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter' && firstResult) {
      chapter = firstResult;
      entry = topic = null;
      render(1);
    }
  });
  reset.addEventListener('click', () => {
    search.value = '';
    chapter = entry = topic = null;
    map.scrollLeft = 0;
    render();
    search.focus();
  });
  render();
  explorer.querySelector('.dsm-columns').hidden = true;
  explorer.querySelector('.dsm-tools').hidden = false;
  explorer.querySelector('.dsm-map-tools').hidden = false;
  map.hidden = false;
})();
