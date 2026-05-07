/**
 * GetNotes — Modern SaaS frontend
 * Vanilla JS, no framework. Same-origin API calls.
 */
(() => {
  'use strict';

  const API = '/api';
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => ctx.querySelectorAll(s);

  /* ============================================================
     HELPERS
     ============================================================ */
  const esc = (s = '') =>
    String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const fmtSize = (b) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const fileIcon = (mime = '') => {
    if (mime.startsWith('image/'))       return '🖼️';
    if (mime.startsWith('video/'))       return '🎬';
    if (mime.includes('pdf'))            return '📄';
    if (mime.includes('word'))           return '📝';
    if (mime.includes('presentation'))   return '📊';
    if (mime.includes('text'))           return '📃';
    return '📎';
  };

  const fileTypeLabel = (mime = '') => {
    if (mime.startsWith('image/'))       return 'IMAGE';
    if (mime.startsWith('video/'))       return 'VIDEO';
    if (mime.includes('pdf'))            return 'PDF';
    if (mime.includes('word'))           return 'DOCX';
    if (mime.includes('presentation'))   return 'PPTX';
    if (mime.includes('text'))           return 'TXT';
    return 'FILE';
  };

  const thumbGradient = (mime = '') => {
    if (mime.startsWith('image/'))       return 'linear-gradient(135deg,#0284c7,#0891b2)';
    if (mime.startsWith('video/'))       return 'linear-gradient(135deg,#dc2626,#db2777)';
    if (mime.includes('pdf'))            return 'linear-gradient(135deg,#4f46e5,#7c3aed)';
    if (mime.includes('word'))           return 'linear-gradient(135deg,#059669,#0d9488)';
    if (mime.includes('presentation'))   return 'linear-gradient(135deg,#d97706,#dc2626)';
    return 'linear-gradient(135deg,#475569,#334155)';
  };

  const starsHtml = (avg) => {
    const full = Math.round(avg || 0);
    return [1,2,3,4,5].map(i => `<span style="color:${i <= full ? '#f59e0b' : '#d1d5db'}">★</span>`).join('');
  };

  async function api(path, opts = {}) {
    const res = await fetch(API + path, opts);
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(e.error || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function toast(msg, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${esc(msg)}</span>
      <button class="toast-x" aria-label="Dismiss">✕</button>`;

    const remove = () => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };
    el.querySelector('.toast-x').addEventListener('click', remove);
    $('#toastContainer').appendChild(el);
    setTimeout(remove, duration);
  }

  /* ============================================================
     MODAL
     ============================================================ */
  let _modalResolve = null;

  function openModal(data = {}) {
    $('#editTitle').value = data.title || '';
    $('#editDesc').value  = data.description || '';
    $('#editTags').value  = (data.tags || []).join(', ');
    $('#editModal').classList.remove('hidden');
    $('#editTitle').focus();

    return new Promise(resolve => { _modalResolve = resolve; });
  }

  function closeModal(result) {
    $('#editModal').classList.add('hidden');
    if (_modalResolve) { _modalResolve(result); _modalResolve = null; }
  }

  $('#modalClose').addEventListener('click',  () => closeModal(null));
  $('#modalCancel').addEventListener('click', () => closeModal(null));
  $('#modalSave').addEventListener('click', () => {
    closeModal({
      title:       $('#editTitle').value.trim(),
      description: $('#editDesc').value.trim(),
      tags:        $('#editTags').value.split(',').map(t => t.trim()).filter(Boolean)
    });
  });
  $('#editModal').addEventListener('click', e => {
    if (e.target === $('#editModal')) closeModal(null);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(null);
  });

  /* ============================================================
     ROUTING
     ============================================================ */
  const VIEWS = { home: 'view-list', trending: 'view-list', upload: 'view-upload', detail: 'view-detail' };

  function show(name) {
    Object.values(VIEWS).forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById(VIEWS[name])?.classList.remove('hidden');
    $$('.nav-link').forEach(a => {
      const match = a.dataset.route === name || (name === 'detail' && a.dataset.route === 'home');
      a.classList.toggle('active', match);
    });
  }

  function navigate(route, arg) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (route === 'home')     return loadList(false);
    if (route === 'trending') return loadList(true);
    if (route === 'upload')   { show('upload'); return; }
    if (route === 'detail')   return loadDetail(arg);
  }

  /* ============================================================
     BROWSE / TRENDING
     ============================================================ */
  async function loadList(trending = false) {
    show('home');
    $('#listTitle').textContent = trending ? '🔥 Trending resources' : 'Latest resources';
    $('#listCount').textContent = '';
    $('#emptyState').classList.add('hidden');
    $('#resourceGrid').innerHTML = skeletons(6);

    try {
      const params = new URLSearchParams();
      const q = $('#searchInput').value.trim();
      const m = $('#moduleFilter').value;
      if (q) params.set('search', q);
      if (m) params.set('module', m);

      const path = trending ? '/resources/trending' : `/resources?${params}`;
      const data  = await api(path);
      const list  = data.resources || [];

      renderList(list);
      $('#listCount').textContent = `${list.length} result${list.length === 1 ? '' : 's'}`;

      // update hero stats
      if (!trending && !q && !m) {
        $('#statResources').textContent = list.length;
        const mods = new Set(list.map(r => r.module).filter(Boolean));
        $('#statModules').textContent = mods.size;
      }
    } catch (err) {
      $('#resourceGrid').innerHTML = `
        <div class="loading-row">
          <span>⚠️ Failed to load: ${esc(err.message)}</span>
        </div>`;
    }
  }

  function skeletons(n) {
    return Array.from({ length: n }, () => `
      <div class="skeleton-card">
        <div class="sk sk-thumb"></div>
        <div class="sk-body">
          <div class="sk sk-line sk-w75"></div>
          <div class="sk sk-line sk-w50"></div>
          <div class="sk sk-line sk-w35" style="margin-top:6px"></div>
        </div>
      </div>`).join('');
  }

  function renderList(resources) {
    const grid = $('#resourceGrid');
    if (!resources.length) {
      grid.innerHTML = '';
      $('#emptyState').classList.remove('hidden');
      return;
    }
    $('#emptyState').classList.add('hidden');

    grid.innerHTML = resources.map(r => `
      <article class="card" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="${esc(r.title)}">
        <div class="card-thumb" style="background:${thumbGradient(r.contentType)}">
          <span class="card-thumb-icon">${fileIcon(r.contentType)}</span>
          <span class="card-thumb-type">${fileTypeLabel(r.contentType)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(r.title)}</h3>
          ${r.description ? `<p class="card-desc">${esc(r.description)}</p>` : ''}
          <div class="card-foot">
            <span class="tag">${esc(r.module)}</span>
            <div class="card-stats">
              ${r.ratingCount ? `<span class="stars">${starsHtml(r.avgRating)} ${r.avgRating?.toFixed(1)}</span>` : ''}
              <span>${r.views || 0} views</span>
            </div>
          </div>
        </div>
      </article>`).join('');

    // Populate module filter
    const modules = [...new Set(resources.map(r => r.module).filter(Boolean))].sort();
    const sel = $('#moduleFilter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All modules</option>' +
      modules.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    sel.value = cur;

    grid.querySelectorAll('.card').forEach(el => {
      const go = () => navigate('detail', el.dataset.id);
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  /* ============================================================
     DETAIL VIEW
     ============================================================ */
  async function loadDetail(id) {
    show('detail');
    $('#detailContent').innerHTML = `
      <div class="loading-row">
        <span class="spinner dark"></span> Loading resource…
      </div>`;

    try {
      const [r, commentsData] = await Promise.all([
        api(`/resources/${encodeURIComponent(id)}`),
        api(`/interactions/comments/${encodeURIComponent(id)}`).catch(() => ({ comments: [] }))
      ]);

      const comments = commentsData.comments || [];

      const previewHtml = (() => {
        if (!r.fileUrl) return '';
        const url = esc(r.fileUrl);
        if (r.contentType?.startsWith('image/'))
          return `<div class="detail-preview"><img src="${url}" alt="${esc(r.title)}" /></div>`;
        if (r.contentType?.startsWith('video/'))
          return `<div class="detail-preview"><video controls src="${url}"></video></div>`;
        if (r.contentType?.includes('pdf'))
          return `<div class="detail-preview"><iframe src="${url}" title="PDF preview"></iframe></div>`;
        return '';
      })();

      $('#detailContent').innerHTML = `
        <div class="detail-grid">
          <div class="detail-main">

            <!-- Main info panel -->
            <div class="panel">
              <div class="detail-header-strip" style="background:${thumbGradient(r.contentType)}"></div>
              <div class="detail-top">
                <h1 class="detail-title">${esc(r.title)}</h1>
                <div class="detail-tags">
                  <span class="tag">${esc(r.module)}</span>
                  ${r.course ? `<span class="tag" style="background:#f0fdf4;color:#166534">${esc(r.course)}</span>` : ''}
                  ${(r.tags || []).map(t => `<span class="tag" style="background:#fdf4ff;color:#7e22ce">${esc(t)}</span>`).join('')}
                </div>
                ${r.description ? `<p class="detail-desc">${esc(r.description)}</p>` : ''}
                <div class="detail-actions">
                  <a class="btn btn-primary" href="${esc(r.fileUrl)}" target="_blank" rel="noopener">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download / Open
                  </a>
                  <button class="btn btn-ghost" id="btnEdit">Edit</button>
                  <button class="btn btn-outline-danger" id="btnDelete">Delete</button>
                </div>
              </div>
            </div>

            ${previewHtml}

            <!-- Comments panel -->
            <div class="panel">
              <div class="panel-head">💬 Comments (${comments.length})</div>
              <div class="panel-body">
                <form class="comment-form-row" id="commentForm" data-id="${esc(r.id)}">
                  <input id="commentText" placeholder="Share your thoughts or feedback…" maxlength="2000" required autocomplete="off" />
                  <button type="submit" class="btn btn-primary btn-sm">Post</button>
                </form>
                <div class="comment-list" id="commentList">
                  ${comments.length
                    ? comments.map(c => `
                        <div class="comment">
                          <div class="comment-meta">👤 ${esc(c.userId)} · ${fmtDate(c.createdAt)}</div>
                          <div class="comment-text">${esc(c.text)}</div>
                        </div>`).join('')
                    : '<p class="no-comments">No comments yet. Be the first!</p>'}
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <aside class="detail-aside">
            <div class="panel">
              <div class="panel-head">📋 Details</div>
              <div class="panel-body">
                <div class="meta-list">
                  <div class="meta-row"><span class="meta-k">File type</span><span class="meta-v">${fileTypeLabel(r.contentType)}</span></div>
                  <div class="meta-row"><span class="meta-k">Size</span><span class="meta-v">${fmtSize(r.fileSize)}</span></div>
                  <div class="meta-row"><span class="meta-k">Views</span><span class="meta-v">${r.views || 0}</span></div>
                  <div class="meta-row"><span class="meta-k">Uploaded by</span><span class="meta-v">${esc(r.uploadedBy || 'anonymous')}</span></div>
                  <div class="meta-row"><span class="meta-k">Uploaded</span><span class="meta-v">${fmtDate(r.createdAt)}</span></div>
                  ${r.university ? `<div class="meta-row"><span class="meta-k">University</span><span class="meta-v">${esc(r.university)}</span></div>` : ''}
                </div>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head">⭐ Rating</div>
              <div class="panel-body">
                <div class="rating-widget">
                  <div class="rating-label">
                    ${r.ratingCount
                      ? `${starsHtml(r.avgRating)} ${r.avgRating?.toFixed(1)} <span style="color:var(--text-muted)">(${r.ratingCount} rating${r.ratingCount !== 1 ? 's' : ''})</span>`
                      : 'No ratings yet'}
                  </div>
                  <div class="star-row" id="starRow" data-id="${esc(r.id)}">
                    ${[1,2,3,4,5].map(n => `<button class="star-btn" data-n="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}
                  </div>
                  <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Click to rate this resource</p>
                </div>
              </div>
            </div>
          </aside>
        </div>`;

      wireDetail(r);
    } catch (err) {
      $('#detailContent').innerHTML = `
        <div class="loading-row">⚠️ ${esc(err.message)}</div>`;
    }
  }

  function wireDetail(resource) {
    // Delete
    $('#btnDelete').addEventListener('click', async () => {
      if (!confirm(`Delete "${resource.title}"? This also removes the file from Blob Storage.`)) return;
      try {
        await api(`/resources/${encodeURIComponent(resource.id)}`, { method: 'DELETE' });
        toast('Resource deleted.', 'success');
        navigate('home');
      } catch (err) {
        toast('Delete failed: ' + err.message, 'error');
      }
    });

    // Edit — uses modal, not prompt()
    $('#btnEdit').addEventListener('click', async () => {
      const result = await openModal({
        title:       resource.title,
        description: resource.description,
        tags:        resource.tags
      });
      if (!result) return;
      if (!result.title) { toast('Title is required.', 'error'); return; }
      try {
        await api(`/resources/${encodeURIComponent(resource.id)}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(result)
        });
        toast('Resource updated!', 'success');
        navigate('detail', resource.id);
      } catch (err) {
        toast('Update failed: ' + err.message, 'error');
      }
    });

    // Star rating with hover highlighting
    const starRow = $('#starRow');
    if (starRow) {
      const stars = [...starRow.querySelectorAll('.star-btn')];
      stars.forEach((btn, i) => {
        btn.addEventListener('mouseenter', () => stars.forEach((s, j) => s.classList.toggle('hl', j <= i)));
        btn.addEventListener('mouseleave', () => stars.forEach(s => s.classList.remove('hl')));
        btn.addEventListener('click', async () => {
          const n = Number(btn.dataset.n);
          try {
            await api('/interactions/ratings', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ resourceId: resource.id, rating: n })
            });
            toast(`Rated ${n} star${n > 1 ? 's' : ''}!`, 'success');
            navigate('detail', resource.id);
          } catch (err) {
            toast('Rating failed: ' + err.message, 'error');
          }
        });
      });
    }

    // Comment form
    const commentForm = $('#commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = $('#commentText').value.trim();
        if (!text) return;
        const btn = commentForm.querySelector('button');
        btn.disabled = true;
        try {
          await api('/interactions/comments', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ resourceId: resource.id, text })
          });
          $('#commentText').value = '';
          toast('Comment posted!', 'success');
          navigate('detail', resource.id);
        } catch (err) {
          toast('Comment failed: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  /* ============================================================
     UPLOAD — drag-and-drop
     ============================================================ */
  let _selectedFile = null;

  function wireUpload() {
    const dropZone   = $('#dropZone');
    const fileInput  = $('#file');
    const dzIdle     = $('#dzIdle');
    const dzPreview  = $('#dzPreview');
    const previewIcon = $('#previewIcon');
    const previewName = $('#previewName');
    const previewSize = $('#previewSize');
    const removeBtn  = $('#removeFile');
    const uploadForm = $('#uploadForm');
    const uploadBtn  = $('#uploadBtn');
    const btnInner   = $('#uploadBtnInner');

    function setFile(f) {
      _selectedFile = f;
      previewIcon.textContent = fileIcon(f.type);
      previewName.textContent = f.name;
      previewSize.textContent = fmtSize(f.size);
      dzIdle.classList.add('hidden');
      dzPreview.classList.remove('hidden');
    }

    function clearFile() {
      _selectedFile = null;
      fileInput.value = '';
      dzPreview.classList.add('hidden');
      dzIdle.classList.remove('hidden');
    }

    // Drag events on the zone
    dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('over'); });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('over');
      const f = e.dataTransfer?.files?.[0];
      if (f) setFile(f);
    });

    // Click zone → open file dialog (but not when clicking remove button)
    dropZone.addEventListener('click', e => {
      if (e.target.closest('.preview-remove')) return;
      fileInput.click();
    });
    dropZone.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.preview-remove')) {
        e.preventDefault(); fileInput.click();
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) setFile(fileInput.files[0]);
    });

    removeBtn.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

    // Submit
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!_selectedFile) { toast('Please select or drop a file first.', 'error'); return; }

      const inner = btnInner.innerHTML;
      btnInner.innerHTML = '<span class="spinner"></span> Uploading…';
      uploadBtn.disabled = true;

      try {
        const fd = new FormData(uploadForm);
        fd.set('file', _selectedFile, _selectedFile.name);

        const res  = await fetch(API + '/resources', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        toast('Resource uploaded successfully!', 'success');
        uploadForm.reset();
        clearFile();
        setTimeout(() => navigate('detail', data.id), 600);
      } catch (err) {
        toast('Upload failed: ' + err.message, 'error');
      } finally {
        btnInner.innerHTML = inner;
        uploadBtn.disabled = false;
      }
    });
  }

  /* ============================================================
     NAV
     ============================================================ */
  function wireNav() {
    document.body.addEventListener('click', e => {
      const link = e.target.closest('[data-route]');
      if (!link) return;
      e.preventDefault();
      navigate(link.dataset.route);
    });
    $('#searchBtn').addEventListener('click', () => loadList(false));
    $('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') loadList(false); });
    $('#moduleFilter').addEventListener('change', () => loadList(false));
  }

  /* ============================================================
     BOOT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    wireNav();
    wireUpload();
    loadList(false);
  });

})();
