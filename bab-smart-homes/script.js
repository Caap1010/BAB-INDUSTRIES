const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

document.querySelectorAll('[data-logo]').forEach((logo) => {
    const fallbackId = logo.getAttribute('data-fallback');
    const fallbackElement = fallbackId ? document.getElementById(fallbackId) : null;

    const showLogo = () => {
        logo.classList.add('is-ready');
        if (fallbackElement) {
            fallbackElement.style.display = 'none';
        }
    };

    const showFallback = () => {
        logo.classList.remove('is-ready');
        if (fallbackElement) {
            fallbackElement.style.display = '';
        }
    };

    if (logo.complete && logo.naturalWidth > 0) {
        showLogo();
    } else if (logo.complete && logo.naturalWidth === 0) {
        showFallback();
    }

    logo.addEventListener('load', showLogo);
    logo.addEventListener('error', showFallback);
});

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
}

document.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.scroll);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

const contactForm = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

if (contactForm && formNote) {
    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitter = event.submitter;
        const channel = submitter?.dataset.channel || 'whatsapp';

        const formData = new FormData(contactForm);
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const subject = (formData.get('subject') || '').toString().trim();
        const message = (formData.get('message') || '').toString().trim();

        if (!name || !email || !subject || !message) {
            formNote.textContent = 'Please complete all fields before sending.';
            return;
        }

        const whatsappNumber = '27677844577';
        const destinationEmail = 'brokenaintbad@gmail.com';

        if (channel === 'email') {
            const emailSubject = encodeURIComponent(`BAB Smart Homes: ${subject}`);
            const emailBody = encodeURIComponent(
                `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
            );
            window.location.href = `mailto:${destinationEmail}?subject=${emailSubject}&body=${emailBody}`;
            formNote.textContent = 'Opening your email app...';
            return;
        }

        const whatsappText = encodeURIComponent(
            `BAB Smart Homes Contact Form\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`
        );
        window.open(`https://wa.me/${whatsappNumber}?text=${whatsappText}`, '_blank', 'noopener');
        formNote.textContent = 'Opening WhatsApp...';
    });
}
