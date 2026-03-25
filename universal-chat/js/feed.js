/* ============================================================
   NEXUS — Feed page logic (Firebase)
   ============================================================ */

const Feed = (() => {
    let attachedFiles = [];
    let storyFile = null;

    async function init() {
        const user = await App.init();
        if (!user) return;

        const avEl = document.getElementById('composer-avatar');
        if (avEl) avEl.appendChild(avatarEl(CURRENT_PROFILE, 'md'));

        wireComposer();
        wireStoryModal();
        document.getElementById('refresh-btn')?.addEventListener('click', () => loadAll());

        await loadAll();

        fbDb.collection('posts').orderBy('created_at', 'desc').limit(1).onSnapshot(() => {
            loadFeed();
        });
    }

    async function loadAll() {
        await Promise.all([loadStories(), loadFeed(), loadSuggestions(), loadTrending()]);
    }

    async function loadStories() {
        const snap = await fbDb
            .collection('stories')
            .where('kind', '==', 'story')
            .orderBy('created_at', 'desc')
            .limit(30)
            .get();

        const items = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(s => asDate(s.created_at).getTime() >= Date.now() - 86400000)
            .slice(0, 20);

        const profileMap = await getProfilesByIds(items.map(s => s.user_id));
        const container = document.getElementById('story-bubbles');
        if (!container) return;

        if (!items.length) {
            container.innerHTML = '<p style="font-size:0.8rem;color:var(--c-text-subtle)">No stories yet</p>';
            return;
        }

        container.innerHTML = items.map(s => {
            const p = profileMap[s.user_id] || {};
            const avSrc = p.avatar_url || '';
            const avHtml = avSrc
                ? `<img class="story-bubble-inner" src="${avSrc}" alt="">`
                : `<div class="story-bubble-inner avatar-placeholder" style="display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1rem;background:var(--grad-primary);color:#fff">${initials(p.display_name || p.username)}</div>`;
            return `<div class="story-bubble" onclick="Feed.openStory('${s.id}', '${escHtml(s.media_url || '')}', '${escHtml(JSON.stringify(p))}')">
                <div class="story-bubble-ring"><div style="width:60px;height:60px;border-radius:50%;overflow:hidden">${avHtml}</div></div>
                <span>${escHtml(p.username || 'user')}</span>
            </div>`;
        }).join('');
    }

    async function loadFeed() {
        const feed = document.getElementById('posts-feed');
        if (!feed) return;

        const postSnap = await fbDb.collection('posts').orderBy('created_at', 'desc').limit(25).get();
        const posts = postSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const profileMap = await getProfilesByIds(posts.map(p => p.user_id));

        const enriched = await Promise.all(posts.map(async post => {
            const [mediaSnap, likesSnap, commentsSnap] = await Promise.all([
                fbDb.collection('post_media').where('post_id', '==', post.id).orderBy('sort_order', 'asc').get(),
                fbDb.collection('post_likes').where('post_id', '==', post.id).get(),
                fbDb.collection('comments').where('post_id', '==', post.id).get(),
            ]);
            return {
                ...post,
                profiles: profileMap[post.user_id] || null,
                post_media: mediaSnap.docs.map(d => d.data()),
                post_likes: likesSnap.docs.map(d => d.data()),
                comments: commentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            };
        }));

        document.getElementById('feed-skeletons')?.remove();
        feed.innerHTML = '';

        enriched.forEach(post => {
            const el = buildPostEl(post);
            feed.appendChild(el);
        });
    }

    function buildPostEl(post) {
        const p = post.profiles || {};
        const media = Array.isArray(post.post_media) ? [...post.post_media] : [];
        const likeCount = post.post_likes?.length ?? 0;
        const commentCount = post.comments?.length ?? 0;
        const liked = (post.post_likes || []).some(l => l.user_id === CURRENT_USER?.uid);

        const avSrc = p.avatar_url || '';
        const avHtml = avSrc
            ? `<img class="avatar avatar-md" src="${avSrc}" alt="">`
            : `<div class="avatar avatar-md avatar-placeholder">${initials(p.display_name || p.username)}</div>`;

        let mediaHtml = '';
        if (media.length === 1) {
            const m = media[0];
            mediaHtml = `<div class="post-media">${m.type === 'video' ? `<video src="${m.url}" controls preload="metadata"></video>` : `<img src="${m.url}" alt="" loading="lazy" onclick="openLightbox('${m.url}')">`}</div>`;
        } else if (media.length > 1) {
            const gridClass = media.length === 2 ? 'cols-2' : 'cols-3';
            mediaHtml = `<div class="post-media-grid ${gridClass}">${media.slice(0, 4).map(m => `<div class="media-item"><img src="${m.url}" alt="" loading="lazy" onclick="openLightbox('${m.url}')"></div>`).join('')}</div>`;
        }

        const div = document.createElement('div');
        div.className = 'card post-card';
        div.dataset.postId = post.id;
        div.innerHTML = `
            <div class="post-header">
                <a href="profile.html?user=${escHtml(p.username || '')}" style="flex-shrink:0">${avHtml}</a>
                <div class="post-author">
                    <a href="profile.html?user=${escHtml(p.username || '')}" class="post-author-name">${escHtml(p.display_name || p.username || 'User')}</a>
                    <div class="post-meta">@${escHtml(p.username || 'user')} · ${timeAgo(post.created_at)}</div>
                </div>
                <button class="btn-icon" title="More">${Icons.get('more')}</button>
            </div>
            <div class="post-body">
                <p class="post-text">${linkifyText(post.body || '')}</p>
                ${mediaHtml}
            </div>
            <div class="post-actions">
                <button class="post-action-btn like-btn${liked ? ' liked' : ''}" data-post-id="${post.id}" data-liked="${liked}">
                    ${Icons.get('heart')}<span class="like-count">${fmtNum(likeCount)}</span>
                </button>
                <button class="post-action-btn comment-btn" data-post-id="${post.id}">
                    ${Icons.get('comment')}<span>${fmtNum(commentCount)}</span>
                </button>
                <button class="post-action-btn share-btn" data-post-id="${post.id}">
                    ${Icons.get('share')}<span>Share</span>
                </button>
                <div class="post-actions-spacer"></div>
                <button class="post-action-btn bookmark-btn" data-post-id="${post.id}">${Icons.get('bookmark')}</button>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display:none">
                <div class="comment-list" id="comment-list-${post.id}"></div>
                <div class="comment-composer">
                    <input type="text" placeholder="Add a comment…" id="comment-input-${post.id}">
                    <div class="comment-send-btn" onclick="Feed.sendComment('${post.id}')">${Icons.get('send')}</div>
                </div>
            </div>
        `;

        div.querySelector('.like-btn').addEventListener('click', e => toggleLike(e.currentTarget, post.id));
        div.querySelector('.comment-btn').addEventListener('click', () => toggleComments(post.id));
        div.querySelector('.share-btn').addEventListener('click', () => {
            navigator.clipboard?.writeText(location.origin + `/feed.html#post-${post.id}`);
            Toast.success('Link copied to clipboard!');
        });

        return div;
    }

    async function toggleLike(btn, postId) {
        if (!CURRENT_USER) { location.href = 'login.html'; return; }
        const likeId = `${postId}_${CURRENT_USER.uid}`;
        const likeRef = fbDb.collection('post_likes').doc(likeId);
        const existing = await likeRef.get();

        if (existing.exists) {
            await likeRef.delete();
        } else {
            await likeRef.set({ post_id: postId, user_id: CURRENT_USER.uid, created_at: firebase.firestore.FieldValue.serverTimestamp() });
        }

        await loadFeed();
    }

    async function toggleComments(postId) {
        const section = document.getElementById(`comments-${postId}`);
        if (!section) return;
        const open = section.style.display !== 'none';
        section.style.display = open ? 'none' : 'block';
        if (!open) await loadComments(postId);
    }

    async function loadComments(postId) {
        const list = document.getElementById(`comment-list-${postId}`);
        if (!list) return;
        const snap = await fbDb.collection('comments').where('post_id', '==', postId).orderBy('created_at', 'asc').limit(50).get();
        const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const profileMap = await getProfilesByIds(comments.map(c => c.user_id));

        list.innerHTML = comments.map(c => {
            const p = profileMap[c.user_id] || {};
            const avHtml = p.avatar_url
                ? `<img class="avatar avatar-sm" src="${p.avatar_url}" alt="">`
                : `<div class="avatar avatar-sm avatar-placeholder">${initials(p.display_name || p.username)}</div>`;
            return `<div class="comment-item">
                <a href="profile.html?user=${escHtml(p.username || '')}">${avHtml}</a>
                <div class="comment-body">
                    <div class="comment-name">${escHtml(p.display_name || p.username || 'User')}</div>
                    <div class="comment-text">${escHtml(c.body || '')}</div>
                    <div class="comment-time">${timeAgo(c.created_at)}</div>
                </div>
            </div>`;
        }).join('');
    }

    async function sendComment(postId) {
        if (!CURRENT_USER) { location.href = 'login.html'; return; }
        const input = document.getElementById(`comment-input-${postId}`);
        const body = input?.value.trim();
        if (!body) return;
        input.value = '';

        await fbDb.collection('comments').add({
            post_id: postId,
            user_id: CURRENT_USER.uid,
            body,
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });

        await loadComments(postId);
        await loadFeed();
    }

    function wireComposer() {
        const textarea = document.getElementById('composer-text');
        const fileInput = document.getElementById('post-media-input');
        const submitBtn = document.getElementById('post-submit-btn');
        const preview = document.getElementById('composer-media-preview');

        textarea?.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });

        fileInput?.addEventListener('change', () => {
            attachedFiles = [...fileInput.files];
            preview.innerHTML = attachedFiles.map((f, i) => {
                const url = URL.createObjectURL(f);
                const isVideo = f.type.startsWith('video/');
                return `<div class="composer-media-preview" style="display:inline-block;margin-right:8px">
                    ${isVideo ? `<video src="${url}" style="max-height:120px;border-radius:var(--r-md)"></video>` : `<img src="${url}" style="max-height:120px;border-radius:var(--r-md)">`}
                    <div class="remove-media-btn" onclick="Feed.removeMedia(${i})">✕</div>
                </div>`;
            }).join('');
        });

        submitBtn?.addEventListener('click', submitPost);
        textarea?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost();
        });
    }

    function removeMedia(idx) {
        attachedFiles.splice(idx, 1);
        const preview = document.getElementById('composer-media-preview');
        if (!attachedFiles.length) {
            preview.innerHTML = '';
            return;
        }
        preview.innerHTML = attachedFiles.map((f, i) => {
            const url = URL.createObjectURL(f);
            const isVideo = f.type.startsWith('video/');
            return `<div class="composer-media-preview" style="display:inline-block;margin-right:8px">
                ${isVideo ? `<video src="${url}" style="max-height:120px;border-radius:var(--r-md)"></video>` : `<img src="${url}" style="max-height:120px;border-radius:var(--r-md)">`}
                <div class="remove-media-btn" onclick="Feed.removeMedia(${i})">✕</div>
            </div>`;
        }).join('');
    }

    async function submitPost() {
        if (!CURRENT_USER) { location.href = 'login.html'; return; }
        const textarea = document.getElementById('composer-text');
        const body = textarea?.value.trim();
        if (!body && attachedFiles.length === 0) return;

        const btn = document.getElementById('post-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        try {
            const postRef = await fbDb.collection('posts').add({
                user_id: CURRENT_USER.uid,
                body: body || '',
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
            });

            for (let i = 0; i < attachedFiles.length; i += 1) {
                const file = attachedFiles[i];
                const url = await uploadFile(BUCKETS.POSTS, file);
                const type = file.type.startsWith('video/') ? 'video' : 'image';
                await fbDb.collection('post_media').add({
                    post_id: postRef.id,
                    url,
                    type,
                    sort_order: i,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                });
            }

            textarea.value = '';
            textarea.style.height = 'auto';
            attachedFiles = [];
            document.getElementById('composer-media-preview').innerHTML = '';
            Toast.success('Post shared!');
            await loadFeed();
        } catch (e) {
            Toast.error(e.message || 'Failed to post.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Post';
        }
    }

    function wireStoryModal() {
        document.getElementById('add-story-btn')?.addEventListener('click', () => {
            document.getElementById('story-modal').style.display = 'flex';
        });
        document.getElementById('story-modal-close')?.addEventListener('click', () => {
            document.getElementById('story-modal').style.display = 'none';
        });
        document.getElementById('story-file-input')?.addEventListener('change', e => {
            storyFile = e.target.files[0] || null;
            const preview = document.getElementById('story-preview');
            if (!storyFile) {
                preview.innerHTML = '';
                return;
            }
            const url = URL.createObjectURL(storyFile);
            const isVideo = storyFile.type.startsWith('video/');
            preview.innerHTML = isVideo
                ? `<video src="${url}" controls style="max-height:200px;border-radius:var(--r-md)"></video>`
                : `<img src="${url}" style="max-height:200px;border-radius:var(--r-md)">`;
        });
        document.getElementById('story-submit-btn')?.addEventListener('click', submitStory);
    }

    async function submitStory() {
        if (!CURRENT_USER) { location.href = 'login.html'; return; }
        if (!storyFile) { Toast.error('Please choose a media file.'); return; }

        const kind = document.getElementById('story-kind').value;
        const caption = document.getElementById('story-caption').value.trim();
        const btn = document.getElementById('story-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const mediaUrl = await uploadFile(BUCKETS.STORIES, storyFile);
            await fbDb.collection('stories').add({
                user_id: CURRENT_USER.uid,
                media_url: mediaUrl,
                kind,
                caption,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
            });
            Toast.success('Story shared!');
            document.getElementById('story-modal').style.display = 'none';
            storyFile = null;
            await loadStories();
        } catch (e) {
            Toast.error(e.message || 'Upload failed.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Share Story';
        }
    }

    function openStory(_id, mediaUrl, profileJson) {
        let profile = {};
        try { profile = JSON.parse(profileJson); } catch (_) { profile = {}; }

        const overlay = document.createElement('div');
        overlay.className = 'story-modal';
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        const isVideo = /\.(mp4|webm|mov)/i.test(mediaUrl || '');
        overlay.innerHTML = `
            <div class="story-viewer">
                ${isVideo ? `<video class="reel-media" src="${escHtml(mediaUrl)}" autoplay muted loop playsinline></video>` : `<img class="story-viewer-media" src="${escHtml(mediaUrl)}" alt="">`}
                <div class="story-viewer-overlay"></div>
                <div class="story-progress-bar"><div class="story-progress-item"><div class="story-progress-fill active"></div></div></div>
                <div class="story-header">
                    <div style="width:36px;height:36px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${initials(profile.display_name || profile.username)}</div>
                    <div class="story-header-info"><div class="story-header-name">${escHtml(profile.display_name || profile.username || 'User')}</div></div>
                    <span class="story-close-btn" onclick="this.closest('.story-modal').remove()">✕</span>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 6000);
    }

    async function loadSuggestions() {
        const list = document.getElementById('suggestions-list');
        if (!list) return;

        const snap = await fbDb.collection('profiles').limit(10).get();
        const people = snap.docs.map(d => d.data()).filter(p => p.id !== CURRENT_USER?.uid).slice(0, 5);

        if (!people.length) {
            list.innerHTML = '<p style="font-size:0.8rem;color:var(--c-text-subtle)">No suggestions right now.</p>';
            return;
        }

        list.innerHTML = people.map(p => {
            const avHtml = p.avatar_url
                ? `<img class="avatar avatar-sm" src="${p.avatar_url}" alt="">`
                : `<div class="avatar avatar-sm avatar-placeholder">${initials(p.display_name || p.username)}</div>`;
            return `<div class="suggestion-item">
                <a href="profile.html?user=${escHtml(p.username)}">${avHtml}</a>
                <div class="suggestion-info">
                    <a href="profile.html?user=${escHtml(p.username)}" class="suggestion-name">${escHtml(p.display_name || p.username)}</a>
                    <div class="suggestion-meta">@${escHtml(p.username)}</div>
                </div>
                <button class="btn btn-secondary btn-sm follow-sugg-btn" data-uid="${p.id}">Follow</button>
            </div>`;
        }).join('');

        list.querySelectorAll('.follow-sugg-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const targetId = btn.dataset.uid;
                if (!CURRENT_USER || !targetId) return;
                btn.disabled = true;
                btn.textContent = '...';
                await fbDb.collection('follows').doc(`${CURRENT_USER.uid}_${targetId}`).set({
                    follower_id: CURRENT_USER.uid,
                    following_id: targetId,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                });
                btn.textContent = 'Following';
            });
        });
    }

    async function loadTrending() {
        const list = document.getElementById('trending-list');
        if (!list) return;

        const snap = await fbDb.collection('posts').orderBy('created_at', 'desc').limit(80).get();
        const tagCounts = {};
        snap.docs.forEach(d => {
            const body = d.data().body || '';
            (body.match(/#\w+/g) || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (!tags.length) {
            list.innerHTML = '<p style="font-size:0.8rem;color:var(--c-text-subtle)">No trending topics yet.</p>';
            return;
        }

        list.innerHTML = tags.map(([tag, count]) =>
            `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--c-border)">
                <span style="color:var(--c-primary);font-weight:600;font-size:0.875rem">${escHtml(tag)}</span>
                <span style="font-size:0.75rem;color:var(--c-text-subtle)">${count} post${count > 1 ? 's' : ''}</span>
            </div>`
        ).join('');
    }

    function openLightbox(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
        overlay.onclick = () => overlay.remove();
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'max-width:95vw;max-height:95vh;border-radius:var(--r-md);object-fit:contain';
        overlay.appendChild(img);
        document.body.appendChild(overlay);
    }

    return { init, sendComment, removeMedia, openStory, openLightbox };
})();

function openLightbox(url) { Feed.openLightbox(url); }

Feed.init();
