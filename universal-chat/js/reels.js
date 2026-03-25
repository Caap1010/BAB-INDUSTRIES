/* ============================================================
   NEXUS — Reels page logic (Firebase)
   ============================================================ */

const Reels = (() => {
    const likedReels = new Set();
    let reelFile = null;

    async function init() {
        const user = await App.init();
        if (!user) return;
        await loadReels();
        wireUploadModal();
    }

    async function loadReels() {
        const container = document.getElementById('reels-container');
        document.getElementById('reels-loading')?.remove();

        const snap = await fbDb
            .collection('stories')
            .where('kind', '==', 'reel')
            .orderBy('created_at', 'desc')
            .limit(30)
            .get();

        const reels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!reels.length) {
            container.innerHTML = `<div class="empty-state" style="height:60vh"><div class="empty-state-icon" style="width:72px;height:72px">${Icons.get('film')}</div><h3>No reels yet</h3><p>Be the first to share a reel!</p><button class="btn btn-primary" onclick="document.getElementById('upload-reel-btn').click()">Upload reel</button></div>`;
            return;
        }

        const profileMap = await getProfilesByIds(reels.map(r => r.user_id));
        container.innerHTML = '';
        reels.forEach(reel => container.appendChild(buildReelEl(reel, profileMap[reel.user_id] || {})));

        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const vid = entry.target.querySelector('video.reel-media');
                if (!vid) return;
                if (entry.isIntersecting) {
                    vid.play().catch(() => { });
                    vid.muted = true;
                } else {
                    vid.pause();
                    vid.currentTime = 0;
                }
            });
        }, { threshold: 0.6 });

        container.querySelectorAll('.reel-item').forEach(el => io.observe(el));
    }

    function buildReelEl(reel, p) {
        const mediaUrl = reel.media_url || '';
        const isVideo = /\.(mp4|webm|mov)/i.test(mediaUrl);
        const liked = likedReels.has(reel.id);

        const avHtml = p.avatar_url
            ? `<img class="avatar avatar-sm" src="${p.avatar_url}" alt="" style="border:2px solid rgba(255,255,255,0.4)">`
            : `<div class="avatar avatar-sm avatar-placeholder" style="border:2px solid rgba(255,255,255,0.4)">${initials(p.display_name || p.username)}</div>`;

        const div = document.createElement('div');
        div.className = 'reel-item';
        div.dataset.reelId = reel.id;
        div.innerHTML = `
            ${isVideo ? `<video class="reel-media" src="${mediaUrl}" loop muted playsinline preload="metadata"></video>` : `<img class="reel-media" src="${mediaUrl}" alt="">`}
            <div class="reel-overlay"></div>
            <div class="reel-info">
                <div class="reel-author">
                    <a href="profile.html?user=${escHtml(p.username || '')}">${avHtml}</a>
                    <a href="profile.html?user=${escHtml(p.username || '')}" class="reel-author-name">${escHtml(p.display_name || p.username || 'User')}</a>
                    <button class="btn btn-sm follow-reel-btn" data-uid="${p.id || ''}" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)">Follow</button>
                </div>
                ${reel.caption ? `<p class="reel-caption">${escHtml(reel.caption)}</p>` : ''}
            </div>
            <div class="reel-side-actions">
                <div class="reel-action like-reel${liked ? ' liked' : ''}" data-reel-id="${reel.id}">
                    <div class="reel-action-icon">${Icons.get('heart')}</div>
                    <span class="reel-action-count">0</span>
                </div>
                <div class="reel-action" onclick="Reels.shareReel('${reel.id}')"><div class="reel-action-icon">${Icons.get('share')}</div><span class="reel-action-count">Share</span></div>
                <a href="profile.html?user=${escHtml(p.username || '')}" class="reel-action">${avHtml}</a>
            </div>`;

        div.querySelector('.like-reel')?.addEventListener('click', e => toggleLikeReel(e.currentTarget, reel.id));
        div.querySelector('.follow-reel-btn')?.addEventListener('click', async ev => {
            const uid = ev.target.dataset.uid;
            if (!uid || !CURRENT_USER) return;
            ev.target.disabled = true;
            ev.target.textContent = '...';
            await fbDb.collection('follows').doc(`${CURRENT_USER.uid}_${uid}`).set({
                follower_id: CURRENT_USER.uid,
                following_id: uid,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
            });
            ev.target.textContent = 'Following';
        });

        return div;
    }

    async function toggleLikeReel(btn, reelId) {
        if (!CURRENT_USER) { location.href = 'login.html'; return; }
        const id = `${reelId}_${CURRENT_USER.uid}`;
        const ref = fbDb.collection('story_views').doc(id);
        const exists = await ref.get();
        if (exists.exists) {
            likedReels.delete(reelId);
            await ref.delete();
            btn.querySelector('.reel-action-icon').style.background = '';
        } else {
            likedReels.add(reelId);
            await ref.set({ story_id: reelId, viewer_id: CURRENT_USER.uid, created_at: firebase.firestore.FieldValue.serverTimestamp() });
            btn.querySelector('.reel-action-icon').style.background = 'rgba(244,63,94,0.5)';
        }
    }

    function wireUploadModal() {
        document.getElementById('upload-reel-btn')?.addEventListener('click', () => {
            document.getElementById('upload-reel-modal').style.display = 'flex';
        });
        document.getElementById('upload-modal-close')?.addEventListener('click', () => {
            document.getElementById('upload-reel-modal').style.display = 'none';
        });
        document.getElementById('reel-file-input')?.addEventListener('change', e => {
            reelFile = e.target.files[0] || null;
            const preview = document.getElementById('reel-preview');
            if (!reelFile) return;
            const url = URL.createObjectURL(reelFile);
            preview.innerHTML = reelFile.type.startsWith('video/')
                ? `<video src="${url}" controls style="max-height:220px;border-radius:var(--r-md);width:100%"></video>`
                : `<img src="${url}" style="max-height:220px;border-radius:var(--r-md);width:100%;object-fit:cover">`;
        });
        document.getElementById('reel-upload-btn')?.addEventListener('click', uploadReel);
    }

    async function uploadReel() {
        if (!reelFile) { Toast.error('Please choose a file.'); return; }
        const caption = document.getElementById('reel-caption').value.trim();
        const btn = document.getElementById('reel-upload-btn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const mediaUrl = await uploadFile(BUCKETS.STORIES, reelFile);
            await fbDb.collection('stories').add({
                user_id: CURRENT_USER.uid,
                media_url: mediaUrl,
                kind: 'reel',
                caption,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
            });
            Toast.success('Reel published!');
            document.getElementById('upload-reel-modal').style.display = 'none';
            reelFile = null;
            await loadReels();
        } catch (e) {
            Toast.error(e.message || 'Upload failed.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Share Reel';
        }
    }

    function shareReel(reelId) {
        navigator.clipboard?.writeText(location.origin + `/reels.html#reel-${reelId}`);
        Toast.success('Link copied!');
    }

    return { init, shareReel };
})();

Reels.init();
