/* ARD client app v1.2.1 */
const CATEGORIES = [
  { id: 'leader_cult', name: 'Leader Cult & Retribution', weight: 1.0 },
  { id: 'state_capture', name: 'State Capture (Civil Service/Agencies)', weight: 1.0 },
  { id: 'suppression', name: 'Suppression of Opposition / Protest', weight: 1.0 },
  { id: 'propaganda', name: 'Propaganda & Enemy Construction', weight: 0.8 },
  { id: 'militarization', name: 'Domestic Militarization', weight: 1.0 },
  { id: 'removal', name: 'Scapegoating & Mass Removal Machinery', weight: 1.0 },
  { id: 'rule_of_law', name: 'Rule-of-Law Interference', weight: 1.0 }
];
const SEV_W = { low: .25, medium: .5, high: .75, extreme: 1.0 };
const $ = id => document.getElementById(id);
let STATE = { entries: [], month: '', category: '', severity: '' };

async function loadData() {
  try {
    const ls = localStorage.getItem('ardb.entries');
    if (ls) STATE.entries = JSON.parse(ls);
    else {
      const res = await fetch('data.json', { cache: 'no-store' });
      STATE.entries = await res.json();
    }
  } catch (e) {
    console.error('Failed to load data.json', e);
    STATE.entries = [];
  }
}

function saveData(){ localStorage.setItem('ardb.entries', JSON.stringify(STATE.entries)); }
const fmtDate = s => new Date(s).toISOString().slice(0,10);

function computeComposite(monthStr){
  const month = monthStr || null;
  const byCat = new Map(CATEGORIES.map(c=>[c.id,0]));
  for (const e of STATE.entries){
    if (month && !e.date.startsWith(month)) continue;
    const sev = SEV_W[e.severity] || 0.25;
    const catW = CATEGORIES.find(c=>c.id===e.category)?.weight || 1;
    byCat.set(e.category, byCat.get(e.category) + sev * (e.impact ?? .5) * catW);
  }
  const total = [...byCat.values()].reduce((a,b)=>a+b,0);
  const score = Math.min(100, Math.max(0, Math.round(total*20)));
  return { score, byCat };
}

function kpis(){
  const now = new Date();
  const counts = [30,60,90].map(n=>{
    const dfrom = new Date(now - n*86400000);
    return STATE.entries.filter(e => new Date(e.date)>=dfrom).length;
  });
  $('kpi30').textContent = counts[0];
  $('kpi60').textContent = counts[1];
  $('kpi90').textContent = counts[2];
}

let gaugeChart, trendChart;
function drawGauge(score){
  const ctx = $('gauge');
  if (gaugeChart) gaugeChart.destroy();
  gaugeChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Risk','Remaining'], datasets: [{ data: [score, 100-score] }] },
    options: { cutout: '70%', plugins: { legend: { display:false } }, responsive:true }
  });
  const label = score<33? 'green' : score<66? 'yellow' : 'red';
  $('gaugeText').textContent = `(${score}/100, ${label})`;
}

function drawTrend(){
  const byMonth = {};
  for (const e of STATE.entries){ const m = e.date.slice(0,7); (byMonth[m] ||= []).push(e); }
  const months = Object.keys(byMonth).sort();
  const scores = months.map(m=> computeComposite(m).score );
  const ctx = $('trend');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: months, datasets: [{ label: 'Composite score', data: scores, tension: .25, fill:false }] },
    options: { plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, suggestedMax:100 } } }
  });
}

function renderCategories(byCat){
  const grid = $('catGrid'); grid.innerHTML = '';
  for (const c of CATEGORIES){
    const val = (byCat?.get(c.id) || 0).toFixed(2);
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="cat-h">${c.name}</div><div class="text-xs text-zinc-400">Weight ${c.weight} • Month score ${val}</div>`;
    grid.appendChild(el);
  }
}

function renderTable(){
  const tbody = $('rows'); tbody.innerHTML='';
  const {month,category,severity} = STATE;
  const filtered = STATE.entries.filter(e =>
    (!month || e.date.startsWith(month)) &&
    (!category || e.category===category) &&
    (!severity || e.severity===severity)
  ).sort((a,b)=> b.date.localeCompare(a.date));

  for (const e of filtered){
    const tr = document.createElement('tr');
    tr.className = 'border-b border-zinc-900 hover:bg-zinc-900/40';
    tr.innerHTML = `
      <td class="py-2 pr-3 whitespace-nowrap">${fmtDate(e.date)}</td>
      <td class="py-2 pr-3">${(CATEGORIES.find(c=>c.id===e.category)||{}).name||e.category}</td>
      <td class="py-2 pr-3">${e.title}</td>
      <td class="py-2 pr-3"><span class="badge ${e.severity}">${e.severity}</span></td>
      <td class="py-2 pr-3">${(e.impact??0.5).toFixed(2)}</td>
      <td class="py-2 pr-3 truncate max-w-[280px]"><a class="table-link" href="${e.source_url}" target="_blank" rel="noopener">${e.source_outlet||'source'}</a></td>`;
    tbody.appendChild(tr);
  }
}

function bindFilters(){
  $('filterMonth').addEventListener('change', e=>{ STATE.month = e.target.value; update(); });
  const catSel = $('filterCategory');
  catSel.innerHTML = '<option value="">All</option>' + CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  catSel.addEventListener('change', e=>{ STATE.category = e.target.value; update(); });
  $('filterSeverity').addEventListener('change', e=>{ STATE.severity = e.target.value; update(); });
  $('btnClear').addEventListener('click', ()=>{ STATE.month=''; STATE.category=''; STATE.severity=''; $('filterMonth').value=''; $('filterCategory').value=''; $('filterSeverity').value=''; update(); });
}

function bindIO(){
  $('btnImport').addEventListener('click', ()=>{
    const inp = document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
    inp.onchange = async ()=>{
      const f = inp.files[0]; if(!f) return; const text = await f.text();
      try { const data = JSON.parse(text); if(!Array.isArray(data)) throw new Error('Expected an array of entries'); STATE.entries = data; saveData(); update(); }
      catch(err){ alert('Bad JSON: '+err.message); }
    };
    inp.click();
  });
  $('btnExport').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(STATE.entries, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'authoritarian-risk-data.json'; a.click(); URL.revokeObjectURL(a.href);
  });
}

function bindModal(){
  const modal = document.getElementById('modal');
  document.getElementById('btnAdd').addEventListener('click', ()=>{
    const cat = document.getElementById('mCategory');
    cat.innerHTML = CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    modal.showModal();
  });
  document.getElementById('mSave').addEventListener('click', (ev)=>{
    ev.preventDefault();
    const e = {
      id: crypto.randomUUID(),
      date: document.getElementById('mDate').value,
      category: document.getElementById('mCategory').value,
      title: document.getElementById('mTitle').value.trim(),
      severity: document.getElementById('mSeverity').value,
      impact: parseFloat(document.getElementById('mImpact').value),
      source_outlet: document.getElementById('mOutlet').value.trim(),
      source_url: document.getElementById('mUrl').value.trim(),
      summary: document.getElementById('mSummary').value.trim()
    };
    if (!e.date || !e.title || !e.source_url) { alert('Date, Title, and Source URL are required.'); return; }
    STATE.entries.push(e); saveData(); modal.close(); update();
  });
}

function update(){
  const { score, byCat } = computeComposite(STATE.month);
  drawGauge(score);
  renderCategories(byCat);
  renderTable();
  drawTrend();
  kpis();
}

(async function init(){
  await loadData();
  bindFilters();
  bindIO();
  bindModal();
  update();
})();