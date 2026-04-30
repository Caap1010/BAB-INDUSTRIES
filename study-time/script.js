const exams = Array.isArray(window.studyTimeExams) ? window.studyTimeExams : [];

const state = {
    selectedExamId: exams[0] ? exams[0].id : "",
    mode: "practice",
    selectedDomain: "all",
    activeLearner: "Guest Learner",
    selectedCohortId: "",
    currentQuestionIndex: 0,
    answers: [],
    checkedAnswers: [],
    markedForReview: [],
    flaggedQuestions: [],
    startedAt: null,
    remainingSeconds: 0,
    timerId: null,
    isActive: false,
    isPaused: false,
    activeQuestions: []
};

const pathGrid = document.getElementById("pathGrid");
const examSelect = document.getElementById("examSelect");
const modeSelect = document.getElementById("modeSelect");
const domainSelect = document.getElementById("domainSelect");
const examOverview = document.getElementById("examOverview");
const startExamButton = document.getElementById("startExamButton");
const exportProgressButton = document.getElementById("exportProgressButton");
const importProgressButton = document.getElementById("importProgressButton");
const importProgressInput = document.getElementById("importProgressInput");
const toggleHighContrastButton = document.getElementById("toggleHighContrastButton");
const toggleDyslexiaFontButton = document.getElementById("toggleDyslexiaFontButton");
const historyList = document.getElementById("historyList");
const liveReadinessBadge = document.getElementById("liveReadinessBadge");
const studyNotesPanel = document.getElementById("studyNotesPanel");
const az900CoveragePanel = document.getElementById("az900CoveragePanel");
const domainTrendChart = document.getElementById("domainTrendChart");
const recentScoreTrend = document.getElementById("recentScoreTrend");
const reviewQueueList = document.getElementById("reviewQueueList");
const dailyPlanList = document.getElementById("dailyPlanList");
const sectionProgressList = document.getElementById("sectionProgressList");
const weakestSectionsList = document.getElementById("weakestSectionsList");
const emptyState = document.getElementById("emptyState");
const examInterface = document.getElementById("examInterface");
const examTitle = document.getElementById("examTitle");
const questionIndicator = document.getElementById("questionIndicator");
const timerValue = document.getElementById("timerValue");
const progressBar = document.getElementById("progressBar");
const questionDomain = document.getElementById("questionDomain");
const questionDifficulty = document.getElementById("questionDifficulty");
const questionVersion = document.getElementById("questionVersion");
const caseStudyPanel = document.getElementById("caseStudyPanel");
const flagQuestionButton = document.getElementById("flagQuestionButton");
const questionText = document.getElementById("questionText");
const optionsList = document.getElementById("optionsList");
const feedbackPanel = document.getElementById("feedbackPanel");
const questionNav = document.getElementById("questionNav");
const pauseExamButton = document.getElementById("pauseExamButton");
const markReviewButton = document.getElementById("markReviewButton");
const reportIssueButton = document.getElementById("reportIssueButton");
const checkAnswerButton = document.getElementById("checkAnswerButton");
const nextQuestionButton = document.getElementById("nextQuestionButton");
const finishExamButton = document.getElementById("finishExamButton");
const resultsPanel = document.getElementById("resultsPanel");
const resultTitle = document.getElementById("resultTitle");
const resultScore = document.getElementById("resultScore");
const resultSummary = document.getElementById("resultSummary");
const resultReadiness = document.getElementById("resultReadiness");
const resultImprovements = document.getElementById("resultImprovements");
const reviewList = document.getElementById("reviewList");
const savePdfButton = document.getElementById("savePdfButton");
const restartButton = document.getElementById("restartButton");
const pathCount = document.getElementById("pathCount");
const learnerNameInput = document.getElementById("learnerNameInput");
const saveLearnerButton = document.getElementById("saveLearnerButton");
const activeLearnerLabel = document.getElementById("activeLearnerLabel");
const instructorStats = document.getElementById("instructorStats");
const cohortNameInput = document.getElementById("cohortNameInput");
const createCohortButton = document.getElementById("createCohortButton");
const cohortSelect = document.getElementById("cohortSelect");
const memberNameInput = document.getElementById("memberNameInput");
const addMemberButton = document.getElementById("addMemberButton");
const cohortMembersList = document.getElementById("cohortMembersList");
const assignmentExamSelect = document.getElementById("assignmentExamSelect");
const assignmentModeSelect = document.getElementById("assignmentModeSelect");
const assignmentDomainSelect = document.getElementById("assignmentDomainSelect");
const assignmentDueDateInput = document.getElementById("assignmentDueDateInput");
const createAssignmentButton = document.getElementById("createAssignmentButton");
const assignmentList = document.getElementById("assignmentList");
const myTasksList = document.getElementById("myTasksList");
const leaderboardList = document.getElementById("leaderboardList");
const cohortDomainHeatmap = document.getElementById("cohortDomainHeatmap");
const questionReportsList = document.getElementById("questionReportsList");
const revisionExamSelect = document.getElementById("revisionExamSelect");
const revisionQuestionIndexInput = document.getElementById("revisionQuestionIndexInput");
const revisionNoteInput = document.getElementById("revisionNoteInput");
const saveRevisionButton = document.getElementById("saveRevisionButton");
const revisionHistoryList = document.getElementById("revisionHistoryList");

const READINESS_OVERALL_TARGET = 90;
const READINESS_DOMAIN_TARGET = 85;
const READINESS_TIMED_STREAK_TARGET = 3;
const FIXED_EXAM_DURATION_MINUTES = 45;
const SECTION_COUNTS_BY_EXAM = {
    "az-900": {
        1: 120,
        2: 80,
        3: 30,
        4: 80,
        5: 50,
        6: 50,
        7: 40,
        8: 50
    },
    "az-305": {
        1: 80,
        2: 90,
        3: 80,
        4: 60,
        5: 80,
        6: 60,
        7: 50
    },
    "az-500": {
        1: 90,
        2: 90,
        3: 100,
        4: 80,
        5: 70,
        6: 70
    },
    "ai-102": {
        1: 80,
        2: 90,
        3: 80,
        4: 80,
        5: 80,
        6: 90
    },
    "dp-203": {
        1: 80,
        2: 90,
        3: 90,
        4: 70,
        5: 70,
        6: 100
    },
    "az-400": {
        1: 70,
        2: 80,
        3: 90,
        4: 80,
        5: 70,
        6: 70,
        7: 40
    }
};

const AZ900_BLUEPRINT_CHECKLIST = [
    {
        title: "Describe cloud concepts (25-30%)",
        items: [
            { label: "Define cloud computing", matchAny: ["define cloud computing"] },
            { label: "Describe the shared responsibility model", matchAny: ["shared responsibility model"] },
            { label: "Define cloud models: public, private, hybrid", matchAny: ["cloud models", "public private and hybrid"] },
            { label: "Identify use cases for cloud models", matchAny: ["use cases for public private and hybrid cloud"] },
            { label: "Describe the consumption-based model", matchAny: ["consumption based model"] },
            { label: "Compare cloud pricing models", matchAny: ["compare cloud pricing models"] },
            { label: "Describe serverless", matchAny: ["describe serverless"] },
            { label: "Benefits of high availability and scalability", matchAny: ["benefits of high availability and scalability"] },
            { label: "Benefits of reliability and predictability", matchAny: ["benefits of reliability and predictability"] },
            { label: "Benefits of security and governance", matchAny: ["benefits of security and governance"] },
            { label: "Benefits of manageability", matchAny: ["benefits of manageability"] },
            { label: "Describe IaaS", matchAny: ["describe iaas"] },
            { label: "Describe PaaS", matchAny: ["describe paas"] },
            { label: "Describe SaaS", matchAny: ["describe saas"] },
            { label: "Identify use cases for IaaS, PaaS, and SaaS", matchAny: ["use cases for iaas paas and saas"] }
        ]
    },
    {
        title: "Describe Azure architecture and services (35-40%)",
        items: [
            { label: "Regions, region pairs, sovereign regions", matchAny: ["regions region pairs and sovereign regions"] },
            { label: "Availability zones", matchAny: ["availability zones"] },
            { label: "Azure datacenters", matchAny: ["azure datacenters"] },
            { label: "Resources and resource groups", matchAny: ["azure resources and resource groups"] },
            { label: "Subscriptions", matchAny: ["subscriptions"] },
            { label: "Management groups", matchAny: ["management groups"] },
            { label: "Hierarchy: management groups to resources", matchAny: ["hierarchy of resource groups subscriptions and management groups"] },
            { label: "Compare compute types: containers, VMs, functions", matchAny: ["compare compute types containers virtual machines and functions"] },
            { label: "VM options: VMs, scale sets, availability sets, AVD", matchAny: ["virtual machine options vms vm scale sets availability sets and azure virtual desktop"] },
            { label: "Resources required for VMs", matchAny: ["resources required for virtual machines"] },
            { label: "App hosting: web apps, containers, VMs", matchAny: ["application hosting options web apps containers and virtual machines"] },
            { label: "Virtual networking and hybrid connectivity", matchAny: ["virtual networking vnets subnets peering azure dns vpn gateway expressroute"] },
            { label: "Public and private endpoints", matchAny: ["public and private endpoints"] },
            { label: "Compare Azure Storage services", matchAny: ["compare azure storage services"] },
            { label: "Storage tiers", matchAny: ["storage tiers"] },
            { label: "Storage redundancy options", matchAny: ["storage redundancy options"] },
            { label: "Storage account options and storage types", matchAny: ["storage account options and storage types"] },
            { label: "File movement: AzCopy, Storage Explorer, File Sync", matchAny: ["azcopy azure storage explorer and azure file sync"] },
            { label: "Migration: Azure Migrate and Data Box", matchAny: ["azure migrate and azure data box"] },
            { label: "Directory services: Entra ID and Entra Domain Services", matchAny: ["entra id and entra domain services"] },
            { label: "Authentication: SSO, MFA, passwordless", matchAny: ["authentication methods sso mfa and passwordless"] },
            { label: "External identities", matchAny: ["external identities in azure"] },
            { label: "Conditional Access", matchAny: ["entra conditional access"] },
            { label: "RBAC", matchAny: ["role based access control", "rbac"] },
            { label: "Zero Trust", matchAny: ["zero trust"] },
            { label: "Defense-in-depth", matchAny: ["defense in depth"] },
            { label: "Defender for Cloud", matchAny: ["defender for cloud"] }
        ]
    },
    {
        title: "Describe Azure management and governance (30-35%)",
        items: [
            { label: "Cost factors in Azure", matchAny: ["factors that affect costs in azure"] },
            { label: "Pricing calculator", matchAny: ["pricing calculator"] },
            { label: "Cost management capabilities", matchAny: ["cost management capabilities in azure"] },
            { label: "Purpose of tags", matchAny: ["purpose of tags"] },
            { label: "Purpose of Microsoft Purview", matchAny: ["purpose of microsoft purview"] },
            { label: "Purpose of Azure Policy", matchAny: ["purpose of azure policy"] },
            { label: "Purpose of resource locks", matchAny: ["purpose of resource locks"] },
            { label: "Azure portal", matchAny: ["azure portal"] },
            { label: "Cloud Shell, Azure CLI, Azure PowerShell", matchAny: ["azure cloud shell azure cli and azure powershell"] },
            { label: "Purpose of Azure Arc", matchAny: ["purpose of azure arc"] },
            { label: "Infrastructure as code", matchAny: ["infrastructure as code", "iac"] },
            { label: "ARM and ARM templates", matchAny: ["arm and arm templates"] },
            { label: "Purpose of Azure Advisor", matchAny: ["purpose of azure advisor"] },
            { label: "Purpose of Azure Service Health", matchAny: ["purpose of azure service health"] },
            { label: "Azure Monitor, Log Analytics, alerts, App Insights", matchAny: ["azure monitor log analytics alerts and application insights"] }
        ]
    }
];

