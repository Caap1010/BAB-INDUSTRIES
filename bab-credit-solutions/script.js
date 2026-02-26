// script.js for BAB Credit Solutions

// Email address that receives the form requests
const DESTINATION_EMAIL = "brokenaintbad@gmail.com"; // change if you want

document.addEventListener("DOMContentLoaded", () => {
    // Update year in footer
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Handle credit form submit -> open email client
    const form = document.getElementById("creditForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const fullName = document.getElementById("fullName").value.trim();
            const idNumber = document.getElementById("idNumber").value.trim();
            const email = document.getElementById("email").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const type = document.getElementById("type").value;
            const income = document.getElementById("income").value.trim();
            const situation = document.getElementById("situation").value.trim();

            // Basic validation for required fields
            if (!fullName || !email || !phone || !type) {
                alert("Please fill in your name, email, phone and what you need help with.");
                return;
            }

            const subject = `BAB Credit Solutions - ${type} Request`;

            const bodyLines = [
                "BAB Credit Solutions Request",
                "-----------------------------------",
                `Full Name: ${fullName}`,
                `ID Number: ${idNumber || "N/A"}`,
                `Email: ${email}`,
                `Phone / WhatsApp: ${phone}`,
                `Service Needed: ${type}`,
                `Approx. Monthly Income: ${income || "N/A"}`,
                "",
                "Current Situation:",
                situation || "N/A",
                "",
                "Sent from BAB Credit Solutions website."
            ];

            const body = encodeURIComponent(bodyLines.join("\n"));

            // Build the mailto link
            const mailtoLink = `mailto:${encodeURIComponent(
                DESTINATION_EMAIL
            )}?subject=${encodeURIComponent(subject)}&body=${body}`;

            // Open the default mail client
            window.location.href = mailtoLink;
        });
    }
});