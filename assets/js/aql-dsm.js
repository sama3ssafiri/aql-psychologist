(() => {
  const explorer = document.querySelector('.dsm');
  if (!explorer) return;

  const search = explorer.querySelector('#dsm-search');
  const status = explorer.querySelector('.dsm-count');
  const map = explorer.querySelector('.dsm-map');
  const reading = explorer.querySelector('.dsm-reading');
  const trail = explorer.querySelector('.dsm-path');
  const manual = explorer.querySelector('.dsm-sources a');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const summary = detail => detail.querySelector('summary').firstChild.textContent.trim();
  const chapters = [...explorer.querySelectorAll('.dsm-branch')].map((branch, index) => ({
    id: 'chapter-' + index,
    title: summary(branch),
    entries: [...branch.querySelectorAll('.dsm-entry')].map((node, item) => ({
      id: 'entry-' + index + '-' + item,
      title: summary(node),
      evidence: node.querySelector('.dsm-entry-content')
    }))
  }));

  const studyPrompts = new Map([
    ['Post-traumatic stress disorder (PTSD)', 'What would help you distinguish trauma reminders from current danger? What might you miss if you only ask about intrusive memories?'],
    ['Obsessive-compulsive disorder (OCD)', 'What happens immediately after a ritual? How might that short-term relief help explain why the cycle continues?'],
    ['Major depressive disorder', 'Which routines or relationships have become harder to engage with? What information would help you explore the timing of those changes?'],
    ['Schizophrenia', 'How could you explore what an experience means to the person and how it affects their everyday life?']
  ]);
  const ocdName = 'Obsessive-compulsive disorder (OCD)';
  const ocdSource = 'https://www.merckmanuals.com/professional/psychiatric-disorders/obsessive-compulsive-and-related-disorders/obsessive-compulsive-disorder-ocd';
  const ocdLeaves = [
    ['Obsessions or compulsions', 'The assessment considers recurring unwanted mental experiences, repeated actions or mental rituals, or a combination of these.'],
    ['Impact', 'Ask how much time the experiences take up and how they affect distress, relationships, work or other routines.'],
    ['Rule-outs', 'Consider whether a substance, medication, medical condition or another mental disorder better accounts for the presentation.']
  ];
  const root = { id: 'root', title: 'DSM‑5‑TR' };
  const criteria = { id: 'criteria', title: 'Criteria' };
  const topics = [criteria, { id: 'assessment', title: 'Assessment' }, { id: 'discussion', title: 'Discussion' }, { id: 'treatment', title: 'Treatment evidence' }];
  let expanded = false;
  let chapter;
  let entry;
  let topic;
  let leaf;
  let visibleIds = new Set();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function svgElement(tag, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function results() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const groups = chapters.map(group => ({
      ...group,
      entries: group.entries.filter(item => words.every(word => (group.title + ' ' + item.title).toLowerCase().includes(word)))
    })).filter(group => group.entries.length);
    status.textContent = words.length ? groups.reduce((sum, group) => sum + group.entries.length, 0) + ' matching entries' : '';
    return groups;
  }

  function showReading() {
    reading.replaceChildren();
    reading.hidden = !entry || !topic || (topic === criteria && entry.title === ocdName && !leaf);
    if (reading.hidden) return;

    reading.append(element('h3', '', leaf?.title ?? topic.title), element('p', 'dsm-chapter', entry.title));
    if (topic.id === 'treatment') {
      const content = entry.evidence.cloneNode(true);
      content.querySelector('.dsm-chapter')?.remove();
      content.querySelector('h4')?.remove();
      reading.append(content);
    } else if (topic === criteria) {
      reading.append(element('p', '', leaf?.text ?? 'Criteria notes have not yet been added for this entry. See the manual for the complete criteria.'));
      if (leaf) {
        reading.append(element('p', 'dsm-chapter', 'Study summary. Use the manual for the full diagnostic criteria.'));
        const source = element('a', '', 'Merck Manual clinical reference');
        source.href = ocdSource;
        reading.append(source, document.createTextNode(' · '));
      }
      reading.append(manual.cloneNode(true));
    } else if (topic.id === 'discussion') {
      reading.append(element('p', '', studyPrompts.get(entry.title) ??
        'What else could explain a similar presentation? What information would help distinguish those possibilities?'));
    } else {
      reading.append(element('p', '', 'What would you need to clarify about the person’s history, context and everyday functioning before interpreting this presentation?'), manual.cloneNode(true));
    }
  }

  function choose(node) {
    if (node.depth === 0) {
      expanded = !expanded;
      chapter = entry = topic = leaf = null;
    } else if (node.depth === 1) {
      chapter = chapter?.id === node.id ? null : node;
      entry = topic = leaf = null;
    } else if (node.depth === 2) {
      entry = entry?.id === node.id ? null : node;
      topic = leaf = null;
    } else if (node.depth === 3) {
      topic = topic?.id === node.id ? null : topics.find(item => item.id === node.id);
      leaf = null;
    } else {
      leaf = leaf?.id === node.id ? null : node;
    }
    render(node.id);
  }

  function render(focusId) {
    const groups = results();
    const selectedGroup = groups.find(group => group.id === chapter?.id);
    if (!selectedGroup) chapter = entry = topic = leaf = null;
    else if (!selectedGroup.entries.some(item => item.id === entry?.id)) entry = topic = leaf = null;

    trail.textContent = [root.title, chapter?.title, entry?.title, topic?.title, leaf?.title].filter(Boolean).join(' / ');
    const nodes = [];
    let row = 0;
    const columnWidth = 222;
    const rowHeight = 70;

    function place(item, depth, parent, children) {
      const node = { ...item, depth, parent, x: 25 + depth * columnWidth };
      nodes.push(node);
      const descendants = children?.(node) ?? [];
      node.children = descendants;
      node.y = descendants.length && depth > 0 ? (descendants.at(0).y + descendants.at(-1).y) / 2 : 38 + row * rowHeight;
      if (!descendants.length) row += 1;
      if (depth === 0) node.y = 38;
      return node;
    }

    place(root, 0, null, origin => expanded ? groups.map(group =>
      place(group, 1, origin, parent => group.id === chapter?.id ? group.entries.map(item =>
        place(item, 2, parent, diagnosis => item.id === entry?.id ? topics.map(subject =>
          place(subject, 3, diagnosis, branch => subject === criteria && topic === criteria && item.title === ocdName
            ? ocdLeaves.map(([title, text], index) => place({ id: 'criterion-' + index, title, text }, 4, branch))
            : [])
        ) : [])
      ) : [])
    ) : []);

    const width = Math.max(...nodes.map(node => node.x)) + 195;
    const height = Math.max(165, row * rowHeight + 20);
    const stage = element('div', 'dsm-stage');
    stage.style.width = width + 'px';
    stage.style.height = height + 'px';
    const svg = svgElement('svg', { class: 'dsm-wires', width, height, 'aria-hidden': 'true' });
    stage.append(svg);
    const selected = new Set([root.id, chapter?.id, entry?.id, topic?.id, leaf?.id]);

    for (const node of nodes) {
      const fresh = focusId && !visibleIds.has(node.id) && !motion.matches;
      if (node.parent) {
        const start = node.parent.x + 158;
        const middle = (start + node.x) / 2;
        const curve = `M ${start} ${node.parent.y} C ${middle + 16} ${node.parent.y}, ${middle - 16} ${node.y}, ${node.x} ${node.y}`;
        svg.append(svgElement('path', {
          d: curve,
          pathLength: '1',
          class: 'dsm-wire' + (selected.has(node.id) ? ' is-lit' : '') + (fresh ? ' is-growing' : '')
        }));
        if (fresh) {
          const pulse = svgElement('circle', { r: '3', class: 'dsm-pulse' });
          pulse.append(svgElement('animateMotion', { path: curve, dur: '.42s', fill: 'freeze' }));
          svg.append(pulse);
        }
      }
      const button = element('button', 'dsm-node' + (fresh ? ' is-new' : ''), node.title);
      button.type = 'button';
      button.style.left = node.x + 'px';
      button.style.top = node.y + 'px';
      button.dataset.node = node.id;
      if (node.depth < 3 || (node.id === 'criteria' && entry?.title === ocdName)) {
        button.setAttribute('aria-expanded', String(node.depth === 0 ? expanded : selected.has(node.id)));
      } else {
        button.setAttribute('aria-pressed', String(selected.has(node.id)));
      }
      if (selected.has(node.id)) button.classList.add('is-lit');
      button.addEventListener('click', () => choose(node));
      stage.append(button);
    }

    visibleIds = new Set(nodes.map(node => node.id));
    const left = map.scrollLeft;
    const top = map.scrollTop;
    map.replaceChildren(stage);
    map.scrollTo(left, top);
    const focused = nodes.find(node => node.id === focusId);
    if (focused) {
      stage.querySelector('[data-node="' + focused.id + '"]').focus({ preventScroll: true });
      const next = focused.depth === 0 ? focused : focused.children[Math.floor(focused.children.length / 2)] ?? focused;
      map.scrollTo({
        left: next.x + 170 > left + map.clientWidth ? Math.max(0, next.x - 45) : left,
        top: Math.max(0, next.y - map.clientHeight / 2),
        behavior: motion.matches ? 'instant' : 'smooth'
      });
    }
    showReading();
  }

  search.addEventListener('input', () => {
    expanded = search.value.trim().length > 0;
    chapter = entry = topic = leaf = null;
    map.scrollTo(0, 0);
    render();
  });
  search.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const first = results()[0];
    if (!first) return;
    expanded = true;
    chapter = first;
    entry = topic = leaf = null;
    render(chapter.id);
  });
  explorer.querySelector('.dsm-reset').addEventListener('click', () => {
    search.value = '';
    expanded = false;
    chapter = entry = topic = leaf = null;
    render('root');
    map.scrollTo(0, 0);
  });
  render();
  explorer.querySelector('.dsm-columns').hidden = true;
  explorer.querySelector('.dsm-tools').hidden = false;
  explorer.querySelector('.dsm-map-tools').hidden = false;
  map.hidden = false;
})();
