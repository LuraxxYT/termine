const socket = io();
let state = { events: [], settings: {} };
let page = 0;
const PER_PAGE = 4;
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
function duration(ms) {
  ms = Math.max(0, ms);
  const sec = Math.floor(ms / 1000), days = Math.floor(sec / 86400), hours = Math.floor(sec % 86400 / 3600), mins = Math.floor(sec % 3600 / 60), seconds = sec % 60;
  return { days, hours, mins, seconds };
}
function dateLabel(dateStr, time) {
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'long', year:'numeric' }).format(new Date(y,m-1,d)) + ' · ' + time;
}
function updateClock(){ $('clock').textContent = new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()); }
function render() {
  const events = state.events || [];
  const pages = Math.max(1, Math.ceil(events.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  $('boardTitle').textContent = state.settings.board_title || 'TERMINBOARD';
  $('boardSubtitle').textContent = state.settings.board_subtitle || '';
  $('pageInfo').textContent = `SEITE ${pad(page+1)} / ${pad(pages)}`;
  $('prevPage').disabled = page <= 0; $('nextPage').disabled = page >= pages - 1;
  const subset = events.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  if (!subset.length) {
    $('tiles').innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><h2>Alles im Blick.</h2><p>Erstelle im Admin-Panel deinen ersten Termin.</p></div>`; return;
  }
  $('tiles').innerHTML = subset.map((e, i) => {
    const d = duration(new Date(e.dueAt).getTime() - Date.now());
    const recurring = e.recurring ? 'JÄHRLICH' : 'EINMALIG';
    return `<article class="timer-card" data-id="${e.id}"><div class="card-top"><span class="card-tag"><span>◷</span>${i===0 && page===0 ? 'ALS NÄCHSTES' : recurring}</span><span class="card-index">${String(page*PER_PAGE+i+1).padStart(2,'0')}</span></div><div class="event-content"><div class="event-copy"><h2>${escapeHtml(e.title)}</h2><p>${escapeHtml(e.description || (e.recurring ? 'Wiederholt sich jedes Jahr.' : 'Ein geplanter Termin.'))}</p></div>${e.image ? `<img class="event-image" src="${escapeAttr(e.image)}" alt="" onerror="this.style.display='none'">` : ''}</div><div class="countdown"><span class="number" data-unit="days">${d.days}</span><span class="unit">Tage</span><span class="separator">:</span><span class="number" data-unit="hours">${pad(d.hours)}</span><span class="unit">Std.</span><span class="separator">:</span><span class="number" data-unit="mins">${pad(d.mins)}</span><span class="unit">Min.</span><span class="separator">:</span><span class="number" data-unit="seconds">${pad(d.seconds)}</span><span class="unit">Sek.</span></div><div class="event-date"><span>${e.recurring ? 'Nächste Wiederholung' : 'Terminzeitpunkt'}</span><strong>${dateLabel(e.date,e.time)}</strong></div></article>`;
  }).join('');
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr(v){return escapeHtml(v);}
function tick(){ updateClock(); document.querySelectorAll('.timer-card').forEach(card=>{const e=state.events.find(x=>String(x.id)===card.dataset.id);if(!e)return;const d=duration(new Date(e.dueAt).getTime()-Date.now());for(const [unit,val] of Object.entries({days:d.days,hours:pad(d.hours),mins:pad(d.mins),seconds:pad(d.seconds)})){const node=card.querySelector(`[data-unit="${unit}"]`);if(node)node.textContent=val;}}); }
socket.on('board:update', next=>{state=next;render();tick();});
socket.on('event:expired', event=>{
  if(event.action==='message') { $('actionTitle').textContent=event.title; $('actionMessage').textContent=event.message || 'Der Timer ist abgelaufen.'; $('actionOverlay').hidden=false; }
  if(event.action==='sound') { const audio=$('endSound'); audio.currentTime=0; audio.play().catch(()=>{}); }
  if(event.action==='page') { page=0; render(); }
});
$('prevPage').addEventListener('click',()=>{if(page>0){page--;render();tick();}});
$('nextPage').addEventListener('click',()=>{if((page+1)*PER_PAGE<state.events.length){page++;render();tick();}});
$('closeAction').addEventListener('click',()=>$('actionOverlay').hidden=true);
setInterval(tick,250);
