/* Portal 前端邏輯。全域：CURRENT_USER, IS_ADMIN, window.t（i18n） */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const fileInput = $('fileInput'), dropzone = $('dropzone'), selected = $('selected'),
        uploadBtn = $('uploadBtn'), progress = $('progress'), progressBar = progress.querySelector('div'),
        onlyMine = $('onlyMine'), doneSearch = $('doneSearch');
  let filesToUpload = [], lastData = { waiting: [], done: [] };

  const T = (k, p) => (window.t ? window.t(k, p) : k);
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function showToast(m, e) { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (e ? ' err' : ''); setTimeout(() => t.className = 'toast', 2500); }
  function fmt(b) { return (b / 1048576).toFixed(1) + ' MB'; }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag'); setFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => setFiles(fileInput.files));
  if (onlyMine) onlyMine.addEventListener('change', renderAll);
  if (doneSearch) doneSearch.addEventListener('input', renderAll);
  $('refreshBtn').addEventListener('click', refreshLists);
  document.addEventListener('i18n:changed', renderAll);

  function setFiles(list) {
    filesToUpload = Array.from(list);
    if (filesToUpload.length) {
      selected.innerHTML = T('selected.prefix') + filesToUpload.map(f => '<b style="color:#93a9ff">' + esc(f.name) + '</b>').join(', ');
      uploadBtn.style.display = 'inline-flex';
    } else { selected.innerHTML = ''; uploadBtn.style.display = 'none'; }
  }

  function uploadOne(file, idx, total) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); const fd = new FormData(); fd.append('file', file);
      xhr.open('POST', '/submit');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round(e.loaded / e.total * 100);
        progressBar.style.width = pct + '%';
        selected.textContent = T('upload.progress', { i: idx, total: total, name: file.name, pct: pct, loaded: fmt(e.loaded), tot: (e.total / 1048576).toFixed(1) });
        if (window.keepAlive) window.keepAlive();
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('HTTP ' + xhr.status));
      xhr.onerror = () => reject(new Error('network'));
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
      catch (e) { showToast(T('toast.uploadFail', { name: filesToUpload[i].name }), true); }
    }
    selected.textContent = '';
    showToast(T('toast.uploadDone', { ok: ok, total: total }), ok < total);
    filesToUpload = []; fileInput.value = '';
    uploadBtn.style.display = 'none'; uploadBtn.disabled = false;
    setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0'; }, 800);
    refreshLists();
  });

  function renderTable(files, isDone) {
    if (!files.length) {
      const searching = isDone && doneSearch && doneSearch.value.trim();
      const key = isDone ? (searching ? 'empty.signedSearch' : 'empty.signed') : 'empty.waiting';
      return '<div class="empty">' + T(key) + '</div>';
    }
    const rows = files.map(f => {
      const url = (isDone ? '/download_signed/' : '/download/') + encodeURIComponent(f.name);
      const isMe = f.owner && f.owner === CURRENT_USER;
      const owner = '<span class="owner-tag' + (isMe ? ' me' : '') + '">' + esc(f.owner || '-') + '</span>';
      const act = isDone
        ? '<a class="btn small" href="' + url + '">' + T('btn.download') + '</a>'
          + '<button class="btn small danger delete-btn" style="margin-left:8px" data-file="' + encodeURIComponent(f.name) + '">' + T('btn.delete') + '</button>'
        : '<span class="badge wait">' + T('badge.processing') + '</span>';
      return '<tr><td class="name">' + esc(f.name) + '</td><td>' + owner + '</td><td>' + esc(f.size) + '</td><td>' + esc(f.mtime) + '</td><td style="text-align:right;white-space:nowrap">' + act + '</td></tr>';
    }).join('');
    return '<table><thead><tr><th>' + T('th.name') + '</th><th>' + T('th.owner') + '</th><th>' + T('th.size') + '</th><th>' + T('th.time') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function renderAll() {
    let w = lastData.waiting, d = lastData.done;
    const mineOnly = IS_ADMIN ? (onlyMine && onlyMine.checked) : true;
    if (mineOnly) { w = w.filter(f => f.owner === CURRENT_USER); d = d.filter(f => f.owner === CURRENT_USER); }
    if (doneSearch) { const q = doneSearch.value.trim().toLowerCase(); if (q) d = d.filter(f => f.name.toLowerCase().includes(q)); }
    $('waitTable').innerHTML = renderTable(w, false);
    $('doneTable').innerHTML = renderTable(d, true);
    $('waitCount').textContent = T('count.files', { n: w.length });
    $('doneCount').textContent = T('count.files', { n: d.length });
  }

  async function refreshLists() { try { const r = await fetch('/api/files'); lastData = await r.json(); renderAll(); } catch (e) { } }

  async function deleteFile(enc) {
    const name = decodeURIComponent(enc);
    if (!confirm(T('confirm.delete', { name: name }))) return;
    try { const r = await fetch('/delete_signed/' + enc, { method: 'POST' }); showToast(r.ok ? T('toast.deleted', { name: name }) : T('toast.deleteFail', { name: name }), !r.ok); }
    catch (e) { showToast(T('toast.deleteFail', { name: name }), true); }
    refreshLists();
  }
  document.addEventListener('click', e => { const b = e.target.closest('.delete-btn'); if (b) deleteFile(b.getAttribute('data-file')); });

  refreshLists(); setInterval(refreshLists, 5000);
})();
