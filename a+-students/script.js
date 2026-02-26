// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open') ? 'true' : 'false');
    });

    // Close menu when a link is clicked (on mobile)
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('click', (event) => {
        const clickedInsideNav = navLinks.contains(event.target);
        const clickedToggle = navToggle.contains(event.target);
        if (!clickedInsideNav && !clickedToggle) {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        }
    });
}

// Highlight active nav link on scroll
const sections = document.querySelectorAll('main section[id]');
const navItems = document.querySelectorAll('.nav-link');

function onScroll() {
    let currentId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
            currentId = section.getAttribute('id');
        }
    });

    navItems.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href === `#${currentId}`) {
            link.classList.add('active');
        }
    });
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Set current year in footer
const yearSpan = document.getElementById('year');
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// Contact form actions (WhatsApp + Email)
const contactForm = document.getElementById('contactForm');
const emailAction = document.getElementById('emailAction');
const contactStatus = document.getElementById('contactStatus');

const contactInputs = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    grade: document.getElementById('grade'),
    message: document.getElementById('message')
};

const contactTargets = {
    whatsapp: '27677844577',
    email: 'brokenaintbad@gmail.com'
};

function buildContactMessage() {
    const fullName = contactInputs.name?.value.trim() || '';
    const email = contactInputs.email?.value.trim() || '';
    const gradeOrInterest = contactInputs.grade?.value.trim() || 'Not specified';
    const supportMessage = contactInputs.message?.value.trim() || '';

    return [
        'A+ Student Academy enquiry',
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Grade/Interest: ${gradeOrInterest}`,
        `Message: ${supportMessage}`
    ].join('\n');
}

function buildContactLinks() {
    const message = buildContactMessage();
    const subject = encodeURIComponent('A+ Student Academy Enquiry');
    const encodedMessage = encodeURIComponent(message);

    return {
        whatsapp: `https://wa.me/${contactTargets.whatsapp}?text=${encodedMessage}`,
        email: `mailto:${contactTargets.email}?subject=${subject}&body=${encodedMessage}`
    };
}

function setContactActionsState() {
    if (!contactForm || !emailAction) {
        return;
    }

    const isValid = contactForm.checkValidity();
    if (!isValid) {
        emailAction.href = '#';
        emailAction.classList.add('action-disabled');
        return;
    }

    const links = buildContactLinks();
    emailAction.href = links.email;
    emailAction.classList.remove('action-disabled');
}

if (contactForm) {
    setContactActionsState();

    contactForm.addEventListener('input', setContactActionsState);

    if (emailAction) {
        emailAction.addEventListener('click', (event) => {
            if (emailAction.classList.contains('action-disabled')) {
                event.preventDefault();
                contactForm.reportValidity();
                if (contactStatus) {
                    contactStatus.textContent = 'Please complete all required fields first.';
                }
            }
        });
    }

    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!contactForm.checkValidity()) {
            contactForm.reportValidity();
            if (contactStatus) {
                contactStatus.textContent = 'Please complete all required fields first.';
            }
            return;
        }

        const links = buildContactLinks();
        if (emailAction) {
            emailAction.href = links.email;
            emailAction.classList.remove('action-disabled');
        }

        window.open(links.whatsapp, '_blank', 'noopener,noreferrer');
        if (contactStatus) {
            contactStatus.textContent = 'Opening WhatsApp with your prefilled message...';
        }
    });
}