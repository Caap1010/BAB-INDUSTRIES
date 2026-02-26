// Smooth scroll helper
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');

if (navToggle && navMobile) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMobile.style.display === 'flex';
    navMobile.style.display = isOpen ? 'none' : 'flex';
  });

  // Close mobile menu when a link is clicked
  navMobile.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMobile.style.display = 'none';
    });
  });
}

// Fake form handler (just shows an alert, doesn’t send email)
function handleFormSubmit(event) {
  event.preventDefault();
  alert('Thank you! Your quote request has been captured (demo). For immediate assistance, please call or WhatsApp +27 67 784 4577.');
}