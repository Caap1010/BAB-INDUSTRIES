const onlineToggle = document.getElementById("onlineToggle");
const themeToggle = document.getElementById("themeToggle");
const availabilityValue = document.getElementById("availabilityValue");
const zoneValue = document.getElementById("zoneValue");
const acceptanceValue = document.getElementById("acceptanceValue");
const safetyValue = document.getElementById("safetyValue");
const requestList = document.getElementById("requestList");
const queueCount = document.getElementById("queueCount");
const simulateRequestBtn = document.getElementById("simulateRequestBtn");
const autoAcceptBtn = document.getElementById("autoAcceptBtn");
const tripCard = document.getElementById("tripCard");
const tripPhase = document.getElementById("tripPhase");
const nextStepBtn = document.getElementById("nextStepBtn");
const completeTripBtn = document.getElementById("completeTripBtn");
const zoneGrid = document.getElementById("zoneGrid");
const refreshDemandBtn = document.getElementById("refreshDemandBtn");
const lastRefresh = document.getElementById("lastRefresh");
const earningsValue = document.getElementById("earningsValue");
const tripsDone = document.getElementById("tripsDone");
const surgeBonus = document.getElementById("surgeBonus");
const questProgress = document.getElementById("questProgress");
const questBar = document.getElementById("questBar");
const sosBtn = document.getElementById("sosBtn");
const shareTripBtn = document.getElementById("shareTripBtn");
const incidentBtn = document.getElementById("incidentBtn");
const safetyStatus = document.getElementById("safetyStatus");
const brandLogo = document.getElementById("brandLogo");
const brandFallback = document.getElementById("brandFallback");

const zones = ["Johannesburg CBD", "Sandton", "Midrand", "Pretoria Central", "Rosebank", "Soweto"];
const passengerNames = ["Lerato", "Amina", "Thabo", "Zanele", "Mpho", "Jason", "Nandi", "Sipho"];

const tripStages = ["Accepted", "Arriving Pickup", "Passenger Onboard", "Drop-off Reached"];

const state = {
    isOnline: false,
    autoAccept: false,
    totalRequests: 0,
    acceptedRequests: 0,
    completedTrips: 0,
    todayEarnings: 0,
    totalSurgeBonus: 0,
    questTarget: 12,
    currentTrip: null,
    requestQueue: [],
    demand: [],
};

