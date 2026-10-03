// Static, source-backed inventory. No external API or database server required.
(() => {
  const search = document.querySelector('#search');
  const results = document.querySelector('.browse-grid');
  const filters = [...document.querySelectorAll('.filter')];
  const count = document.querySelector('#count');
  const empty = document.querySelector('#empty');
  let records = [], sources = [], group = 'All', ready = false, page = 0;
  const pageSize = 24;
  const pager = elPager();
  function elPager() {
    const nav = document.createElement('nav'); nav.className = 'inventory-pagination'; nav.setAttribute('aria-label', 'Inventory result pages');
    results.after(nav); return nav;
  }
  const normalise = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
  function render() {
    if (!ready) return;
    const query = normalise(search.value);
    const tokens = query.split(' ').filter(Boolean);
    const eligible = records.filter(r => group === 'All' || r.group === group);
    const exact = query ? eligible.filter(r => [r.scientificName, r.sourceName, r.commonName, ...(r.aliases || [])].some(name => normalise(name) === query)) : [];
    const matched = exact.length ? exact : eligible.filter(r => tokens.every(t => r.searchText.includes(t)));
    const fragment = document.createDocumentFragment();
    const pages = Math.ceil(matched.length / pageSize);
    page = Math.max(0, Math.min(page, pages - 1));
    matched.slice(page * pageSize, (page + 1) * pageSize).forEach(r => {
      const card = el('article', '', 'inventory-card');
      card.append(el('span', r.group + ' / ' + r.rank, 'eyebrow'), el('h3', r.commonName || r.scientificName));
      if (r.commonName) card.append(el('p', r.scientificName, 'inventory-name'));
      if (r.description) card.append(el('p', r.description));
      if (r.review === 'Provisional identification') card.append(el('span', 'Identification uncertain', 'inventory-review'));
      const details = el('details');
      details.append(el('summary', 'Species information'));
      details.append(el('p', 'Group: ' + r.group));
      if (r.distribution) details.append(el('p', 'Distribution in Uganda: ' + r.distribution));
      if (r.lifeForm) details.append(el('p', 'Life form: ' + r.lifeForm));
      if (r.habitat) details.append(el('p', 'Habitat: ' + r.habitat));
      if (r.taxonomy && r.taxonomy.family) details.append(el('p', 'Family: ' + r.taxonomy.family));
      if (r.taxonomy && r.taxonomy.order) details.append(el('p', 'Order: ' + r.taxonomy.order));
      if (r.establishment && r.establishment.length) details.append(el('p', 'Occurrence: ' + r.establishment.join(' / ')));
      card.append(details);
      fragment.append(card);
    });
    results.replaceChildren(fragment);
    count.textContent = matched.length + ' inventory ' + (matched.length === 1 ? 'entry' : 'entries') + ' / ' + records.length + ' loaded';
    empty.hidden = matched.length !== 0;
    pager.replaceChildren();
    if (pages > 1) {
      const previous = el('button', 'Previous'); previous.type = 'button'; previous.disabled = page === 0;
      const next = el('button', 'Next'); next.type = 'button'; next.disabled = page === pages - 1;
      const move = step => { page += step; render(); document.querySelector('#browse').scrollIntoView({block:'start'}); };
      previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
      pager.append(previous, el('span', 'Page ' + (page + 1) + ' of ' + pages), next);
    }
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === group)));
  }
  search.addEventListener('input', () => { page = 0; render(); });
  document.querySelector('#search-form').addEventListener('submit', event => {
    event.preventDefault(); render();
    document.querySelector('#browse').scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  });
  const bindFilter = button => button.addEventListener('click', () => { group = button.dataset.filter; page = 0; render(); });
  filters.forEach(bindFilter);
  document.querySelector('#reset').addEventListener('click', () => { search.value = ''; group = 'All'; page = 0; render(); search.focus(); });
  count.textContent = 'Loading species inventory…';
  fetch('data/species.json').then(response => {
    if (!response.ok) throw new Error('Inventory unavailable');
    return response.json();
  }).then(data => {
    if (data.schemaVersion !== 1 || !Array.isArray(data.records) || !Array.isArray(data.sources)) throw new Error('Invalid inventory');
    records = data.records.map(r => ({...r, searchText: normalise([r.scientificName, r.sourceName, r.commonName, r.group, r.lifeForm, ...(r.aliases || [])].join(' '))}));
    sources = data.sources; ready = true; render();
    const groups = [...new Set(records.map(r => r.group))];
    groups.filter(g => !filters.some(b => b.dataset.filter === g)).forEach(g => {
      const button = el('button', g, 'filter'); button.type = 'button'; button.dataset.filter = g; button.setAttribute('aria-pressed', 'false');
      document.querySelector('.filters').append(button); filters.push(button); bindFilter(button);
    });
  }).catch(() => {
    count.textContent = 'The inventory could not load. Reload the page or download the inventory below.';
    results.replaceChildren(); empty.hidden = true;
  });
})();
