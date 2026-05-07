/**
 * GetNotes frontend.
 * Vanilla JS, no framework. Talks to /api/* on the same origin so no CORS issue
 * when both frontend and backend are served by the same App Service.
 */
(() => {
    'use strict';

    const API = '/api';
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ---------- Helpers ----------
    const fileIcon = (mime = '') => {
        if (mime.startsWith('image/'))  return '🖼️';
        if (mime.startsWith('video/'))  return '🎬';
        if (mime.includes('pdf'))       return '📄';
        if (mime.includes('word'))      return '📝';
        if (mime.includes('presentation')) return '📊';
        return '📎';
    };
    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };
    const formatDate = (iso) => new Date(iso).toLocaleDateString();
    const escapeHtml = (s = '') =>
        String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

    async function api(path, options = {}) {
        const res = await fetch(API + path, options);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return res.status === 204 ? null : res.json();
    }

    // ---------- Routing ----------
    const views = {
        home:     'view-list',
        trending: 'view-list',
        upload:   'view-upload',
        detail:   'view-detail'
    };
    function show(view) {
        Object.values(views).forEach(id => $('#' + id).classList.add('hidden'));
        $('#' + views[view]).classList.remove('hidden');
        $$('.nav-link').forEach(a => a.classList.toggle('active',
            a.dataset.route === view || (view === 'detail' && a.dataset.route === 'home')));
    }

    function navigate(route, arg) {
        if (route === 'home')     return loadList(false);
        if (route === 'trending') return loadList(true);
        if (route === 'upload')   { show('upload'); window.scrollTo(0, 0); return; }
        if (route === 'detail')   return loadDetail(arg);
    }

    // ---------- Browse / trending ----------
    async function loadList(trending = false) {
        show('home');
        $('#listTitle').textContent = trending ? 'Trending resources' : 'Latest resources';
        $('#listCount').textContent = 'Loading…';
        $('#emptyState').classList.add('hidden');
        $('#resourceGrid').innerHTML = '<p class="muted"><span class="spinner"></span>Loading resources…</p>';

        try {
            const params = new URLSearchParams();
            const q = $('#searchInput').value.trim();
            const m = $('#moduleFilter').value;
            if (q) params.set('search', q);
            if (m) params.set('module', m);

            const path = trending ? '/resources/trending' : `/resources?${params.toString()}`;
            const data = await api(path);
            renderList(data.resources || []);
            $('#listCount').textContent = `${data.count || 0} result${data.count === 1 ? '' : 's'}`;
        } catch (err) {
            $('#resourceGrid').innerHTML = `<p class="status error">Failed to load: ${escapeHtml(err.message)}</p>`;
            $('#listCount').textContent = '';
        }
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
            <div class="card" data-id="${escapeHtml(r.id)}">
                <div class="card-thumb">${fileIcon(r.contentType)}</div>
                <div class="card-body">
                    <h3 class="card-title">${escapeHtml(r.title)}</h3>
                    <div class="card-meta">
                        <span class="card-tag">${escapeHtml(r.module)}</span>
                        ${r.avgRating ? `<span class="rating">★ ${r.avgRating.toFixed(1)}</span>` : ''}
                        <span>${r.views || 0} views</span>
                    </div>
                </div>
            </div>`).join('');
        // Populate module filter from data we already have.
        const modules = [...new Set(resources.map(r => r.module).filter(Boolean))].sort();
        const sel = $('#moduleFilter');
        const current = sel.value;
        sel.innerHTML = '<option value="">All modules</option>' +
            modules.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
        sel.value = current;

        grid.querySelectorAll('.card').forEach(el => {
            el.addEventListener('click', () => navigate('detail', el.dataset.id));
        });
    }

    // ---------- Detail view ----------
    async function loadDetail(id) {
        show('detail');
        $('#detailContent').innerHTML = '<p class="muted"><span class="spinner"></span>Loading…</p>';
        try {
            const r = await api(`/resources/${encodeURIComponent(id)}`);
            const comments = await api(`/interactions/comments/${encodeURIComponent(id)}`).catch(() => ({ comments: [] }));

            const previewHtml = (() => {
                if (!r.fileUrl) return '';
                if (r.contentType?.startsWith('image/'))
                    return `<div class="detail-preview"><img src="${escapeHtml(r.fileUrl)}" alt="${escapeHtml(r.title)}" /></div>`;
                if (r.contentType?.startsWith('video/'))
                    return `<div class="detail-preview"><video controls src="${escapeHtml(r.fileUrl)}"></video></div>`;
                if (r.contentType?.includes('pdf'))
                    return `<div class="detail-preview"><iframe src="${escapeHtml(r.fileUrl)}" style="width:100%;height:520px;border:0;border-radius:6px;"></iframe></div>`;
                return '';
            })();

            $('#detailContent').innerHTML = `
                <div class="detail-card">
                    <h2 class="detail-title">${escapeHtml(r.title)}</h2>
                    <div class="detail-meta">
                        <span><strong>Module:</strong> ${escapeHtml(r.module)}</span>
                        ${r.course ? `<span><strong>Course:</strong> ${escapeHtml(r.course)}</span>` : ''}
                        ${r.university ? `<span><strong>University:</strong> ${escapeHtml(r.university)}</span>` : ''}
                        <span><strong>Uploaded:</strong> ${formatDate(r.createdAt)}</span>
                        <span><strong>Size:</strong> ${formatSize(r.fileSize)}</span>
                        <span><strong>Views:</strong> ${r.views || 0}</span>
                        <span class="rating">★ ${(r.avgRating || 0).toFixed(1)} (${r.ratingCount || 0})</span>
                    </div>
                    ${r.description ? `<p>${escapeHtml(r.description)}</p>` : ''}
                    ${(r.tags || []).map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join(' ')}
                    ${previewHtml}
                    <div class="detail-actions">
                        <a class="btn btn-primary" href="${escapeHtml(r.fileUrl)}" target="_blank" rel="noopener">Download / Open</a>
                        <button class="btn btn-secondary" id="btnEdit">Edit metadata</button>
                        <button class="btn btn-danger" id="btnDelete">Delete</button>
                    </div>
                    <div class="rating-input" id="ratingInput" data-id="${escapeHtml(r.id)}">
                        <span>Rate:</span>
                        ${[1,2,3,4,5].map(n => `<button data-n="${n}">★</button>`).join('')}
                    </div>
                </div>
                <div class="detail-card comments-section">
                    <h3>Comments</h3>
                    <form class="comment-form" id="commentForm" data-id="${escapeHtml(r.id)}">
                        <input id="commentText" placeholder="Add a comment..." maxlength="2000" required />
                        <button type="submit" class="btn btn-primary">Post</button>
                    </form>
                    <div class="comment-list" id="commentList">
                        ${(comments.comments || []).map(c => `
                            <div class="comment">
                                <div class="comment-meta">${escapeHtml(c.userId)} · ${formatDate(c.createdAt)}</div>
                                <div>${escapeHtml(c.text)}</div>
                            </div>`).join('') || '<p class="muted">No comments yet.</p>'}
                    </div>
                </div>`;

            wireDetail(r);
        } catch (err) {
            $('#detailContent').innerHTML = `<p class="status error">${escapeHtml(err.message)}</p>`;
        }
    }

    function wireDetail(resource) {
        $('#btnDelete').addEventListener('click', async () => {
            if (!confirm('Delete this resource? This also removes the file from Blob Storage.')) return;
            try {
                await api(`/resources/${encodeURIComponent(resource.id)}`, { method: 'DELETE' });
                alert('Deleted.');
                navigate('home');
            } catch (err) { alert('Delete failed: ' + err.message); }
        });

        $('#btnEdit').addEventListener('click', async () => {
            const newTitle = prompt('New title:', resource.title);
            if (newTitle === null) return;
            const newDesc = prompt('New description:', resource.description || '');
            if (newDesc === null) return;
            try {
                await api(`/resources/${encodeURIComponent(resource.id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle, description: newDesc })
                });
                navigate('detail', resource.id);
            } catch (err) { alert('Update failed: ' + err.message); }
        });

        $('#ratingInput').querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', async () => {
                const n = Number(btn.dataset.n);
                try {
                    await api('/interactions/ratings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resourceId: resource.id, rating: n })
                    });
                    navigate('detail', resource.id);
                } catch (err) { alert('Rating failed: ' + err.message); }
            });
        });

        $('#commentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = $('#commentText').value.trim();
            if (!text) return;
            try {
                await api('/interactions/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resourceId: resource.id, text })
                });
                $('#commentText').value = '';
                navigate('detail', resource.id);
            } catch (err) { alert('Comment failed: ' + err.message); }
        });
    }

    // ---------- Upload ----------
    function wireUpload() {
        $('#uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const status = $('#uploadStatus');
            const btn = $('#uploadBtn');
            status.className = 'status';
            status.innerHTML = '<span class="spinner"></span>Uploading…';
            btn.disabled = true;

            try {
                const fd = new FormData(e.target);
                const res = await fetch(API + '/resources', { method: 'POST', body: fd });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

                status.className = 'status success';
                status.textContent = '✓ Uploaded successfully';
                e.target.reset();
                setTimeout(() => navigate('detail', data.id), 800);
            } catch (err) {
                status.className = 'status error';
                status.textContent = '✗ ' + err.message;
            } finally {
                btn.disabled = false;
            }
        });
    }

    // ---------- Wire up nav ----------
    function wireNav() {
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('[data-route]');
            if (!link) return;
            e.preventDefault();
            navigate(link.dataset.route);
        });
        $('#searchBtn').addEventListener('click', () => loadList(false));
        $('#searchInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadList(false);
        });
        $('#moduleFilter').addEventListener('change', () => loadList(false));
    }

    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', () => {
        wireNav();
        wireUpload();
        loadList(false);
    });
})();
