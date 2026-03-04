const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const siteFavicon = document.getElementById('siteFavicon');
const siteTouchIcon = document.getElementById('siteTouchIcon');
const ADMIN_PIN = 'BAB2026';

const logoCandidates = [
    'images/bab-sneaker-lab-logo.png',
    'images/logo.png',
    'images/logo.jpg',
    'images/logo.jpeg',
    'images/bab-sneaker-lab.png'
];

const tryLoadLogo = async (imgElement, fallbackElement) => {
    for (const path of logoCandidates) {
        const probe = new Image();
        probe.src = path;

        await new Promise((resolve) => {
            probe.onload = () => resolve(true);
            probe.onerror = () => resolve(false);
        });

        if (probe.naturalWidth > 0) {
            imgElement.src = path;
            imgElement.classList.add('is-ready');
            if (fallbackElement) {
                fallbackElement.style.display = 'none';
            }
            if (siteFavicon) {
                siteFavicon.href = path;
            }
            if (siteTouchIcon) {
                siteTouchIcon.href = path;
            }
            return;
        }
    }

    imgElement.classList.remove('is-ready');
    if (fallbackElement) {
        fallbackElement.style.display = '';
    }
};

document.querySelectorAll('[data-logo]').forEach((logo) => {
    const fallbackId = logo.getAttribute('data-fallback');
    const fallbackElement = fallbackId ? document.getElementById(fallbackId) : null;
    tryLoadLogo(logo, fallbackElement);
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

const categoryFilter = document.getElementById('categoryFilter');
const brandFilter = document.getElementById('brandFilter');
const productGrid = document.getElementById('productGrid');

if (categoryFilter && brandFilter && productGrid) {
    const productCards = [...productGrid.querySelectorAll('.product-card')];

    const applyProductFilters = () => {
        const selectedCategory = categoryFilter.value;
        const selectedBrand = brandFilter.value;

        productCards.forEach((card) => {
            const category = card.dataset.category;
            const brand = card.dataset.brand;
            const categoryMatch = selectedCategory === 'all' || selectedCategory === category;
            const brandMatch = selectedBrand === 'all' || selectedBrand === brand;
            card.style.display = categoryMatch && brandMatch ? '' : 'none';
        });
    };

    categoryFilter.addEventListener('change', applyProductFilters);
    brandFilter.addEventListener('change', applyProductFilters);
    applyProductFilters();
}

const contactForm = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');
const galleryUploadForm = document.getElementById('galleryUploadForm');
const galleryGrid = document.getElementById('galleryGrid');
const galleryNote = document.getElementById('galleryNote');
const clearGalleryBtn = document.getElementById('clearGalleryBtn');
const resetBookingSlotsBtn = document.getElementById('resetBookingSlotsBtn');
const reviewForm = document.getElementById('reviewForm');
const reviewNote = document.getElementById('reviewNote');
const reviewsGrid = document.getElementById('reviewsGrid');
const clearReviewsBtn = document.getElementById('clearReviewsBtn');

const verifyAdminPin = () => {
    const enteredPin = window.prompt('Enter admin password to continue:');
    if (enteredPin === null) {
        return false;
    }
    if (enteredPin !== ADMIN_PIN) {
        window.alert('Incorrect password. Action cancelled.');
        return false;
    }
    return true;
};

if (contactForm && formNote) {
    const preferredDateField = contactForm.querySelector('input[name="preferredDate"]');
    const preferredTimeField = contactForm.querySelector('select[name="preferredTime"]');
    const quoteTotal = document.getElementById('quoteTotal');
    const quoteBreakdown = document.getElementById('quoteBreakdown');

    const serviceRates = {
        'Sneaker Purchase': 1200,
        'Cleaning': 220,
        'Restoration': 520,
        'Custom Design': 1300,
        'Bulk / Business': 900
    };

    const materialMultipliers = {
        'Leather': 1,
        'Suede / Nubuck': 1.2,
        'Canvas': 0.95,
        'Mesh / Knit': 1.05,
        'Mixed': 1.15
    };

    const handoverFees = {
        'Drop-off at store': 0,
        'Pickup needed': 80,
        'Delivery after service': 90
    };

    const dailySlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'];

    const makeSlotKey = (dateValue) => `bsl-bookings-${dateValue}`;

    const getSlotMap = (dateValue) => {
        const raw = localStorage.getItem(makeSlotKey(dateValue));
        if (!raw) {
            return {};
        }
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    };

    const setSlotMap = (dateValue, slotMap) => {
        localStorage.setItem(makeSlotKey(dateValue), JSON.stringify(slotMap));
    };

    const updateSlotOptions = () => {
        if (!preferredDateField || !preferredTimeField) {
            return;
        }

        const selectedDate = preferredDateField.value;
        preferredTimeField.innerHTML = '';

        if (!selectedDate) {
            preferredTimeField.innerHTML = '<option value="">Select date first</option>';
            return;
        }

        const slotMap = getSlotMap(selectedDate);
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select available time slot';
        preferredTimeField.append(defaultOption);

        dailySlots.forEach((slot) => {
            const count = slotMap[slot] || 0;
            const isFull = count >= 3;
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = isFull ? `${slot} (Full)` : `${slot} (${3 - count} spots left)`;
            option.disabled = isFull;
            preferredTimeField.append(option);
        });
    };

    const updateQuote = () => {
        if (!quoteTotal || !quoteBreakdown) {
            return;
        }

        const formData = new FormData(contactForm);
        const serviceType = (formData.get('serviceType') || '').toString();
        const material = (formData.get('material') || '').toString();
        const handover = (formData.get('handover') || '').toString();
        const pairCount = Number((formData.get('pairCount') || '').toString()) || 0;

        if (!serviceType || !material || !handover || pairCount < 1) {
            quoteTotal.textContent = 'R0';
            quoteBreakdown.innerHTML = '<li>Fill the booking fields to calculate.</li>';
            return;
        }

        const baseRate = serviceRates[serviceType] || 0;
        const materialMultiplier = materialMultipliers[material] || 1;
        const handoverFee = handoverFees[handover] || 0;
        const subtotal = Math.round(baseRate * pairCount * materialMultiplier + handoverFee);

        quoteTotal.textContent = `R${subtotal.toLocaleString('en-ZA')}`;
        quoteBreakdown.innerHTML = `
            <li>Base (${serviceType}): R${baseRate.toLocaleString('en-ZA')} × ${pairCount} pair(s)</li>
            <li>Material factor (${material}): × ${materialMultiplier.toFixed(2)}</li>
            <li>Pickup/Drop-off fee: R${handoverFee.toLocaleString('en-ZA')}</li>
            <li>Estimate excludes rare material damage recovery and replacement parts.</li>
        `;
    };

    if (preferredDateField) {
        preferredDateField.min = new Date().toISOString().split('T')[0];
        preferredDateField.addEventListener('change', updateSlotOptions);
    }

    contactForm.addEventListener('change', updateQuote);
    contactForm.addEventListener('input', updateQuote);
    updateSlotOptions();
    updateQuote();

    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitter = event.submitter;
        const channel = submitter?.dataset.channel || 'whatsapp';

        const formData = new FormData(contactForm);
        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const phone = (formData.get('phone') || '').toString().trim();
        const serviceType = (formData.get('serviceType') || '').toString().trim();
        const pairCount = (formData.get('pairCount') || '').toString().trim();
        const material = (formData.get('material') || '').toString().trim();
        const handover = (formData.get('handover') || '').toString().trim();
        const preferredDate = (formData.get('preferredDate') || '').toString().trim();
        const preferredTime = (formData.get('preferredTime') || '').toString().trim();
        const subject = (formData.get('subject') || '').toString().trim();
        const message = (formData.get('message') || '').toString().trim();

        if (!name || !email || !phone || !serviceType || !pairCount || !material || !handover || !preferredDate || !preferredTime || !subject || !message) {
            formNote.textContent = 'Please complete all fields before sending.';
            return;
        }

        const slotMap = getSlotMap(preferredDate);
        const slotCount = slotMap[preferredTime] || 0;
        if (slotCount >= 3) {
            formNote.textContent = 'That time slot is full. Please choose another slot.';
            updateSlotOptions();
            return;
        }
        slotMap[preferredTime] = slotCount + 1;
        setSlotMap(preferredDate, slotMap);
        updateSlotOptions();

        const whatsappNumber = '27677844577';
        const destinationEmail = 'brokenaintbad@gmail.com';

        if (channel === 'email') {
            const emailSubject = encodeURIComponent(`BAB Sneaker Lab: ${subject}`);
            const emailBody = encodeURIComponent(
                `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nService Type: ${serviceType}\nPairs: ${pairCount}\nMaterial: ${material}\nPickup/Drop-off: ${handover}\nPreferred Date: ${preferredDate}\nPreferred Time: ${preferredTime}\n\nMessage:\n${message}`
            );
            window.location.href = `mailto:${destinationEmail}?subject=${emailSubject}&body=${emailBody}`;
            formNote.textContent = 'Opening your email app...';
            return;
        }

        const whatsappText = encodeURIComponent(
            `BAB Sneaker Lab Contact Form\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nService Type: ${serviceType}\nPairs: ${pairCount}\nMaterial: ${material}\nPickup/Drop-off: ${handover}\nPreferred Date: ${preferredDate}\nPreferred Time: ${preferredTime}\nSubject: ${subject}\nMessage: ${message}`
        );
        window.open(`https://wa.me/${whatsappNumber}?text=${whatsappText}`, '_blank', 'noopener');
        formNote.textContent = 'Opening WhatsApp...';
    });
}