function getSectionCountsForExam(examId) {
    return SECTION_COUNTS_BY_EXAM[examId] || null;
}

function getSelectedExam() {
    return exams.find((exam) => exam.id === state.selectedExamId) || exams[0];
}

function getHistoryKey(examId) {
    return `studytime-history-${examId}`;
}

function getReviewQueueKey(examId) {
    return `studytime-review-queue-${examId}`;
}

function getMetaKey(name) {
    return `studytime-meta-${name}`;
}

function getAllHistoryEntries() {
    return exams.flatMap((exam) => {
        return loadHistory(exam.id).map((attempt) => ({ ...attempt, examId: exam.id, examCode: exam.code }));
    });
}

function loadMetaList(name) {
    try {
        const raw = window.localStorage.getItem(getMetaKey(name));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveMetaList(name, value) {
    try {
        window.localStorage.setItem(getMetaKey(name), JSON.stringify(value));
    } catch {
        // Ignore local storage failures.
    }
}

function loadActiveLearner() {
    const raw = window.localStorage.getItem(getMetaKey("active-learner"));
    return raw && raw.trim() ? raw : "Guest Learner";
}

function saveActiveLearner(name) {
    const trimmed = String(name || "").trim() || "Guest Learner";
    window.localStorage.setItem(getMetaKey("active-learner"), trimmed);
    state.activeLearner = trimmed;
}

function loadCohorts() {
    return loadMetaList("cohorts");
}

function saveCohorts(items) {
    saveMetaList("cohorts", items);
}

function loadAssignments() {
    return loadMetaList("assignments");
}

function saveAssignments(items) {
    saveMetaList("assignments", items);
}

function loadQuestionReports() {
    return loadMetaList("question-reports");
}

function saveQuestionReports(items) {
    saveMetaList("question-reports", items);
}

function loadQuestionRevisions() {
    return loadMetaList("question-revisions");
}

function saveQuestionRevisions(items) {
    saveMetaList("question-revisions", items);
}

function loadAssignmentCompletions() {
    return loadMetaList("assignment-completions");
}

function saveAssignmentCompletions(items) {
    saveMetaList("assignment-completions", items);
}

function getAssignmentCompletion(assignmentId, learner) {
    return loadAssignmentCompletions().find((item) => item.assignmentId === assignmentId && item.learner === learner);
}

function setReportStatus(reportId, status) {
    const allowed = ["open", "in_review", "resolved", "rejected"];
    if (!allowed.includes(status)) {
        return;
    }

    const reports = loadQuestionReports();
    const target = reports.find((report) => report.id === reportId);

    if (!target) {
        return;
    }

    target.status = status;
    target.updatedAt = new Date().toISOString();
    target.updatedBy = state.activeLearner;
    saveQuestionReports(reports);
}

function normalizeReports() {
    const reports = loadQuestionReports();
    let changed = false;

    reports.forEach((report) => {
        if (!report.id) {
            report.id = `report-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
            changed = true;
        }

        if (!report.status) {
            report.status = "open";
            changed = true;
        }
    });

    if (changed) {
        saveQuestionReports(reports);
    }

    return reports;
}

function getQuestionVersion(examId, prompt) {
    const revisions = loadQuestionRevisions().filter((item) => item.examId === examId && item.prompt === prompt);
    return Math.max(1, revisions.length + 1);
}

function applyRevisionToQuestion(examId, question) {
    const revisions = loadQuestionRevisions().filter((item) => item.examId === examId && item.prompt === question.prompt);

    if (!revisions.length) {
        return { ...question };
    }

    const latest = revisions[revisions.length - 1];
    return {
        ...question,
        explanation: `${question.explanation} Revision note: ${latest.note}`
    };
}

function loadReviewQueue(examId) {
    try {
        const raw = window.localStorage.getItem(getReviewQueueKey(examId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveReviewQueue(examId, queue) {
    try {
        window.localStorage.setItem(getReviewQueueKey(examId), JSON.stringify(queue));
    } catch {
        // Ignore local storage failures.
    }
}

function loadHistory(examId) {
    try {
        const raw = window.localStorage.getItem(getHistoryKey(examId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistory(examId, attempts) {
    try {
        window.localStorage.setItem(getHistoryKey(examId), JSON.stringify(attempts));
    } catch {
        // Ignore storage write failures so exam flow still works.
    }
}

function renderHistory() {
    const exam = getSelectedExam();

    if (!exam) {
        historyList.innerHTML = "<p>No attempts yet.</p>";
        return;
    }

    const attempts = loadHistory(exam.id);

    if (!attempts.length) {
        historyList.innerHTML = "<p>No attempts yet for this certification.</p>";
        return;
    }

    historyList.innerHTML = attempts
        .slice(0, 6)
        .map((attempt) => `
            <article class="history-item">
                <strong>${attempt.score}% ${attempt.passed ? "Pass" : "Needs review"}</strong>
                <p>${attempt.correct} / ${attempt.total} correct</p>
                <p>${attempt.domainLabel} · ${attempt.mode}</p>
                <p>Learner: ${attempt.learner || "Guest Learner"}</p>
                <p class="domain-breakdown">${attempt.domainBreakdownText || "No domain breakdown available"}</p>
                <p>${attempt.dateLabel}</p>
            </article>
        `)
        .join("");
}

function inferDifficulty(question) {
    const promptLength = (question.prompt || "").length;

    if (promptLength > 170 || question.domain.toLowerCase().includes("architecture") || question.domain.toLowerCase().includes("security")) {
        return "Hard";
    }

    if (promptLength > 115 || question.domain.toLowerCase().includes("design") || question.domain.toLowerCase().includes("governance")) {
        return "Medium";
    }

    return "Easy";
}

function arraysEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
}

function arraysSetEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
    }

    const a = [...left].sort((x, y) => x - y);
    const b = [...right].sort((x, y) => x - y);
    return a.every((value, index) => value === b[index]);
}

function hasAnsweredQuestion(question, answer) {
    if (question.type === "yesno") {
        return typeof answer === "boolean";
    }

    if (question.type === "dragdrop") {
        return Array.isArray(answer) && answer.length > 0;
    }

    if (question.type === "multiselect") {
        return Array.isArray(answer) && answer.length === question.chooseCount;
    }

    return typeof answer === "number";
}

function getQuestionScore(question, answer) {
    if (question.type === "yesno") {
        return Boolean(answer) === Boolean(question.correctYes) ? 1 : 0;
    }

    if (question.type === "dragdrop") {
        if (!Array.isArray(answer) || !Array.isArray(question.correctOrder) || !question.correctOrder.length) {
            return 0;
        }

        const matches = answer.reduce((count, value, index) => count + (value === question.correctOrder[index] ? 1 : 0), 0);
        return matches / question.correctOrder.length;
    }

    if (question.type === "multiselect") {
        return arraysSetEqual(answer, question.correctAnswers) ? 1 : 0;
    }

    return answer === question.answer ? 1 : 0;
}

function isAnswerCorrect(question, answer) {
    return getQuestionScore(question, answer) >= 0.999;
}

function getAnswerLabel(question, answer) {
    if (question.type === "yesno") {
        if (typeof answer !== "boolean") {
            return "No answer selected";
        }

        return answer ? "Yes" : "No";
    }

    if (question.type === "dragdrop") {
        if (!Array.isArray(answer) || !answer.length) {
            return "No order submitted";
        }

        return answer.map((item, index) => `${index + 1}. ${item}`).join(" | ");
    }

    if (question.type === "multiselect") {
        if (!Array.isArray(answer) || !answer.length) {
            return "No options selected";
        }

        return answer
            .map((optionIndex) => question.options[optionIndex])
            .filter(Boolean)
            .join(" | ");
    }

    return typeof answer === "number" ? question.options[answer] : "No answer selected";
}

function toYesNoQuestion(question) {
    const correctOption = question.options[question.answer];

    return {
        ...question,
        type: "yesno",
        prompt: `Yes/No: For this scenario, is the following the best answer? \"${correctOption}\"`,
        sourcePrompt: question.prompt,
        correctYes: true
    };
}

function toDragDropQuestion(question) {
    const correctOption = question.options[question.answer];
    const distractors = question.options.filter((_, index) => index !== question.answer);
    const correctOrder = [correctOption, ...distractors];
    const dragOptions = shuffleArray([...correctOrder]);

    return {
        ...question,
        type: "dragdrop",
        prompt: `Drag and drop: Reorder the options from strongest to weakest response for this scenario: ${question.prompt}`,
        dragOptions,
        correctOrder
    };
}

function toMultiSelectQuestion(question) {
    const supportStatement = `Align the decision with ${question.domain.toLowerCase()} requirements and risk controls.`;
    const mixedOptions = [
        question.options[question.answer],
        supportStatement,
        ...question.options.filter((_, index) => index !== question.answer).slice(0, 2)
    ];

    return {
        ...question,
        type: "multiselect",
        prompt: `Choose two: Which options best satisfy this scenario? ${question.prompt}`,
        options: mixedOptions,
        correctAnswers: [0, 1],
        chooseCount: 2
    };
}

function attachCaseStudyGroups(questions) {
    let caseId = 1;
    const withCaseStudy = [...questions];

    for (let index = 0; index < withCaseStudy.length - 1; index += 13) {
        const first = withCaseStudy[index];
        const second = withCaseStudy[index + 1];

        if (!first || !second) {
            continue;
        }

        const caseStudy = {
            id: `case-${caseId}`,
            title: `Case Study ${caseId}`,
            scenario: `A client is planning a ${first.domain.toLowerCase()} rollout and needs a secure, cost-aware, and supportable design decision path.`,
            requirements: [
                "Choose responses that reduce operational risk.",
                "Prioritize governance, reliability, and objective alignment.",
                "Assume enterprise-scale adoption over 12 months."
            ]
        };

        withCaseStudy[index] = { ...first, caseStudy };
        withCaseStudy[index + 1] = { ...second, caseStudy };
        caseId += 1;
    }

    return withCaseStudy;
}

function applyQuestionFormats(questions) {
    const mixed = questions.map((question, index) => {
        const base = { ...question, type: question.type || "single" };

        if (index % 11 === 0) {
            return toDragDropQuestion(base);
        }

        if (index % 9 === 0) {
            return toMultiSelectQuestion(base);
        }

        if (index % 7 === 0) {
            return toYesNoQuestion(base);
        }

        return base;
    });

    return attachCaseStudyGroups(mixed);
}

function renderQuestionNavigator() {
    const activeQuestions = getActiveQuestions();

    if (!questionNav) {
        return;
    }

    questionNav.innerHTML = activeQuestions
        .map((_, index) => {
            const classes = [
                state.currentQuestionIndex === index ? "current" : "",
                hasAnsweredQuestion(activeQuestions[index], state.answers[index]) ? "answered" : "",
                state.markedForReview[index] ? "review" : ""
            ].filter(Boolean).join(" ");

            return `<button type="button" class="${classes}" data-nav-index="${index}">${index + 1}</button>`;
        })
        .join("");
}

function renderAnalytics() {
    const exam = getSelectedExam();

    if (!exam || !domainTrendChart || !recentScoreTrend || !reviewQueueList || !dailyPlanList) {
        return;
    }

    const attempts = loadHistory(exam.id);
    const recent = attempts.slice(0, 8);
    const domainTotals = {};

    recent.forEach((attempt) => {
        Object.entries(attempt.domainBreakdown || {}).forEach(([domain, stats]) => {
            if (!domainTotals[domain]) {
                domainTotals[domain] = { sum: 0, count: 0 };
            }
            domainTotals[domain].sum += stats.score;
            domainTotals[domain].count += 1;
        });
    });

    const domainRows = Object.entries(domainTotals)
        .map(([domain, totals]) => ({ domain, score: Math.round(totals.sum / totals.count) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);

    domainTrendChart.innerHTML = domainRows.length
        ? domainRows.map((row) => `
            <div class="trend-row">
                <div>
                    <p>${row.domain}</p>
                    <div class="trend-bar"><span style="width:${Math.max(2, row.score)}%"></span></div>
                </div>
                <strong>${row.score}%</strong>
            </div>
        `).join("")
        : "<p>No domain trend data yet.</p>";

    recentScoreTrend.innerHTML = recent.length
        ? recent.map((attempt) => `<p>${attempt.dateLabel}: <strong>${attempt.score}%</strong> (${attempt.mode})</p>`).join("")
        : "<p>No recent attempts yet.</p>";

    const queue = loadReviewQueue(exam.id)
        .sort((left, right) => new Date(left.nextReviewAt).getTime() - new Date(right.nextReviewAt).getTime())
        .slice(0, 10);

    reviewQueueList.innerHTML = queue.length
        ? queue.map((item) => `<p><strong>${item.domain}</strong> · ${item.prompt}<br><span>Review on: ${new Date(item.nextReviewAt).toLocaleDateString()}</span></p>`).join("")
        : "<p>No review queue yet. Missed questions will appear here.</p>";

    const weakest = [...domainRows].sort((left, right) => left.score - right.score).slice(0, 3);
    const planLines = [
        `Run 1 timed ${exam.code} attempt today, then review all incorrect answers.`,
        ...weakest.map((row) => `Focus ${row.domain}: complete 10 questions and target 90%+ in this domain.`),
        "Finish with adaptive mode to close weak-domain gaps."
    ];

    dailyPlanList.innerHTML = planLines.map((line) => `<p>${line}</p>`).join("");
    renderSectionProgress(exam.id);
    renderWeakestSectionsRecommendations(exam.id);
}

function getAz900SectionNumber(question) {
    const prompt = String(question?.prompt || "");
    const match = prompt.match(/\[Section\s+(\d+)\b/i);
    return match ? Number(match[1]) : null;
}

function buildSectionBreakdown(examId, questions, answers) {
    const breakdown = {};
    const sectionCounts = getSectionCountsForExam(examId) || {};

    questions.forEach((question, index) => {
        const sectionNumber = getAz900SectionNumber(question);
        if (!sectionNumber) {
            return;
        }

        if (!breakdown[sectionNumber]) {
            breakdown[sectionNumber] = { scoreSum: 0, total: 0, score: 0, coverage: 0 };
        }

        breakdown[sectionNumber].total += 1;
        breakdown[sectionNumber].scoreSum += getQuestionScore(question, answers[index]);
    });

    Object.entries(breakdown).forEach(([sectionKey, stats]) => {
        const sectionNumber = Number(sectionKey);
        stats.score = Math.round((stats.scoreSum / Math.max(stats.total, 1)) * 100);
        const maxQuestions = sectionCounts[sectionNumber] || stats.total;
        stats.coverage = Math.round((stats.total / Math.max(maxQuestions, 1)) * 100);
    });

    return breakdown;
}

function renderSectionProgress(examId) {
    if (!sectionProgressList) {
        return;
    }

    const sectionCounts = getSectionCountsForExam(examId);
    if (!sectionCounts) {
        sectionProgressList.innerHTML = "<p>Section tracker is not configured for this exam.</p>";
        return;
    }

    const exam = getExamById(examId);
    const attempts = loadHistory(examId).slice(0, 12);
    if (!attempts.length) {
        sectionProgressList.innerHTML = `<p>No ${exam ? exam.code : examId} attempt data yet.</p>`;
        return;
    }

    const aggregate = {};
    attempts.forEach((attempt) => {
        const sectionBreakdown = attempt.sectionBreakdown || {};
        Object.entries(sectionBreakdown).forEach(([sectionKey, stats]) => {
            if (!aggregate[sectionKey]) {
                aggregate[sectionKey] = { scoreSum: 0, runCount: 0, bestCoverage: 0 };
            }

            aggregate[sectionKey].scoreSum += stats.score;
            aggregate[sectionKey].runCount += 1;
            aggregate[sectionKey].bestCoverage = Math.max(aggregate[sectionKey].bestCoverage, stats.coverage || 0);
        });
    });

    const rows = Object.entries(sectionCounts).map(([sectionKey, totalQuestions]) => {
        const source = aggregate[sectionKey] || { scoreSum: 0, runCount: 0, bestCoverage: 0 };
        const avgScore = source.runCount ? Math.round(source.scoreSum / source.runCount) : 0;
        const coverage = source.bestCoverage || 0;

        return `
            <article class="simple-row">
                <p><strong>${exam ? exam.code : examId} Section ${sectionKey}</strong> · ${totalQuestions} questions</p>
                <p>Average score: ${avgScore}%</p>
                <p>Coverage reached: ${coverage}%</p>
                <div class="trend-bar"><span style="width:${Math.max(2, avgScore)}%"></span></div>
            </article>
        `;
    });

    sectionProgressList.innerHTML = rows.join("");
}

function renderWeakestSectionsRecommendations(examId) {
    if (!weakestSectionsList) {
        return;
    }

    const sectionCounts = getSectionCountsForExam(examId);
    if (!sectionCounts) {
        weakestSectionsList.innerHTML = "<p>Weak section recommendations are not configured for this exam.</p>";
        return;
    }

    const exam = getExamById(examId);
    const attempts = loadHistory(examId).slice(0, 8);
    if (!attempts.length) {
        weakestSectionsList.innerHTML = `<p>No ${exam ? exam.code : examId} data yet. Complete an attempt to see section recommendations.</p>`;
        return;
    }

    const aggregate = {};
    attempts.forEach((attempt) => {
        Object.entries(attempt.sectionBreakdown || {}).forEach(([sectionKey, stats]) => {
            if (!aggregate[sectionKey]) {
                aggregate[sectionKey] = { scoreSum: 0, runCount: 0, bestCoverage: 0 };
            }

            aggregate[sectionKey].scoreSum += stats.score;
            aggregate[sectionKey].runCount += 1;
            aggregate[sectionKey].bestCoverage = Math.max(aggregate[sectionKey].bestCoverage, stats.coverage || 0);
        });
    });

    const weakest = Object.entries(sectionCounts)
        .map(([sectionKey, totalQuestions]) => {
            const source = aggregate[sectionKey] || { scoreSum: 0, runCount: 0, bestCoverage: 0 };
            const avgScore = source.runCount ? Math.round(source.scoreSum / source.runCount) : 0;
            return {
                sectionKey,
                totalQuestions,
                avgScore,
                coverage: source.bestCoverage || 0
            };
        })
        .sort((left, right) => left.avgScore - right.avgScore)
        .slice(0, 3);

    weakestSectionsList.innerHTML = weakest.map((entry) => {
        const nextAction = entry.avgScore >= READINESS_DOMAIN_TARGET
            ? "Maintain this section with one timed review pass."
            : `Retake Section ${entry.sectionKey} in focused practice until it reaches ${READINESS_DOMAIN_TARGET}%+. Review all incorrect explanations before the next timed attempt.`;

        return `
            <article class="simple-row">
                <p><strong>${exam ? exam.code : examId} Section ${entry.sectionKey}</strong> · ${entry.totalQuestions} questions</p>
                <p>Average score: ${entry.avgScore}%</p>
                <p>Coverage reached: ${entry.coverage}%</p>
                <p>${nextAction}</p>
            </article>
        `;
    }).join("");
}

function getExamById(examId) {
    return exams.find((exam) => exam.id === examId);
}

function renderInstructorStats() {
    if (!instructorStats) {
        return;
    }

    const allAttempts = getAllHistoryEntries();
    const averageScore = allAttempts.length
        ? Math.round(allAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / allAttempts.length)
        : 0;
    const learners = [...new Set(allAttempts.map((attempt) => attempt.learner || "Guest Learner"))];
    const readyAttempts = allAttempts.filter((attempt) => {
        return attempt.mode === "exam" && qualifiesForReadinessThresholds(attempt, attempt.examId);
    }).length;

    instructorStats.innerHTML = [
        `<article class="simple-row"><p>Total attempts</p><strong>${allAttempts.length}</strong></article>`,
        `<article class="simple-row"><p>Average score</p><strong>${averageScore}%</strong></article>`,
        `<article class="simple-row"><p>Learners tracked</p><strong>${learners.length}</strong></article>`,
        `<article class="simple-row"><p>Qualified timed passes</p><strong>${readyAttempts}</strong></article>`
    ].join("");
}

function renderLearnerProfile() {
    if (!activeLearnerLabel || !learnerNameInput) {
        return;
    }

    learnerNameInput.value = state.activeLearner;
    activeLearnerLabel.textContent = `Current learner: ${state.activeLearner}`;
}

function renderCohortOptions() {
    if (!cohortSelect) {
        return;
    }

    const cohorts = loadCohorts();
    if (!cohorts.length) {
        cohortSelect.innerHTML = "<option value=\"\">No cohorts yet</option>";
        state.selectedCohortId = "";
        return;
    }

    if (!state.selectedCohortId || !cohorts.some((cohort) => cohort.id === state.selectedCohortId)) {
        state.selectedCohortId = cohorts[0].id;
    }

    cohortSelect.innerHTML = cohorts.map((cohort) => `<option value="${cohort.id}">${cohort.name}</option>`).join("");
    cohortSelect.value = state.selectedCohortId;
}

function renderCohortMembers() {
    if (!cohortMembersList) {
        return;
    }

    const cohorts = loadCohorts();
    const cohort = cohorts.find((item) => item.id === state.selectedCohortId);

    if (!cohort) {
        cohortMembersList.innerHTML = "<p>No cohort selected.</p>";
        return;
    }

    cohortMembersList.innerHTML = cohort.members.length
        ? cohort.members.map((member) => `<article class="simple-row"><strong>${member}</strong></article>`).join("")
        : "<p>No members added yet.</p>";
}

function renderAssignmentExamOptions() {
    if (!assignmentExamSelect || !revisionExamSelect) {
        return;
    }

    const optionsHtml = exams.map((exam) => `<option value="${exam.id}">${exam.code} · ${exam.title}</option>`).join("");
    assignmentExamSelect.innerHTML = optionsHtml;
    revisionExamSelect.innerHTML = optionsHtml;

    if (!assignmentExamSelect.value && exams[0]) {
        assignmentExamSelect.value = exams[0].id;
    }

    if (!revisionExamSelect.value && exams[0]) {
        revisionExamSelect.value = exams[0].id;
    }

    renderAssignmentDomainOptions();
}

function renderAssignmentDomainOptions() {
    if (!assignmentDomainSelect || !assignmentExamSelect) {
        return;
    }

    const exam = getExamById(assignmentExamSelect.value);
    if (!exam) {
        assignmentDomainSelect.innerHTML = "<option value=\"all\">All domains</option>";
        return;
    }

    const domains = [...new Set(exam.questionBank.map((question) => question.domain))].sort();
    assignmentDomainSelect.innerHTML = [
        "<option value=\"all\">All domains</option>",
        ...domains.map((domain) => `<option value="${domain}">${domain}</option>`)
    ].join("");
}

function renderAssignments() {
    if (!assignmentList) {
        return;
    }

    const assignments = loadAssignments();
    const cohorts = loadCohorts();

    assignmentList.innerHTML = assignments.length
        ? assignments.slice(0, 10).map((assignment) => {
            const exam = getExamById(assignment.examId);
            const cohort = cohorts.find((item) => item.id === assignment.cohortId);
            return `
                <article class="simple-row">
                    <p><strong>${exam ? exam.code : assignment.examId}</strong> · ${assignment.mode}</p>
                    <p>${assignment.domain === "all" ? "All domains" : assignment.domain}</p>
                    <p>Cohort: ${cohort ? cohort.name : "Unknown"}</p>
                    <p>Due: ${assignment.dueDate || "No due date"}</p>
                </article>
            `;
        }).join("")
        : "<p>No assignments created yet.</p>";
}

function getCohortIdsForLearner(learner) {
    return loadCohorts()
        .filter((cohort) => cohort.members.includes(learner))
        .map((cohort) => cohort.id);
}

function renderMyTasks() {
    if (!myTasksList) {
        return;
    }

    const learner = state.activeLearner;
    const cohortIds = getCohortIdsForLearner(learner);

    if (!cohortIds.length) {
        myTasksList.innerHTML = "<p>Add this learner to a cohort to receive tasks.</p>";
        return;
    }

    const assignments = loadAssignments().filter((assignment) => cohortIds.includes(assignment.cohortId));
    if (!assignments.length) {
        myTasksList.innerHTML = "<p>No tasks assigned yet.</p>";
        return;
    }

    myTasksList.innerHTML = assignments.slice(0, 12).map((assignment) => {
        const exam = getExamById(assignment.examId);
        const completion = getAssignmentCompletion(assignment.id, learner);
        const dueDate = assignment.dueDate || "No due date";

        return `
            <article class="simple-row">
                <p><strong>${exam ? exam.code : assignment.examId}</strong> · ${assignment.mode}</p>
                <p>${assignment.domain === "all" ? "All domains" : assignment.domain}</p>
                <p>Due: ${dueDate}</p>
                <p>${completion ? `Completed on ${new Date(completion.completedAt).toLocaleDateString()} (${completion.score}% score)` : "Pending"}</p>
                ${completion ? "" : `<div class=\"inline-actions\"><button class=\"button button-secondary button-mini\" data-action=\"complete-assignment\" data-assignment-id=\"${assignment.id}\" type=\"button\">Mark done</button></div>`}
            </article>
        `;
    }).join("");
}

function renderLeaderboard() {
    if (!leaderboardList) {
        return;
    }

    const cohorts = loadCohorts();
    const cohort = cohorts.find((item) => item.id === state.selectedCohortId);

    if (!cohort || !cohort.members.length) {
        leaderboardList.innerHTML = "<p>Add members to a cohort to view leaderboard.</p>";
        return;
    }

    const allAttempts = getAllHistoryEntries();
    const standings = cohort.members.map((member) => {
        const attempts = allAttempts.filter((attempt) => (attempt.learner || "Guest Learner") === member);
        const average = attempts.length
            ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
            : 0;
        const timedCount = attempts.filter((attempt) => attempt.mode === "exam").length;

        return { member, average, timedCount };
    }).sort((left, right) => right.average - left.average);

    leaderboardList.innerHTML = standings.map((entry, index) => `
        <article class="simple-row">
            <p><strong>#${index + 1} ${entry.member}</strong></p>
            <p>Average score: ${entry.average}%</p>
            <p>Timed attempts: ${entry.timedCount}</p>
        </article>
    `).join("");
}

function renderQuestionReports() {
    if (!questionReportsList) {
        return;
    }

    const reports = normalizeReports();
    questionReportsList.innerHTML = reports.length
        ? reports.slice(0, 10).map((report) => `
            <article class="simple-row">
                <p><strong>${report.examCode}</strong> · v${report.version}</p>
                <p>${report.domain}</p>
                <p>${report.note}</p>
                <p class="status-${report.status || "open"}">Status: ${(report.status || "open").replace("_", " ")}</p>
                <p>By ${report.learner} on ${new Date(report.createdAt).toLocaleString()}</p>
                <div class="inline-actions">
                    <button class="button button-secondary button-mini" data-action="report-status" data-report-id="${report.id}" data-status="open" type="button">Open</button>
                    <button class="button button-secondary button-mini" data-action="report-status" data-report-id="${report.id}" data-status="in_review" type="button">In Review</button>
                    <button class="button button-secondary button-mini" data-action="report-status" data-report-id="${report.id}" data-status="resolved" type="button">Resolved</button>
                    <button class="button button-secondary button-mini" data-action="report-status" data-report-id="${report.id}" data-status="rejected" type="button">Rejected</button>
                </div>
            </article>
        `).join("")
        : "<p>No question reports yet.</p>";
}

function renderCohortDomainHeatmap() {
    if (!cohortDomainHeatmap) {
        return;
    }

    const cohorts = loadCohorts();
    const cohort = cohorts.find((item) => item.id === state.selectedCohortId);

    if (!cohort || !cohort.members.length) {
        cohortDomainHeatmap.innerHTML = "<p>Select a cohort with members to view heatmap.</p>";
        return;
    }

    const allAttempts = getAllHistoryEntries();
    const domainTotals = {};

    cohort.members.forEach((member) => {
        allAttempts
            .filter((attempt) => (attempt.learner || "Guest Learner") === member)
            .forEach((attempt) => {
                Object.entries(attempt.domainBreakdown || {}).forEach(([domain, stats]) => {
                    if (!domainTotals[domain]) {
                        domainTotals[domain] = { sum: 0, count: 0 };
                    }

                    domainTotals[domain].sum += stats.score;
                    domainTotals[domain].count += 1;
                });
            });
    });

    const rows = Object.entries(domainTotals)
        .map(([domain, value]) => ({ domain, score: Math.round(value.sum / value.count) }))
        .sort((left, right) => left.score - right.score);

    cohortDomainHeatmap.innerHTML = rows.length
        ? `<div class="heatmap-grid">${rows.map((row) => {
            const normalized = Math.max(0.08, row.score / 100);
            return `<article class="heatmap-cell" style="background: rgba(12,124,89,${normalized.toFixed(2)});"><p><strong>${row.domain}</strong></p><p>${row.score}%</p></article>`;
        }).join("")}</div>`
        : "<p>No cohort domain data yet.</p>";
}

function renderRevisionHistory() {
    if (!revisionHistoryList) {
        return;
    }

    const revisions = loadQuestionRevisions();
    revisionHistoryList.innerHTML = revisions.length
        ? revisions.slice(0, 12).map((item) => {
            const exam = getExamById(item.examId);
            return `
                <article class="simple-row">
                    <p><strong>${exam ? exam.code : item.examId}</strong> · Q${item.questionIndex + 1}</p>
                    <p>${item.note}</p>
                    <p>By ${item.editor} on ${new Date(item.createdAt).toLocaleString()}</p>
                </article>
            `;
        }).join("")
        : "<p>No revisions yet.</p>";
}

function renderTeamHub() {
    renderLearnerProfile();
    renderInstructorStats();
    renderCohortOptions();
    renderCohortMembers();
    renderAssignmentExamOptions();
    renderAssignments();
    renderMyTasks();
    renderLeaderboard();
    renderCohortDomainHeatmap();
    renderQuestionReports();
    renderRevisionHistory();
}

function addHistoryEntry(exam, payload) {
    const attempts = loadHistory(exam.id);
    const nextAttempts = [payload, ...attempts].slice(0, 20);
    saveHistory(exam.id, nextAttempts);
}

function isTimedMode(mode) {
    return mode === "exam";
}

function getDomainMinimum(domainBreakdown) {
    const scores = Object.values(domainBreakdown).map((stats) => stats.score);
    return scores.length ? Math.min(...scores) : 0;
}

function getSectionMinimum(examId, sectionBreakdown) {
    const sectionKeys = Object.keys(getSectionCountsForExam(examId) || {});

    if (!sectionKeys.length) {
        return null;
    }

    if (!sectionBreakdown || typeof sectionBreakdown !== "object") {
        return 0;
    }

    const hasAllSections = sectionKeys.every((sectionKey) => {
        return sectionBreakdown[sectionKey] && typeof sectionBreakdown[sectionKey].score === "number";
    });

    if (!hasAllSections) {
        return 0;
    }

    return Math.min(...sectionKeys.map((sectionKey) => sectionBreakdown[sectionKey].score));
}

function qualifiesForReadinessThresholds(attempt, examId) {
    if (!attempt || !attempt.domainBreakdown) {
        return false;
    }

    if (getSectionCountsForExam(examId)) {
        const sectionMin = getSectionMinimum(examId, attempt.sectionBreakdown);
        if (sectionMin < READINESS_DOMAIN_TARGET) {
            return false;
        }
    }

    return attempt.score >= READINESS_OVERALL_TARGET
        && getDomainMinimum(attempt.domainBreakdown) >= READINESS_DOMAIN_TARGET;
}

function getConsecutiveTimedQualifiedPasses(examId) {
    const attempts = loadHistory(examId).filter((attempt) => isTimedMode(attempt.mode));
    let streak = 0;

    for (const attempt of attempts) {
        if (qualifiesForReadinessThresholds(attempt, examId)) {
            streak += 1;
        } else {
            break;
        }
    }

    return streak;
}

function renderReadinessPanel(exam, attempt) {
    const overallMet = attempt.score >= READINESS_OVERALL_TARGET;
    const domainMin = getDomainMinimum(attempt.domainBreakdown);
    const domainMet = domainMin >= READINESS_DOMAIN_TARGET;
    const hasSectionGate = Boolean(getSectionCountsForExam(exam.id));
    const sectionMin = hasSectionGate ? getSectionMinimum(exam.id, attempt.sectionBreakdown) : null;
    const sectionMet = hasSectionGate ? sectionMin >= READINESS_DOMAIN_TARGET : true;
    const timedModeMet = isTimedMode(attempt.mode);
    const timedStreak = getConsecutiveTimedQualifiedPasses(exam.id);
    const streakMet = timedStreak >= READINESS_TIMED_STREAK_TARGET;
    const fullyReady = overallMet && domainMet && sectionMet && timedModeMet && streakMet;

    const statusClass = fullyReady ? "readiness-pass" : "readiness-progress";
    const headline = fullyReady
        ? "Readiness Gate: Ready"
        : "Readiness Gate: In Progress";

    resultReadiness.className = `readiness-panel ${statusClass}`;
    resultReadiness.innerHTML = `
        <h4>${headline}</h4>
        <ul>
            <li>Overall score target (${READINESS_OVERALL_TARGET}%+): ${overallMet ? "Met" : "Not met"}</li>
            <li>Per-domain target (${READINESS_DOMAIN_TARGET}%+ each): ${domainMet ? "Met" : `Not met (lowest: ${domainMin}%)`}</li>
            ${hasSectionGate
            ? `<li>Per-section target for ${exam.code} (${READINESS_DOMAIN_TARGET}%+ each): ${sectionMet ? "Met" : `Not met (lowest section: ${sectionMin}%)`}</li>`
            : ""}
            <li>Timed mode attempt required: ${timedModeMet ? "Met" : "Not met (run in Exam mode)"}</li>
            <li>Consecutive qualified timed passes (${READINESS_TIMED_STREAK_TARGET}): ${Math.min(timedStreak, READINESS_TIMED_STREAK_TARGET)} / ${READINESS_TIMED_STREAK_TARGET}</li>
        </ul>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function exportExamQaAsPdf() {
    const exam = getSelectedExam();
    const questions = getActiveQuestions();

    if (!exam || !questions.length) {
        window.alert("Complete an exam first, then export the Q&A PDF.");
        return;
    }

    const now = new Date();
    const fileDate = now.toISOString().slice(0, 10);
    const title = `${exam.code} Practice Q&A Report`;

    const rows = questions.map((question, index) => {
        const selectedAnswer = state.answers[index];
        const selectedText = getAnswerLabel(question, selectedAnswer);
        const correctText = question.type === "yesno"
            ? (question.correctYes ? "Yes" : "No")
            : question.type === "dragdrop"
                ? question.correctOrder.map((item, orderIndex) => `${orderIndex + 1}. ${item}`).join(" | ")
                : question.type === "multiselect"
                    ? question.correctAnswers.map((optionIndex) => question.options[optionIndex]).join(" | ")
                    : question.options[question.answer];
        const isCorrect = isAnswerCorrect(question, selectedAnswer);

        return `
            <section class="qa-block">
                <h3>Q${index + 1}. ${escapeHtml(question.prompt)}</h3>
                <p><strong>Domain:</strong> ${escapeHtml(question.domain)}</p>
                <p><strong>Your answer:</strong> ${escapeHtml(selectedText)}</p>
                <p><strong>Correct answer:</strong> ${escapeHtml(correctText)}</p>
                <p><strong>Status:</strong> ${isCorrect ? "Correct" : "Incorrect"}</p>
                <p><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p>
            </section>
        `;
    }).join("");

    const printWindow = window.open("", "_blank", "width=980,height=700");

    if (!printWindow) {
        window.alert("Pop-up blocked. Please allow pop-ups to export PDF.");
        return;
    }

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1f2937; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { margin: 0 0 18px; color: #475569; }
    .qa-block { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .qa-block h3 { margin: 0 0 8px; font-size: 17px; }
    .qa-block p { margin: 6px 0; line-height: 1.5; }
    @media print {
      body { margin: 12mm; }
      .qa-block { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Generated: ${escapeHtml(now.toLocaleString())}</p>
  <p class="meta">Use your browser print dialog and choose "Save as PDF".</p>
  ${rows}
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Give the new document a moment to render before print.
    setTimeout(() => {
        printWindow.document.title = `${exam.code}-qa-report-${fileDate}`;
        printWindow.print();
    }, 350);
}

function renderLiveReadinessBadge() {
    const exam = getSelectedExam();

    if (!exam) {
        liveReadinessBadge.innerHTML = "<p>Readiness data unavailable.</p>";
        return;
    }

    const attempts = loadHistory(exam.id);
    const latest = attempts[0];
    const timedStreak = getConsecutiveTimedQualifiedPasses(exam.id);

    if (!latest) {
        liveReadinessBadge.innerHTML = `
            <p class="eyebrow">Readiness gate</p>
            <strong>Not started</strong>
            <p>Target: ${READINESS_OVERALL_TARGET}% overall, ${READINESS_DOMAIN_TARGET}% per domain, ${READINESS_TIMED_STREAK_TARGET} consecutive exam-mode passes.</p>
            ${getSectionCountsForExam(exam.id) ? `<p>${exam.code} section target: ${READINESS_DOMAIN_TARGET}%+ in every section.</p>` : ""}
            <p>Consecutive qualified timed passes: 0 / ${READINESS_TIMED_STREAK_TARGET}</p>
        `;
        return;
    }

    const overallMet = latest.score >= READINESS_OVERALL_TARGET;
    const domainMin = getDomainMinimum(latest.domainBreakdown || {});
    const domainMet = domainMin >= READINESS_DOMAIN_TARGET;
    const hasSectionGate = Boolean(getSectionCountsForExam(exam.id));
    const sectionMin = hasSectionGate ? getSectionMinimum(exam.id, latest.sectionBreakdown) : null;
    const sectionMet = hasSectionGate ? sectionMin >= READINESS_DOMAIN_TARGET : true;
    const streakMet = timedStreak >= READINESS_TIMED_STREAK_TARGET;
    const ready = overallMet && domainMet && sectionMet && streakMet;

    liveReadinessBadge.innerHTML = `
        <p class="eyebrow">Readiness gate</p>
        <strong>${ready ? "Ready" : "In progress"}</strong>
        <p>Latest score: ${latest.score}% (${latest.mode})</p>
        <p>Overall target: ${overallMet ? "Met" : "Not met"}</p>
        <p>Domain target: ${domainMet ? "Met" : `Not met (lowest ${domainMin}%)`}</p>
        ${hasSectionGate ? `<p>Section target: ${sectionMet ? "Met" : `Not met (lowest section ${sectionMin}%)`}</p>` : ""}
        <p>Timed streak: ${Math.min(timedStreak, READINESS_TIMED_STREAK_TARGET)} / ${READINESS_TIMED_STREAK_TARGET}</p>
    `;
}

function getActiveQuestions() {
    return state.activeQuestions;
}

function shuffleArray(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
}

function shuffleQuestion(question) {
    const mappedOptions = question.options.map((option, index) => ({
        option,
        isCorrect: index === question.answer
    }));

    const shuffledOptions = shuffleArray(mappedOptions);

    return {
        ...question,
        options: shuffledOptions.map((item) => item.option),
        answer: shuffledOptions.findIndex((item) => item.isCorrect)
    };
}

function buildSessionQuestions(exam) {
    const sourceQuestions = state.selectedDomain === "all"
        ? exam.questionBank
        : exam.questionBank.filter((question) => question.domain === state.selectedDomain);

    const effectiveQuestions = (sourceQuestions.length ? sourceQuestions : exam.questionBank)
        .map((question) => applyRevisionToQuestion(exam.id, question));

    const formattedQuestions = applyQuestionFormats(effectiveQuestions);

    if (state.mode !== "adaptive" || state.selectedDomain !== "all") {
        return shuffleArray(formattedQuestions).map((question) => {
            if (question.type === "single") {
                return shuffleQuestion(question);
            }

            if (question.type === "dragdrop") {
                return {
                    ...question,
                    dragOptions: shuffleArray(question.dragOptions)
                };
            }

            return question;
        });
    }

    const weaknessMap = getDomainWeaknessMap(exam.id);
    const adaptiveOrdered = [...formattedQuestions].sort((left, right) => {
        const leftScore = weaknessMap[left.domain] ?? 65;
        const rightScore = weaknessMap[right.domain] ?? 65;

        if (leftScore !== rightScore) {
            return leftScore - rightScore;
        }

        return Math.random() - 0.5;
    });

    return adaptiveOrdered.map((question) => {
        if (question.type === "single") {
            return shuffleQuestion(question);
        }

        if (question.type === "dragdrop") {
            return {
                ...question,
                dragOptions: shuffleArray(question.dragOptions)
            };
        }

        return question;
    });
}

function getDomainWeaknessMap(examId) {
    const attempts = loadHistory(examId);
    const totals = {};

    attempts.forEach((attempt) => {
        if (!attempt.domainBreakdown || typeof attempt.domainBreakdown !== "object") {
            return;
        }

        Object.entries(attempt.domainBreakdown).forEach(([domain, stats]) => {
            if (!totals[domain]) {
                totals[domain] = { scoreSum: 0, runs: 0 };
            }

            totals[domain].scoreSum += stats.score;
            totals[domain].runs += 1;
        });
    });

    return Object.entries(totals).reduce((accumulator, [domain, totalsByDomain]) => {
        accumulator[domain] = totalsByDomain.scoreSum / Math.max(totalsByDomain.runs, 1);
        return accumulator;
    }, {});
}

function exportProgress() {
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        histories: exams.reduce((allHistories, exam) => {
            allHistories[exam.id] = loadHistory(exam.id);
            return allHistories;
        }, {}),
        reviewQueues: exams.reduce((allQueues, exam) => {
            allQueues[exam.id] = loadReviewQueue(exam.id);
            return allQueues;
        }, {}),
        activeLearner: state.activeLearner,
        cohorts: loadCohorts(),
        assignments: loadAssignments(),
        questionReports: loadQuestionReports(),
        questionRevisions: loadQuestionRevisions(),
        assignmentCompletions: loadAssignmentCompletions()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `studytime-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

function importProgressFromFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result));

            if (!parsed || typeof parsed !== "object" || !parsed.histories) {
                window.alert("Invalid progress file format.");
                return;
            }

            exams.forEach((exam) => {
                const imported = parsed.histories[exam.id];
                if (Array.isArray(imported)) {
                    saveHistory(exam.id, imported);
                }

                const importedQueue = parsed.reviewQueues && parsed.reviewQueues[exam.id];
                if (Array.isArray(importedQueue)) {
                    saveReviewQueue(exam.id, importedQueue);
                }
            });

            if (parsed.activeLearner) {
                saveActiveLearner(parsed.activeLearner);
            }

            if (Array.isArray(parsed.cohorts)) {
                saveCohorts(parsed.cohorts);
            }

            if (Array.isArray(parsed.assignments)) {
                saveAssignments(parsed.assignments);
            }

            if (Array.isArray(parsed.questionReports)) {
                saveQuestionReports(parsed.questionReports);
            }

            if (Array.isArray(parsed.questionRevisions)) {
                saveQuestionRevisions(parsed.questionRevisions);
            }

            if (Array.isArray(parsed.assignmentCompletions)) {
                saveAssignmentCompletions(parsed.assignmentCompletions);
            }

            renderHistory();
            renderTeamHub();
            window.alert("Progress imported successfully.");
        } catch {
            window.alert("Unable to read the selected file. Please use a valid StudyTime export.");
        }
    };

    reader.readAsText(file);
}

function buildDomainBreakdown(questions, answers) {
    const accumulator = {};

    questions.forEach((question, index) => {
        if (!accumulator[question.domain]) {
            accumulator[question.domain] = { correct: 0, total: 0, score: 0 };
        }

        accumulator[question.domain].total += 1;

        if (isAnswerCorrect(question, answers[index])) {
            accumulator[question.domain].correct += 1;
        }
    });

    Object.values(accumulator).forEach((stats) => {
        stats.score = Math.round((stats.correct / Math.max(stats.total, 1)) * 100);
    });

    return accumulator;
}

function formatDomainBreakdown(domainBreakdown) {
    return Object.entries(domainBreakdown)
        .map(([domain, stats]) => `${domain}: ${stats.score}%`)
        .join(" | ");
}

function buildImprovementPlan(exam, domainBreakdown) {
    const ranked = Object.entries(domainBreakdown)
        .map(([domain, stats]) => ({ domain, score: stats.score }))
        .sort((left, right) => left.score - right.score);

    const weakest = ranked.slice(0, 3);
    const recommendations = weakest.map((entry) => {
        const matchingSection = (exam.studyNotes?.sections || []).find((section) => {
            return entry.domain.toLowerCase().includes(section.title.toLowerCase())
                || section.title.toLowerCase().includes(entry.domain.toLowerCase());
        });

        const guidance = matchingSection
            ? matchingSection.points.join(" ")
            : "Use focused domain drills, review explanations, and rerun adaptive mode until this area trends above 85%.";

        return `<li><strong>${entry.domain} (${entry.score}%)</strong>: ${guidance}</li>`;
    });

    const checklist = (exam.studyNotes?.beforeExamChecklist || [])
        .slice(0, 4)
        .map((item) => `<li>${item}</li>`)
        .join("");

    return `
        <h4>Where to Improve Next</h4>
        <ul>${recommendations.join("")}</ul>
        <h4>How to Improve</h4>
        <ul>
            <li>Switch to <strong>Adaptive weak-area mode</strong> for the next 2 attempts.</li>
            <li>Use <strong>Domain focus</strong> and target the weakest domain above until reaching 85%+.</li>
            <li>After each attempt, review incorrect answers and explanations before retaking.</li>
            ${checklist}
        </ul>
    `;
}

function updateDomainFilterOptions() {
    const exam = getSelectedExam();

    if (!exam) {
        domainSelect.innerHTML = "<option value=\"all\">All domains</option>";
        return;
    }

    const uniqueDomains = [...new Set(exam.questionBank.map((question) => question.domain))].sort();
    domainSelect.innerHTML = [
        "<option value=\"all\">All domains</option>",
        ...uniqueDomains.map((domain) => `<option value="${domain}">${domain}</option>`)
    ].join("");

    domainSelect.value = state.selectedDomain;
}

function renderStudyNotes() {
    const exam = getSelectedExam();

    if (!exam || !exam.studyNotes) {
        studyNotesPanel.innerHTML = "<p>No notes available for this certification yet.</p>";
        return;
    }

    const roadmapItems = exam.studyNotes.roadmap
        .map((item) => `<li>${item}</li>`)
        .join("");
    const memoriseItems = exam.studyNotes.mustMemorize
        .map((item) => `<li>${item}</li>`)
        .join("");
    const sectionCards = exam.studyNotes.sections
        .map((section) => `
            <article class="notes-card">
                <h4>${section.title}</h4>
                <ul class="notes-list">${section.points.map((point) => `<li>${point}</li>`).join("")}</ul>
            </article>
        `)
        .join("");
    const checklistItems = (exam.studyNotes.beforeExamChecklist || [])
        .map((item) => `<li>${item}</li>`)
        .join("");

    studyNotesPanel.innerHTML = `
        <p class="eyebrow">Study notes</p>
        <h3>${exam.code} prep map</h3>
        <p>${exam.studyNotes.summary}</p>
        <div class="notes-grid">
            <article class="notes-card">
                <h4>7-day roadmap</h4>
                <ul class="notes-list">${roadmapItems}</ul>
            </article>
            <article class="notes-card">
                <h4>Must memorise</h4>
                <ul class="notes-list">${memoriseItems}</ul>
            </article>
        </div>
        <div class="notes-grid">
            <article class="notes-card">
                <h4>Before exam checklist</h4>
                <ul class="notes-list">${checklistItems}</ul>
            </article>
        </div>
        <div class="notes-grid">${sectionCards}</div>
    `;
}

function normalizeCoverageText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function renderAz900CoverageChecklist() {
    if (!az900CoveragePanel) {
        return;
    }

    const exam = getSelectedExam();
    if (!exam || exam.id !== "az-900") {
        az900CoveragePanel.innerHTML = `
            <p class="eyebrow">AZ-900 blueprint coverage</p>
            <h3>Coverage checklist</h3>
            <p>Select AZ-900 to view objective-by-objective checklist coverage.</p>
        `;
        return;
    }

    const questionBank = Array.isArray(exam.questionBank) ? exam.questionBank : [];
    const objectiveText = (exam.objectives || []).join(" ");
    const notesText = exam.studyNotes ? JSON.stringify(exam.studyNotes) : "";
    const corpus = normalizeCoverageText(
        questionBank
            .map((question) => `${question.domain || ""} ${question.prompt || ""} ${question.explanation || ""}`)
            .join(" ") + ` ${objectiveText} ${notesText}`
    );
    const domainSet = new Set(questionBank.map((question) => normalizeCoverageText(question.domain)));

    const sectionsMarkup = AZ900_BLUEPRINT_CHECKLIST.map((section) => {
        const itemRows = section.items.map((item) => {
            const normalizedLabel = normalizeCoverageText(item.label);
            const coveredByDomain = domainSet.has(normalizedLabel);
            const coveredByText = (item.matchAny || []).some((phrase) => corpus.includes(normalizeCoverageText(phrase)));
            const covered = coveredByDomain || coveredByText;

            return {
                covered,
                markup: `<li class="coverage-item ${covered ? "is-covered" : "is-missing"}"><span class="coverage-dot" aria-hidden="true"></span><span>${item.label}</span></li>`
            };
        });

        const coveredCount = itemRows.filter((row) => row.covered).length;
        const totalCount = section.items.length;
        const sectionPercent = Math.round((coveredCount / Math.max(totalCount, 1)) * 100);

        return {
            coveredCount,
            totalCount,
            markup: `
                <article class="notes-card coverage-card">
                    <h4>${section.title}</h4>
                    <p class="coverage-meta">${coveredCount} / ${totalCount} covered (${sectionPercent}%)</p>
                    <div class="trend-bar"><span style="width:${Math.max(2, sectionPercent)}%"></span></div>
                    <ul class="notes-list coverage-list">${itemRows.map((row) => row.markup).join("")}</ul>
                </article>
            `
        };
    });

    const coveredTotal = sectionsMarkup.reduce((sum, section) => sum + section.coveredCount, 0);
    const totalItems = sectionsMarkup.reduce((sum, section) => sum + section.totalCount, 0);
    const overallPercent = Math.round((coveredTotal / Math.max(totalItems, 1)) * 100);

    az900CoveragePanel.innerHTML = `
        <p class="eyebrow">AZ-900 blueprint coverage</p>
        <h3>Objective checklist</h3>
        <p>Live mapping of your current AZ-900 question bank against the official skill areas.</p>
        <p class="coverage-meta"><strong>${coveredTotal} / ${totalItems}</strong> objectives covered (${overallPercent}%)</p>
        <div class="trend-bar"><span style="width:${Math.max(2, overallPercent)}%"></span></div>
        <div class="notes-grid">${sectionsMarkup.map((section) => section.markup).join("")}</div>
    `;
}

function getCurrentQuestionCheckState() {
    return Boolean(state.checkedAnswers[state.currentQuestionIndex]);
}

function explainCurrentAnswer(question, selectedAnswer) {
    const correct = isAnswerCorrect(question, selectedAnswer);
    const scoreFraction = getQuestionScore(question, selectedAnswer);
    const selectedLabel = getAnswerLabel(question, selectedAnswer);

    let correctLabel = "";
    if (question.type === "yesno") {
        correctLabel = question.correctYes ? "Yes" : "No";
    } else if (question.type === "dragdrop") {
        correctLabel = question.correctOrder.map((item, index) => `${index + 1}. ${item}`).join(" | ");
    } else if (question.type === "multiselect") {
        correctLabel = question.correctAnswers.map((optionIndex) => question.options[optionIndex]).join(" | ");
    } else {
        correctLabel = question.options[question.answer];
    }

    return {
        correct,
        label: correct ? "Correct" : `Incorrect (${Math.round(scoreFraction * 100)}%)`,
        detail: correct
            ? `Correct answer: ${correctLabel}. ${question.explanation}`
            : `Your answer: ${selectedLabel}. Correct answer: ${correctLabel}. ${question.explanation}`
    };
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderPaths() {
    if (!exams.length) {
        pathGrid.innerHTML = "<article class=\"path-card\"><h3>Question bank unavailable</h3><p>The StudyTime question bank did not load.</p></article>";
        return;
    }

    pathCount.textContent = String(exams.length);
    pathGrid.innerHTML = exams
        .map((exam) => `
            <article class="path-card">
                <p class="eyebrow">${exam.code}</p>
                <h3>${exam.title}</h3>
                <p>${exam.focus}</p>
                <div class="path-meta">
                    <span class="chip">${exam.level}</span>
                    <span>${exam.questionBank.length} questions</span>
                </div>
            </article>
        `)
        .join("");
}

function populateExamSelect() {
    if (!exams.length) {
        examSelect.innerHTML = "<option value=\"\">No exams loaded</option>";
        examSelect.disabled = true;
        startExamButton.disabled = true;
        return;
    }

    examSelect.innerHTML = exams
        .map((exam) => `<option value="${exam.id}">${exam.code} · ${exam.title}</option>`)
        .join("");
    examSelect.value = state.selectedExamId;
}

function formatExamDate(isoDate) {
    const d = new Date(isoDate);
    const parts = new Intl.DateTimeFormat("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Africa/Johannesburg"
    }).formatToParts(d);
    const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
    const day = get("day");
    const month = get("month");
    const year = get("year");
    const weekday = get("weekday");
    const hour = get("hour");
    const minute = get("minute");
    return `${day} ${month} ${year} (${weekday}) ${hour}:${minute} SAST`;
}

function formatCountdown(isoDate) {
    const diff = new Date(isoDate) - new Date();
    if (diff <= 0) return "Exam passed";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
}

function updateOverview() {
    const exam = getSelectedExam();

    if (!exam) {
        examOverview.innerHTML = "<p>Question bank unavailable.</p>";
        return;
    }

    const examDateBlock = exam.examDate
        ? `<p><strong>Exam date:</strong> ${formatExamDate(exam.examDate)}${exam.booked ? ' <span class="booked-badge">Booked</span>' : ""}</p>
        <p><strong>Countdown:</strong> ${formatCountdown(exam.examDate)}</p>`
        : "";

    examOverview.innerHTML = `
        <p class="eyebrow">Exam blueprint</p>
        <h3>${exam.code} · ${exam.title}</h3>
        <p>${exam.focus}</p>
        <p><strong>Level:</strong> ${exam.level}</p>
        ${examDateBlock}
        <p><strong>Questions:</strong> ${exam.questionBank.length}</p>
        <p><strong>Suggested time:</strong> ${FIXED_EXAM_DURATION_MINUTES} minutes</p>
        <p><strong>Readiness gate:</strong> ${READINESS_OVERALL_TARGET}%+ overall, ${READINESS_DOMAIN_TARGET}%+ per domain, ${READINESS_TIMED_STREAK_TARGET} consecutive exam-mode passes</p>
        <p><strong>Selected domain:</strong> ${state.selectedDomain === "all" ? "All domains" : state.selectedDomain}</p>
        <p><strong>Coverage:</strong> ${exam.objectives.join(", ")}</p>
    `;
}

function resetSessionState() {
    const exam = getSelectedExam();

    state.currentQuestionIndex = 0;
    state.answers = [];
    state.checkedAnswers = [];
    state.markedForReview = [];
    state.flaggedQuestions = [];
    state.startedAt = null;
    state.activeQuestions = [];
    state.isPaused = false;
    state.remainingSeconds = exam ? FIXED_EXAM_DURATION_MINUTES * 60 : 0;
    state.isActive = false;
    clearInterval(state.timerId);
    state.timerId = null;
    timerValue.textContent = formatTime(state.remainingSeconds);
    resultReadiness.innerHTML = "";
    resultImprovements.innerHTML = "";
    renderLiveReadinessBadge();
    renderQuestionNavigator();
}

function showPanel(panel) {
    emptyState.classList.add("hidden");
    examInterface.classList.add("hidden");
    resultsPanel.classList.add("hidden");
    panel.classList.remove("hidden");
}

function renderQuestion() {
    const exam = getSelectedExam();
    const activeQuestions = getActiveQuestions();
    const question = activeQuestions[state.currentQuestionIndex];

    if (!exam || !question) {
        return;
    }

    const selectedAnswer = state.answers[state.currentQuestionIndex];
    const hasAnswered = hasAnsweredQuestion(question, selectedAnswer);
    const isChecked = getCurrentQuestionCheckState();

    examTitle.textContent = `${exam.code} Practice Exam`;
    questionIndicator.textContent = `${state.currentQuestionIndex + 1} / ${activeQuestions.length}`;
    questionDomain.textContent = question.caseStudy ? `${question.domain} · Case Study` : question.domain;
    if (questionDifficulty) {
        questionDifficulty.textContent = inferDifficulty(question);
    }
    if (questionVersion && exam) {
        questionVersion.textContent = `v${getQuestionVersion(exam.id, question.prompt)}`;
    }
    if (flagQuestionButton) {
        flagQuestionButton.textContent = state.flaggedQuestions[state.currentQuestionIndex] ? "Flagged" : "Flag";
    }

    if (question.caseStudy && caseStudyPanel) {
        caseStudyPanel.classList.remove("hidden");
        caseStudyPanel.innerHTML = `
            <p class="eyebrow">${question.caseStudy.title}</p>
            <p>${question.caseStudy.scenario}</p>
            <ul class="notes-list">${question.caseStudy.requirements.map((item) => `<li>${item}</li>`).join("")}</ul>
        `;
    } else if (caseStudyPanel) {
        caseStudyPanel.classList.add("hidden");
        caseStudyPanel.innerHTML = "";
    }

    questionText.textContent = question.prompt;
    progressBar.style.width = `${((state.currentQuestionIndex + 1) / activeQuestions.length) * 100}%`;

    if (question.type === "yesno") {
        const yesSelected = selectedAnswer === true;
        const noSelected = selectedAnswer === false;

        optionsList.innerHTML = `
            <button class="option-card ${yesSelected ? "selected" : ""}" type="button" data-yesno-value="yes">
                <span class="option-letter">Y</span>
                <span>Yes</span>
            </button>
            <button class="option-card ${noSelected ? "selected" : ""}" type="button" data-yesno-value="no">
                <span class="option-letter">N</span>
                <span>No</span>
            </button>
        `;
    } else if (question.type === "dragdrop") {
        const answerOrder = Array.isArray(selectedAnswer) && selectedAnswer.length
            ? selectedAnswer
            : question.dragOptions;

        if (!Array.isArray(selectedAnswer) || !selectedAnswer.length) {
            state.answers[state.currentQuestionIndex] = [...answerOrder];
        }

        optionsList.innerHTML = `
            <div class="drag-list" data-drag-list="true">
                ${answerOrder.map((item) => `<div class="drag-item" draggable="true" data-drag-item="${escapeHtml(item)}"><span class="option-letter">::</span><span>${escapeHtml(item)}</span></div>`).join("")}
            </div>
            <p class="field-hint">Drag items to reorder them from strongest to weakest response.</p>
        `;
    } else if (question.type === "multiselect") {
        const selectedSet = Array.isArray(selectedAnswer) ? selectedAnswer : [];

        optionsList.innerHTML = `
            <p class="field-hint">Select exactly ${question.chooseCount} options.</p>
            ${question.options
                .map((option, index) => {
                    let classes = "option-card";
                    if (selectedSet.includes(index)) {
                        classes += " multi-selected";
                    }

                    if (isChecked && hasAnswered) {
                        if (question.correctAnswers.includes(index)) {
                            classes += " correct";
                        } else if (selectedSet.includes(index)) {
                            classes += " incorrect";
                        }
                    }

                    return `
                        <button class="${classes}" type="button" data-multi-index="${index}">
                            <span class="option-letter">${index + 1}</span>
                            <span>${option}</span>
                        </button>
                    `;
                })
                .join("")}
        `;
    } else {
        optionsList.innerHTML = question.options
            .map((option, index) => {
                const letters = ["A", "B", "C", "D"];
                let classes = "option-card";

                if (selectedAnswer === index) {
                    classes += " selected";
                }

                if (isChecked && hasAnswered) {
                    if (index === question.answer) {
                        classes += " correct";
                    } else if (selectedAnswer === index && selectedAnswer !== question.answer) {
                        classes += " incorrect";
                    }
                }

                return `
                    <button class="${classes}" type="button" data-option-index="${index}">
                        <span class="option-letter">${letters[index]}</span>
                        <span>${option}</span>
                    </button>
                `;
            })
            .join("");
    }

    if (isChecked && hasAnswered) {
        const explanation = explainCurrentAnswer(question, selectedAnswer);
        feedbackPanel.className = `feedback-panel ${explanation.correct ? "is-correct" : "is-incorrect"}`;
        feedbackPanel.innerHTML = `
            <strong>${explanation.label}</strong>
            <p>${explanation.detail}</p>
        `;
        feedbackPanel.classList.remove("hidden");
    } else {
        feedbackPanel.classList.add("hidden");
        feedbackPanel.textContent = "";
    }

    const isLastQuestion = state.currentQuestionIndex === activeQuestions.length - 1;
    finishExamButton.classList.toggle("hidden", !isLastQuestion);
    nextQuestionButton.classList.toggle("hidden", isLastQuestion);
    checkAnswerButton.disabled = !hasAnswered;
    if (markReviewButton) {
        markReviewButton.textContent = state.markedForReview[state.currentQuestionIndex] ? "Marked" : "Mark for Review";
    }
    if (pauseExamButton) {
        pauseExamButton.textContent = state.isPaused ? "Resume" : "Pause";
    }
    nextQuestionButton.disabled = !hasAnswered || !isChecked;
    finishExamButton.disabled = !hasAnswered || !isChecked;
    renderQuestionNavigator();
}

function selectAnswer(answerIndex) {
    if (!state.isActive) {
        return;
    }

    state.answers[state.currentQuestionIndex] = answerIndex;
    state.checkedAnswers[state.currentQuestionIndex] = false;
    renderQuestion();
}

function selectYesNoAnswer(value) {
    if (!state.isActive) {
        return;
    }

    state.answers[state.currentQuestionIndex] = value;
    state.checkedAnswers[state.currentQuestionIndex] = false;
    renderQuestion();
}

function selectMultiAnswer(optionIndex) {
    if (!state.isActive) {
        return;
    }

    const question = getActiveQuestions()[state.currentQuestionIndex];
    if (!question || question.type !== "multiselect") {
        return;
    }

    const selected = Array.isArray(state.answers[state.currentQuestionIndex])
        ? [...state.answers[state.currentQuestionIndex]]
        : [];

    const existingIndex = selected.indexOf(optionIndex);
    if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
    } else {
        if (selected.length >= question.chooseCount) {
            selected.shift();
        }
        selected.push(optionIndex);
    }

    state.answers[state.currentQuestionIndex] = selected;
    state.checkedAnswers[state.currentQuestionIndex] = false;
    renderQuestion();
}

function updateDragDropAnswerFromDom() {
    if (!state.isActive) {
        return;
    }

    const items = [...optionsList.querySelectorAll("[data-drag-item]")].map((node) => node.dataset.dragItem);
    state.answers[state.currentQuestionIndex] = items;
    state.checkedAnswers[state.currentQuestionIndex] = false;
}

function checkAnswer() {
    const selectedAnswer = state.answers[state.currentQuestionIndex];
    const question = getActiveQuestions()[state.currentQuestionIndex];

    if (!question) {
        return;
    }

    if (question.type === "dragdrop") {
        if (!Array.isArray(selectedAnswer) || !selectedAnswer.length) {
            return;
        }

        state.checkedAnswers[state.currentQuestionIndex] = true;
        renderQuestion();
        return;
    }

    if (question.type === "yesno") {
        if (typeof selectedAnswer !== "boolean") {
            return;
        }

        state.checkedAnswers[state.currentQuestionIndex] = true;
        renderQuestion();
        return;
    }

    if (question.type === "multiselect") {
        if (!Array.isArray(selectedAnswer) || selectedAnswer.length !== question.chooseCount) {
            return;
        }

        state.checkedAnswers[state.currentQuestionIndex] = true;
        renderQuestion();
        return;
    }

    if (typeof selectedAnswer !== "number") {
        return;
    }

    state.checkedAnswers[state.currentQuestionIndex] = true;
    renderQuestion();
}

function startTimer() {
    clearInterval(state.timerId);
    timerValue.textContent = formatTime(state.remainingSeconds);

    state.timerId = setInterval(() => {
        if (state.isPaused) {
            return;
        }

        state.remainingSeconds -= 1;
        timerValue.textContent = formatTime(Math.max(state.remainingSeconds, 0));

        if (state.remainingSeconds <= 0) {
            clearInterval(state.timerId);
            finishExam(true);
        }
    }, 1000);
}

function startExam() {
    const exam = getSelectedExam();

    if (!exam) {
        return;
    }

    resetSessionState();
    state.mode = modeSelect.value;
    state.isPaused = false;
    state.activeQuestions = buildSessionQuestions(exam);
    state.startedAt = Date.now();
    state.isActive = true;
    startTimer();
    showPanel(examInterface);
    renderQuestion();
}

function togglePauseExam() {
    if (!state.isActive) {
        return;
    }

    state.isPaused = !state.isPaused;
    if (pauseExamButton) {
        pauseExamButton.textContent = state.isPaused ? "Resume" : "Pause";
    }
}

function toggleMarkForReview() {
    if (!state.isActive) {
        return;
    }

    state.markedForReview[state.currentQuestionIndex] = !state.markedForReview[state.currentQuestionIndex];
    renderQuestion();
}

function toggleFlagQuestion() {
    if (!state.isActive) {
        return;
    }

    state.flaggedQuestions[state.currentQuestionIndex] = !state.flaggedQuestions[state.currentQuestionIndex];
    renderQuestion();
}

function reportCurrentQuestionIssue() {
    if (!state.isActive) {
        return;
    }

    const exam = getSelectedExam();
    const question = getActiveQuestions()[state.currentQuestionIndex];

    if (!exam || !question) {
        return;
    }

    const note = window.prompt("Describe the issue with this question (clarity, accuracy, wording, etc.):", "");

    if (!note || !note.trim()) {
        return;
    }

    const reports = loadQuestionReports();
    reports.unshift({
        id: `report-${Date.now()}`,
        examId: exam.id,
        examCode: exam.code,
        domain: question.domain,
        prompt: question.prompt,
        note: note.trim(),
        version: getQuestionVersion(exam.id, question.prompt),
        status: "open",
        learner: state.activeLearner,
        createdAt: new Date().toISOString()
    });
    saveQuestionReports(reports.slice(0, 200));
    renderQuestionReports();
    window.alert("Question issue captured in the editorial queue.");
}

function createCohort() {
    const name = String(cohortNameInput?.value || "").trim();

    if (!name) {
        window.alert("Enter a cohort name first.");
        return;
    }

    const cohorts = loadCohorts();
    cohorts.unshift({
        id: `cohort-${Date.now()}`,
        name,
        members: []
    });
    saveCohorts(cohorts);
    cohortNameInput.value = "";
    renderTeamHub();
}

function addMemberToCohort() {
    const memberName = String(memberNameInput?.value || "").trim();

    if (!memberName || !state.selectedCohortId) {
        window.alert("Select a cohort and enter a learner name.");
        return;
    }

    const cohorts = loadCohorts();
    const cohort = cohorts.find((item) => item.id === state.selectedCohortId);

    if (!cohort) {
        return;
    }

    if (!cohort.members.includes(memberName)) {
        cohort.members.push(memberName);
    }

    saveCohorts(cohorts);
    memberNameInput.value = "";
    renderTeamHub();
}

function createAssignment() {
    const cohortId = state.selectedCohortId;
    const examId = assignmentExamSelect?.value;

    if (!cohortId || !examId) {
        window.alert("Select a cohort and exam before creating an assignment.");
        return;
    }

    const assignments = loadAssignments();
    assignments.unshift({
        id: `assignment-${Date.now()}`,
        cohortId,
        examId,
        mode: assignmentModeSelect?.value || "practice",
        domain: assignmentDomainSelect?.value || "all",
        dueDate: assignmentDueDateInput?.value || "",
        createdAt: new Date().toISOString(),
        createdBy: state.activeLearner
    });
    saveAssignments(assignments);
    renderAssignments();
}

function saveRevision() {
    const examId = revisionExamSelect?.value;
    const note = String(revisionNoteInput?.value || "").trim();
    const indexInput = Number(revisionQuestionIndexInput?.value || 0);
    const questionIndex = indexInput - 1;
    const exam = getExamById(examId);

    if (!exam || questionIndex < 0 || questionIndex >= exam.questionBank.length || !note) {
        window.alert("Provide exam, valid question number, and revision note.");
        return;
    }

    const question = exam.questionBank[questionIndex];
    const revisions = loadQuestionRevisions();
    revisions.unshift({
        examId,
        prompt: question.prompt,
        questionIndex,
        note,
        editor: state.activeLearner,
        createdAt: new Date().toISOString()
    });
    saveQuestionRevisions(revisions.slice(0, 300));
    revisionNoteInput.value = "";
    revisionQuestionIndexInput.value = "";
    renderRevisionHistory();
    window.alert("Revision saved. It will be applied in new exam sessions.");
}

function completeAssignment(assignmentId, score = 0, completedByAttempt = false) {
    const assignments = loadAssignments();
    const assignment = assignments.find((item) => item.id === assignmentId);

    if (!assignment) {
        return;
    }

    const learner = state.activeLearner;
    const completions = loadAssignmentCompletions();
    const existing = completions.find((item) => item.assignmentId === assignmentId && item.learner === learner);

    if (existing) {
        existing.completedAt = new Date().toISOString();
        existing.score = score;
        existing.source = completedByAttempt ? "attempt" : "manual";
    } else {
        completions.unshift({
            assignmentId,
            learner,
            completedAt: new Date().toISOString(),
            score,
            source: completedByAttempt ? "attempt" : "manual"
        });
    }

    saveAssignmentCompletions(completions.slice(0, 500));
    renderMyTasks();
}

function autoCompleteMatchingAssignments(exam, score) {
    const learner = state.activeLearner;
    const cohortIds = getCohortIdsForLearner(learner);

    if (!cohortIds.length) {
        return;
    }

    const assignments = loadAssignments().filter((assignment) => {
        const examMatch = assignment.examId === exam.id;
        const modeMatch = assignment.mode === state.mode;
        const domainMatch = assignment.domain === "all" || state.selectedDomain === "all" || assignment.domain === state.selectedDomain;
        const cohortMatch = cohortIds.includes(assignment.cohortId);
        return examMatch && modeMatch && domainMatch && cohortMatch;
    });

    assignments.forEach((assignment) => {
        completeAssignment(assignment.id, score, true);
    });
}

function moveToNextQuestion() {
    const activeQuestions = getActiveQuestions();
    if (state.currentQuestionIndex >= activeQuestions.length - 1) {
        return;
    }
    state.currentQuestionIndex += 1;
    renderQuestion();
}

function finishExam(timeExpired = false) {
    const exam = getSelectedExam();
    const activeQuestions = getActiveQuestions();

    if (!exam || !activeQuestions.length) {
        return;
    }

    clearInterval(state.timerId);
    state.isActive = false;

    const earnedPoints = activeQuestions.reduce((total, question, index) => {
        return total + getQuestionScore(question, state.answers[index]);
    }, 0);

    const correctAnswers = Math.round(earnedPoints * 100) / 100;

    const score = Math.round((earnedPoints / activeQuestions.length) * 100);
    const passed = score >= 70;
    const elapsedSeconds = (FIXED_EXAM_DURATION_MINUTES * 60) - state.remainingSeconds;

    resultTitle.textContent = `${exam.code} mock exam complete`;
    resultScore.innerHTML = `${score}% <span class="${passed ? "status-pass" : "status-fail"}">${passed ? "Pass" : "Keep practising"}</span>`;
    resultSummary.textContent = timeExpired
        ? `Time expired. You earned ${correctAnswers} points out of ${activeQuestions.length}.`
        : `You earned ${correctAnswers} points out of ${activeQuestions.length} in ${formatTime(elapsedSeconds)}.`;

    const domainBreakdown = buildDomainBreakdown(activeQuestions, state.answers);
    const sectionBreakdown = buildSectionBreakdown(exam.id, activeQuestions, state.answers);
    const domainBreakdownText = formatDomainBreakdown(domainBreakdown);

    addHistoryEntry(exam, {
        score,
        passed,
        learner: state.activeLearner,
        correct: correctAnswers,
        total: activeQuestions.length,
        mode: state.mode,
        domainLabel: state.selectedDomain === "all" ? "All domains" : state.selectedDomain,
        dateLabel: new Date().toLocaleString(),
        domainBreakdown,
        sectionBreakdown,
        domainBreakdownText,
        markedCount: state.markedForReview.filter(Boolean).length,
        flaggedCount: state.flaggedQuestions.filter(Boolean).length
    });

    autoCompleteMatchingAssignments(exam, score);

    const queue = loadReviewQueue(exam.id);
    const queueEntries = activeQuestions
        .map((question, index) => ({ question, index }))
        .filter((entry) => !isAnswerCorrect(entry.question, state.answers[entry.index]))
        .map((entry) => {
            const nextReviewAt = new Date();
            nextReviewAt.setDate(nextReviewAt.getDate() + 2);

            return {
                prompt: entry.question.prompt,
                domain: entry.question.domain,
                nextReviewAt: nextReviewAt.toISOString()
            };
        });

    saveReviewQueue(exam.id, [...queueEntries, ...queue].slice(0, 120));

    renderHistory();
    renderLiveReadinessBadge();
    renderAnalytics();
    renderTeamHub();
    renderReadinessPanel(exam, {
        score,
        mode: state.mode,
        domainBreakdown
    });
    resultImprovements.innerHTML = buildImprovementPlan(exam, domainBreakdown);

    reviewList.innerHTML = activeQuestions
        .map((question, index) => {
            const selectedAnswer = state.answers[index];
            const selectedText = getAnswerLabel(question, selectedAnswer);
            const correctAnswerText = question.type === "yesno"
                ? (question.correctYes ? "Yes" : "No")
                : question.type === "dragdrop"
                    ? question.correctOrder.map((item, orderIndex) => `${orderIndex + 1}. ${item}`).join(" | ")
                    : question.type === "multiselect"
                        ? question.correctAnswers.map((optionIndex) => question.options[optionIndex]).join(" | ")
                        : question.options[question.answer];
            const correct = isAnswerCorrect(question, selectedAnswer);

            return `
                <article class="review-item">
                    <strong>${index + 1}. ${question.prompt}</strong>
                    <p><strong>Your answer:</strong> ${selectedText}</p>
                    <p><strong>Correct answer:</strong> ${correctAnswerText}</p>
                    <p><strong>Why:</strong> ${question.explanation}</p>
                    <p class="${correct ? "status-pass" : "status-fail"}">${correct ? "Correct" : "Needs review"}</p>
                </article>
            `;
        })
        .join("");

    showPanel(resultsPanel);
}

examSelect.addEventListener("change", (event) => {
    state.selectedExamId = event.target.value;
    state.selectedDomain = "all";
    updateDomainFilterOptions();
    updateOverview();
    renderHistory();
    renderLiveReadinessBadge();
    renderStudyNotes();
    renderAz900CoverageChecklist();
    renderAnalytics();
    renderTeamHub();
    resetSessionState();
    showPanel(emptyState);
});

modeSelect.addEventListener("change", () => {
    state.mode = modeSelect.value;
    updateOverview();
});

domainSelect.addEventListener("change", (event) => {
    state.selectedDomain = event.target.value;
    updateOverview();
    resetSessionState();
    showPanel(emptyState);
});

startExamButton.addEventListener("click", startExam);
if (pauseExamButton) {
    pauseExamButton.addEventListener("click", togglePauseExam);
}
if (markReviewButton) {
    markReviewButton.addEventListener("click", toggleMarkForReview);
}
if (flagQuestionButton) {
    flagQuestionButton.addEventListener("click", toggleFlagQuestion);
}
if (reportIssueButton) {
    reportIssueButton.addEventListener("click", reportCurrentQuestionIssue);
}
checkAnswerButton.addEventListener("click", checkAnswer);
nextQuestionButton.addEventListener("click", moveToNextQuestion);
finishExamButton.addEventListener("click", () => finishExam(false));
restartButton.addEventListener("click", () => {
    resetSessionState();
    showPanel(emptyState);
});

savePdfButton.addEventListener("click", exportExamQaAsPdf);

exportProgressButton.addEventListener("click", exportProgress);
importProgressButton.addEventListener("click", () => {
    importProgressInput.click();
});

importProgressInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
        importProgressFromFile(file);
        renderLiveReadinessBadge();
        renderAz900CoverageChecklist();
        renderAnalytics();
        renderTeamHub();
    }
    importProgressInput.value = "";
});

if (saveLearnerButton) {
    saveLearnerButton.addEventListener("click", () => {
        saveActiveLearner(learnerNameInput?.value || "");
        renderTeamHub();
    });
}

if (createCohortButton) {
    createCohortButton.addEventListener("click", createCohort);
}

if (cohortSelect) {
    cohortSelect.addEventListener("change", (event) => {
        state.selectedCohortId = event.target.value;
        renderCohortMembers();
        renderLeaderboard();
        renderAssignments();
        renderCohortDomainHeatmap();
    });
}

if (addMemberButton) {
    addMemberButton.addEventListener("click", addMemberToCohort);
}

if (assignmentExamSelect) {
    assignmentExamSelect.addEventListener("change", renderAssignmentDomainOptions);
}

if (createAssignmentButton) {
    createAssignmentButton.addEventListener("click", () => {
        createAssignment();
        renderMyTasks();
    });
}

if (saveRevisionButton) {
    saveRevisionButton.addEventListener("click", saveRevision);
}

if (myTasksList) {
    myTasksList.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-action='complete-assignment']");
        if (!trigger) {
            return;
        }

        completeAssignment(trigger.dataset.assignmentId, 0, false);
    });
}

if (questionReportsList) {
    questionReportsList.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-action='report-status']");
        if (!trigger) {
            return;
        }

        setReportStatus(trigger.dataset.reportId, trigger.dataset.status);
        renderQuestionReports();
    });
}

if (questionNav) {
    questionNav.addEventListener("click", (event) => {
        const navButton = event.target.closest("[data-nav-index]");

        if (!navButton || !state.isActive) {
            return;
        }

        state.currentQuestionIndex = Number(navButton.dataset.navIndex);
        renderQuestion();
    });
}

window.addEventListener("keydown", (event) => {
    if (!state.isActive || state.isPaused) {
        return;
    }

    const key = event.key.toLowerCase();
    const optionIndex = ["a", "b", "c", "d"].indexOf(key);
    const question = getActiveQuestions()[state.currentQuestionIndex];

    if (optionIndex >= 0) {
        if (question && question.type === "multiselect") {
            selectMultiAnswer(optionIndex);
        } else {
            selectAnswer(optionIndex);
        }
        return;
    }

    if (key === "enter") {
        if (!getCurrentQuestionCheckState()) {
            checkAnswer();
        } else if (state.currentQuestionIndex < state.activeQuestions.length - 1) {
            moveToNextQuestion();
        }
    }
});

if (toggleHighContrastButton) {
    toggleHighContrastButton.addEventListener("click", () => {
        document.body.classList.toggle("high-contrast");
    });
}

if (toggleDyslexiaFontButton) {
    toggleDyslexiaFontButton.addEventListener("click", () => {
        document.body.classList.toggle("dyslexia-font");
    });
}

optionsList.addEventListener("click", (event) => {
    const yesNoButton = event.target.closest("[data-yesno-value]");
    if (yesNoButton) {
        selectYesNoAnswer(yesNoButton.dataset.yesnoValue === "yes");
        return;
    }

    const optionButton = event.target.closest("[data-option-index]");
    const multiButton = event.target.closest("[data-multi-index]");

    if (multiButton) {
        selectMultiAnswer(Number(multiButton.dataset.multiIndex));
        return;
    }

    if (!optionButton) {
        return;
    }

    const answerIndex = Number(optionButton.dataset.optionIndex);
    selectAnswer(answerIndex);
});

let draggedItem = null;

optionsList.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-drag-item]");
    if (!item) {
        return;
    }

    draggedItem = item;
    item.classList.add("dragging");
});

optionsList.addEventListener("dragend", (event) => {
    const item = event.target.closest("[data-drag-item]");
    if (item) {
        item.classList.remove("dragging");
    }
    draggedItem = null;
    updateDragDropAnswerFromDom();
    renderQuestion();
});

optionsList.addEventListener("dragover", (event) => {
    const list = event.target.closest("[data-drag-list]");
    const targetItem = event.target.closest("[data-drag-item]");

    if (!list || !draggedItem || !targetItem || draggedItem === targetItem) {
        return;
    }

    event.preventDefault();
    const targetRect = targetItem.getBoundingClientRect();
    const isAfter = event.clientY > (targetRect.top + targetRect.height / 2);

    if (isAfter) {
        targetItem.after(draggedItem);
    } else {
        targetItem.before(draggedItem);
    }
});

renderPaths();
populateExamSelect();
updateDomainFilterOptions();
state.activeLearner = loadActiveLearner();
updateOverview();
renderHistory();
renderLiveReadinessBadge();
renderStudyNotes();
renderAz900CoverageChecklist();
renderAnalytics();
renderTeamHub();
resetSessionState();