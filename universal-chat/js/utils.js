/* ============================================================
   NEXUS — Shared Utilities (Firebase)
   ============================================================ */

const ProfileCache = new Map();

function asDate(value) {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}

function timeAgo(dateStr) {
    const diff = (Date.now() - asDate(dateStr).getTime()) / 1000;
    if (diff < 60) return `${Math.max(1, Math.floor(diff))}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return asDate(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function fmtNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n || 0);
}

function storageUrl(_bucket, pathOrUrl) {
    if (!pathOrUrl) return null;
    return pathOrUrl;
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function linkifyText(text) {
    return escHtml(text || '').replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
}

async function uploadFile(bucket, file) {
    if (!fbStorage) throw new Error(window.NEXUS_CONFIG_ERROR || 'Firebase storage not configured.');
    if (file.size > MAX_FILE_SIZE) throw new Error('File too large (max 50 MB)');

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${bucket}/${CURRENT_USER.uid}/${Date.now()}.${ext}`;
    const ref = fbStorage.ref().child(path);
    await ref.put(file);
    return ref.getDownloadURL();
}

function avatarEl(profile, size = 'md') {
    const src = profile?.avatar_url || null;
    const cls = `avatar avatar-${size}`;
    if (src) {
        const img = document.createElement('img');
        img.className = cls;
        img.src = src;
        img.alt = profile?.display_name || 'avatar';
        return img;
    }
    const el = document.createElement('div');
    el.className = `${cls} avatar-placeholder`;
    el.textContent = initials(profile?.display_name || profile?.username || '?');
    return el;
}

async function getProfileById(userId) {
    if (!userId) return null;
    if (ProfileCache.has(userId)) return ProfileCache.get(userId);
    const snap = await fbDb.collection('profiles').doc(userId).get();
    const profile = snap.exists ? snap.data() : null;
    if (profile) ProfileCache.set(userId, profile);
    return profile;
}

async function getProfilesByIds(userIds) {
    const unique = [...new Set((userIds || []).filter(Boolean))];
    const unresolved = unique.filter(id => !ProfileCache.has(id));

    for (let i = 0; i < unresolved.length; i += 10) {
        const chunk = unresolved.slice(i, i + 10);
        if (!chunk.length) continue;
        const snap = await fbDb
            .collection('profiles')
            .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
            .get();
        snap.forEach(doc => ProfileCache.set(doc.id, doc.data()));
    }

    const map = {};
    unique.forEach(id => { map[id] = ProfileCache.get(id) || null; });
    return map;
}

const Toast = (() => {
    let container;
    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    function show(message, type = 'info', duration = 3500) {
        const icons = { success: '✓', error: '✕', info: '✦' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${icons[type] || '✦'}</span><span>${escHtml(message)}</span>`;
        getContainer().appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; }, duration - 400);
        setTimeout(() => toast.remove(), duration);
    }
    return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

function animateCounters() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count, 10);
        const duration = 1800;
        const start = performance.now();
        const update = now => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 4);
            el.textContent = fmtNum(Math.floor(ease * target));
            if (p < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    });
}

function observeReveal(selector = '[data-reveal]') {
    const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(selector).forEach(el => io.observe(el));
}

function debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function getParam(key) {
    return new URLSearchParams(location.search).get(key);
}