if (galleryUploadForm && galleryGrid && galleryNote) {
    const storageKey = 'bsl-gallery-items';

    const renderGalleryItem = (item) => {
        const article = document.createElement('article');
        article.className = 'gallery-card card';
        article.dataset.uploaded = 'true';
        article.innerHTML = `
            <div class="gallery-split">
                <div class="shot"><img src="${item.before}" alt="Before sneaker result" /></div>
                <div class="shot"><img src="${item.after}" alt="After sneaker result" /></div>
            </div>
            <p>${item.caption}</p>
        `;
        galleryGrid.prepend(article);
    };

    const loadSavedGallery = () => {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return;
        }
        try {
            const items = JSON.parse(raw);
            if (Array.isArray(items)) {
                items.forEach(renderGalleryItem);
            }
        } catch {
            galleryNote.textContent = 'Saved gallery data could not be loaded.';
        }
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    galleryUploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(galleryUploadForm);
        const caption = (formData.get('caption') || '').toString().trim();
        const beforeFile = formData.get('beforeImage');
        const afterFile = formData.get('afterImage');

        if (!caption || !(beforeFile instanceof File) || !(afterFile instanceof File) || !beforeFile.size || !afterFile.size) {
            galleryNote.textContent = 'Please add a caption and both images.';
            return;
        }

        try {
            const before = await readFileAsDataUrl(beforeFile);
            const after = await readFileAsDataUrl(afterFile);
            const item = { caption, before, after };

            const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
            current.unshift(item);
            const capped = current.slice(0, 9);
            localStorage.setItem(storageKey, JSON.stringify(capped));

            renderGalleryItem(item);
            galleryUploadForm.reset();
            galleryNote.textContent = 'Gallery item added.';
        } catch {
            galleryNote.textContent = 'Could not process the selected images.';
        }
    });

    if (clearGalleryBtn) {
        clearGalleryBtn.addEventListener('click', () => {
            if (!verifyAdminPin()) {
                return;
            }
            const confirmed = window.confirm('Clear all saved uploaded gallery items?');
            if (!confirmed) {
                return;
            }

            localStorage.removeItem(storageKey);
            galleryGrid.querySelectorAll('[data-uploaded="true"]').forEach((item) => item.remove());
            galleryNote.textContent = 'Saved gallery items cleared.';
        });
    }

    loadSavedGallery();
}

