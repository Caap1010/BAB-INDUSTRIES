const sections = document.querySelectorAll('.reveal');
const siteHeader = document.querySelector('.site-header');
const navDropdown = document.getElementById('navDropdown');
const navDropdownSummary = navDropdown ? navDropdown.querySelector('summary') : null;
const navLinks = document.querySelectorAll('.nav-dropdown-menu a');
const brandedImages = document.querySelectorAll('img.brand-image');
const galleryTabs = document.querySelectorAll('[data-gallery-view]');
const galleryContents = document.querySelectorAll('[data-gallery-content]');
const counters = document.querySelectorAll('[data-counter]');
const saNow = document.getElementById('saNow');
const examCards = document.querySelectorAll('[data-exam-date]');
const featuredTrack = document.getElementById('featuredTrack');
const featuredPrev = document.getElementById('featuredPrev');
const featuredNext = document.getElementById('featuredNext');
const projectButtons = document.querySelectorAll('[data-project]');
const projectModal = document.getElementById('projectModal');
const projectModalTitle = document.getElementById('projectModalTitle');
const projectModalBody = document.getElementById('projectModalBody');
const projectModalClose = document.getElementById('projectModalClose');
const testimonialForm = document.getElementById('testimonialForm');
const testimonialList = document.getElementById('testimonialList');
const skillsLaneCards = document.querySelectorAll('.skills-lane');
const skillsPieChart = document.getElementById('skillsPieChart');
const skillsGrowthLegend = document.getElementById('skillsGrowthLegend');
const skillsGrowthTable = document.getElementById('skillsGrowthTable');
const skillsChartModeButtons = document.querySelectorAll('[data-skills-chart-mode]');


const TESTIMONIALS_KEY = 'portfolioTestimonials';
const ANALYTICS_KEY = 'portfolioAnalyticsEvents';
const SKILLS_LANE_COLORS = ['#56CCF2', '#F2994A', '#6FCF97', '#BB6BD9', '#EB5757', '#2D9CDB'];

let skillsChartMode = 'lane';

const PROJECT_DETAILS = {
    talenttrack: {
        title: 'TalentTrack',
        body: 'TalentTrack addresses hiring visibility and matching by combining listings, profile workflows, and recommendation support for candidates and employers.'
    },
    civic: {
        title: 'BAB Civic Connect',
        body: 'Civic Connect supports structured community communication, issue tracking, and participation channels for digital civic engagement.'
    },
    chat: {
        title: 'Universal Chat',
        body: 'Universal Chat is built for scalable, real-time messaging with adaptable interfaces and practical communication controls.'
    }
};

const navSectionTargets = Array.from(navLinks)
    .map((link) => link.getAttribute('href'))
    .filter((href) => href && href.startsWith('#'))
    .filter((href, index, list) => list.indexOf(href) === index)
    .map((href) => {
        const section = document.querySelector(href);
        return section ? { href, section } : null;
    })
    .filter(Boolean);

function trackEvent(eventName, detail = {}) {
    const existing = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
    existing.push({ eventName, detail, timestamp: new Date().toISOString() });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(existing.slice(-250)));
}

function setActiveNavSection(activeHref) {
    navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === activeHref;
        link.classList.toggle('active', isActive);
        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });

    if (navDropdownSummary) {
        const dropdownHasActive = Array.from(navLinks).some((link) => link.getAttribute('href') === activeHref);
        navDropdownSummary.classList.toggle('active', dropdownHasActive);
        if (dropdownHasActive) {
            navDropdownSummary.setAttribute('aria-current', 'page');
        } else {
            navDropdownSummary.removeAttribute('aria-current');
        }
    }
}

function updateActiveNavSection() {
    if (navSectionTargets.length === 0) {
        return;
    }

    const headerOffset = siteHeader ? siteHeader.offsetHeight + 120 : 120;
    const scrollPosition = window.scrollY + headerOffset;
    let currentHref = navSectionTargets[0].href;

    navSectionTargets.forEach(({ href, section }) => {
        if (scrollPosition >= section.offsetTop) {
            currentHref = href;
        }
    });

    setActiveNavSection(currentHref);
}

