/* Recorded classification, not an inferred evolutionary tree. */
(function (root) {
  const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
  function build(records) {
    const tree = {label:'All organisms', rank:'root', ids:[], children:new Map(), path:[]};
    for (const record of records) {
      let node = tree; node.ids.push(record.id);
      for (const [rank, name] of [['group', record.group || 'Unplaced organisms'], ...ranks.map(rank => [rank, record.taxonomy?.[rank] || ''])]) {
        const key = JSON.stringify([rank, name]);
        if (!node.children.has(key)) node.children.set(key, {label:name || rank[0].toUpperCase()+rank.slice(1)+' not recorded', rank, missing:!name, ids:[], children:new Map(), path:[...node.path,[rank,name]]});
        node = node.children.get(key); node.ids.push(record.id);
      }
      node.children.set(JSON.stringify(['species',record.id]), {label:record.commonName || record.scientificName, scientificName:record.scientificName, rank:'species', ids:[record.id], children:new Map(), path:[...node.path,['species',record.id]], record});
    }
    return tree;
  }
  function children(node) { return [...node.children.values()].sort((a,b)=>a.label.localeCompare(b.label)); }
  const api = {build, children, ranks};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClassificationTree = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
