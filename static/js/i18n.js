/* 簡易 i18n：data-i18n 靜態文字 + t() 給 JS 產生的字串。
   語言記在 localStorage('lang')，預設依瀏覽器語言（zh-* → zh，否則 en）。
   切換後派發 'i18n:changed' 事件，讓各頁重繪動態內容。 */
(function () {
  "use strict";
  const DICT = {
    zh: {
      "nav.admin": "管理後台", "nav.changepw": "改密碼", "nav.logout": "登出",
      "nav.backportal": "回 Portal", "label.user": "用户",
      "login.subtitle": "Code Signing Portal 登入",
      "field.username": "帳號", "field.password": "密碼", "btn.login": "登入",
      "cpw.title": "修改密碼", "cpw.forced": "首次登入請設定新密碼", "cpw.normal": "修改你的密碼",
      "cpw.current": "目前密碼", "cpw.new": "新密碼（至少 {n} 碼）", "cpw.confirm": "再次輸入新密碼",
      "btn.updatepw": "更新密碼",
      "portal.subtitle": "Windows 應用程式數位簽章服務 — 上傳待簽檔案，簽署完成後即可下載。",
      "portal.uploadCard": "上傳待簽章檔案",
      "portal.dropA": "拖曳檔案到這裡，或 ", "portal.dropB": "點擊選擇檔案",
      "portal.dropHint": "支援 .exe / .dll / .msi / .ps1（可一次選多個）",
      "portal.startUpload": "開始上傳", "portal.onlyMine": "只顯示我上傳的檔案",
      "btn.refresh": "重新整理", "portal.waiting": "待簽章", "portal.signed": "已簽章",
      "portal.searchPh": "搜尋已簽章檔名…",
      "portal.deleteHint": "下載完成後，請按刪除移除自己的檔案，保持清單乾淨。",
      "th.name": "檔名", "th.owner": "上傳者", "th.size": "大小", "th.time": "時間",
      "badge.processing": "處理中", "btn.download": "下載", "btn.delete": "刪除",
      "empty.waiting": "目前沒有待簽章的檔案", "empty.signed": "目前沒有已簽章的檔案",
      "empty.signedSearch": "找不到符合的已簽章檔案",
      "count.files": "{n} 個檔案", "selected.prefix": "已選擇: ",
      "toast.uploadDone": "上傳完成！成功 {ok}/{total} 個檔案", "toast.uploadFail": "上傳失敗：{name}",
      "confirm.delete": "確定要刪除「{name}」嗎？此動作無法復原。",
      "toast.deleted": "已刪除：{name}", "toast.deleteFail": "刪除失敗：{name}",
      "upload.progress": "上傳中 ({i}/{total})：{name} {pct}% ({loaded} / {tot} MB)",
      "admin.title": "管理後台", "admin.subtitle": "使用者管理與稽核紀錄",
      "admin.newUser": "新增使用者", "admin.createBtn": "建立帳號",
      "admin.newUserHint": "建立後會產生一次性臨時密碼（只顯示一次），交給本人，對方首次登入須改密碼。",
      "admin.usersList": "使用者清單", "admin.auditTitle": "稽核紀錄（最近 200 筆）",
      "admin.auditSearchPh": "搜尋稽核（帳號 / 動作 / 檔名 / IP…）",
      "th.role": "角色", "th.status": "狀態", "th.created": "建立時間",
      "badge.enabled": "啟用", "badge.disabled": "停用", "tag.mustchange": "(待改密碼)",
      "btn.resetpw": "重設密碼", "btn.disable": "停用", "btn.enable": "啟用",
      "th.action": "動作", "th.target": "對象", "th.result": "結果",
      "empty.users": "尚無使用者", "empty.audit": "尚無紀錄", "empty.auditSearch": "找不到符合的紀錄",
      "confirm.resetpw": "重設 {u} 的密碼？將產生新臨時密碼。", "confirm.deluser": "確定刪除帳號 {u}？",
      "toast.resetdone": "已重設，臨時密碼：{pw}", "msg.createOk": "已建立 {u}，臨時密碼：{pw}（請立即複製交給本人，僅顯示一次）",
      "msg.needUser": "請輸入帳號", "msg.fail": "操作失敗",
      "idle.warn": "閒置過久，30 秒後將自動登出（移動滑鼠可繼續）"
    },
    en: {
      "nav.admin": "Admin", "nav.changepw": "Change password", "nav.logout": "Log out",
      "nav.backportal": "Back to Portal", "label.user": "User",
      "login.subtitle": "Sign in — Code Signing Portal",
      "field.username": "Username", "field.password": "Password", "btn.login": "Sign in",
      "cpw.title": "Change Password", "cpw.forced": "Set a new password for your first login", "cpw.normal": "Change your password",
      "cpw.current": "Current password", "cpw.new": "New password (min {n} chars)", "cpw.confirm": "Confirm new password",
      "btn.updatepw": "Update password",
      "portal.subtitle": "Windows code-signing service — upload files to sign, then download once signed.",
      "portal.uploadCard": "Upload files to sign",
      "portal.dropA": "Drag files here, or ", "portal.dropB": "click to choose",
      "portal.dropHint": "Supports .exe / .dll / .msi / .ps1 (multiple allowed)",
      "portal.startUpload": "Start upload", "portal.onlyMine": "Show only my files",
      "btn.refresh": "Refresh", "portal.waiting": "Waiting", "portal.signed": "Signed",
      "portal.searchPh": "Search signed files…",
      "portal.deleteHint": "After downloading, please delete your file to keep the list clean.",
      "th.name": "File", "th.owner": "Owner", "th.size": "Size", "th.time": "Time",
      "badge.processing": "Processing", "btn.download": "Download", "btn.delete": "Delete",
      "empty.waiting": "No files waiting", "empty.signed": "No signed files",
      "empty.signedSearch": "No matching signed files",
      "count.files": "{n} file(s)", "selected.prefix": "Selected: ",
      "toast.uploadDone": "Upload done: {ok}/{total} succeeded", "toast.uploadFail": "Upload failed: {name}",
      "confirm.delete": "Delete \"{name}\"? This cannot be undone.",
      "toast.deleted": "Deleted: {name}", "toast.deleteFail": "Delete failed: {name}",
      "upload.progress": "Uploading ({i}/{total}): {name} {pct}% ({loaded} / {tot} MB)",
      "admin.title": "Admin", "admin.subtitle": "User management & audit log",
      "admin.newUser": "New user", "admin.createBtn": "Create account",
      "admin.newUserHint": "A one-time password is generated (shown once). Give it to the user; they must change it on first login.",
      "admin.usersList": "Users", "admin.auditTitle": "Audit log (latest 200)",
      "admin.auditSearchPh": "Search audit (user / action / file / IP…)",
      "th.role": "Role", "th.status": "Status", "th.created": "Created",
      "badge.enabled": "Enabled", "badge.disabled": "Disabled", "tag.mustchange": "(must change pw)",
      "btn.resetpw": "Reset password", "btn.disable": "Disable", "btn.enable": "Enable",
      "th.action": "Action", "th.target": "Target", "th.result": "Result",
      "empty.users": "No users", "empty.audit": "No records", "empty.auditSearch": "No matching records",
      "confirm.resetpw": "Reset password for {u}? A new one-time password will be generated.", "confirm.deluser": "Delete account {u}?",
      "toast.resetdone": "Reset done. One-time password: {pw}", "msg.createOk": "Created {u}. One-time password: {pw} (copy now — shown once)",
      "msg.needUser": "Please enter a username", "msg.fail": "Operation failed",
      "idle.warn": "Idle too long — auto logout in 30s (move mouse to stay)"
    }
  };

  function detect() {
    const saved = localStorage.getItem('lang');
    if (saved === 'zh' || saved === 'en') return saved;
    return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  let lang = detect();

  function fmt(s, params) {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  }
  function t(key, params) {
    const s = (DICT[lang] && DICT[lang][key]) || (DICT.zh[key]) || key;
    return fmt(s, params);
  }
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const n = el.getAttribute('data-n');
      el.textContent = t(key, n != null ? { n } : null);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = (lang === 'zh') ? 'EN' : '繁中';
  }
  function setLang(l) {
    lang = l; localStorage.setItem('lang', l);
    document.documentElement.setAttribute('lang', l === 'zh' ? 'zh-Hant' : 'en');
    apply();
    document.dispatchEvent(new Event('i18n:changed'));
  }

  // 建立右上角語言切換鈕
  function mountToggle() {
    if (document.getElementById('langToggle')) return;
    const b = document.createElement('button');
    b.id = 'langToggle'; b.type = 'button'; b.className = 'lang-toggle';
    b.addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));
    document.body.appendChild(b);
  }

  window.t = t;
  window.currentLang = () => lang;
  window.setLang = setLang;

  document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-Hant' : 'en');
  mountToggle();
  apply();
})();
