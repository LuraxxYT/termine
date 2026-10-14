const socket = io();
const $ = id => document.getElementById(id);
let events = [];
let toastTimer;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmtDate(date,time){if(!date)return 'Ohne Datum';const [y,m,d]=date.split('-').map(Number);return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d))+' · '+(time||'00:00');}
async function api(url, options={}){const r=await fetch(url,options);let data={};try{data=await r.json();}catch{}if(r.status===401){showLogin();throw new Error(data.error||'Bitte anmelden.');}if(!r.ok)throw new Error(data.error||'Ein Fehler ist aufgetreten.');return data;}
function showLogin(){ $('loginScreen').hidden=false; $('adminApp').hidden=true; }
function showApp(){ $('loginScreen').hidden=true; $('adminApp').hidden=false; }
async function checkLogin(){try{const d=await api('/api/admin/status');if(d.authenticated){showApp();await loadEvents();}else showLogin();}catch{showLogin();}}
async function loadEvents(){events=await api('/api/admin/events');renderEvents();updateStats();}
function updateStats(){
 $('statTotal').textContent=events.length;
 const active=events.filter(e=>e.active); const next=active.map(e=>({...e, due:nextDue(e)})).sort((a,b)=>a.due-b.due)[0];
 $('statNext').textContent=next?next.title:'—';$('statNextDate').textContent=next?fmtDate(next.date,next.time):'Noch nichts geplant';
}
function nextDue(e){const now=new Date();const [y,m,d]=e.date.split('-').map(Number);const [h,min]=(e.time||'00:00').split(':').map(Number);if(!e.recurring)return new Date(y,m-1,d,h,min).getTime();let due=new Date(now.getFullYear(),m-1,d,h,min);if(due<=now)due=new Date(now.getFullYear()+1,m-1,d,h,min);return due.getTime();}
function renderEvents(){
 const list=$('eventList');if(!events.length){list.innerHTML='<div class="list-empty">Noch keine Termine. Erstelle deinen ersten Termin mit „Termin erstellen“.</div>';return;}
 const ordered=[...events].sort((a,b)=>nextDue(a)-nextDue(b));
 list.innerHTML=ordered.map(e=>`<article class="event-row"><div class="event-thumb">${e.image?`<img src="${esc(e.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:'◷'}</div><div class="event-details"><h3>${esc(e.title)}${!e.active?' <span style="color:#9ba3b2;font-weight:500">· ausgeblendet</span>':''}</h3><p>${esc(e.description||'Keine Beschreibung')}</p><div class="event-meta"><span class="mini-pill ${e.recurring?'blue':''}">${e.recurring?'↻ Jährlich':'◷ Einmalig'}</span><span class="mini-pill">${esc(fmtDate(e.date,e.time))}</span>${e.image?'<span class="mini-pill">▧ Bild</span>':''}<span class="mini-pill">${esc(actionLabel(e.end_action))}</span></div></div><div class="row-actions"><button class="icon-btn" data-edit="${e.id}" title="Bearbeiten" aria-label="Bearbeiten">✎</button><button class="icon-btn danger" data-delete="${e.id}" title="Löschen" aria-label="Löschen">⌫</button></div></article>`).join('');
 list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(Number(b.dataset.edit))));
 list.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteEvent(Number(b.dataset.delete))));
}
function actionLabel(a){return ({none:'Keine Aktion',message:'Meldung',hide:'Ausblenden',sound:'Signalton',page:'Erste Seite'})[a]||'Keine Aktion';}
function openModal(e=null){
 delete $('eventForm').dataset.removeImage; $('eventForm').reset();$('eventId').value=e?e.id:'';$('modalTitle').textContent=e?'Termin bearbeiten':'Neuen Termin erstellen';$('eventName').value=e?.title||'';$('eventDescription').value=e?.description||'';$('eventDate').value=e?.date||new Date().toISOString().slice(0,10);$('eventTime').value=e?.time||'00:00';$('eventRecurring').checked=!!e?.recurring;$('eventImageUrl').value=e?.image||'';$('endAction').value=e?.end_action||'none';$('endMessage').value=e?.end_message||'';$('formError').textContent='';$('eventImage').value='';$('imagePreview').innerHTML=e?.image?`<img src="${esc(e.image)}" alt="Vorschau"><small>Aktuelles Bild</small>`:'<span>▧</span><small>Bild auswählen oder hier klicken</small>';$('removeImageBtn').hidden=!e?.image;$('eventModal').hidden=false;toggleEndMessage();
}
function openEdit(id){const e=events.find(x=>x.id===id);if(e)openModal(e);}
function closeModal(){$('eventModal').hidden=true;}
function toggleEndMessage(){$('endMessageWrap').hidden=$('endAction').value!=='message';}
async function deleteEvent(id){const e=events.find(x=>x.id===id);if(!e||!confirm(`„${e.title}“ wirklich löschen?`))return;try{await api(`/api/admin/events/${id}`,{method:'DELETE'});await loadEvents();toast('Termin gelöscht.');}catch(err){toast(err.message);}}
$('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();$('loginError').textContent='';try{await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});$('password').value='';showApp();await loadEvents();}catch(e){$('loginError').textContent=e.message;}});
$('logoutBtn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST'});}catch{}showLogin();});
$('newEventBtn').addEventListener('click',()=>openModal());$('closeModal').addEventListener('click',closeModal);$('cancelModal').addEventListener('click',closeModal);$('eventModal').addEventListener('click',e=>{if(e.target===$('eventModal'))closeModal();});$('endAction').addEventListener('change',toggleEndMessage);
$('eventImage').addEventListener('change',()=>{const file=$('eventImage').files[0];if(!file)return;if(file.size>8*1024*1024){$('formError').textContent='Das Bild darf maximal 8 MB groß sein.';$('eventImage').value='';return;}const url=URL.createObjectURL(file);$('imagePreview').innerHTML=`<img src="${url}" alt="Vorschau"><small>${esc(file.name)}</small>`;$('removeImageBtn').hidden=false;});
$('removeImageBtn').addEventListener('click',()=>{$('eventImage').value='';$('eventImageUrl').value='';$('imagePreview').innerHTML='<span>▧</span><small>Kein Bild ausgewählt</small>';$('removeImageBtn').hidden=true;$('eventForm').dataset.removeImage='true';});
$('eventForm').addEventListener('submit',async ev=>{ev.preventDefault();$('formError').textContent='';const id=$('eventId').value;const data=new FormData();data.append('title',$('eventName').value);data.append('description',$('eventDescription').value);data.append('date',$('eventDate').value);data.append('time',$('eventTime').value||'00:00');data.append('recurring',$('eventRecurring').checked?'true':'false');data.append('endAction',$('endAction').value);data.append('endMessage',$('endMessage').value);data.append('image',$('eventImageUrl').value);if($('eventImage').files[0])data.append('imageFile',$('eventImage').files[0]);if($('eventForm').dataset.removeImage==='true')data.append('removeImage','true');try{await api(id?`/api/admin/events/${id}`:'/api/admin/events',{method:id?'PUT':'POST',body:data});delete $('eventForm').dataset.removeImage;closeModal();await loadEvents();toast(id?'Termin aktualisiert.':'Termin erstellt.');}catch(e){$('formError').textContent=e.message;}});
$('settingsForm').addEventListener('submit',async ev=>{ev.preventDefault();try{await api('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('boardTitleInput').value,subtitle:$('boardSubtitleInput').value})});toast('Darstellung gespeichert.');}catch(e){toast(e.message);}});
socket.on('board:update',data=>{if(data.settings){$('boardTitleInput').value=data.settings.board_title||'TERMINBOARD';$('boardSubtitleInput').value=data.settings.board_subtitle||'';}if(!$('adminApp').hidden)loadEvents().catch(()=>{});});
checkLogin();
