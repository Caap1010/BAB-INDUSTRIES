/* ============================================================
   NEXUS — Profile page logic (Firebase)
   ============================================================ */

const Profile = (() => {
    let viewedProfile = null;
    let isOwnProfile = false;
    let isFollowing = false;

    async function init() {
        const user = await App.init();
        if (!user) return;

        const username = getParam('user') || CURRENT_PROFILE?.username;
        if (!username) return showNotFound();

        viewedProfile = await loadProfile(username);
        if (!viewedProfile) return showNotFound();

        isOwnProfile = viewedProfile.id === CURRENT_USER.uid;

        await Promise.all([loadStats(), loadPosts(), loadMicroPosts(), loadFollowState()]);
        renderHeader();
        renderActions();
        renderAbout();
        wireEvents();

        document.getElementById('profile-loading').style.display = 'none';
        document.getElementById('profile-content').style.display = '';
    }

    async function loadProfile(username) {
        const snap = await fbDb.collection('profiles').where('username', '==', username).limit(1).get();
        if (snap.empty) return null;
        return snap.docs[0].data();
    }

    async function loadStats() {
        const [postSnap, followerSnap, followingSnap] = await Promise.all([
            fbDb.collection('posts').where('user_id', '==', viewedProfile.id).get(),
            fbDb.collection('follows').where('following_id', '==', viewedProfile.id).get(),
            fbDb.collection('follows').where('follower_id', '==', viewedProfile.id).get(),
        ]);

        document.getElementById('stat-posts').textContent = fmtNum(postSnap.size);
        document.getElementById('stat-followers').textContent = fmtNum(followerSnap.size);
        document.getElementById('stat-following').textContent = fmtNum(followingSnap.size);
    }

    async function loadPosts() {
        const snap = await fbDb
            .collection('posts')
            .where('user_id', '==', viewedProfile.id)
            .orderBy('created_at', 'desc')
            .limit(36)
            .get();

        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const grid = document.getElementById('posts-grid');

        if (!posts.length) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1 / -1"><h3>No posts yet</h3><p>This user has not posted anything.</p></div>';
            return;
        }

        const mediaByPost = {};
        for (const post of posts) {
            const mediaSnap = await fbDb.collection('post_media').where('post_id', '==', post.id).orderBy('sort_order', 'asc').limit(4).get();
            mediaByPost[post.id] = mediaSnap.docs.map(d => d.data());
        }

        grid.innerHTML = posts.map(post => {
            const media = mediaByPost[post.id] || [];
            const first = media[0];
            const thumb = first?.url;
            if (!thumb) {
                return `<article class="grid-post" title="${escHtml(post.body || '')}"><div style="padding:12px;font-size:0.85rem;color:var(--c-text-muted)">${escHtml((post.body || '').slice(0, 100) || 'Text post')}</div></article>`;
            }
            return `<article class="grid-post" onclick="window.open('feed.html','_self')">
                ${first.type === 'video' ? `<video src="${thumb}" muted playsinline preload="metadata"></video>` : `<img src="${thumb}" alt="" loading="lazy">`}
                <div class="grid-post-overlay"><span class="grid-post-stat">${first.type === 'video' ? 'Video' : 'Post'}</span></div>
            </article>`;
        }).join('');
    }

    async function loadMicroPosts() {
        const snap = await fbDb
            .collection('micro_posts')
            .where('user_id', '==', viewedProfile.id)
            .orderBy('created_at', 'desc')
            .limit(50)
            .get();

        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const list = document.getElementById('micro-list');

        if (!rows.length) {
            list.innerHTML = '<div class="empty-state"><h3>No thoughts yet</h3><p>Short updates will appear here.</p></div>';
            return;
        }

        list.innerHTML = rows.map(item => `<div class="micro-post-item"><p class="micro-post-body">${linkifyText(item.body || '')}</p><div class="micro-post-time">${timeAgo(item.created_at)}</div></div>`).join('');
    }

    async function loadFollowState() {
        if (isOwnProfile) { isFollowing = false; return; }
        const ref = await fbDb.collection('follows').doc(`${CURRENT_USER.uid}_${viewedProfile.id}`).get();
        isFollowing = ref.exists;
    }

    function renderHeader() {
        document.title = `${viewedProfile.display_name || viewedProfile.username} — NEXUS`;
        document.getElementById('header-username').textContent = viewedProfile.display_name || viewedProfile.username;
        document.getElementById('profile-name').textContent = viewedProfile.display_name || viewedProfile.username;
        document.getElementById('profile-handle').textContent = `@${viewedProfile.username}`;
        document.getElementById('profile-bio').textContent = viewedProfile.bio || 'No bio yet.';

        const avatarWrap = document.getElementById('profile-avatar-el');
        avatarWrap.innerHTML = '';
        const av = avatarEl(viewedProfile, 'xl');
        av.classList.add('profile-avatar');
        avatarWrap.appendChild(av);

        const cover = document.getElementById('profile-cover');
        if (viewedProfile.avatar_url) {
            cover.innerHTML = `<img src="${viewedProfile.avatar_url}" alt=""><div class="profile-cover-overlay"></div>`;
        }

        const websiteEl = document.getElementById('profile-website');
        if (viewedProfile.website) {
            const clean = viewedProfile.website.startsWith('http') ? viewedProfile.website : `https://${viewedProfile.website}`;
            websiteEl.innerHTML = `<a href="${escHtml(clean)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="padding-left:0">${Icons.get('link')} ${escHtml(viewedProfile.website)}</a>`;
        } else {
            websiteEl.innerHTML = '';
        }
    }

    function renderActions() {
        const wrap = document.getElementById('profile-actions');
        if (isOwnProfile) {
            wrap.innerHTML = `<button class="btn btn-secondary" id="edit-profile-btn">${Icons.get('edit')} Edit profile</button><a class="btn btn-ghost" href="messages.html">${Icons.get('message')} Messages</a>`;
            return;
        }
        wrap.innerHTML = `<button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" id="follow-toggle-btn">${isFollowing ? 'Following' : 'Follow'}</button><button class="btn btn-ghost" id="message-user-btn">${Icons.get('message')} Message</button>`;
    }

    function renderAbout() {
        const el = document.getElementById('about-details');
        const joined = viewedProfile.created_at ? asDate(viewedProfile.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : 'Unknown';
        el.innerHTML = `<div class="card" style="padding:20px"><h4 style="margin-bottom:12px">Profile details</h4><div style="display:grid;gap:10px;font-size:0.9rem"><div><strong>Username:</strong> @${escHtml(viewedProfile.username)}</div><div><strong>Display name:</strong> ${escHtml(viewedProfile.display_name || viewedProfile.username)}</div><div><strong>Joined:</strong> ${escHtml(joined)}</div><div><strong>Bio:</strong> ${escHtml(viewedProfile.bio || 'No bio')}</div></div></div>`;
    }

    function wireEvents() {
        document.getElementById('follow-toggle-btn')?.addEventListener('click', toggleFollow);
        document.getElementById('message-user-btn')?.addEventListener('click', startMessage);
        document.getElementById('edit-profile-btn')?.addEventListener('click', openEditModal);
        document.getElementById('edit-modal-close')?.addEventListener('click', closeEditModal);
        document.getElementById('edit-save-btn')?.addEventListener('click', saveProfile);

        if (isOwnProfile) {
            document.getElementById('micro-composer').style.display = '';
            document.getElementById('micro-submit')?.addEventListener('click', createMicroPost);
        }
    }

    async function toggleFollow() {
        const btn = document.getElementById('follow-toggle-btn');
        btn.disabled = true;
        try {
            const id = `${CURRENT_USER.uid}_${viewedProfile.id}`;
            const ref = fbDb.collection('follows').doc(id);
            if (isFollowing) {
                await ref.delete();
                isFollowing = false;
            } else {
                await ref.set({
                    follower_id: CURRENT_USER.uid,
                    following_id: viewedProfile.id,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                });
                isFollowing = true;
            }
            btn.className = `btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`;
            btn.textContent = isFollowing ? 'Following' : 'Follow';
            await loadStats();
        } catch (_) {
            Toast.error('Could not update follow state.');
        } finally {
            btn.disabled = false;
        }
    }

    async function startMessage() {
        const ids = [CURRENT_USER.uid, viewedProfile.id].sort();
        const dmKey = ids.join('__');
        const snap = await fbDb.collection('conversations').where('dm_key', '==', dmKey).limit(1).get();

        let convId;
        if (!snap.empty) {
            convId = snap.docs[0].id;
        } else {
            const ref = await fbDb.collection('conversations').add({
                is_group: false,
                name: '',
                dm_key: dmKey,
                member_ids: ids,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                last_message: '',
            });
            convId = ref.id;
        }

        location.href = `messages.html?conv=${convId}`;
    }

    function openEditModal() {
        document.getElementById('edit-name').value = viewedProfile.display_name || '';
        document.getElementById('edit-bio').value = viewedProfile.bio || '';
        document.getElementById('edit-website').value = viewedProfile.website || '';
        document.getElementById('edit-profile-modal').style.display = 'flex';
    }

    function closeEditModal() {
        document.getElementById('edit-profile-modal').style.display = 'none';
        document.getElementById('edit-avatar-file').value = '';
    }

    async function saveProfile() {
        const saveBtn = document.getElementById('edit-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const payload = {
                display_name: document.getElementById('edit-name').value.trim(),
                bio: document.getElementById('edit-bio').value.trim(),
                website: document.getElementById('edit-website').value.trim(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
            };

            const avatarFile = document.getElementById('edit-avatar-file').files?.[0];
            if (avatarFile) payload.avatar_url = await uploadFile(BUCKETS.AVATARS, avatarFile);

            await fbDb.collection('profiles').doc(CURRENT_USER.uid).set(payload, { merge: true });
            viewedProfile = await Auth.fetchProfile(CURRENT_USER.uid);
            CURRENT_PROFILE = viewedProfile;

            renderHeader();
            renderAbout();
            App.buildSidebar();
            closeEditModal();
            Toast.success('Profile updated.');
        } catch (err) {
            Toast.error(err.message || 'Failed to save profile.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save changes';
        }
    }

    async function createMicroPost() {
        const input = document.getElementById('micro-input');
        const body = input.value.trim();
        if (!body) return;

        const btn = document.getElementById('micro-submit');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        try {
            await fbDb.collection('micro_posts').add({
                user_id: CURRENT_USER.uid,
                body,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
            });
            input.value = '';
            await loadMicroPosts();
            Toast.success('Thought posted.');
        } catch (err) {
            Toast.error(err.message || 'Failed to post thought.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Post thought';
        }
    }

    function switchTab(tab) {
        document.querySelectorAll('.profile-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
        document.getElementById('tab-posts').style.display = tab === 'posts' ? '' : 'none';
        document.getElementById('tab-micro').style.display = tab === 'micro' ? '' : 'none';
        document.getElementById('tab-about').style.display = tab === 'about' ? '' : 'none';
    }

    function showNotFound() {
        document.getElementById('profile-loading').style.display = 'none';
        document.getElementById('profile-content').style.display = 'none';
        document.getElementById('profile-not-found').style.display = '';
    }

    return { init, switchTab };
})();

Profile.init();
