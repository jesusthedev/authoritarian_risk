/* ARD v1.4.0 — hardening pass */
const CATEGORIES = [
  { id: 'leader_cult', name: 'Leader Cult & Retribution', weight: 1.0 },
  { id: 'state_capture', name: 'State Capture (Civil Service/Agencies)', weight: 1.0 },
  { id: 'suppression', name: 'Suppression of Opposition / Protest', weight: 1.0 },
  { id: 'propaganda', name: 'Propaganda & Enemy Construction', weight: 0.8 },
  { id: 'militarization', name: 'Domestic Militarization', weight: 1.0 },
  { id: 'removal', name: 'Scapegoating & Mass Removal Machinery', weight: 1.0 },
  { id: 'rule_of_law', name: 'Rule-of-Law Interference', weight: 1.0 }
];
const SEV_W = { low:.25, medium:.5, high:.75, extreme:1.0 };
const $ = (id)=>document.getElementById(id);
let STATE = { entries: [], month:'', category:'', severity:'', actor:'', state:'', confidence:'', sortKey:'date', sortDir:'desc' };

async function loadData(){
  try{
    const res = await fetch('data.json', {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    STATE.entries = await res.json();
    if(!Array.isArray(STATE.entries)) throw new Error('data.json is not an array');
  }catch(e){
    console.error('data.json load failed', e);
    STATE.entries = [];
    const es = $('emptyState');
    es.classList.remove('hidden');
    es.textContent = 'Failed to load data.json. Check that the file exists at the project root.';
  }
}
function saveData(){ localStorage.setItem('ardb.entries', JSON.stringify(STATE.entries)); }
const fmtDate = s => new Date(s).toISOString().slice(0,10);

function computeComposite(monthStr){
  const month = monthStr || null;
  const byCat = new Map(CATEGORIES.map(c=>[c.id,0]));
  for (const e of STATE.entries){
    if (month && !e.date?.startsWith?.(month)) continue;
    const sev = SEV_W[e.severity] || .25;
    const catW = CATEGORIES.find(c=>c.id===e.category)?.weight || 1;
    const impact = typeof e.impact === 'number' ? e.impact : (typeof e.impact_score === 'number' ? e.impact_score : .5);
    byCat.set(e.category, (byCat.get(e.category)||0) + sev * impact * catW);
  }
  const total = [...byCat.values()].reduce((a,b)=>a+b,0);
  return { score: Math.min(100, Math.round(total*20)), byCat };
}

function kpis(){
  const now = new Date();
  const counts=[30,60,90].map(n=>STATE.entries.filter(e=> new Date(e.date) >= new Date(now - n*86400000)).length);
  $('kpi30').textContent=counts[0]; $('kpi60').textContent=counts[1]; $('kpi90').textContent=counts[2];
}

let gaugeChart, trendChart;
function drawGauge(score){
  const ctx = $('gauge'); if (gaugeChart) gaugeChart.destroy();
  gaugeChart = new Chart(ctx, { type:'doughnut', data:{labels:['Risk','Remaining'], datasets:[{data:[score,100-score]}]}, options:{ cutout:'70%', plugins:{legend:{display:false}}, responsive:true } });
  $('gaugeText').textContent = `(${score}/100)`;
}
function drawTrend(){
  const byMonth={}; for(const e of STATE.entries){ const m=(e.date||'').slice(0,7); if(!m) continue; (byMonth[m] ||= []).push(e); }
  const months=Object.keys(byMonth).sort();
  const scores=months.map(m=>computeComposite(m).score);
  const ctx=$('trend'); if(trendChart) trendChart.destroy();
  trendChart=new Chart(ctx,{type:'line',data:{labels:months,datasets:[{label:'Composite score',data:scores,tension:.25,fill:false}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,suggestedMax:100}}}});
}

function renderCategories(byCat){
  const grid=document.getElementById('catGrid'); if(!grid) return; grid.innerHTML='';
  for(const c of CATEGORIES){
    const val=(byCat?.get(c.id)||0).toFixed(2);
    const el=document.createElement('div'); el.className='card';
    el.innerHTML=`<div class="cat-h">${c.name}</div><div class="text-xs text-zinc-400">Weight ${c.weight} • Month score ${val}</div>`;
    grid.appendChild(el);
  }
}

function sortRows(rows){
  const k=STATE.sortKey, dir=STATE.sortDir==='asc'?1:-1;
  return rows.sort((a,b)=>{
    const va=(a[k]??'').toString().toLowerCase();
    const vb=(b[k]??'').toString().toLowerCase();
    if(k==='impact'){ return (parseFloat(va)-parseFloat(vb))*dir; }
    return va<vb ? -1*dir : va>vb ? 1*dir : 0;
  });
}

function renderTable(){
  const tbody=$('rows'); tbody.innerHTML='';
  const f=STATE;
  let rows=STATE.entries.filter(e=>(!f.month||e.date?.startsWith?.(f.month))&&(!f.category||e.category===f.category)&&(!f.severity||e.severity===f.severity)&&(!f.actor||e.actor===f.actor)&&(!f.state||((e.geo_state||'').toLowerCase().includes(f.state.toLowerCase())) )&&(!f.confidence||e.confidence===f.confidence));
  rows = sortRows(rows);
  $('emptyState').classList.toggle('hidden', rows.length>0);
  for(const e of rows){
    const tr=document.createElement('tr'); tr.className='border-b border-zinc-900 hover:bg-zinc-900/40';
    const catName=(CATEGORIES.find(c=>c.id===e.category)||{}).name||e.category;
    const conf=e.confidence||'';
    tr.innerHTML=`<td class="py-2 pr-3 whitespace-nowrap">${e.date?fmtDate(e.date):''}</td>
      <td class="py-2 pr-3">${catName}</td>
      <td class="py-2 pr-3">${e.actor||''}${e.agency?` / ${e.agency}`:''}</td>
      <td class="py-2 pr-3">${e.geo_state||''}</td>
      <td class="py-2 pr-3 trunc" title="${e.title||''}">${e.title||''}</td>
      <td class="py-2 pr-3"><span class="badge ${e.severity}">${e.severity||''}</span></td>
      <td class="py-2 pr-3">${(e.impact??e.impact_score??.5).toFixed(2)}</td>
      <td class="py-2 pr-3"><span class="badge ${conf}">${conf}</span></td>
      <td class="py-2 pr-3"><a class="table-link" href="${e.source_url}" target="_blank" rel="noopener">${e.source_outlet||'source'}</a></td>`;
    tbody.appendChild(tr);
  }
}

function bindFilters(){
  $('filterMonth').addEventListener('change', e=>{ STATE.month=e.target.value; update(); });
  const cat=$('filterCategory'); cat.innerHTML='<option value="">All</option>'+CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); cat.addEventListener('change', e=>{ STATE.category=e.target.value; update(); });
  $('filterSeverity').addEventListener('change', e=>{ STATE.severity=e.target.value; update(); });
  $('filterConfidence').addEventListener('change', e=>{ STATE.confidence=e.target.value; update(); });
  $('filterState').addEventListener('input', e=>{ STATE.state=e.target.value; update(); });
  const actors=['executive','legislative','judiciary','state_local'];
  const actorSel=$('filterActor'); actorSel.innerHTML='<option value="">All</option>'+actors.map(a=>`<option>${a}</option>`).join(''); actorSel.addEventListener('change', e=>{ STATE.actor=e.target.value; update(); });
  $('btnClear').addEventListener('click', ()=>{ STATE={...STATE,month:'',category:'',severity:'',actor:'',state:'',confidence:''}; document.querySelectorAll('#filterMonth,#filterCategory,#filterSeverity,#filterActor,#filterConfidence').forEach(el=>el.value=''); $('filterState').value=''; update(); });

  // Sorting
  document.querySelectorAll('th.sortable').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key=th.getAttribute('data-key');
      STATE.sortKey = key;
      STATE.sortDir = STATE.sortDir==='asc' ? 'desc' : 'asc';
      update();
    });
  });
}

