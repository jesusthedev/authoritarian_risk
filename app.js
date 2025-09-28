const SEV_W={low:.25,medium:.5,high:.75,extreme:1.0};
let entries=[];
async function load(){
  const res=await fetch('data.json'); entries=await res.json(); update();
}
function compute(){let total=0;for(const e of entries){total+=SEV_W[e.severity]*(e.impact||.5);}return Math.min(100,Math.round(total*20));}
function update(){
  const score=compute();
  document.getElementById('gaugeText').textContent='Composite '+score+'/100';
  const tbody=document.getElementById('rows'); tbody.innerHTML='';
  for(const e of entries){const tr=document.createElement('tr');tr.innerHTML=`<td>${e.date}</td><td>${e.category}</td><td>${e.title}</td><td>${e.severity}</td><td>${e.impact}</td><td><a href="${e.source_url}">${e.source_outlet}</a></td>`;tbody.appendChild(tr);}
}
load();