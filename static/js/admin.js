/* 管理後台前端邏輯（i18n + 稽核搜尋）。全域：window.t */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const T = (k, p) => (window.t ? window.t(k, p) : k);
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function showToast(m, e) { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (e ? ' err' : ''); setTimeout(() => t.className = 'toast', 3000); }
  async function postJSON(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let d = {}; try { d = await r.json(); } catch (e) { } return { ok: r.ok, data: d };
  }
  let lastUsers = [], lastAudit = [];

  async function createUser() {
    const input = $('newUser'), m = $('createMsg'); const u = input.value.trim();
    if (!u) { m.className = 'msg err'; m.textContent = T('msg.needUser'); return; }
    const { ok, data } = await postJSON('/admin/create_user', { username: u });
    if (ok) {
      m.className = 'msg ok';
      m.innerHTML = T('msg.createOk', { u: esc(u), pw: '<b style="color:#7fe9ff">' + esc(data.temp_password) + '</b>' });
      input.value = ''; loadUsers();
    } else { m.className = 'msg err'; m.textContent = data.error || T('msg.fail'); }
  }
  async function resetPw(u) {
    if (!confirm(T('confirm.resetpw', { u: u }))) return;
    const { ok, data } = await postJSON('/admin/reset_password', { username: u });
    showToast(ok ? T('toast.resetdone', { pw: data.temp_password }) : (data.error || T('msg.fail')), !ok); loadUsers();
  }
  async function toggleUser(u) { const { ok, data } = await postJSON('/admin/toggle_user', { username: u }); if (!ok) showToast(data.error || T('msg.fail'), true); loadUsers(); }
  async function delUser(u) { if (!confirm(T('confirm.deluser', { u: u }))) return; const { ok, data } = await postJSON('/admin/delete_user', { username: u }); if (!ok) showToast(data.error || T('msg.fail'), true); loadUsers(); }

  function renderUsers() {
    const box = $('usersTable'), users = lastUsers;
    if (!users.length) { box.innerHTML = '<div class="empty">' + T('empty.users') + '</div>'; return; }
    const rows = users.map(u => {
      const roleB = u.role === 'admin' ? '<span class="badge admin">admin</span>' : 'user';
      const actB = u.active ? '<span class="badge on">' + T('badge.enabled') + '</span>' : '<span class="badge off">' + T('badge.disabled') + '</span>';
      const mc = u.must_change ? ' <span class="hint">' + T('tag.mustchange') + '</span>' : '';
      let ops = '';
      if (u.role !== 'admin') {
        const un = esc(u.username);
        ops = '<button class="btn small ghost" data-act="reset" data-user="' + un + '">' + T('btn.resetpw') + '</button>'
            + ' <button class="btn small ghost" data-act="toggle" data-user="' + un + '">' + (u.active ? T('btn.disable') : T('btn.enable')) + '</button>'
            + ' <button class="btn small danger" data-act="del" data-user="' + un + '">' + T('btn.delete') + '</button>';
      }
      return '<tr><td class="name">' + esc(u.username) + mc + '</td><td>' + roleB + '</td><td>' + actB + '</td><td>' + esc(u.created_at || '-') + '</td><td style="text-align:right;white-space:nowrap">' + ops + '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>' + T('field.username') + '</th><th>' + T('th.role') + '</th><th>' + T('th.status') + '</th><th>' + T('th.created') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderAudit() {
    const box = $('auditTable'); const as = $('auditSearch');
    const q = as ? as.value.trim().toLowerCase() : '';
    let rows = lastAudit;
    if (q) rows = rows.filter(a => [a.ts, a.username, a.action, a.target, a.ip, a.result].some(v => String(v || '').toLowerCase().includes(q)));
    if (!rows.length) { box.innerHTML = '<div class="empty">' + T(q ? 'empty.auditSearch' : 'empty.audit') + '</div>'; return; }
    const body = rows.map(a => '<tr><td>' + esc(a.ts) + '</td><td class="name">' + esc(a.username || '-') + '</td><td>' + esc(a.action) + '</td><td class="name">' + esc(a.target || '') + '</td><td>' + esc(a.ip || '') + '</td><td>' + esc(a.result || '') + '</td></tr>').join('');
    box.innerHTML = '<table><thead><tr><th>' + T('th.time') + '</th><th>' + T('label.user') + '</th><th>' + T('th.action') + '</th><th>' + T('th.target') + '</th><th>IP</th><th>' + T('th.result') + '</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  async function loadUsers() { const r = await fetch('/admin/api/users'); lastUsers = await r.json(); renderUsers(); }
  async function loadAudit() { const r = await fetch('/admin/api/audit'); lastAudit = await r.json(); renderAudit(); }

  $('createBtn').addEventListener('click', createUser);
  $('reloadUsers').addEventListener('click', loadUsers);
  $('reloadAudit').addEventListener('click', loadAudit);
  if ($('auditSearch')) $('auditSearch').addEventListener('input', renderAudit);
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const u = b.getAttribute('data-user'), act = b.getAttribute('data-act');
    if (act === 'reset') resetPw(u); else if (act === 'toggle') toggleUser(u); else if (act === 'del') delUser(u);
  });
  document.addEventListener('i18n:changed', () => { renderUsers(); renderAudit(); });

  loadUsers(); loadAudit();
})();