function bindModal(){
  const modal=document.getElementById('modal');
  document.getElementById('btnAdd').addEventListener('click',()=>{
    const cat=document.getElementById('mCategory'); cat.innerHTML=CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    modal.showModal();
  });
  document.getElementById('mSave').addEventListener('click',(ev)=>{
    ev.preventDefault();
    const e={
      id:crypto.randomUUID(),
      date:document.getElementById('mDate').value,
      category:document.getElementById('mCategory').value,
      title:document.getElementById('mTitle').value.trim(),
      severity:document.getElementById('mSeverity').value,
      impact:parseFloat(document.getElementById('mImpact').value),
      actor:document.getElementById('mActor').value,
      agency:document.getElementById('mAgency').value.trim(),
      geo_state:document.getElementById('mState').value.trim(),
      confidence:document.getElementById('mConfidence').value,
      tags:document.getElementById('mTags').value.split(',').map(s=>s.trim()).filter(Boolean),
      arrests: parseInt(document.getElementById('mArrests').value||'0',10),
      troop_count: parseInt(document.getElementById('mTroops').value||'0',10),
      detention_capacity_change: parseInt(document.getElementById('mDetCap').value||'0',10),
      corroboration_count: parseInt(document.getElementById('mCorro').value||'1',10),
      source_outlet:document.getElementById('mOutlet').value.trim(),
      source_url:document.getElementById('mUrl').value.trim(),
      summary:document.getElementById('mSummary').value.trim()
    };
    if(!e.date||!e.title||!e.source_url){ alert('Date, Title, and Source URL are required.'); return; }
    STATE.entries.push(e); saveData(); modal.close(); update();
  });
}

function update(){
  const {score,byCat}=computeComposite(STATE.month);
  drawGauge(score); renderCategories(byCat); renderTable(); drawTrend(); kpis();
}

(async function init(){ await loadData(); bindFilters(); bindModal(); update(); })();