function readStorageJson(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function calculateSkillTarget(current) {
    if (current >= 90) {
        return 95;
    }
    if (current >= 80) {
        return Math.min(95, current + 6);
    }
    if (current >= 70) {
        return Math.min(95, current + 8);
    }
    return Math.min(95, current + 10);
}

function normalizeLaneTitle(title) {
    return title.replace(/\s*\(.*\)\s*$/, '').trim();
}

function getLaneColor(index) {
    return SKILLS_LANE_COLORS[index % SKILLS_LANE_COLORS.length];
}

function withAlpha(hexColor, alpha) {
    const clean = hexColor.replace('#', '');
    if (clean.length !== 6) {
        return hexColor;
    }
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function collectSkillsLaneData() {
    const laneData = [];
    const skillData = [];

    skillsLaneCards.forEach((lane, index) => {
        const heading = lane.querySelector('h3');
        const title = heading ? normalizeLaneTitle(heading.textContent || `Lane ${index + 1}`) : `Lane ${index + 1}`;
        const laneColor = getLaneColor(index);
        const rows = Array.from(lane.querySelectorAll(':scope > div'));
        const progressBars = rows.map((row) => row.querySelector('progress')).filter(Boolean);

        lane.style.borderColor = withAlpha(laneColor, 0.6);
        lane.style.background = `linear-gradient(180deg, ${withAlpha(laneColor, 0.16)}, rgba(8, 33, 69, 0.72))`;

        let currentTotal = 0;
        let targetTotal = 0;

        rows.forEach((row) => {
            const label = row.querySelector('span');
            const progress = row.querySelector('progress');
            if (!label || !progress) {
                return;
            }

            const skillNameText = (label.textContent || 'Skill').trim();

            const current = Number(progress.value || 0);
            const target = Number(progress.dataset.target || calculateSkillTarget(current));
            progress.dataset.target = String(target);
            currentTotal += current;
            targetTotal += target;
            progress.style.accentColor = laneColor;

            let labelRow = row.querySelector('.skill-label-row');
            if (!labelRow) {
                labelRow = document.createElement('div');
                labelRow.className = 'skill-label-row';
                const skillName = document.createElement('span');
                skillName.className = 'skill-name';
                skillName.textContent = skillNameText;
                const skillPercent = document.createElement('span');
                skillPercent.className = 'skill-percent';
                skillPercent.textContent = `${current}%`;
                labelRow.appendChild(skillName);
                labelRow.appendChild(skillPercent);
                row.replaceChild(labelRow, label);
            } else {
                const percentEl = labelRow.querySelector('.skill-percent');
                if (percentEl) {
                    percentEl.textContent = `${current}%`;
                }
            }

            let targetEl = row.querySelector('.skill-target');
            if (!targetEl) {
                targetEl = document.createElement('small');
                targetEl.className = 'skill-target';
                row.appendChild(targetEl);
            }
            const growthDelta = target - current;
            targetEl.textContent = `Target Aug 2026: ${target}% (${growthDelta >= 0 ? '+' : ''}${growthDelta}%)`;
            progress.setAttribute('aria-label', `${skillNameText} current ${current}% and target ${target}%`);

            skillData.push({
                title: skillNameText,
                laneTitle: title,
                current,
                target,
                growth: growthDelta,
                color: laneColor
            });
        });

        if (progressBars.length > 0) {
            const averageCurrent = Math.round(currentTotal / progressBars.length);
            const averageTarget = Math.round(targetTotal / progressBars.length);
            laneData.push({
                title,
                current: averageCurrent,
                target: averageTarget,
                growth: averageTarget - averageCurrent,
                color: laneColor
            });
        }
    });

    return { laneData, skillData };
}

function drawSkillsPie(items, chartLabel) {
    if (!skillsPieChart || items.length === 0) {
        return;
    }

    const ctx = skillsPieChart.getContext('2d');
    if (!ctx) {
        return;
    }

    const cssSize = Math.min(Math.max(skillsPieChart.clientWidth, 260), 360);
    const dpr = window.devicePixelRatio || 1;

    skillsPieChart.width = Math.round(cssSize * dpr);
    skillsPieChart.height = Math.round(cssSize * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, skillsPieChart.width, skillsPieChart.height);
    ctx.scale(dpr, dpr);

    const center = cssSize / 2;
    const radius = cssSize * 0.38;
    const total = items.reduce((sum, item) => sum + item.current, 0);
    let startAngle = -Math.PI / 2;

    items.forEach((item) => {
        const ratio = total === 0 ? 0 : item.current / total;
        const endAngle = startAngle + ratio * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        startAngle = endAngle;
    });

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#081a33';
    ctx.fill();

    const avgCurrent = Math.round(items.reduce((sum, item) => sum + item.current, 0) / items.length);
    const avgTarget = Math.round(items.reduce((sum, item) => sum + item.target, 0) / items.length);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8f3ff';
    ctx.font = '700 18px Manrope, sans-serif';
    ctx.fillText(`${avgCurrent}%`, center, center - 4);
    ctx.fillStyle = '#b5cae6';
    ctx.font = '500 12px IBM Plex Sans, sans-serif';
    ctx.fillText(`${chartLabel} | Target ${avgTarget}%`, center, center + 16);
}

function renderSkillsGrowthLegend(items, isSkillMode) {
    if (!skillsGrowthLegend) {
        return;
    }
    skillsGrowthLegend.innerHTML = '';

    items.forEach((entry) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'skills-growth-item';
        const subtitle = isSkillMode
            ? `${entry.laneTitle} | ${entry.current}% current | ${entry.target}% target`
            : `${entry.current}% current | ${entry.target}% target`;
        legendItem.innerHTML = `
            <span class="skills-growth-swatch" style="background:${entry.color}"></span>
            <div>
                <strong>${entry.title}</strong>
                <span>${subtitle}</span>
            </div>
        `;
        skillsGrowthLegend.appendChild(legendItem);
    });
}

function renderSkillsGrowthTable(items, isSkillMode) {
    if (!skillsGrowthTable) {
        return;
    }

    const rows = items.map((item) => `
        <tr>
            <td>${item.title}</td>
            ${isSkillMode ? `<td>${item.laneTitle}</td>` : ''}
            <td>${item.current}%</td>
            <td>${item.target}%</td>
            <td class="growth-positive">+${item.growth}%</td>
        </tr>
    `).join('');

    skillsGrowthTable.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>${isSkillMode ? 'Skill' : 'Lane'}</th>
                    ${isSkillMode ? '<th>Skillset Lane</th>' : ''}
                    <th>Current Level</th>
                    <th>Target (Aug 2026)</th>
                    <th>Growth Gap</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderSkillsGrowthAnalysis() {
    const { laneData, skillData } = collectSkillsLaneData();
    if (laneData.length === 0) {
        return;
    }

    const isSkillMode = skillsChartMode === 'skill';
    const dataset = isSkillMode ? skillData : laneData;
    const chartLabel = isSkillMode ? 'Skill View' : 'Lane View';

    drawSkillsPie(dataset, chartLabel);
    renderSkillsGrowthLegend(dataset, isSkillMode);
    renderSkillsGrowthTable(dataset, isSkillMode);
}

skillsChartModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const mode = button.dataset.skillsChartMode;
        if (!mode || mode === skillsChartMode) {
            return;
        }
        skillsChartMode = mode;
        skillsChartModeButtons.forEach((candidate) => {
            const active = candidate === button;
            candidate.classList.toggle('is-active', active);
            candidate.setAttribute('aria-selected', String(active));
        });
        renderSkillsGrowthAnalysis();
        trackEvent('skills_chart_mode_change', { mode });
    });
});

