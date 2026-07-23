/* 管理後台前端邏輯。 */
(function () {
  "use strict";
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function showToast(m, e) {
    const t = document.getElementById('toast');
    t.textContent = m; t.className = 'toast show' + (e ? ' err' : '');
    setTimeout(() => t.className = 'toast', 3000);
  }
  async function postJSON(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let d = {}; try { d = await r.json(); } catch (e) { }
    return { ok: r.ok, data: d };
  }

  async function createUser() {
    const input = document.getElementById('newUser');
    const m = document.getElementById('createMsg');
    const u = input.value.trim();
    if (!u) { m.className = 'msg err'; m.textContent = '請輸入帳號'; return; }
    const { ok, data } = await postJSON('/admin/create_user', { username: u });
    if (ok) {
      m.className = 'msg ok';
      m.innerHTML = '已建立 <b>' + esc(u) + '</b>，臨時密碼：<b style="color:#7fe9ff">' + esc(data.temp_password) + '</b>（請立即複製交給本人，僅顯示一次）';
      input.value = ''; loadUsers();
    } else { m.className = 'msg err'; m.textContent = data.error || '建立失敗'; }
  }

  async function resetPw(u) {
    if (!confirm('重設 ' + u + ' 的密碼？將產生新臨時密碼。')) return;
    const { ok, data } = await postJSON('/admin/reset_password', { username: u });
    showToast(ok ? ('已重設，臨時密碼：' + data.temp_password) : (data.error || '失敗'), !ok);
    loadUsers();
  }
  async function toggleUser(u) {
    const { ok, data } = await postJSON('/admin/toggle_user', { username: u });
    if (!ok) showToast(data.error || '失敗', true);
    loadUsers();
  }
  async function delUser(u) {
    if (!confirm('確定刪除帳號 ' + u + ' ？')) return;
    const { ok, data } = await postJSON('/admin/delete_user', { username: u });
    if (!ok) showToast(data.error || '失敗', true);
    loadUsers();
  }

  async function loadUsers() {
    const r = await fetch('/admin/api/users');
    const users = await r.json();
    const box = document.getElementById('usersTable');
    if (!users.length) { box.innerHTML = '<div class="empty">尚無使用者</div>'; return; }
    let rows = users.map(u => {
      const roleB = u.role === 'admin' ? '<span class="badge admin">admin</span>' : 'user';
      const actB = u.active ? '<span class="badge on">啟用</span>' : '<span class="badge off">停用</span>';
      const mc = u.must_change ? ' <span class="hint">(待改密碼)</span>' : '';
      let ops = '';
      if (u.role !== 'admin') {
        const un = esc(u.username);
        ops = '<button class="btn small ghost" data-act="reset" data-user="' + un + '">重設密碼</button>'
            + ' <button class="btn small ghost" data-act="toggle" data-user="' + un + '">' + (u.active ? '停用' : '啟用') + '</button>'
            + ' <button class="btn small danger" data-act="del" data-user="' + un + '">刪除</button>';
      }
      return '<tr><td class="name">' + esc(u.username) + mc + '</td><td>' + roleB + '</td><td>' + actB + '</td><td>' + esc(u.created_at || '-') + '</td><td style="text-align:right;white-space:nowrap">' + ops + '</td></tr>';
    }).join('');
    box.innerHTML = '<table><thead><tr><th>帳號</th><th>角色</th><th>狀態</th><th>建立時間</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  async function loadAudit() {
    const r = await fetch('/admin/api/audit');
    const rows = await r.json();
    const box = document.getElementById('auditTable');
    if (!rows.length) { box.innerHTML = '<div class="empty">尚無紀錄</div>'; return; }
    let body = rows.map(a => '<tr><td>' + esc(a.ts) + '</td><td class="name">' + esc(a.username || '-') + '</td><td>' + esc(a.action) + '</td><td class="name">' + esc(a.target || '') + '</td><td>' + esc(a.ip || '') + '</td><td>' + esc(a.result || '') + '</td></tr>').join('');
    box.innerHTML = '<table><thead><tr><th>時間</th><th>使用者</th><th>動作</th><th>對象</th><th>IP</th><th>結果</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  document.getElementById('createBtn').addEventListener('click', createUser);
  document.getElementById('reloadUsers').addEventListener('click', loadUsers);
  document.getElementById('reloadAudit').addEventListener('click', loadAudit);
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const u = b.getAttribute('data-user'), act = b.getAttribute('data-act');
    if (act === 'reset') resetPw(u);
    else if (act === 'toggle') toggleUser(u);
    else if (act === 'del') delUser(u);
  });

  loadUsers();
  loadAudit();
})();