if (resetBookingSlotsBtn) {
    resetBookingSlotsBtn.addEventListener('click', () => {
        if (!verifyAdminPin()) {
            return;
        }
        const confirmed = window.confirm('Reset all saved booking time slot allocations?');
        if (!confirmed) {
            return;
        }

        const bookingKeys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key && key.startsWith('bsl-bookings-')) {
                bookingKeys.push(key);
            }
        }

        bookingKeys.forEach((key) => localStorage.removeItem(key));
        if (formNote) {
            formNote.textContent = 'Booking slot allocations reset.';
        }
    });
}

if (reviewForm && reviewNote && reviewsGrid) {
    const reviewStorageKey = 'bsl-reviews';

    const renderReview = (review) => {
        const article = document.createElement('article');
        article.className = 'card review-card';
        article.dataset.uploadedReview = 'true';
        const rating = Number(review.rating) || 0;
        const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
        article.innerHTML = `
            <p>“${review.comment}”</p>
            <span class="review-meta">— ${review.name}</span>
            <div class="review-stars">${stars}</div>
        `;
        reviewsGrid.prepend(article);
    };

    const loadSavedReviews = () => {
        const raw = localStorage.getItem(reviewStorageKey);
        if (!raw) {
            return;
        }

        try {
            const reviews = JSON.parse(raw);
            if (Array.isArray(reviews)) {
                reviews.forEach(renderReview);
            }
        } catch {
            reviewNote.textContent = 'Saved reviews could not be loaded.';
        }
    };

    reviewForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(reviewForm);
        const name = (formData.get('reviewerName') || '').toString().trim();
        const rating = (formData.get('rating') || '').toString().trim();
        const comment = (formData.get('reviewComment') || '').toString().trim();

        if (!name || !rating || !comment) {
            reviewNote.textContent = 'Please complete all review fields.';
            return;
        }

        const review = { name, rating, comment };
        const current = JSON.parse(localStorage.getItem(reviewStorageKey) || '[]');
        current.unshift(review);
        const capped = current.slice(0, 20);
        localStorage.setItem(reviewStorageKey, JSON.stringify(capped));

        renderReview(review);
        reviewForm.reset();
        reviewNote.textContent = 'Thanks for your review.';
    });

    if (clearReviewsBtn) {
        clearReviewsBtn.addEventListener('click', () => {
            if (!verifyAdminPin()) {
                return;
            }
            const confirmed = window.confirm('Clear all saved reviews?');
            if (!confirmed) {
                return;
            }

            localStorage.removeItem(reviewStorageKey);
            reviewsGrid.querySelectorAll('[data-uploaded-review="true"]').forEach((item) => item.remove());
            reviewNote.textContent = 'Saved reviews cleared.';
        });
    }

    loadSavedReviews();
}
