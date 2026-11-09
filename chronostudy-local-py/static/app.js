const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let TOKEN = localStorage.getItem('cs_token') || '';
async function api(path, method = 'GET', body) {
  const r = await fetch('/api/' + path, {method, headers: {'Content-Type': 'application/json', ...(TOKEN ? {Authorization: 'Bearer ' + TOKEN} : {})}, body: body ? JSON.stringify(body) : undefined});
  if (r.status === 401) { show('settings'); alert('Token required: enter it in Settings'); throw new Error('401'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { alert(j.error || r.status); throw new Error(j.error); }
  return j;
}
const tq = () => TOKEN ? '&token=' + encodeURIComponent(TOKEN) : '';
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const pad = n => String(Math.floor(n)).padStart(2, '0');
let tracks = [];

// ---- nav
const TABS = [['timer', 'Timer'], ['cal', 'Calendar'], ['tasks', 'Tasks'], ['notes', 'Notes'], ['reports', 'Reports'], ['settings', 'Settings']];
$('nav').innerHTML = TABS.map(([k, v]) => `<button data-k="${k}">${v}</button>`).join('');
function show(k) {
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === k));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  ({timer: loadTimer, cal: loadCal, tasks: loadTasks, notes: loadNotes, reports: loadReport, settings: loadSettings})[k]();
}
$('nav').onclick = e => e.target.dataset.k && show(e.target.dataset.k);

async function loadTracks() {
  tracks = await api('tracks');
  const opts = '<option value="">(no track)</option>' + tracks.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  ['s_track', 'p_track', 'k_track', 'n_track'].forEach(i => { const v = $(i).value; $(i).innerHTML = opts; $(i).value = v; });
  $('tracks').innerHTML = tracks.map(t => `<tr><td><span style="color:${esc(t.color)}">&#9632;</span> ${esc(t.name)}</td><td>${t.target_hours_week || 0} h/wk</td><td><button class="d" onclick="delTrack(${t.id})">x</button></td></tr>`).join('') || '<tr><td class="mut">No tracks yet &mdash; add your first one above.</td></tr>';
}
window.delTrack = async id => { if (confirm('Delete track?')) { await api('tracks/' + id, 'DELETE'); loadTracks(); } };
$('t_add').onclick = async () => { if (!$('t_name').value.trim()) return; await api('tracks', 'POST', {name: $('t_name').value.trim(), color: $('t_color').value, target_hours_week: +$('t_goal').value || 0}); $('t_name').value = ''; loadTracks(); };

// ---- timer
let active = null;
async function loadTimer() {
  await loadTracks();
  active = (await api('sessions/active')).session;
  const ss = await api('sessions');
  $('sess').innerHTML = ss.slice(-15).reverse().map(s => `<tr><td>${new Date(s.start_ts * 1000).toLocaleString()}</td><td>${esc(s.track || '')} ${esc(s.topic)}</td><td>${Math.round(s.seconds / 60)}m</td><td>${s.rating ? '&#9733;' + s.rating : ''}</td><td><button class="d" onclick="delSess(${s.id})">x</button></td></tr>`).join('');
  tick();
}
window.delSess = async id => { await api('sessions/' + id, 'DELETE'); loadTimer(); };
let base = 0, baseAt = 0;
function tick() {
  if (active) { if (!baseAt || active.elapsed !== base) { base = active.elapsed; baseAt = Date.now(); } }
  const el = active ? base + (active.state === 'running' ? (Date.now() - baseAt) / 1000 : 0) : 0;
  $('clock').textContent = pad(el / 3600) + ':' + pad(el / 60 % 60) + ':' + pad(el % 60);
  $('cur').textContent = active ? active.state + (active.topic ? ' \u2014 ' + active.topic : '') : 'No active session';
}
setInterval(tick, 500);
$('b_start').onclick = async () => { const r = await api('sessions/start', 'POST', {track_id: +$('s_track').value || null, topic: $('s_topic').value}); active = r.session; baseAt = 0; tick(); };
$('b_pause').onclick = async () => { if (!active) return; const r = await api('sessions/' + (active.state === 'running' ? 'pause' : 'resume'), 'POST', {}); active = r.session; baseAt = 0; tick(); };
$('b_stop').onclick = async () => { if (!active) return; await api('sessions/stop', 'POST', {rating: +$('s_rating').value || null, notes: $('s_notes').value}); $('s_notes').value = ''; active = null; baseAt = 0; loadTimer(); };

