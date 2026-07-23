/* Portal 前端邏輯。需要全域變數 CURRENT_USER（由頁面注入）。 */
(function () {
  "use strict";
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const selected = document.getElementById('selected');
  const uploadBtn = document.getElementById('uploadBtn');
  const progress = document.getElementById('progress');
  const progressBar = progress.querySelector('div');
  const onlyMine = document.getElementById('onlyMine');
  let filesToUpload = [];
  let lastData = { waiting: [], done: [] };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function showToast(m, e) {
    const t = document.getElementById('toast');
    t.textContent = m; t.className = 'toast show' + (e ? ' err' : '');
    setTimeout(() => t.className = 'toast', 2500);
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag'); setFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => setFiles(fileInput.files));
  if (onlyMine) onlyMine.addEventListener('change', renderAll);
  document.getElementById('refreshBtn').addEventListener('click', refreshLists);

  function setFiles(list) {
    filesToUpload = Array.from(list);
    if (filesToUpload.length) {
      selected.innerHTML = '已選擇: ' + filesToUpload.map(f => '<b style="color:#93a9ff">' + esc(f.name) + '</b>').join(', ');
      uploadBtn.style.display = 'inline-flex';
    } else {
      selected.innerHTML = ''; uploadBtn.style.display = 'none';
    }
  }

  function fmt(b) { return (b / 1048576).toFixed(1) + ' MB'; }

  function uploadOne(file, idx, total) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData(); fd.append('file', file);
      xhr.open('POST', '/submit');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round(e.loaded / e.total * 100);
        progressBar.style.width = pct + '%';
        selected.textContent = '上傳中 (' + idx + '/' + total + ')：' + file.name +
          '  ' + pct + '%  (' + fmt(e.loaded) + ' / ' + fmt(e.total) + ')';
        if (window.keepAlive) window.keepAlive();   // 上傳期間維持登入
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
        ? resolve() : reject(new Error('HTTP ' + xhr.status));
      xhr.onerror = () => reject(new Error('network error'));
      xhr.send(fd);
    });
  }

  uploadBtn.addEventListener('click', async () => {
    if (!filesToUpload.length) return;
    uploadBtn.disabled = true; progress.style.display = 'block';
    const total = filesToUpload.length; let ok = 0;
    for (let i = 0; i < total; i++) {
      progressBar.style.width = '0%';
      try { await uploadOne(filesToUpload[i], i + 1, total); ok++; }
      catch (e) { showToast('上傳失敗：' + filesToUpload[i].name, true); }
    }
    selected.textContent = '';
    showToast('上傳完成！成功 ' + ok + '/' + total + ' 個檔案', ok < total);
    filesToUpload = []; fileInput.value = '';
    uploadBtn.style.display = 'none'; uploadBtn.disabled = false;
    setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0'; }, 800);
    refreshLists();
  });

  function renderTable(files, isDone) {
    if (!files.length) return '<div class="empty">' + (isDone ? '目前沒有已簽章的檔案' : '目前沒有待簽章的檔案') + '</div>';
    let rows = files.map(f => {
      const url = (isDone ? '/download_signed/' : '/download/') + encodeURIComponent(f.name);
      const isMe = f.owner && f.owner === CURRENT_USER;
      const owner = '<span class="owner-tag' + (isMe ? ' me' : '') + '">' + esc(f.owner || '-') + '</span>';
      let act = isDone
        ? '<a class="btn small" href="' + url + '">下載</a><button class="btn small danger delete-btn" style="margin-left:8px" data-file="' + encodeURIComponent(f.name) + '">刪除</button>'
        : '<span class="badge wait">處理中</span>';
      return '<tr><td class="name">' + esc(f.name) + '</td><td>' + owner + '</td><td>' + esc(f.size) + '</td><td>' + esc(f.mtime) + '</td><td style="text-align:right;white-space:nowrap">' + act + '</td></tr>';
    }).join('');
    return '<table><thead><tr><th>檔名</th><th>上傳者</th><th>大小</th><th>時間</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderAll() {
    let w = lastData.waiting, d = lastData.done;
    // 一般使用者：一律只顯示自己的檔；admin：依勾選決定
    const mineOnly = IS_ADMIN ? (onlyMine && onlyMine.checked) : true;
    if (mineOnly) { w = w.filter(f => f.owner === CURRENT_USER); d = d.filter(f => f.owner === CURRENT_USER); }
    document.getElementById('waitTable').innerHTML = renderTable(w, false);
    document.getElementById('doneTable').innerHTML = renderTable(d, true);
    document.getElementById('waitCount').textContent = w.length + ' 個檔案';
    document.getElementById('doneCount').textContent = d.length + ' 個檔案';
  }

  async function refreshLists() {
    try { const r = await fetch('/api/files'); lastData = await r.json(); renderAll(); } catch (e) { }
  }

  async function deleteFile(enc) {
    const name = decodeURIComponent(enc);
    if (!confirm('確定要刪除「' + name + '」嗎？此動作無法復原。')) return;
    try {
      const r = await fetch('/delete_signed/' + enc, { method: 'POST' });
      showToast(r.ok ? ('已刪除：' + name) : ('刪除失敗：' + name), !r.ok);
    } catch (e) { showToast('刪除失敗：' + name, true); }
    refreshLists();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.delete-btn');
    if (b) deleteFile(b.getAttribute('data-file'));
  });

  refreshLists();
  setInterval(refreshLists, 5000);
})();
