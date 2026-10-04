(() => {
  const search=document.querySelector('#search'), results=document.querySelector('.browse-grid');
  const filters=[...document.querySelectorAll('.filter')], count=document.querySelector('#count'), empty=document.querySelector('#empty');
  const treeHost=document.querySelector('#classification-tree'), branchLabel=document.querySelector('#classification-selection');
  let records=[], group='All', selected=null, ready=false, limit=24, hierarchy;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
  const normalise=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const groupAnchor=value=>'group-'+value.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const more=el('div','','inventory-pagination');results.after(more);
  function choose(node) {selected=node;limit=24;render();results.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  function branch(node, autoOpen=false) {
    if(node.rank==='species') {
      const button=el('button',node.label,'classification-species');button.type='button';
      if(node.label!==node.scientificName)button.append(el('small',node.scientificName));
      button.addEventListener('click',()=>choose(node));return button;
    }
    const details=el('details','','classification-branch');
    if(node.rank==='group')details.id=groupAnchor(node.label);
    const summary=el('summary');summary.append(el('span',node.label),el('small',node.rank==='group'?'Group':node.rank));details.append(summary);
    let populated=false;
    details.addEventListener('toggle',()=>{
      if(!details.open||populated)return;populated=true;
      const body=el('div','','classification-children');
      if(node.rank==='group'||(['order','family','genus'].includes(node.rank)&&node.children.size>1)){
        const view=el('button','See species','classification-view');view.type='button';view.setAttribute('aria-label','See species in '+node.label);view.addEventListener('click',()=>choose(node));body.append(view);
      }
      ClassificationTree.children(node).forEach(child=>body.append(branch(child,autoOpen&&node.children.size===1)));details.append(body);
    });if(autoOpen)details.open=true;return details;
  }
  function drawTree() {
    document.querySelector('#classification-title').textContent=group==='All'?'Explore the branches of life.':'Browse '+group.toLowerCase()+'.';
    document.querySelector('#birds-tree-preview').hidden=group!=='Birds';
    treeHost.replaceChildren();
    ClassificationTree.children(hierarchy).filter(node=>group==='All'||node.label===group).forEach(node=>treeHost.append(branch(node,group!=='All')));
    if(!treeHost.childElementCount){const message=el('p','No entries in this group yet.');message.id=groupAnchor(group);treeHost.append(message);}
  }
  function render() {
    if(!ready)return;
    const query=normalise(search.value), tokens=query.split(' ').filter(Boolean), ids=selected?new Set(selected.ids):null;
    const eligible=records.filter(r=>(group==='All'||r.group===group)&&(!ids||ids.has(r.id)));
    const exact=query?eligible.filter(r=>[r.scientificName,r.commonName,...(r.aliases||[]),...(r.localNames||[]).map(n=>n.name)].some(name=>normalise(name)===query)):[];
    const matches=exact.length?exact:eligible.filter(r=>tokens.every(t=>r.searchText.includes(t)));
    const browsing=!query&&!selected;
    count.textContent=matches.length+' '+(query?'matching ':'')+'species currently in this catalogue';
    branchLabel.textContent=selected?'Selected: '+selected.path.map(p=>p[0]==='species'?selected.scientificName:(p[1]||p[0]+' not recorded')).join(' → '):'Browse by recorded classification, or search directly for a name.';
    results.replaceChildren();more.replaceChildren();
    empty.hidden=browsing||matches.length!==0;
    if(browsing)results.append(el('p','Choose a branch above to see its organisms.','classification-guide'));
    else matches.slice(0,limit).forEach(r=>{
      const card=el('article','','inventory-card');card.append(el('span',r.group+' / '+r.rank,'eyebrow'),el('h3',r.commonName||r.scientificName));
      if(r.commonName)card.append(el('p',r.scientificName,'inventory-name'));
      if(r.description)card.append(el('p',r.description));
      const details=el('details');details.append(el('summary','Species information'));
      if(r.distribution)details.append(el('p','Distribution in Uganda: '+r.distribution));
      if(r.habitat)details.append(el('p','Habitat: '+r.habitat));
      ClassificationTree.ranks.forEach(rank=>{if(r.taxonomy?.[rank])details.append(el('p',rank[0].toUpperCase()+rank.slice(1)+': '+r.taxonomy[rank]));});
      (r.localNames||[]).forEach(n=>details.append(el('p',n.name+' · '+n.language+(n.region?' · '+n.region:''))));
      for(const field of ['feeding','behaviour','breeding','conservation'])if(r[field])details.append(el('p',field[0].toUpperCase()+field.slice(1)+': '+r[field]));
      if(r.establishment?.length)details.append(el('p','Occurrence: '+r.establishment.join(' / ')));
      if(r.review==='Provisional identification')details.append(el('p','Identification uncertain'));
      card.append(details);results.append(card);
    });
    if(!browsing&&matches.length>limit){const button=el('button','Show more species');button.type='button';button.addEventListener('click',()=>{limit+=24;render();});more.append(button);}
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===group)));
  }
  search.addEventListener('input',()=>{selected=null;limit=24;render();});
  document.querySelector('#search-form').addEventListener('submit',event=>{event.preventDefault();render();document.querySelector('#browse').scrollIntoView({block:'start'});});
  function syncGroupRoute(){const url=new URL(location.href);if(group==='All')url.searchParams.delete('group');else url.searchParams.set('group',group);url.hash=group==='All'?'browse':groupAnchor(group);history.replaceState(null,'',url);}
  function bindFilter(button){button.addEventListener('click',()=>{group=button.dataset.filter;selected=null;limit=24;syncGroupRoute();drawTree();render();});}
  filters.forEach(bindFilter);
  document.querySelector('#classification-clear').addEventListener('click',()=>{selected=null;limit=24;render();});
  document.querySelector('#reset').addEventListener('click',()=>{search.value='';group='All';selected=null;limit=24;syncGroupRoute();drawTree();render();search.focus();});
  // Restore a group anchor after the asynchronous inventory changes page height.
  // Stop correcting once the visitor starts interacting with this page.
  let anchorInterrupted=false;
  for(const event of ['wheel','touchstart','pointerdown','keydown'])
    addEventListener(event,()=>{anchorInterrupted=true;},{passive:true});
  function alignInitialGroupAnchor(){
    if(anchorInterrupted||!ready)return;
    const id=location.hash.slice(1);
    if(!document.getElementById(id)?.matches('[id^="group-"]')&&!['browse','species-results','plants-world','birds-world','mammals-world','small-world','fungi-world','fish-world','amphibians-world','reptiles-world'].includes(id))return;
    requestAnimationFrame(()=>{if(!anchorInterrupted)document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'});});
  }
  addEventListener('load',alignInitialGroupAnchor);
  addEventListener('hashchange',()=>{anchorInterrupted=false;alignInitialGroupAnchor();});
  count.textContent='Loading species inventory…';
  fetch('data/species.json').then(response=>{if(!response.ok)throw Error('Inventory unavailable');return response.json();}).then(data=>{
    if(data.schemaVersion!==1||!Array.isArray(data.records))throw Error('Invalid inventory');
    records=data.records.map(r=>({...r,searchText:normalise([r.scientificName,r.commonName,r.group,...Object.values(r.taxonomy||{}),...(r.aliases||[]),...(r.localNames||[]).flatMap(n=>[n.name,n.language,n.region])].join(' '))}));
    hierarchy=ClassificationTree.build(records);
    [...new Set(records.map(r=>r.group))].filter(g=>!filters.some(b=>b.dataset.filter===g)).forEach(g=>{const button=el('button',g,'filter');button.type='button';button.dataset.filter=g;document.querySelector('.filters').append(button);filters.push(button);bindFilter(button);});
    const requestedGroup=new URLSearchParams(location.search).get('group');
    if(requestedGroup&&filters.some(button=>button.dataset.filter===requestedGroup))group=requestedGroup;
    const requestedName=new URLSearchParams(location.search).get('q');
    if(requestedName)search.value=requestedName.slice(0,256);
    ready=true;drawTree();render();alignInitialGroupAnchor();
  }).catch(()=>{count.textContent='The inventory could not load. Reload the page or download the inventory below.';treeHost.replaceChildren();results.replaceChildren();empty.hidden=true;});
})();
