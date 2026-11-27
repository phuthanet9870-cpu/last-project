// Admin dashboard logic (served as a file so the page can use a strict Content-Security-Policy without 'unsafe-inline' scripts).
let tok = '';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function api(path, body) { const r = await fetch('/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; }
const table = (rows) => rows.length ? '<table><tr>' + Object.keys(rows[0]).map((k) => '<th>' + esc(k) + '</th>').join('') + '</tr>' + rows.map((r) => '<tr>' + Object.values(r).map((v) => '<td>' + esc(typeof v === 'object' ? JSON.stringify(v) : v) + '</td>').join('') + '</tr>').join('') + '</table>' : '<i>none</i>';
async function load() {
  try { const o = await api('/admin/overview'); $('ov').innerHTML = `<b>${o.online}</b> online · p95 tick ${o.tickMsP95.toFixed(2)} ms · cmds ${o.cmds} · RSS ${o.memoryMB} MB · listings ${o.listings} · ledger ${o.ledger.ok ? '<span class=ok>balanced</span>' : '<span class=err>PROBLEMS</span>'}<br>DB: ${esc(JSON.stringify(o.db))}` + table(o.worlds); } catch (e) { $('ov').innerHTML = '<span class=err>' + esc(e.message) + '</span>'; return; }
  const e = await api('/admin/economy'); $('eco').innerHTML = table(e.flows) + (e.unbalancedTx.length ? '<p class=err>Unbalanced tx: ' + esc(JSON.stringify(e.unbalancedTx)) + '</p>' : '<p class=ok>All ledger transactions balanced</p>');
  const f = await api('/admin/flags'); $('flags').innerHTML = f.rows.map((r) => `<label><input type=checkbox data-k="${esc(r.key)}" ${r.enabled ? 'checked' : ''}> ${esc(r.key)}</label><br>`).join(''); $('flags').querySelectorAll('input').forEach((i) => i.onchange = () => api('/admin/flags', { key: i.dataset.k, enabled: i.checked }).then(load).catch((er) => { alert(er.message); load(); }));
  $('reports').innerHTML = table((await api('/admin/reports')).rows); $('audit').innerHTML = table((await api('/admin/audit')).rows.map((r) => ({ at: r.at, actor: r.actor, action: r.action, target: r.target, reason: r.reason })));
  const pl = await api('/admin/players?q=' + encodeURIComponent($('q').value)); $('players').innerHTML = '<b>Online</b>' + table(pl.online) + '<b>Search</b>' + table(pl.search);
}
$('login').onclick = async () => { const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: $('u').value, password: $('p').value, otp: $('otp').value || undefined }) }); const j = await r.json(); if (!r.ok) return alert(j.error); tok = j.accessToken; $('who').textContent = 'role: ' + j.role; load(); };
$('refresh').onclick = load; $('search').onclick = load;
$('sGo').onclick = () => api('/admin/sanction', { charId: $('sChar').value, action: $('sAct').value, reason: $('sReason').value }).then(() => { $('sOut').textContent = 'applied'; load(); }).catch((e) => $('sOut').textContent = e.message);
$('kick').onclick = () => api('/admin/kick', { charId: $('sChar').value, reason: $('sReason').value || 'kicked by GM' }).then((r) => { $('sOut').textContent = r.ok ? 'kicked' : 'not online'; load(); });
$('gGo').onclick = () => { if (!confirm('Grant ' + $('gQty').value + ' × ' + $('gWhat').value + '?')) return; api('/admin/grant', { charId: $('gChar').value, what: $('gWhat').value, qty: Number($('gQty').value), reason: $('gReason').value }).then(() => { $('gOut').textContent = 'granted'; load(); }).catch((e) => $('gOut').textContent = e.message); };
$('annGo').onclick = () => api('/admin/announce', { msg: $('ann').value }).then(() => alert('sent'));
setInterval(() => tok && load().catch(() => {}), 10000);
