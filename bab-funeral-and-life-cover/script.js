document.getElementById("year").textContent = new Date().getFullYear();

const navToggle = document.getElementById("navToggle");
const navMobile = document.getElementById("navMobile");
const brandLogo = document.getElementById("brandLogo");
const brandFallback = document.getElementById("brandFallback");
const contactForm = document.getElementById("contactForm");
const sendWhatsappBtn = document.getElementById("sendWhatsappBtn");
const sendEmailBtn = document.getElementById("sendEmailBtn");
const contactStatus = document.getElementById("contactStatus");

const clientName = document.getElementById("clientName");
const clientEmail = document.getElementById("clientEmail");
const clientPhone = document.getElementById("clientPhone");
const clientSubject = document.getElementById("clientSubject");
const clientMessage = document.getElementById("clientMessage");

if (navToggle && navMobile) {
    navToggle.addEventListener("click", () => {
        navMobile.classList.toggle("nav-mobile-open");
    });
}

if (brandLogo && brandFallback) {
    brandLogo.addEventListener("error", () => {
        brandLogo.style.display = "none";
        brandFallback.style.display = "grid";
    });
}

function getFormValues() {
    return {
        name: clientName?.value.trim() || "",
        email: clientEmail?.value.trim() || "",
        phone: clientPhone?.value.trim() || "",
        subject: clientSubject?.value.trim() || "",
        message: clientMessage?.value.trim() || "",
    };
}

function hasRequiredValues(values) {
    return values.name && values.email && values.phone && values.subject && values.message;
}

function updateActionLinks() {
    if (!sendWhatsappBtn || !sendEmailBtn || !contactStatus) {
        return;
    }

    const values = getFormValues();
    if (!hasRequiredValues(values)) {
        sendWhatsappBtn.href = "#";
        sendEmailBtn.href = "#";
        sendWhatsappBtn.classList.add("disabled");
        sendEmailBtn.classList.add("disabled");
        contactStatus.textContent = "Complete the form to enable WhatsApp and Email buttons.";
        return;
    }

    const whatsappText = [
        "BAB Funeral and Life Cover Enquiry",
        `Name: ${values.name}`,
        `Email: ${values.email}`,
        `Phone: ${values.phone}`,
        `Subject: ${values.subject}`,
        `Message: ${values.message}`,
    ].join("\n");

    const emailSubject = `BAB Funeral & Life Cover: ${values.subject}`;
    const emailBody = [
        `Name: ${values.name}`,
        `Email: ${values.email}`,
        `Phone: ${values.phone}`,
        "",
        values.message,
    ].join("\n");

    sendWhatsappBtn.href = `https://wa.me/27677844577?text=${encodeURIComponent(whatsappText)}`;
    sendEmailBtn.href = `mailto:brokenaintbad@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    sendWhatsappBtn.classList.remove("disabled");
    sendEmailBtn.classList.remove("disabled");
    contactStatus.textContent = "Ready to send via WhatsApp or Email.";
}

if (contactForm) {
    contactForm.addEventListener("input", updateActionLinks);
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        updateActionLinks();
    });
    updateActionLinks();
}