navLinks.forEach((link) => {
    link.addEventListener('click', () => {
        if (navDropdown) {
            navDropdown.open = false;
        }
    });
});

if (navDropdown) {
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Node)) {
            return;
        }

        if (!navDropdown.contains(target)) {
            navDropdown.open = false;
        }
    });
}

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        });
    },
    {
        threshold: 0.14,
        rootMargin: '0px 0px -36px 0px'
    }
);

sections.forEach((section, index) => {
    section.style.transitionDelay = `${Math.min(index * 55, 360)}ms`;
    revealObserver.observe(section);
});

let navScrollTicking = false;

window.addEventListener('scroll', () => {
    if (navScrollTicking) {
        return;
    }

    navScrollTicking = true;
    window.requestAnimationFrame(() => {
        updateActiveNavSection();
        navScrollTicking = false;
    });
}, { passive: true });

window.addEventListener('resize', updateActiveNavSection);
updateActiveNavSection();
renderSkillsGrowthAnalysis();

window.addEventListener('resize', () => {
    renderSkillsGrowthAnalysis();
});

function applyImageFallback(image) {
    if (image.dataset.fallbackApplied === 'true') {
        return;
    }

    const label = image.dataset.fallback || 'Image slot';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18508a"/><stop offset="1" stop-color="#2ea2e5"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="260" text-anchor="middle" fill="#eef8ff" font-family="Manrope, Arial, sans-serif" font-size="34" font-weight="700">${label}</text></svg>`;

    image.dataset.fallbackApplied = 'true';
    image.classList.add('fallback');
    image.alt = label;
    image.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

brandedImages.forEach((image) => {
    if (!image.classList.contains('hero-bg')) {
        image.loading = 'lazy';
    }

    if (!image.getAttribute('src')) {
        applyImageFallback(image);
        return;
    }

    image.addEventListener('error', () => applyImageFallback(image), { once: true });
});

galleryTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.galleryView;
        trackEvent('gallery_tab_switch', { target });

        galleryTabs.forEach((candidate) => {
            const active = candidate === tab;
            candidate.classList.toggle('is-active', active);
            candidate.setAttribute('aria-selected', String(active));
        });

        galleryContents.forEach((section) => {
            const shouldShow = section.dataset.galleryContent === target;
            section.classList.toggle('is-hidden', !shouldShow);
        });
    });
});