// ---- calendar
let cursor = new Date();
async function loadCal() {
  await loadTracks();
  const view = $('c_view').value;
  let s, e;
  if (view === 'month') { s = new Date(cursor.getFullYear(), cursor.getMonth(), 1); e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); s.setDate(s.getDate() - (s.getDay() + 6) % 7); e.setDate(e.getDate() + (7 - (e.getDay() + 6) % 7 - 1) % 7); $('c_title').textContent = cursor.toLocaleDateString(undefined, {month: 'long', year: 'numeric'}); }
  else if (view === 'week') { s = new Date(cursor); s.setDate(s.getDate() - (s.getDay() + 6) % 7); e = new Date(s); e.setDate(e.getDate() + 6); $('c_title').textContent = iso(s) + ' \u2192 ' + iso(e); }
  else { s = e = new Date(cursor); $('c_title').textContent = cursor.toDateString(); }
  const items = await api(`calendar?start=${iso(s)}&end=${iso(e)}`);
  let h = view === 'day' ? '<div>' : '<div class="grid">';
  if (view !== 'day') h += ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<b class="mut">${d}</b>`).join('');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const k = iso(d), its = items.filter(i => i.start.slice(0, 10) === k);
    h += `<div class="cell ${k === iso(new Date()) ? 'today' : ''}"><b>${d.getDate()}</b>` + its.map(i => `<span class="ev ${i.kind}">${i.start.length > 10 ? i.start.slice(11, 16) + ' ' : ''}${esc(i.title)}${i.kind === 'event' && i.source === 'local' ? ` <a href="#" onclick="delEv(${i.id});return false">x</a>` : ''}</span>`).join('') + '</div>';
  }
  $('c_body').innerHTML = h + '</div>';
  const prog = await api('program');
  $('prog').innerHTML = prog.map(p => `<tr><td>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][p.weekday]} ${p.start_time}-${p.end_time}</td><td>${esc(p.title || p.track || '')}</td><td><button class="d" onclick="delProg(${p.id})">x</button></td></tr>`).join('');
}
const step = () => ({month: [0, 1, 0], week: [0, 0, 7], day: [0, 0, 1]})[$('c_view').value];
$('c_prev').onclick = () => {
  const [, m, d] = step();
  if (m) { cursor.setDate(1); cursor.setMonth(cursor.getMonth() - m); }
  else { cursor.setDate(cursor.getDate() - d); }
  loadCal();
};
$('c_next').onclick = () => {
  const [, m, d] = step();
  if (m) { cursor.setDate(1); cursor.setMonth(cursor.getMonth() + m); }
  else { cursor.setDate(cursor.getDate() + d); }
  loadCal();
};
$('c_today').onclick = () => { cursor = new Date(); loadCal(); };
$('c_view').onchange = loadCal;
window.delEv = async id => { await api('events/' + id, 'DELETE'); loadCal(); };
window.delProg = async id => { await api('program/' + id, 'DELETE'); loadCal(); };
$('e_add').onclick = async () => { if (!$('e_title').value || !$('e_start').value) return; await api('events', 'POST', {title: $('e_title').value, start: $('e_start').value + ':00', end: $('e_end').value ? $('e_end').value + ':00' : null}); $('e_title').value = ''; loadCal(); };
$('p_add').onclick = async () => { await api('program', 'POST', {weekday: +$('p_day').value, track_id: +$('p_track').value || null, title: $('p_title').value, start_time: $('p_s').value, end_time: $('p_e').value}); loadCal(); };

// ---- tasks
async function loadTasks() {
  await loadTracks();
  const all = await api('tasks');
  const f = $('k_filter').value.toLowerCase(), hide = $('k_hide').checked;
  const match = t => !f || (f[0] === '#' ? t.tags.includes(f.slice(1)) : (t.title + ' ' + (t.track || '')).toLowerCase().includes(f));
  const item = t => `<li class="p${t.priority}"><label class="${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="doneTask(${t.id},this.checked)"> ${esc(t.title)}</label> ${t.due ? `<small class="mut">${t.due.slice(0, 10)}</small>` : ''} ${t.track ? `<small class="mut">${esc(t.track)}</small>` : ''} ${t.recur ? '&#8635;' + t.recur : ''} ${t.tags.map(g => `<span class="tag">${esc(g)}</span>`).join(' ')}
    <button onclick="addSub(${t.id})">+sub</button><button class="d" onclick="delTask(${t.id})">x</button></li>`;
  const tops = all.filter(t => !t.parent_id && (!hide || !t.done));
  $('klist').innerHTML = tops.filter(t => match(t) || all.some(s => s.parent_id === t.id && match(s))).map(t => item(t) + all.filter(s => s.parent_id === t.id).map(s => `<div class="sub">${item(s)}</div>`).join('')).join('') || '<li class="mut">No tasks.</li>';
}
window.doneTask = async (id, v) => { await api('tasks/' + id + '/done', 'POST', {done: v}); loadTasks(); };
window.delTask = async id => { await api('tasks/' + id, 'DELETE'); loadTasks(); };
window.addSub = async id => { const t = prompt('Subtask'); if (t) { await api('tasks', 'POST', {title: t, parent_id: id}); loadTasks(); } };
$('k_add').onclick = async () => { if (!$('k_title').value.trim()) return; await api('tasks', 'POST', {title: $('k_title').value, priority: +$('k_pri').value, due: $('k_due').value || null, track_id: +$('k_track').value || null, tags: $('k_tags').value.split(',').map(x => x.trim()).filter(Boolean), recur: $('k_rec').value}); $('k_title').value = ''; loadTasks(); };
$('k_filter').oninput = $('k_hide').onchange = loadTasks;

// ---- notes
async function loadNotes() {
  await loadTracks();
  const ns = await api('notes');
  $('nlist').innerHTML = ns.map(n => `<div class="card"><b>${esc(n.track || '')}</b> ${esc(n.topic)} <span class="mut">${new Date(n.created_ts * 1000).toLocaleString()}</span> <button class="d" onclick="delNote(${n.id})">x</button>
  <div style="background:#3335;border-radius:4px;height:6px"><div style="width:${n.progress}%;height:6px;background:var(--ok);border-radius:4px"></div></div><p>${esc(n.text).replace(/\n/g, '<br>')}</p></div>`).join('');
}
window.delNote = async id => { await api('notes/' + id, 'DELETE'); loadNotes(); };
$('n_add').onclick = async () => { await api('notes', 'POST', {track_id: +$('n_track').value || null, topic: $('n_topic').value, text: $('n_text').value, progress: +$('n_prog').value}); $('n_text').value = ''; loadNotes(); };

// ---- reports
async function loadReport() {
  if (!$('r_date').value) $('r_date').value = iso(new Date());
  const q = `type=${$('r_type').value}&date=${$('r_date').value}`;
  $('r_csv').href = `/api/report?${q}&format=csv${tq()}`; $('r_json').href = `/api/report?${q}${tq()}`; $('r_html').href = `/api/report?${q}&format=html${tq()}`;
  const r = await api('report?' + q);
  $('r_out').innerHTML = `<p><b>${r.period.start} \u2192 ${r.period.end}</b>: ${Math.round(r.totals.minutes)} min, ${r.totals.sessions} sessions, ${r.totals.tasksDone} tasks done</p>
  <table>${r.byTrack.map(t => `<tr><td>${esc(t.name)}</td><td>${Math.round(t.minutes)} min</td><td>${t.sessions}</td></tr>`).join('')}</table>
  <div style="display:flex;align-items:flex-end;gap:2px;height:90px">${r.daily.map(d => `<div title="${d.date}: ${d.minutes}m" style="flex:1;background:var(--acc);height:${Math.max(2, d.minutes / Math.max(1, ...r.daily.map(x => x.minutes)) * 85)}px"></div>`).join('')}</div>
  <table>${r.goals.map(g => `<tr><td>${esc(g.track)}</td><td>${g.actualHours} / ${g.targetHoursPerWeek} h/wk</td></tr>`).join('')}</table>`;
}
$('r_go').onclick = loadReport; $('r_type').onchange = loadReport;

// ---- settings
async function loadSettings() {
  const s = await api('settings');
  $('g_url').value = s.apps_script_url || ''; $('i_min').value = s.ics_refresh_minutes || 60; $('tok').value = TOKEN;
  $('feed').href = '/feed.ics' + (TOKEN ? '?token=' + encodeURIComponent(TOKEN) : '');
  const src = await api('ics/sources');
  $('ics').innerHTML = src.map(x => `<tr><td>${esc(x.url)}</td><td class="mut">${esc(x.last_status)}</td><td><button class="d" onclick="delSrc(${x.id})">x</button></td></tr>`).join('');
}
window.delSrc = async id => { await api('ics/' + id, 'DELETE'); loadSettings(); };
$('g_save').onclick = async () => { await api('settings', 'PUT', {apps_script_url: $('g_url').value}); $('g_out').textContent = 'saved'; };
$('g_push').onclick = async () => { await api('settings', 'PUT', {apps_script_url: $('g_url').value}); try { const r = await api('report/push', 'POST', {type: $('r_type').value}); $('g_out').textContent = 'pushed: HTTP ' + r.status; } catch (e) { $('g_out').textContent = 'failed: ' + e.message; } };
$('i_add').onclick = async () => { const r = await api('ics/import', 'POST', {url: $('i_url').value}); alert(r.status); loadSettings(); };
$('i_ref').onclick = async () => { await api('ics/refresh', 'POST', {}); loadSettings(); };
$('i_min').onchange = () => api('settings', 'PUT', {ics_refresh_minutes: +$('i_min').value || 60});
$('i_file').onchange = async e => { const f = e.target.files[0]; if (!f) return; const r = await api('ics/import', 'POST', {text: await f.text()}); alert('Imported ' + r.imported); };
$('tok_save').onclick = () => { TOKEN = $('tok').value.trim(); localStorage.setItem('cs_token', TOKEN); show('timer'); };
$('bk').onclick = async () => alert((await api('backup', 'POST', {})).path);

show('timer');
