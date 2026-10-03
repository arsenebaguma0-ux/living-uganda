// Open a cited source when its chapter link is followed; native details remain usable without JavaScript.
function showCitedSource(){
  const id=decodeURIComponent(location.hash.slice(1));
  const panel=document.getElementById(id);
  if(panel instanceof HTMLDetailsElement){panel.open=true;panel.scrollIntoView({block:'start'});}
}
window.addEventListener('hashchange',showCitedSource);
showCitedSource();
