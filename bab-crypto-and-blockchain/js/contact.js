const contactForm = document.getElementById("contactForm");
const contactStatus = document.getElementById("contactStatus");

if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const formData = new FormData(contactForm);
        const name = (formData.get("name") || "").toString().trim();
        const email = (formData.get("email") || "").toString().trim();
        const company = (formData.get("company") || "").toString().trim();
        const message = (formData.get("message") || "").toString().trim();

        const subject = encodeURIComponent("Partnership Enquiry - BAB Crypto & Blockchain");
        const body = encodeURIComponent(
            `Name: ${name}\nEmail: ${email}\nCompany/Project: ${company || "N/A"}\n\nMessage:\n${message}`
        );

        const mailtoUrl = `mailto:partnerships@babindustries.co.za?subject=${subject}&body=${body}`;
        window.location.href = mailtoUrl;

        if (contactStatus) {
            contactStatus.textContent = "Your email app should open now with your message pre-filled.";
        }
    });
}
