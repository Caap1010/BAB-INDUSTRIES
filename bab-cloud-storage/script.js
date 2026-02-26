// script.js

// Email address that receives the form requests
const DESTINATION_EMAIL = "brokenaintbad@gmail.com"; // change if you want

document.addEventListener("DOMContentLoaded", () => {
    // Update year in footer
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Handle form submit -> open email client
    const form = document.getElementById("cloudForm");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const fullName = document.getElementById("fullName").value.trim();
            const company = document.getElementById("company").value.trim();
            const email = document.getElementById("email").value.trim();
            const phone = document.getElementById("phone").value.trim();
            const plan = document.getElementById("plan").value;
            const storage = document.getElementById("storage").value.trim();
            const message = document.getElementById("message").value.trim();

            // Basic validation for required fields
            if (!fullName || !email || !plan) {
                alert("Please fill in your name, email and desired plan.");
                return;
            }

            const subject = `BAB Cloud Storage Request - ${plan}`;

            const bodyLines = [
                "BAB Cloud Storage Request",
                "-----------------------------------",
                `Full Name: ${fullName}`,
                `Company: ${company || "N/A"}`,
                `Email: ${email}`,
                `Phone / WhatsApp: ${phone || "N/A"}`,
                `Desired Plan: ${plan}`,
                `Estimated Storage: ${storage || "N/A"}`,
                "",
                "Additional Details:",
                message || "N/A",
                "",
                "Sent from BAB Cloud Storage website."
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