function formatCurrency(value) {
    return `R ${value.toFixed(2)}`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(array) {
    return array[randomInt(0, array.length - 1)];
}

function updateTopStatus() {
    availabilityValue.textContent = state.isOnline ? "Online" : "Offline";
    onlineToggle.textContent = state.isOnline ? "Go Offline" : "Go Online";
    onlineToggle.classList.toggle("success", !state.isOnline);

    const acceptanceRate = state.totalRequests > 0
        ? Math.round((state.acceptedRequests / state.totalRequests) * 100)
        : 100;

    acceptanceValue.textContent = `${acceptanceRate}%`;
    safetyValue.textContent = `${Math.max(90, 100 - Math.floor(state.completedTrips / 3))} / 100`;
}

function generateRequest() {
    const pickup = pickRandom(zones);
    let dropoff = pickRandom(zones);

    while (dropoff === pickup) {
        dropoff = pickRandom(zones);
    }

    const distanceKm = randomInt(2, 28);
    const etaMin = randomInt(2, 10);
    const surge = Math.random() > 0.72 ? Number((1 + Math.random() * 1.4).toFixed(1)) : 1;
    const fareBase = randomInt(50, 260);
    const fare = Number((fareBase * surge).toFixed(2));

    return {
        id: `REQ-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        passenger: pickRandom(passengerNames),
        pickup,
        dropoff,
        distanceKm,
        etaMin,
        surge,
        fare,
    };
}

function renderQueue() {
    queueCount.textContent = `${state.requestQueue.length} pending`;

    if (!state.requestQueue.length) {
        requestList.innerHTML = `<li class="request-card"><strong>No pending requests</strong><span class="request-meta">${state.isOnline ? "Waiting for dispatch..." : "Go online to receive requests."}</span></li>`;
        return;
    }

    requestList.innerHTML = state.requestQueue
        .map((request) => {
            return `
                <li class="request-card">
                    <div class="request-meta">
                        <span>${request.id}</span>
                        <span>${request.etaMin} min away</span>
                    </div>
                    <strong>${request.passenger}: ${request.pickup} → ${request.dropoff}</strong>
                    <div class="request-meta">
                        <span>${request.distanceKm} km</span>
                        <span>${request.surge > 1 ? `${request.surge}x surge` : "Standard"}</span>
                        <span>${formatCurrency(request.fare)}</span>
                    </div>
                    <div class="request-controls">
                        <button class="btn primary" data-action="accept" data-id="${request.id}" type="button">Accept</button>
                        <button class="btn ghost" data-action="decline" data-id="${request.id}" type="button">Decline</button>
                    </div>
                </li>`;
        })
        .join("");
}

function setTrip(request) {
    state.currentTrip = {
        ...request,
        stageIndex: 0,
        startedAt: new Date(),
    };

    tripPhase.textContent = tripStages[state.currentTrip.stageIndex];
    nextStepBtn.disabled = false;
    completeTripBtn.disabled = false;
    zoneValue.textContent = request.pickup;
    renderTripCard();
}

function renderTripCard() {
    if (!state.currentTrip) {
        tripCard.classList.add("empty");
        tripCard.innerHTML = "<p>Accept a request to activate advanced trip controls.</p>";
        tripPhase.textContent = "No active trip";
        nextStepBtn.disabled = true;
        completeTripBtn.disabled = true;
        return;
    }

    tripCard.classList.remove("empty");
    tripCard.innerHTML = `
        <strong>${state.currentTrip.passenger}</strong>
        <div class="kv"><span>Route</span><span>${state.currentTrip.pickup} → ${state.currentTrip.dropoff}</span></div>
        <div class="kv"><span>Distance</span><span>${state.currentTrip.distanceKm} km</span></div>
        <div class="kv"><span>Estimated Fare</span><span>${formatCurrency(state.currentTrip.fare)}</span></div>
        <div class="kv"><span>Surge</span><span>${state.currentTrip.surge}x</span></div>
        <div class="kv"><span>Current Stage</span><span>${tripStages[state.currentTrip.stageIndex]}</span></div>
    `;
}

function updateEarnings() {
    earningsValue.textContent = `${formatCurrency(state.todayEarnings)} today`;
    tripsDone.textContent = String(state.completedTrips);
    surgeBonus.textContent = formatCurrency(state.totalSurgeBonus);
    questProgress.textContent = `${state.completedTrips} / ${state.questTarget}`;
    questBar.max = state.questTarget;
    questBar.value = Math.min(state.completedTrips, state.questTarget);
}

function updateDemand() {
    state.demand = zones.map((zone) => {
        const multiplier = Number((1 + Math.random() * 1.8).toFixed(1));
        const eta = randomInt(2, 12);
        return { zone, multiplier, eta };
    }).sort((a, b) => b.multiplier - a.multiplier);

    zoneGrid.innerHTML = state.demand
        .map((item) => {
            const className = item.multiplier >= 2.2 ? "max" : item.multiplier >= 1.6 ? "high" : "";
            return `<div class="zone-item">
                <div>
                    <strong>${item.zone}</strong>
                    <small>${item.eta} min avg pickup ETA</small>
                </div>
                <span class="multiplier ${className}">${item.multiplier}x</span>
            </div>`;
        })
        .join("");

    const best = state.demand[0];
    if (best) {
        zoneValue.textContent = best.zone;
    }

    lastRefresh.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function maybeAutoAccept() {
    if (!state.autoAccept || state.currentTrip || !state.requestQueue.length) {
        return;
    }

    const request = state.requestQueue.shift();
    state.acceptedRequests += 1;
    setTrip(request);
    renderQueue();
    updateTopStatus();
}

function addRequest() {
    if (!state.isOnline) {
        return;
    }

    const request = generateRequest();
    state.requestQueue.unshift(request);
    state.totalRequests += 1;
    renderQueue();
    updateTopStatus();
    maybeAutoAccept();
}

function acceptRequestById(id) {
    if (state.currentTrip) {
        safetyStatus.textContent = "Finish or complete the active trip before accepting another request.";
        return;
    }

    const index = state.requestQueue.findIndex((req) => req.id === id);
    if (index < 0) {
        return;
    }

    const request = state.requestQueue.splice(index, 1)[0];
    state.acceptedRequests += 1;
    setTrip(request);
    renderQueue();
    updateTopStatus();
    safetyStatus.textContent = "Trip accepted and navigation optimized.";
}

function declineRequestById(id) {
    const index = state.requestQueue.findIndex((req) => req.id === id);
    if (index < 0) {
        return;
    }

    state.requestQueue.splice(index, 1);
    renderQueue();
    updateTopStatus();
    safetyStatus.textContent = "Request declined. Dispatch priority recalculated.";
}

function moveTripForward() {
    if (!state.currentTrip) {
        return;
    }

    if (state.currentTrip.stageIndex < tripStages.length - 1) {
        state.currentTrip.stageIndex += 1;
        tripPhase.textContent = tripStages[state.currentTrip.stageIndex];
        if (state.currentTrip.stageIndex >= 2) {
            zoneValue.textContent = state.currentTrip.dropoff;
        }
        renderTripCard();
        safetyStatus.textContent = "Trip stage updated successfully.";
    }
}

function completeTrip() {
    if (!state.currentTrip) {
        return;
    }

    const earnings = state.currentTrip.fare;
    const surgePart = state.currentTrip.surge > 1 ? earnings * (1 - 1 / state.currentTrip.surge) : 0;

    state.completedTrips += 1;
    state.todayEarnings += earnings;
    state.totalSurgeBonus += surgePart;

    state.currentTrip = null;
    renderTripCard();
    updateEarnings();
    updateTopStatus();
    safetyStatus.textContent = "Trip completed. Earnings and quest progress updated.";
    maybeAutoAccept();
}

function toggleOnline() {
    state.isOnline = !state.isOnline;

    if (!state.isOnline) {
        state.requestQueue = [];
        state.currentTrip = null;
        renderTripCard();
        safetyStatus.textContent = "You are offline. Dispatch paused.";
    } else {
        safetyStatus.textContent = "You are online. Smart dispatch is active.";
        addRequest();
    }

    renderQueue();
    updateTopStatus();
}

function toggleTheme() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
}

function toggleAutoAccept() {
    state.autoAccept = !state.autoAccept;
    autoAcceptBtn.textContent = `Auto Accept: ${state.autoAccept ? "On" : "Off"}`;
    safetyStatus.textContent = state.autoAccept
        ? "Auto accept enabled with risk-screening safeguards."
        : "Auto accept disabled.";
    maybeAutoAccept();
}

function runSOS() {
    safetyStatus.textContent = "SOS triggered. Emergency contacts and control room have been notified.";
}

function shareLiveTrip() {
    if (!state.currentTrip) {
        safetyStatus.textContent = "No active trip to share.";
        return;
    }

    safetyStatus.textContent = `Live trip link shared for ${state.currentTrip.passenger}.`;
}

function reportIncident() {
    safetyStatus.textContent = "Incident report drafted with trip context, time, and location metadata.";
}

function bindEvents() {
    onlineToggle.addEventListener("click", toggleOnline);
    themeToggle.addEventListener("click", toggleTheme);
    simulateRequestBtn.addEventListener("click", addRequest);
    autoAcceptBtn.addEventListener("click", toggleAutoAccept);
    nextStepBtn.addEventListener("click", moveTripForward);
    completeTripBtn.addEventListener("click", completeTrip);
    refreshDemandBtn.addEventListener("click", updateDemand);
    sosBtn.addEventListener("click", runSOS);
    shareTripBtn.addEventListener("click", shareLiveTrip);
    incidentBtn.addEventListener("click", reportIncident);

    requestList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const action = target.getAttribute("data-action");
        const id = target.getAttribute("data-id");

        if (!action || !id) {
            return;
        }

        if (action === "accept") {
            acceptRequestById(id);
        } else if (action === "decline") {
            declineRequestById(id);
        }
    });

    if (brandLogo && brandFallback) {
        brandLogo.addEventListener("error", () => {
            brandLogo.style.display = "none";
            brandFallback.style.display = "flex";
        });
    }
}

function startBackgroundDispatch() {
    setInterval(() => {
        if (!state.isOnline) {
            return;
        }

        if (Math.random() > 0.4) {
            addRequest();
        }

        if (Math.random() > 0.55) {
            updateDemand();
        }
    }, 9000);
}

function init() {
    bindEvents();
    renderQueue();
    renderTripCard();
    updateDemand();
    updateEarnings();
    updateTopStatus();
    startBackgroundDispatch();
    document.documentElement.setAttribute("data-theme", "dark");
    document.getElementById("year").textContent = new Date().getFullYear();
}

init();