function updateSaTimeAndCountdowns() {
    const now = new Date();
    if (saNow) {
        saNow.textContent = new Intl.DateTimeFormat('en-ZA', {
            timeZone: 'Africa/Johannesburg',
            dateStyle: 'medium',
            timeStyle: 'medium'
        }).format(now);
    }

    examCards.forEach((card) => {
        const status = (card.dataset.examStatus || '').toLowerCase();
        const examDateRaw = card.dataset.examDate;
        const examDate = new Date(examDateRaw);
        const countdownEl = card.querySelector('.cert-countdown');
        if (!countdownEl) {
            return;
        }

        if (status === 'passed') {
            countdownEl.textContent = 'Result: Passed';
            return;
        }

        const diff = examDate.getTime() - now.getTime();
        if (diff <= 0) {
            countdownEl.textContent = 'Exam window reached.';
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        countdownEl.textContent = `Countdown: ${days}d ${hours}h ${minutes}m`;
    });
}

setInterval(updateSaTimeAndCountdowns, 1000);
updateSaTimeAndCountdowns();

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) {
            return;
        }

        const el = entry.target;
        const target = Number(el.dataset.counter || '0');
        const suffix = el.dataset.counterSuffix || '';
        const duration = 900;
        const start = performance.now();

        function animate(ts) {
            const progress = Math.min((ts - start) / duration, 1);
            el.textContent = `${Math.round(progress * target)}${suffix}`;
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
        counterObserver.unobserve(el);
    });
});

counters.forEach((counter) => counterObserver.observe(counter));

if (featuredTrack && featuredPrev && featuredNext) {
    const scrollBy = () => Math.round(featuredTrack.clientWidth * 0.75);
    featuredPrev.addEventListener('click', () => {
        featuredTrack.scrollBy({ left: -scrollBy(), behavior: 'smooth' });
        trackEvent('featured_prev');
    });
    featuredNext.addEventListener('click', () => {
        featuredTrack.scrollBy({ left: scrollBy(), behavior: 'smooth' });
        trackEvent('featured_next');
    });
}

projectButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const key = button.dataset.project;
        const project = PROJECT_DETAILS[key];
        if (!project || !projectModal || !projectModalTitle || !projectModalBody) {
            return;
        }
        projectModalTitle.textContent = project.title;
        projectModalBody.textContent = project.body;
        projectModal.showModal();
        trackEvent('open_project_detail', { key });
    });
});

if (projectModalClose && projectModal) {
    projectModalClose.addEventListener('click', () => projectModal.close());
}

function renderTestimonials() {
    if (!testimonialList) {
        return;
    }
    const entries = readStorageJson(TESTIMONIALS_KEY, []);
    testimonialList.innerHTML = '';

    if (entries.length === 0) {
        testimonialList.innerHTML = '<p class="muted">No comments yet. Add the first testimonial.</p>';
        return;
    }

    entries.slice().reverse().forEach((entry) => {
        const container = document.createElement('article');
        container.className = 'testimonial-entry';
        const custom = entry.customPoint ? `<p>${entry.customPoint}: ${entry.customRating || '-'}/5</p>` : '';
        container.innerHTML = `
            <h4>${entry.name} - ${entry.role}</h4>
            <p>Communication: ${entry.communication}/5 | Leadership: ${entry.leadership}/5</p>
            <p>Problem-solving: ${entry.problem}/5 | Technical: ${entry.technical}/5</p>
            ${custom}
            <p>${entry.comment}</p>
        `;
        testimonialList.appendChild(container);
    });
}

if (testimonialForm) {
    testimonialForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const payload = {
            name: document.getElementById('tName').value.trim(),
            role: document.getElementById('tRole').value.trim(),
            communication: document.getElementById('tCommunication').value,
            leadership: document.getElementById('tLeadership').value,
            problem: document.getElementById('tProblem').value,
            technical: document.getElementById('tTechnical').value,
            customPoint: document.getElementById('tCustomPoint').value.trim(),
            customRating: document.getElementById('tCustomRating').value,
            comment: document.getElementById('tComment').value.trim(),
            createdAt: new Date().toISOString()
        };

        const entries = readStorageJson(TESTIMONIALS_KEY, []);
        entries.push(payload);
        localStorage.setItem(TESTIMONIALS_KEY, JSON.stringify(entries));
        testimonialForm.reset();
        renderTestimonials();
        trackEvent('save_testimonial');
    });
}

renderTestimonials();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => registration.update())
            .catch(() => {
                trackEvent('service_worker_register_failed');
            });
    });
}

document.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', () => {
        const label = el.textContent ? el.textContent.trim().slice(0, 60) : 'interaction';
        trackEvent('ui_click', { label });
    });
});
