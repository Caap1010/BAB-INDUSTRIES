/* ============================================================
   NEXUS — App Shell: Navigation injection + Auth guard
   ============================================================ */

const App = (() => {

    const NAV_LINKS = [
        { href: 'feed.html', icon: 'home', label: 'Feed' },
        { href: 'messages.html', icon: 'message', label: 'Messages' },
        { href: 'reels.html', icon: 'film', label: 'Reels' },
        { href: '#', icon: 'compass', label: 'Explore', id: 'explore-link' },
        { href: '#profile', icon: 'user', label: 'Profile', id: 'profile-link' },
    ];

    /** Build the sidebar HTML and inject into #app-sidebar */
    function buildSidebar() {
        const el = document.getElementById('app-sidebar');
        if (!el) return;

        const currentFile = location.pathname.split('/').pop() || 'feed.html';
        const navItems = NAV_LINKS.map(link => {
            const isActive = link.href === currentFile;
            return `<a href="${link.href}" class="nav-item${isActive ? ' active' : ''}" ${link.id ? `id="${link.id}"` : ''}>
        ${Icons.get(link.icon)}
        <span>${link.label}</span>
      </a>`;
        }).join('');

        const profile = CURRENT_PROFILE;
        const avatarHtml = profile?.avatar_url
            ? `<img class="avatar avatar-md" src="${storageUrl(BUCKETS.AVATARS, profile.avatar_url)}" alt="">`
            : `<div class="avatar avatar-md avatar-placeholder">${initials(profile?.display_name || profile?.username || 'U')}</div>`;

        el.innerHTML = `
      <a href="index.html" class="sidebar-logo">
        <img class="sidebar-logo-mark" src="assets/logo.png" alt="NEXUS logo" onerror="this.onerror=null;this.src='icon.svg'">
        <span class="sidebar-logo-text">NEXUS</span>
      </a>
      <nav class="nav-items">
        ${navItems}
      </nav>
      <div class="sidebar-bottom">
        <a class="nav-item" href="#" id="notifications-btn" title="Notifications">
          ${Icons.get('bell')}<span>Notifications</span>
        </a>
        <a class="nav-item" href="#" id="settings-btn" title="Settings">
          ${Icons.get('settings')}<span>Settings</span>
        </a>
        <div class="sidebar-user" id="sidebar-user" title="Your profile">
          ${avatarHtml}
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${escHtml(profile?.display_name || profile?.username || 'User')}</div>
            <div class="sidebar-user-handle">@${escHtml(profile?.username || '...')}</div>
          </div>
          <button class="btn-icon" id="signout-btn" title="Sign out">${Icons.get('logout')}</button>
        </div>
      </div>
    `;

        // Wire sidebar events
        document.getElementById('signout-btn')?.addEventListener('click', e => { e.stopPropagation(); Auth.signOut(); });
        document.getElementById('sidebar-user')?.addEventListener('click', () => {
            if (CURRENT_PROFILE?.username) location.href = `profile.html?user=${CURRENT_PROFILE.username}`;
        });
        document.getElementById('profile-link')?.addEventListener('click', e => {
            e.preventDefault();
            if (CURRENT_PROFILE?.username) location.href = `profile.html?user=${CURRENT_PROFILE.username}`;
        });
    }

    /** Build the bottom mobile navigation */
    function buildBottomNav() {
        const el = document.getElementById('bottom-nav');
        if (!el) return;
        const currentFile = location.pathname.split('/').pop() || 'feed.html';

        el.innerHTML = `<div class="bottom-nav-items">
      ${NAV_LINKS.map(link => `
        <a href="${link.href}" class="bottom-nav-item${link.href === currentFile ? ' active' : ''}" ${link.id ? `id="bn-${link.id}"` : ''}>
          ${Icons.get(link.icon)}
          <span>${link.label}</span>
        </a>`).join('')}
    </div>`;

        // Wire profile link
        el.querySelector('#bn-profile-link')?.addEventListener('click', e => {
            e.preventDefault();
            if (CURRENT_PROFILE?.username) location.href = `profile.html?user=${CURRENT_PROFILE.username}`;
        });
    }

    /** Hamburger menu toggle for mobile */
    function initMobileNav() {
        const toggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('app-sidebar');
        if (!toggle || !sidebar) return;
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
        document.addEventListener('click', e => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
                sidebar.classList.remove('open');
            }
        });
    }

    /** Register service worker */
    function registerSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => { });
        }
    }

    /**
     * Init the app shell on a protected page.
     * Returns the current user, or redirects to login.html if not authed.
     */
    async function init() {
        const user = await Auth.init();
        if (!user) {
            location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
            return null;
        }
        buildSidebar();
        buildBottomNav();
        initMobileNav();
        registerSW();
        return user;
    }

    /** Init on a PUBLIC page (no auth requirement) */
    async function initPublic() {
        await Auth.init();
        registerSW();
    }

    return { init, initPublic, buildSidebar };
})();
