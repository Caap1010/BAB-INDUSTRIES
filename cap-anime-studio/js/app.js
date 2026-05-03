// ===== CAP ANIME STUDIO — APP JS =====

const sidebar        = document.getElementById('sidebar');
const overlay        = document.getElementById('sidebarOverlay');
const sidebarToggle  = document.getElementById('sidebarToggle');
const navItems       = document.querySelectorAll('.nav-item');
const sections       = document.querySelectorAll('.content-section');

// --- Sidebar toggle (mobile) ---
sidebarToggle?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
});

overlay?.addEventListener('click', () => {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');
});

// --- Section navigation ---
function activateSection(sectionId) {
  const safeSectionId = document.getElementById(sectionId) ? sectionId : 'home';

  // Hide all sections
  sections.forEach(s => s.classList.remove('active'));
  // Deactivate all nav items
  navItems.forEach(n => n.classList.remove('active'));

  // Show target section
  const target = document.getElementById(safeSectionId);
  if (target) {
    target.classList.add('active');
    // Only scroll for non-studio sections
    if (safeSectionId !== 'production') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Activate matching nav item
  const activeNav = document.querySelector(`.nav-item[data-section="${safeSectionId}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Close mobile sidebar
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');

  // Update URL hash without scroll jump
  history.replaceState(null, '', `#${safeSectionId}`);
}

// Handle sidebar nav clicks
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.dataset.section;
    if (section) activateSection(section);
  });
});

// Handle in-content nav links (hero CTA, feat-card links, etc.)
document.querySelectorAll('a.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    if (section) activateSection(section);
  });
});

// --- Init: activate section from URL hash or default to home ---
const initialSection = (window.location.hash || '#home').replace('#', '');
activateSection(initialSection);
