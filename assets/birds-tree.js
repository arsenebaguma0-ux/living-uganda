(() => {
  const svg=document.querySelector('#bird-tree'), scene=document.querySelector('#bird-scene'), detail=document.querySelector('#bird-detail');
  const coverage=document.querySelector('#bird-coverage'), search=document.querySelector('#bird-search'), announcement=document.querySelector('#bird-announcement');
  const ns='http://www.w3.org/2000/svg', nodes=new Map(), expanded=new Set();
  let root, records=[], selected, visible=[], positions=new Map(), scale=1, tx=0, ty=0, dragging=null;
  const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function element(tag,text,cls){const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
  function vector(tag,attributes={}){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
  function sorted(node){return [...node.children.values()].sort((a,b)=>a.label.localeCompare(b.label));}
  function build(data){
    const tree={key:'birds',label:'Birds',rank:'class',children:new Map(),ids:[],parent:null};nodes.set(tree.key,tree);
    for(const record of data){let node=tree;node.ids.push(record.id);
      for(const rank of ['order','family','genus']){
        const value=record.taxonomy?.[rank]||'',key=node.key+'/'+JSON.stringify([rank,value]);
        if(!node.children.has(key)){const child={key,label:value||rank[0].toUpperCase()+rank.slice(1)+' not recorded',rank,missing:!value,children:new Map(),ids:[],parent:node};node.children.set(key,child);nodes.set(key,child);}
        node=node.children.get(key);node.ids.push(record.id);
      }
      const key=node.key+'/'+record.id,leaf={key,label:record.commonName||record.scientificName,rank:'species',children:new Map(),ids:[record.id],record,parent:node};node.children.set(key,leaf);nodes.set(key,leaf);
    }return tree;
  }
  function layout(){let leaf=0;visible=[];positions=new Map();
    // Parent coordinates use the same world units as their children.
    function visitFixed(node,depth){const children=expanded.has(node.key)?sorted(node):[];let y;if(children.length){const ys=children.map(child=>visitFixed(child,depth+1));y=ys.reduce((a,b)=>a+b,0)/ys.length;}else y=40+leaf++*44;positions.set(node.key,{x:80+depth*300,y});visible.push(node);return y;}
    visitFixed(root,0);
  }
  function draw(){
    layout();scene.replaceChildren();
    for(const node of visible){if(!node.parent||!positions.has(node.parent.key))continue;const a=positions.get(node.parent.key),b=positions.get(node.key),mid=(a.x+b.x)/2;scene.append(vector('path',{d:`M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`,class:'bird-tree-link','stroke-dasharray':node.missing?'4 4':''}));}
    for(const node of visible){const p=positions.get(node.key),group=vector('g',{class:'bird-node'+(expanded.has(node.key)?' expanded':'')+(selected?.key===node.key?' selected':''),transform:`translate(${p.x},${p.y})`,tabindex:'0',role:'button','data-key':node.key,'aria-label':node.rank+': '+node.label+(node.children.size?', open or close branch':', read species')});
      if(node.children.size)group.setAttribute('aria-expanded',String(expanded.has(node.key)));
      const title=vector('title');title.textContent=node.label;group.append(title,vector('rect',{class:'node-label-bg',rx:3}),vector('circle',{class:'node-dot'}));
      const text=vector('text',{class:'node-label'});text.textContent=node.label.length>29?node.label.slice(0,27)+'…':node.label;group.append(text);
      const rank=vector('text',{class:'node-rank'});rank.textContent=node.rank;group.append(rank);
      group.addEventListener('click',()=>activate(node));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(node);}else if(event.key==='ArrowRight'&&node.children.size){event.preventDefault();expanded.add(node.key);selected=node;draw();inspect(node);focus(node);}else if(event.key==='ArrowLeft'&&node.children.size){event.preventDefault();expanded.delete(node.key);selected=node;draw();inspect(node);focus(node);}});scene.append(group);
    }transform();
  }
  function transform(){
    scene.setAttribute('transform',`translate(${tx},${ty}) scale(${scale})`);
    scene.querySelectorAll('.bird-tree-link').forEach(path=>path.setAttribute('stroke-width',1.2/scale));
    scene.querySelectorAll('.bird-node').forEach(group=>{
      const node=nodes.get(group.getAttribute('data-key')),left=expanded.has(node.key)&&node.children.size,offset=left?-13/scale:13/scale;
      const text=group.querySelector('.node-label'),rank=group.querySelector('.node-rank'),dot=group.querySelector('.node-dot'),bg=group.querySelector('.node-label-bg');
      const font=Math.min(14/scale,34),small=Math.min(9/scale,23);text.setAttribute('font-size',font);text.setAttribute('x',offset);text.setAttribute('y',4/scale);text.setAttribute('text-anchor',left?'end':'start');rank.setAttribute('font-size',small);rank.setAttribute('x',offset);rank.setAttribute('y',18/scale);rank.setAttribute('text-anchor',left?'end':'start');rank.style.display=selected?.key===node.key?'':'none';dot.setAttribute('r',5/scale);dot.setAttribute('stroke-width',1.5/scale);
      const box=text.getBBox();bg.setAttribute('x',box.x-4/scale);bg.setAttribute('y',box.y-2/scale);bg.setAttribute('width',box.width+8/scale);bg.setAttribute('height',box.height+17/scale);
    });
  }
  function fit(){if(!positions.size)return;const points=[...positions.values()],minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),maxX=Math.max(...points.map(p=>p.x));scale=Math.max(.2,Math.min(1.4,(svg.clientWidth-60)/(maxX+220),(svg.clientHeight-60)/(maxY-minY+60)));
    for(let i=0;i<8;i++){transform();const box=scene.getBBox(),factor=Math.min(1,(svg.clientWidth-36)/(box.width*scale),(svg.clientHeight-48)/(box.height*scale));if(factor>.99)break;scale=Math.max(.15,scale*factor);}
    transform();const box=scene.getBBox();tx=(svg.clientWidth-box.width*scale)/2-box.x*scale;ty=(svg.clientHeight-box.height*scale)/2-box.y*scale;transform();}
  function focus(node){const p=positions.get(node.key);if(!p)return;tx=svg.clientWidth*.38-p.x*scale;ty=svg.clientHeight*.5-p.y*scale;transform();const g=[...scene.querySelectorAll('.bird-node')].find(g=>g.getAttribute('data-key')===node.key);g?.focus({preventScroll:true});}
  function activate(node){selected=node;if(node.children.size){if(expanded.has(node.key))expanded.delete(node.key);else expanded.add(node.key);}draw();inspect(node);focus(node);announcement.textContent=node.label+' selected.';}
  function reveal(node){let parent=node.parent;while(parent){expanded.add(parent.key);parent=parent.parent;}selected=node;if(node.children.size)expanded.add(node.key);draw();inspect(node);focus(node);}
  function inspect(node){
    detail.replaceChildren();detail.append(element('span',node.rank.toUpperCase(),'bird-kicker'),element('h2',node.label));
    const path=[];let ancestor=node.parent;while(ancestor){path.unshift(ancestor.label);ancestor=ancestor.parent;}if(path.length)detail.append(element('p',path.join(' → '),'bird-path'));
    if(node.record){const r=node.record;if(r.commonName)detail.append(element('p',r.scientificName,'bird-path'));
      for(const [key,label] of [['description',''],['distribution','Recorded distribution'],['habitat','Habitat'],['feeding','Feeding'],['behaviour','Behaviour'],['breeding','Breeding'],['conservation','Conservation']])if(r[key])detail.append(element('p',(label?label+': ':'')+r[key]));
      if(!r.description)detail.append(element('p','Explore its recorded name and classification in the catalogue.'));
      for(const name of r.localNames||[])detail.append(element('p',name.name+' · '+name.language+(name.region?' · '+name.region:'')));
      const link=element('a','Open catalogue entry ↗','bird-detail-link');link.href='species.html?group=Birds&q='+encodeURIComponent(r.scientificName)+'&v=20261004-birds-preview#species-results';detail.append(link);
    }else{
      detail.append(element('p','Choose a connected branch below, or open it on the tree.'));
      const list=element('div','','bird-child-list');sorted(node).forEach(child=>{const button=element('button',child.label);button.type='button';if(child.rank==='species'&&child.record.commonName)button.append(element('small',child.record.scientificName));button.addEventListener('click',()=>reveal(child));list.append(button);});detail.append(list);
    }
  }
  function zoom(factor,x=svg.clientWidth/2,y=svg.clientHeight/2){const next=Math.max(.15,Math.min(3.5,scale*factor));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;transform();}
  document.querySelector('#bird-zoom-in').addEventListener('click',()=>zoom(1.25));document.querySelector('#bird-zoom-out').addEventListener('click',()=>zoom(.8));document.querySelector('#bird-fit').addEventListener('click',fit);
  document.querySelector('#bird-reset').addEventListener('click',()=>{expanded.clear();expanded.add(root.key);selected=root;search.value='';draw();inspect(root);fit();});
  svg.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();const rect=svg.getBoundingClientRect();zoom(event.deltaY<0?1.1:.9,event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
  svg.addEventListener('pointerdown',event=>{if(event.target.closest('.bird-node'))return;dragging={x:event.clientX,y:event.clientY,tx,ty};svg.setPointerCapture(event.pointerId);});svg.addEventListener('pointermove',event=>{if(dragging){tx=dragging.tx+event.clientX-dragging.x;ty=dragging.ty+event.clientY-dragging.y;transform();}});for(const type of ['pointerup','pointercancel'])svg.addEventListener(type,()=>{dragging=null;});
  document.querySelector('#bird-search-form').addEventListener('submit',event=>{event.preventDefault();const query=normalize(search.value);if(!query)return;
    const exact=records.filter(r=>[r.scientificName,r.commonName,...(r.aliases||[]),...(r.localNames||[]).map(n=>n.name)].some(n=>normalize(n)===query));
    const matches=exact.length?exact:records.filter(r=>normalize([r.scientificName,r.commonName,...(r.aliases||[])].join(' ')).includes(query));
    if(matches.length===1){reveal([...nodes.values()].find(n=>n.record?.id===matches[0].id));announcement.textContent='Found '+matches[0].scientificName;}
    else{detail.replaceChildren();detail.append(element('span','FIND A BIRD','bird-kicker'),element('h2',matches.length?'Choose a name.':'No matching entry.'),element('p',matches.length?'Select a name to find its branch.':'Try another common or scientific name. This catalogue is still growing.'));const list=element('div','','bird-child-list');matches.slice(0,15).forEach(r=>{const button=element('button',r.commonName||r.scientificName);button.type='button';button.addEventListener('click',()=>reveal([...nodes.values()].find(n=>n.record?.id===r.id)));list.append(button);});detail.append(list);}
  });
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fit,120);});
  fetch('data/species.json').then(r=>{if(!r.ok)throw Error('Catalogue unavailable');return r.json();}).then(data=>{
    records=data.records.filter(r=>r.group==='Birds');if(!records.length)throw Error('No bird entries');root=build(records);expanded.add(root.key);selected=root;coverage.textContent=records.length+' species currently in this catalogue';const names=document.querySelector('#bird-names');for(const record of records){const option=element('option');option.value=record.commonName||record.scientificName;names.append(option);}draw();inspect(root);fit();
  }).catch(()=>{coverage.textContent='The bird catalogue could not load. Use the list browser or reload this page.';svg.setAttribute('aria-label','Bird catalogue unavailable');});
})();
