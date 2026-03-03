const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const year = document.getElementById("year");
const backToTopLink = document.getElementById("backToTopLink");
const backToTopFab = document.getElementById("backToTopFab");
const formStatus = document.getElementById("formStatus");

if (year) {
    year.textContent = new Date().getFullYear();
}

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
        });
    });
}

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
};

if (backToTopLink) {
    backToTopLink.addEventListener("click", (event) => {
        event.preventDefault();
        scrollToTop();
    });
}

if (backToTopFab) {
    backToTopFab.addEventListener("click", scrollToTop);

    const toggleBackToTopVisibility = () => {
        const isVisible = window.scrollY > 320;
        backToTopFab.classList.toggle("visible", isVisible);
    };

    window.addEventListener("scroll", toggleBackToTopVisibility, { passive: true });
    toggleBackToTopVisibility();
}

const contactForm = document.getElementById("contactForm");

if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const formData = new FormData(contactForm);
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const subject = String(formData.get("subject") || "").trim();
        const message = String(formData.get("message") || "").trim();
        const sendMethod = String(formData.get("sendMethod") || "whatsapp");

        const setStatus = (text) => {
            if (formStatus) {
                formStatus.textContent = text;
            }
        };

        if (!name || !email || !subject || !message) {
            setStatus("Please complete all fields before sending.");
            contactForm.reportValidity();
            return;
        }

        const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailIsValid) {
            setStatus("Please enter a valid email address.");
            return;
        }

        const composedMessage = [
            "New enquiry from BAB Reduce Reuse Recycle website",
            "",
            `Name: ${name}`,
            `Email: ${email}`,
            `Subject: ${subject}`,
            "",
            message,
        ].join("\n");

        if (sendMethod === "email") {
            const emailSubject = encodeURIComponent(`Website Enquiry: ${subject}`);
            const emailBody = encodeURIComponent(composedMessage);
            setStatus("Opening your email app...");
            window.location.href = `mailto:brokenaintbad@gmail.com?subject=${emailSubject}&body=${emailBody}`;
            return;
        }

        const whatsappText = encodeURIComponent(composedMessage);
        setStatus("Opening WhatsApp...");
        window.location.href = `https://wa.me/27677844577?text=${whatsappText}`;
    });
}
