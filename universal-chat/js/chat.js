/* ============================================================
   NEXUS — Chat / Messages page logic (Firebase)
   ============================================================ */

const Chat = (() => {
    let activeConvId = null;
    let unsubscribeMessages = null;
    let conversations = [];

    async function init() {
        const user = await App.init();
        if (!user) return;

        await loadConversations();

        document.getElementById('conv-search')?.addEventListener('input', debounce(filterConversations, 250));
        ['new-chat-btn', 'new-chat-btn-2'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', openNewChatModal);
        });
        document.getElementById('new-chat-modal-close')?.addEventListener('click', closeNewChatModal);
        document.getElementById('people-search')?.addEventListener('input', debounce(searchPeople, 250));

        const convId = getParam('conv');
        if (convId) openConversation(convId);
    }

    async function loadConversations() {
        const list = document.getElementById('conv-list');
        const snap = await fbDb
            .collection('conversations')
            .where('member_ids', 'array-contains', CURRENT_USER.uid)
            .orderBy('updated_at', 'desc')
            .limit(50)
            .get();

        conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!conversations.length) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${Icons.get('message')}</div><h3>No conversations yet</h3><p>Start chatting with someone!</p></div>`;
            return;
        }

        const userIds = conversations.flatMap(c => c.member_ids || []).filter(id => id !== CURRENT_USER.uid);
        const profileMap = await getProfilesByIds(userIds);

        list.innerHTML = conversations.map(conv => {
            const others = (conv.member_ids || []).filter(id => id !== CURRENT_USER.uid);
            const other = profileMap[others[0]] || {};
            const name = conv.is_group ? (conv.name || 'Group Chat') : (other.display_name || other.username || 'Unknown');
            const preview = conv.last_message || 'No messages yet';
            const time = conv.updated_at ? timeAgo(conv.updated_at) : '';
            const avHtml = other.avatar_url
                ? `<img class="avatar avatar-md" src="${other.avatar_url}" alt="">`
                : `<div class="avatar avatar-md avatar-placeholder">${initials(name)}</div>`;
            return `<div class="conv-item" data-conv-id="${conv.id}" onclick="Chat.openConversation('${conv.id}')">
                <div class="avatar-wrap">${avHtml}<span class="online-dot" style="display:none"></span></div>
                <div class="conv-item-info">
                    <div class="conv-item-top"><span class="conv-item-name">${escHtml(name)}</span><span class="conv-item-time">${time}</span></div>
                    <div class="conv-item-preview">${escHtml(preview)}</div>
                </div>
            </div>`;
        }).join('');
    }

    function filterConversations() {
        const q = document.getElementById('conv-search').value.toLowerCase();
        document.querySelectorAll('.conv-item').forEach(el => {
            const name = el.querySelector('.conv-item-name')?.textContent.toLowerCase() || '';
            el.style.display = name.includes(q) ? '' : 'none';
        });
    }

    async function openConversation(convId) {
        activeConvId = convId;
        document.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.convId === convId));
        document.getElementById('conv-panel')?.classList.add('chat-open');

        const convDoc = await fbDb.collection('conversations').doc(convId).get();
        const conv = convDoc.exists ? { id: convDoc.id, ...convDoc.data() } : null;
        if (!conv) return;

        const others = (conv.member_ids || []).filter(id => id !== CURRENT_USER.uid);
        const profileMap = await getProfilesByIds(others);
        const other = profileMap[others[0]] || {};
        const title = conv.is_group ? (conv.name || 'Group Chat') : (other.display_name || other.username || 'Chat');

        const windowEl = document.getElementById('chat-window');
        windowEl.innerHTML = `
            <div class="chat-header" id="chat-header">
                <button class="btn-icon" id="chat-back-btn" style="display:none" onclick="Chat.backToList()">${Icons.get('back')}</button>
                <div id="chat-av"></div>
                <div class="chat-header-info"><div class="chat-header-name" id="chat-title"></div><div class="chat-header-status" id="chat-status">Online</div></div>
                <button class="btn-icon" title="More">${Icons.get('more')}</button>
            </div>
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-composer">
                <label class="btn-icon" title="Attach" style="cursor:pointer">${Icons.get('paperclip')}<input type="file" id="msg-file-input" accept="image/*,video/*" style="display:none"></label>
                <textarea class="chat-compose-input" id="msg-input" placeholder="Type a message..." rows="1"></textarea>
                <button class="send-btn" id="send-btn">${Icons.get('send')}</button>
            </div>`;

        document.getElementById('chat-title').textContent = title;
        const avEl = document.getElementById('chat-av');
        avEl.appendChild(avatarEl(other, 'md'));

        if (window.innerWidth <= 900) document.getElementById('chat-back-btn').style.display = 'flex';

        const input = document.getElementById('msg-input');
        input?.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; });
        input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        document.getElementById('send-btn')?.addEventListener('click', sendMessage);
        document.getElementById('msg-file-input')?.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (file) sendMediaMessage(file);
        });

        if (unsubscribeMessages) unsubscribeMessages();
        unsubscribeMessages = fbDb
            .collection('messages')
            .where('conversation_id', '==', convId)
            .orderBy('created_at', 'asc')
            .limit(200)
            .onSnapshot(async snap => {
                const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                const profileMap2 = await getProfilesByIds(messages.map(m => m.sender_id));
                renderMessages(messages, profileMap2);
            });
    }

    function renderMessages(messages, profileMap) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = '';
        messages.forEach(msg => container.appendChild(buildMsgEl(msg, profileMap[msg.sender_id] || {})));
        container.scrollTop = container.scrollHeight;
    }

    function buildMsgEl(msg, profile) {
        const isMine = msg.sender_id === CURRENT_USER.uid;
        const div = document.createElement('div');
        div.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;

        const avHtml = profile.avatar_url
            ? `<img class="avatar avatar-sm" src="${profile.avatar_url}" alt="">`
            : `<div class="avatar avatar-sm avatar-placeholder">${initials(profile.display_name || profile.username)}</div>`;

        let content = '';
        if (msg.media_url) {
            content = msg.media_type === 'video'
                ? `<div class="msg-media"><video src="${msg.media_url}" controls style="max-width:240px;border-radius:var(--r-md)"></video></div>`
                : `<div class="msg-media"><img src="${msg.media_url}" alt="" onclick="window.open('${msg.media_url}','_blank')"></div>`;
        }
        if (msg.body) content += `<div class="msg-bubble">${escHtml(msg.body)}</div>`;

        div.innerHTML = `${!isMine ? avHtml : ''}<div>${content}<div class="msg-time">${timeAgo(msg.created_at)}</div></div>${isMine ? avHtml : ''}`;
        return div;
    }

    async function sendMessage() {
        if (!activeConvId) return;
        const input = document.getElementById('msg-input');
        const body = input?.value.trim();
        if (!body) return;

        input.value = '';
        input.style.height = 'auto';

        await fbDb.collection('messages').add({
            conversation_id: activeConvId,
            sender_id: CURRENT_USER.uid,
            body,
            media_url: '',
            media_type: '',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });

        await fbDb.collection('conversations').doc(activeConvId).set({
            updated_at: firebase.firestore.FieldValue.serverTimestamp(),
            last_message: body,
        }, { merge: true });

        loadConversations();
    }

    async function sendMediaMessage(file) {
        if (!activeConvId) return;
        const mediaUrl = await uploadFile(BUCKETS.MESSAGES, file);
        const type = file.type.startsWith('video/') ? 'video' : 'image';

        await fbDb.collection('messages').add({
            conversation_id: activeConvId,
            sender_id: CURRENT_USER.uid,
            body: '',
            media_url: mediaUrl,
            media_type: type,
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
        });

        await fbDb.collection('conversations').doc(activeConvId).set({
            updated_at: firebase.firestore.FieldValue.serverTimestamp(),
            last_message: '[media]',
        }, { merge: true });

        loadConversations();
    }

    function openNewChatModal() {
        document.getElementById('new-chat-modal').style.display = 'flex';
        document.getElementById('people-search').focus();
    }

    function closeNewChatModal() {
        document.getElementById('new-chat-modal').style.display = 'none';
        document.getElementById('people-results').innerHTML = '';
        document.getElementById('people-search').value = '';
    }

    async function searchPeople() {
        const q = document.getElementById('people-search').value.trim().toLowerCase();
        const results = document.getElementById('people-results');
        if (!q) { results.innerHTML = ''; return; }

        const snap = await fbDb.collection('profiles').limit(50).get();
        const people = snap.docs.map(d => d.data())
            .filter(p => p.id !== CURRENT_USER.uid)
            .filter(p => (p.username || '').toLowerCase().includes(q) || (p.display_name || '').toLowerCase().includes(q))
            .slice(0, 12);

        if (!people.length) {
            results.innerHTML = '<p style="padding:16px;color:var(--c-text-muted);font-size:0.875rem">No users found.</p>';
            return;
        }

        results.innerHTML = people.map(p => {
            const avHtml = p.avatar_url
                ? `<img class="avatar avatar-md" src="${p.avatar_url}" alt="">`
                : `<div class="avatar avatar-md avatar-placeholder">${initials(p.display_name || p.username)}</div>`;
            return `<div class="conv-item" style="border-radius:var(--r-md);cursor:pointer" onclick="Chat.startDM('${p.id}')">
                ${avHtml}
                <div class="conv-item-info">
                    <div class="conv-item-name">${escHtml(p.display_name || p.username)}</div>
                    <div class="conv-item-preview">@${escHtml(p.username || '')}</div>
                </div>
            </div>`;
        }).join('');
    }

    async function startDM(otherUserId) {
        const ids = [CURRENT_USER.uid, otherUserId].sort();
        const dmKey = ids.join('__');

        const existing = await fbDb.collection('conversations').where('dm_key', '==', dmKey).limit(1).get();
        let convId;

        if (!existing.empty) {
            convId = existing.docs[0].id;
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

        closeNewChatModal();
        await loadConversations();
        openConversation(convId);
    }

    function backToList() {
        document.getElementById('conv-panel')?.classList.remove('chat-open');
        const win = document.getElementById('chat-window');
        win.innerHTML = `<div class="chat-empty" id="chat-empty-state"><div class="chat-empty-icon">${Icons.get('message')}</div><h3>Select a conversation</h3><p>Choose a chat from the list or start a new one</p><button class="btn btn-primary" onclick="Chat.openNewChatModal()">Start a new chat</button></div>`;
        activeConvId = null;
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }
    }

    return { init, openConversation, startDM, backToList, openNewChatModal };
})();

Chat.init();
