/* -------------------------------------------------------
   CivicConnect Backend JS – FULL
   - Auth
   - Citizen dashboard
   - Realtime incidents
   - Media + voice notes
   - Risk classification (rule-based)
   - Responder dashboard + map
   - Live GPS tracking
   - Realtime per-incident chat
   - Dispatcher assignment
-------------------------------------------------------- */

var SUPABASE_URL = "https://atpbqzqasnozxbxbnulq.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_dRRnPOJ7C0pqr98OQ-pq5w_KiNKofeK";

// Create ONE global Supabase client safely (UMD v2)
var civicSupabase =
  window.civicSupabase ||
  window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.civicSupabase = civicSupabase;

console.log("CivicSupabase initialized:", !!civicSupabase);

/* ------------ GLOBAL STATE ------------ */

let citizenChatIncidentSelectEl,
  citizenChatMessagesEl,
  citizenChatFormEl,
  citizenChatInputEl,
  responderChatIncidentLabelEl,
  responderChatMessagesEl,
  responderChatFormEl,
  responderChatInputEl;

let gpsWatchId = null;
let responderMap = null;
let responderMarkers = [];
let liveResponderMarkers = [];

let chatChannel = null;
let currentChatIncidentId = null;

let allResponders = [];
let currentUserRole = null;
let currentResponderUser = null;   // <--- NEW: logged-in responder (auth user)

let currentDispatcherUser = null; // logged-in dispatcher
let dispatcherMap = null;
let dispatcherIncidentMarkers = [];
let dispatcherResponderMarkers = [];
let currentDispatcherIncidentId = null;

let pendingVoiceBlob = null;
let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];

// NEW: speed dial button reference (citizen side)
let speedDialBtn = null;

/* ------------ UTILITIES ------------ */

async function getAuthUser() {
  const { data, error } = await civicSupabase.auth.getUser();
  if (error) console.error("getAuthUser error:", error);
  return data?.user ?? null;
}

async function getUserProfile() {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const { data, error } = await civicSupabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (error) {
    console.error("getUserProfile error:", error);
    return null;
  }
  return data;
}

function setYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

/* ------------ RENDER HELPERS (Citizen) ------------ */

function renderIncidentsList(container, incidents) {
  if (!container) return;

  if (!incidents || incidents.length === 0) {
    container.innerHTML =
      '<p style="color:#94a3b8;font-size:0.9rem;">No incidents logged yet.</p>';
    return;
  }

  container.innerHTML = "";
  incidents.forEach((i) => {
    const div = document.createElement("div");
    div.className = "incident-list-item";
    const time = new Date(i.timestamp).toLocaleString();

    const locHref =
      i.latitude && i.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${i.latitude},${i.longitude}`
        : null;

    div.innerHTML = `
      <div><strong>${i.incident_type}</strong> • ${time}</div>
      <div>Responder: ${i.responder_name} (${i.responder_phone})</div>
      <div>
        ${locHref
        ? `<a href="${locHref}" target="_blank">Navigate in Google Maps</a>`
        : ""
      }
      </div>
    `;
    container.appendChild(div);
  });
}

function renderAppointments(container, appointments) {
  if (!container) return;

  if (!appointments || appointments.length === 0) {
    container.innerHTML =
      '<p style="color:#94a3b8;font-size:0.9rem;">No appointments saved yet.</p>';
    return;
  }

  container.innerHTML = "";
  appointments.forEach((a) => {
    const div = document.createElement("div");
    div.className = "appointment-item";
    div.innerHTML = `
      <strong>${a.facility}</strong><br>
      ${a.appointment_date} @ ${a.appointment_time}<br>
      ${a.notes
        ? `<span style="color:#94a3b8;">${a.notes}</span>`
        : ""
      }
    `;
    container.appendChild(div);
  });
}

/* ------------ DATA FETCH (Citizen/Responder) ------------ */

async function fetchIncidents() {
  const user = await getAuthUser();
  if (!user) return [];

  const { data, error } = await civicSupabase
    .from("incidents")
    .select("*")
    .eq("user_id", user.id)
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("fetchIncidents error:", error);
    return [];
  }
  return data || [];
}

async function fetchAppointments() {
  const user = await getAuthUser();
  if (!user) return [];

  const { data, error } = await civicSupabase
    .from("appointments")
    .select("*")
    .eq("user_id", user.id)
    .order("appointment_date", { ascending: false });

  if (error) {
    console.error("fetchAppointments error:", error);
    return [];
  }
  return data || [];
}

async function fetchAllIncidentsForResponder(filters) {
  let query = civicSupabase
    .from("incidents")
    .select("*, users!inner(full_name, phone)")
    .order("timestamp", { ascending: false });

  if (filters?.type) {
    query = query.eq("incident_type", filters.type);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchAllIncidentsForResponder error:", error);
    return [];
  }
  return data || [];
}

async function loadRespondersList() {
  const { data, error } = await civicSupabase
    .from("users")
    .select("id, full_name, phone, user_role")
    .eq("user_role", "responder");

  if (error) {
    console.error("loadRespondersList error:", error);
    return [];
  }
  return data || [];
}

/* ------------ REALTIME INCIDENTS (RESPONDER) ------------ */

let incidentsChannel = null;

async function initRealtimeIncidentsResponder() {
  const authUser = await getAuthUser();
  if (!authUser) {
    console.warn("No auth user for realtime incidents.");
    return;
  }

  const profile = await getUserProfile();
  if (!profile || profile.user_role !== "responder") {
    console.log("Realtime incidents skipped – user is not responder.");
    return;
  }

  if (incidentsChannel) {
    console.log("Realtime incidents already initialized.");
    return;
  }

  incidentsChannel = civicSupabase
    .channel("incidents-realtime-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "incidents",
      },
      async (payload) => {
        console.log("Realtime new incident:", payload);
        await handleRealtimeIncidentInsert(payload.new);
      }
    )
    .subscribe((status) => {
      console.log("Realtime incidents channel status:", status);
    });
}

async function handleRealtimeIncidentInsert(newIncident) {
  const responderIncidentsContainer = document.getElementById(
    "responderIncidents"
  );
  if (!responderIncidentsContainer) return;

  const typeFilterEl = document.getElementById("filterType");
  const statusFilterEl = document.getElementById("filterStatus");

  const typeVal = typeFilterEl?.value || "";
  const statusVal = statusFilterEl?.value || "";

  const incidents = await fetchAllIncidentsForResponder({
    type: typeVal || null,
    status: statusVal || null,
  });

  renderResponderIncidents(responderIncidentsContainer, incidents);

  flashNewIncidentRow(newIncident.id);
  playIncidentAlertSound();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("New incident reported", {
      body:
        (newIncident.incident_type || "Unknown type") +
        " at " +
        (newIncident.timestamp
          ? new Date(newIncident.timestamp).toLocaleTimeString()
          : "now"),
      icon: "assets/images/civic-connect.png",
    });
  }
}

function playIncidentAlertSound() {
  const audio = document.getElementById("incidentAlertSound");
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn("Auto-play blocked:", err);
    });
  } catch (e) {
    console.warn("Could not play alert sound:", e);
  }
}

function flashNewIncidentRow(incidentId) {
  const row = document.querySelector(
    `tr[data-incident-id="${incidentId}"]`
  );
  if (!row) return;
  row.classList.add("new-incident-row");
  setTimeout(() => row.classList.remove("new-incident-row"), 4000);
}

/* ------------ STATIC EMERGENCY DATA ------------ */

const SAPS_STATIONS = [
  {
    name: "SAPS Johannesburg Central",
    phone: "0114977000",
    lat: -26.2041,
    lng: 28.0473,
  },
  {
    name: "SAPS Pretoria Central",
    phone: "0123534000",
    lat: -25.7479,
    lng: 28.2293,
  },
  {
    name: "SAPS Cape Town Central",
    phone: "0214678001",
    lat: -33.9249,
    lng: 18.4241,
  },
];

const HOSPITALS = [
  {
    name: "Charlotte Maxeke Academic Hospital",
    phone: "0114884911",
    lat: -26.186,
    lng: 28.0517,
  },
  {
    name: "Steve Biko Academic Hospital",
    phone: "0123541000",
    lat: -25.7326,
    lng: 28.203,
  },
];

const FIRE = [
  {
    name: "Joburg Fire HQ",
    phone: "0113755911",
    lat: -26.2023,
    lng: 28.0341,
  },
];

const SECURITY = [
  {
    name: "Private Security Dispatch",
    phone: "0100000000",
    lat: -26.2,
    lng: 28.04,
  },
];

/* ------------ GEO HELPERS ------------ */

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearest(lat, lng, list) {
  let best = null;
  let bestDist = Infinity;
  list.forEach((item) => {
    const d = distanceKm(lat, lng, item.lat, item.lng);
    if (d < bestDist) {
      best = item;
      bestDist = d;
    }
  });
  return best;
}

/* ------------ MEDIA UPLOAD ------------ */

async function uploadIncidentMedia(file, incidentId, userId) {
  if (!file || !incidentId || !userId) return null;

  try {
    const ext = file.name.includes(".")
      ? file.name.split(".").pop()
      : "";
    const safeExt = ext || (file.type === "video/mp4" ? "mp4" : "bin");

    const path = `${userId}/incident-${incidentId}-${Date.now()}.${safeExt}`;

    const { data: uploadData, error: uploadError } =
      await civicSupabase.storage
        .from("incident-media")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

    if (uploadError) {
      console.error("uploadIncidentMedia error:", uploadError);
      return null;
    }

    const { data: publicData } = civicSupabase.storage
      .from("incident-media")
      .getPublicUrl(path);

    const publicUrl = publicData?.publicUrl || null;
    if (!publicUrl) return null;

    const { error: updateError } = await civicSupabase
      .from("incidents")
      .update({
        media_url: publicUrl,
        media_type: file.type,
      })
      .eq("id", incidentId);

    if (updateError) {
      console.error(
        "uploadIncidentMedia: failed to save media_url to incident:",
        updateError
      );
      return null;
    }

    return publicUrl;
  } catch (e) {
    console.error("uploadIncidentMedia exception:", e);
    return null;
  }
}

/* ------------ RISK CLASSIFICATION (RULE-BASED) ------------ */

function classifyRisk(description) {
  if (!description) {
    return { level: "unknown", tags: "" };
  }

  const text = description.toLowerCase();
  const tags = [];
  let level = "low";

  const highKeywords = [
    "gun",
    "knife",
    "shots",
    "shooting",
    "stab",
    "stabbing",
    "bleeding a lot",
    "unconscious",
    "fire",
    "explosion",
    "armed",
    "hostage",
  ];
  const mediumKeywords = [
    "fight",
    "assault",
    "break in",
    "breaking in",
    "robbery",
    "theft",
    "car accident",
    "smoke",
  ];

  highKeywords.forEach((kw) => {
    if (text.includes(kw)) {
      level = "high";
      tags.push(kw);
    }
  });

  if (level !== "high") {
    mediumKeywords.forEach((kw) => {
      if (text.includes(kw)) {
        if (level === "low") level = "medium";
        tags.push(kw);
      }
    });
  }

  if (text.includes("child") || text.includes("baby")) {
    if (level === "low") level = "medium";
    tags.push("child");
  }

  return { level, tags: tags.join(", ") };
}

/* ------------ VOICE NOTE RECORDING ------------ */

function initVoiceRecordingControls() {
  const btnStart = document.getElementById("startRecording");
  const btnStop = document.getElementById("stopRecording");
  const audioPreview = document.getElementById("voicePreview");
  const transcriptEl = document.getElementById("voiceTranscript");

  if (!btnStart || !btnStop || !audioPreview) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    btnStart.disabled = true;
    if (transcriptEl) {
      transcriptEl.textContent =
        "Voice recording not supported in this browser.";
    }
    return;
  }

  btnStart.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        pendingVoiceBlob = blob;
        const url = URL.createObjectURL(blob);
        audioPreview.src = url;
        audioPreview.style.display = "block";
        if (transcriptEl) {
          transcriptEl.textContent =
            "Voice note recorded. It will be attached to your next incident.";
        }
      };

      mediaRecorder.start();
      btnStart.style.display = "none";
      btnStop.style.display = "inline-flex";
      if (transcriptEl) {
        transcriptEl.textContent = "Recording… speak clearly.";
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      if (transcriptEl) {
        transcriptEl.textContent = "Could not access microphone.";
      }
    }
  });

  btnStop.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    btnStart.style.display = "inline-flex";
    btnStop.style.display = "none";
  });
}

/* ------------ CAMERA CONTROLS (CITIZEN) ------------ */

function initCameraControls() {
  const openCameraBtn = document.getElementById("openCameraBtn");
  const cameraPreview = document.getElementById("cameraPreview");
  const capturePhotoBtn = document.getElementById("capturePhotoBtn");
  const mediaInput = document.getElementById("incidentMediaFile");
  const mediaInfo = document.getElementById("mediaSelectedInfo");

  if (!openCameraBtn || !cameraPreview || !capturePhotoBtn || !mediaInput) {
    return;
  }

  // Open camera / request stream
  openCameraBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera is not supported in this browser or device.");
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      cameraPreview.srcObject = cameraStream;
      cameraPreview.style.display = "block";
      capturePhotoBtn.style.display = "inline-flex";

      if (mediaInfo) {
        mediaInfo.textContent =
          "Camera active. Tap 'Capture Photo' to take a snapshot.";
      }
    } catch (err) {
      console.error("Error opening camera:", err);
      alert("Could not access camera.");
    }
  });

  // Capture frame into <input type="file">
  capturePhotoBtn.addEventListener("click", () => {
    if (!cameraStream) return;

    const track = cameraStream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width || 640;
    const height = settings.height || 480;

    const canvas = document.getElementById("cameraCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(cameraPreview, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const dt = new DataTransfer();
        dt.items.add(file);
        mediaInput.files = dt.files;

        if (mediaInfo) {
          mediaInfo.textContent =
            "Photo captured. It will be uploaded with your next incident.";
        }
      },
      "image/jpeg",
      0.9
    );
  });

  // Also show message if user picks a file manually
  mediaInput.addEventListener("change", () => {
    if (mediaInput.files && mediaInput.files[0]) {
      if (mediaInfo) {
        mediaInfo.textContent =
          "Media selected. It will be uploaded with your next incident.";
      }
    } else if (mediaInfo) {
      mediaInfo.textContent = "";
    }
  });
}

async function uploadVoiceNote(blob, incidentId, userId) {
  if (!blob || !incidentId || !userId) return;

  const filePath = `${userId}/incident-${incidentId}-${Date.now()}.webm`;

  const { data, error } = await civicSupabase.storage
    .from("incident-voice")
    .upload(filePath, blob, {
      contentType: "audio/webm",
      upsert: false,
    });

  if (error) {
    console.error("Error uploading voice note:", error);
    return;
  }

  const { data: publicData } = civicSupabase.storage
    .from("incident-voice")
    .getPublicUrl(filePath);

  const publicUrl = publicData?.publicUrl || null;
  if (!publicUrl) return;

  const { error: updateError } = await civicSupabase
    .from("incidents")
    .update({ voice_url: publicUrl })
    .eq("id", incidentId);

  if (updateError) {
    console.error("Error saving voice_url:", updateError);
  }
}

/* ------------ LIVE GPS SHARING (RESPONDERS) ------------ */

async function startSharingLocation() {
  const authUser = await getAuthUser();
  if (!authUser) {
    alert("Session expired. Please log in again.");
    window.location.href = "login.html";
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolocation not supported on this device.");
    return;
  }

  if (gpsWatchId) {
    console.log("GPS sharing already active.");
    return;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const { error } = await civicSupabase
        .from("responder_locations")
        .upsert(
          {
            responder_id: authUser.id,
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "responder_id" }
        );

      if (error) console.error("Error saving responder location:", error);
    },
    (err) => {
      console.warn("Geolocation error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 5000,
    }
  );
}

function stopSharingLocation() {
  if (gpsWatchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsWatchId);
  }
  gpsWatchId = null;
}

async function loadResponderLocations() {
  const { data, error } = await civicSupabase
    .from("responder_locations")
    .select("responder_id, latitude, longitude, updated_at");

  if (error) {
    console.error("Error loading responder locations:", error);
    return [];
  }
  return data || [];
}

function clearResponderMarkers() {
  responderMarkers.forEach((m) => {
    if (responderMap) responderMap.removeLayer(m);
  });
  responderMarkers = [];
}

function clearLiveResponderMarkers() {
  liveResponderMarkers.forEach((m) => {
    if (responderMap) responderMap.removeLayer(m);
  });
  liveResponderMarkers = [];
}

async function updateLiveResponderMarkers() {
  if (!responderMap) return;
  const locations = await loadResponderLocations();
  clearLiveResponderMarkers();

  locations.forEach((loc) => {
    if (!loc.latitude || !loc.longitude) return;
    const marker = L.circleMarker([loc.latitude, loc.longitude], {
      radius: 7,
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 0.9,
    }).addTo(responderMap);

    marker.bindPopup(
      `<strong>Responder</strong><br>Last update: ${new Date(
        loc.updated_at
      ).toLocaleTimeString()}`
    );

    liveResponderMarkers.push(marker);
  });
}
function clearDispatcherIncidentMarkers() {
  dispatcherIncidentMarkers.forEach((m) => {
    if (dispatcherMap) dispatcherMap.removeLayer(m);
  });
  dispatcherIncidentMarkers = [];
}

function clearDispatcherResponderMarkers() {
  dispatcherResponderMarkers.forEach((m) => {
    if (dispatcherMap) dispatcherMap.removeLayer(m);
  });
  dispatcherResponderMarkers = [];
}

async function updateDispatcherResponderMarkers() {
  if (!dispatcherMap) return;
  const locations = await loadResponderLocations();

  clearDispatcherResponderMarkers();

  const { data: users, error } = await civicSupabase
    .from("users")
    .select("id, full_name, responder_status")
    .in(
      "id",
      locations.map((l) => l.responder_id)
    );

  if (error) {
    console.error("Error loading responder profiles:", error);
    return;
  }

  locations.forEach((loc) => {
    if (!loc.latitude || !loc.longitude) return;
    const u = users.find((x) => x.id === loc.responder_id);
    const status = u?.responder_status || "available";
    let color = "#22c55e"; // green
    if (status === "busy") color = "#eab308"; // yellow
    if (status === "offline") color = "#4b5563"; // gray

    const marker = L.circleMarker([loc.latitude, loc.longitude], {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(dispatcherMap);

    marker.bindPopup(
      `<strong>${u?.full_name || "Responder"}</strong><br>Status: ${status || "unknown"
      }<br>Last update: ${new Date(loc.updated_at).toLocaleTimeString()}`
    );

    dispatcherResponderMarkers.push(marker);
  });
}

/* ------------ SPEED DIAL (CITIZEN) ------------ */
/* Uses assigned_responder_phone if available, otherwise falls back to responder_phone */

function setupSpeedDialForIncident(incident) {
  if (!speedDialBtn || !incident) return;

  const phone =
    incident.assigned_responder_phone || incident.responder_phone || null;
  const name = incident.assigned_responder_name || incident.responder_name || "";

  if (phone) {
    speedDialBtn.style.display = "block";
    speedDialBtn.textContent = name
      ? `📞 Call ${name}`
      : "📞 Call Responder";

    speedDialBtn.onclick = () => {
      window.location.href = `tel:${phone}`;
    };
  } else {
    // No phone number at all – hide the button
    speedDialBtn.style.display = "none";
  }
}
``

/* ------------ CAMERA CONTROLS (CITIZEN) ------------ */

function initCameraControls() {
  const openCameraBtn = document.getElementById("openCameraBtn");
  const cameraPreview = document.getElementById("cameraPreview");
  const capturePhotoBtn = document.getElementById("capturePhotoBtn");
  const mediaInput = document.getElementById("incidentMediaFile");
  const mediaInfo = document.getElementById("mediaSelectedInfo");

  if (!openCameraBtn || !cameraPreview || !capturePhotoBtn || !mediaInput) {
    return;
  }

  // Open camera / request stream
  openCameraBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera is not supported in this browser or device.");
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      cameraPreview.srcObject = cameraStream;
      cameraPreview.style.display = "block";
      capturePhotoBtn.style.display = "inline-flex";

      if (mediaInfo) {
        mediaInfo.textContent =
          "Camera active. Tap 'Capture Photo' to take a snapshot.";
      }
    } catch (err) {
      console.error("Error opening camera:", err);
      alert("Could not access camera.");
    }
  });

  // Capture frame into <input type="file">
  capturePhotoBtn.addEventListener("click", () => {
    if (!cameraStream) return;

    const track = cameraStream.getVideoTracks()[0];
    const settings = track.getSettings();
    const width = settings.width || 640;
    const height = settings.height || 480;

    const canvas = document.getElementById("cameraCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(cameraPreview, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const dt = new DataTransfer();
        dt.items.add(file);
        mediaInput.files = dt.files;

        if (mediaInfo) {
          mediaInfo.textContent =
            "Photo captured. It will be uploaded with your next incident.";
        }
      },
      "image/jpeg",
      0.9
    );
  });

  // Show info when user picks a file manually
  mediaInput.addEventListener("change", () => {
    if (mediaInput.files && mediaInput.files[0]) {
      if (mediaInfo) {
        mediaInfo.textContent =
          "Media selected. It will be uploaded with your next incident.";
      }
    } else if (mediaInfo) {
      mediaInfo.textContent = "";
    }
  });
}

/* ------------ EMERGENCY HANDLER (uses DB trigger for auto-assign) ------------ */

async function handleEmergency(type, statusEl, listContainer) {
  if (!statusEl) return;

  // 1) Risk classification from free-text
  const riskDescriptionEl = document.getElementById("riskDescription");
  const riskAssessmentEl = document.getElementById("riskAssessment");
  const riskText = riskDescriptionEl ? riskDescriptionEl.value.trim() : "";
  const riskResult = classifyRisk(riskText);

  if (riskAssessmentEl) {
    if (riskResult.level === "unknown") {
      riskAssessmentEl.textContent = "Risk: N/A";
      riskAssessmentEl.style.color = "#94a3b8";
    } else {
      riskAssessmentEl.textContent =
        "Risk: " +
        riskResult.level.toUpperCase() +
        (riskResult.tags ? " (" + riskResult.tags + ")" : "");
      riskAssessmentEl.style.color =
        riskResult.level === "high"
          ? "#f97316"
          : riskResult.level === "medium"
            ? "#eab308"
            : "#22c55e";
    }
  }

  // 2) Decide incident label + fallback call number
  let label, fallbackNumber;
  if (type === "ambulance") {
    label = "Ambulance / Medical";
    fallbackNumber = "112";
  } else if (type === "police") {
    label = "Police / Crime";
    fallbackNumber = "10111";
  } else if (type === "fire") {
    label = "Fire & Rescue";
    fallbackNumber = "10177";
  } else {
    label = "Security / Other";
    fallbackNumber = SECURITY[0].phone;
  }

  // 3) Ensure geolocation support
  if (!navigator.geolocation) {
    statusEl.textContent =
      "Location access not supported in this browser. Logging incident without GPS…";

    await createIncidentWithoutGps(
      label,
      fallbackNumber,
      riskResult,
      listContainer
    );
    return;
  }

  statusEl.textContent = "Getting your location…";

  navigator.geolocation.getCurrentPosition(
    // SUCCESS
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

      statusEl.innerHTML = `
        <strong>${label}</strong><br>
        Calling primary emergency line: ${fallbackNumber}<br>
        <a href="${mapsLink}" target="_blank">Open my location in Google Maps</a>
      `;

      // Immediately trigger normal emergency call (112/10111/10177/…)
      window.location.href = `tel:${fallbackNumber}`;

      const authUser = await getAuthUser();
      if (!authUser) return;

      // 4) Insert incident – DB trigger will auto-assign nearest responder
      const { data: incident, error: insertError } = await civicSupabase
        .from("incidents")
        .insert({
          user_id: authUser.id,
          incident_type: label,
          latitude: lat,
          longitude: lng,
          status: "open",
          risk_level: riskResult.level,
          risk_tags: riskResult.tags,
        })
        .select()
        .single();

      if (insertError || !incident) {
        console.error("Incident insert error:", insertError);
        return;
      }

      // 5) Handle media uploads (image/video)
      const mediaInput = document.getElementById("incidentMediaFile");
      const file =
        mediaInput && mediaInput.files ? mediaInput.files[0] : null;

      if (file) {
        await uploadIncidentMedia(file, incident.id, authUser.id);
        mediaInput.value = "";
      }

      // 6) Voice note, if any
      if (pendingVoiceBlob) {
        await uploadVoiceNote(pendingVoiceBlob, incident.id, authUser.id);
        pendingVoiceBlob = null;
      }

      // 7) Refresh citizen incident list
      const updated = await fetchIncidents();
      renderIncidentsList(listContainer, updated);

      // 8) NEW: setup speed dial to assigned responder (if DB trigger found one)
      setupSpeedDialForIncident(incident);
    },

    // ERROR: GPS failed / denied – still create incident without coords
    async (err) => {
      console.warn("Geolocation error:", err);
      statusEl.textContent =
        "Location failed: " +
        err.message +
        ". Logging incident without GPS…";

      await createIncidentWithoutGps(
        label,
        fallbackNumber,
        riskResult,
        listContainer
      );
    }
  );
}

// Helper used when we don't have coordinates
async function createIncidentWithoutGps(
  label,
  fallbackNumber,
  riskResult,
  listContainer
) {
  const authUser = await getAuthUser();
  if (!authUser) return;

  const { data: incident, error: insertError } = await civicSupabase
    .from("incidents")
    .insert({
      user_id: authUser.id,
      incident_type: label,
      latitude: null,
      longitude: null,
      responder_name: "Unknown (GPS denied)",
      responder_phone: fallbackNumber,
      status: "open",
      risk_level: riskResult.level,
      risk_tags: riskResult.tags,
    })
    .select()
    .single();

  if (insertError || !incident) {
    console.error("Incident insert (no GPS) error:", insertError);
    return;
  }

  const mediaInput = document.getElementById("incidentMediaFile");
  const file =
    mediaInput && mediaInput.files ? mediaInput.files[0] : null;

  if (file) {
    await uploadIncidentMedia(file, incident.id, authUser.id);
    mediaInput.value = "";
  }

  if (pendingVoiceBlob) {
    await uploadVoiceNote(pendingVoiceBlob, incident.id, authUser.id);
    pendingVoiceBlob = null;
  }

  const updated = await fetchIncidents();
  renderIncidentsList(listContainer, updated);

  // No coordinates => DB trigger will not auto-assign, so hide speed dial
  setupSpeedDialForIncident(incident);
}

/* ------------ RESPONDER MAP & TABLE ------------ */

function initResponderMap() {
  const mapContainer = document.getElementById("responderMap");
  if (!mapContainer || typeof L === "undefined") return;

  responderMap = L.map("responderMap").setView([-28.5, 24.7], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(responderMap);
}

function addResponderMarkers(incidents) {
  if (!responderMap || !incidents) return;
  clearResponderMarkers();

  incidents.forEach((i) => {
    if (!i.latitude || !i.longitude) return;
    const marker = L.marker([i.latitude, i.longitude]).addTo(responderMap);
    marker.bindPopup(
      `<strong>${i.incident_type}</strong><br>${new Date(
        i.timestamp
      ).toLocaleString()}`
    );
    responderMarkers.push(marker);
  });

  if (responderMarkers.length > 0) {
    const group = L.featureGroup(responderMarkers);
    responderMap.fitBounds(group.getBounds().pad(0.3));
  }
}

function statusPill(status) {
  const cls =
    status === "resolved"
      ? "status-resolved"
      : status === "in_progress"
        ? "status-in_progress"
        : "status-open";
  const label =
    status === "resolved"
      ? "Resolved"
      : status === "in_progress"
        ? "In Progress"
        : "Open";
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function renderDispatcherIncidents(container, incidents) {
  if (!container) return;

  if (!incidents || incidents.length === 0) {
    container.innerHTML =
      '<p style="color:#94a3b8;">No incidents found for the selected filters.</p>';
    clearDispatcherIncidentMarkers();
    return;
  }

  // Stats
  const statOpen = document.getElementById("dStatOpen");
  const statInProgress = document.getElementById("dStatInProgress");
  const statResolved = document.getElementById("dStatResolved");

  if (statOpen && statInProgress && statResolved) {
    statOpen.textContent = incidents.filter((i) => i.status === "open").length;
    statInProgress.textContent = incidents.filter(
      (i) => i.status === "in_progress"
    ).length;
    statResolved.textContent = incidents.filter(
      (i) => i.status === "resolved"
    ).length;
  }

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Citizen</th>
          <th>Location</th>
          <th>Risk</th>
          <th>Assigned</th>
          <th>Status / Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  incidents.forEach((i) => {
    const time = new Date(i.timestamp).toLocaleString();
    const citizenName = i.users?.full_name || "Unknown";
    const citizenPhone = i.users?.phone || "";
    const locHref =
      i.latitude && i.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${i.latitude},${i.longitude}`
        : "";
    const isAssigned = !!i.assigned_responder_id;

    let assignOptionsHtml = '<option value="">Assign…</option>';
    allResponders.forEach((r) => {
      assignOptionsHtml += `<option value="${r.id}">${r.full_name || "Responder"
        }${r.phone ? " (" + r.phone + ")" : ""}</option>`;
    });

    html += `
      <tr class="dispatcher-inc-row"
          data-incident-id="${i.id}"
          data-lat="${i.latitude || ""}"
          data-lng="${i.longitude || ""}"
          data-incident-type="${i.incident_type || ""}">
        <td>${time}</td>
        <td>${i.incident_type || ""}</td>
        <td>${citizenName}<br><span style="color:#64748b;">${citizenPhone}</span></td>
        <td>
          ${locHref
        ? `<a href="${locHref}" target="_blank">Navigate</a>`
        : "—"
      }
        </td>
        <td>
          ${i.risk_level
        ? `<span style="font-size:0.8rem;">${i.risk_level.toUpperCase()}</span><br>
                 <span style="font-size:0.7rem; color:#94a3b8;">${i.risk_tags || ""
        }</span>`
        : "—"
      }
        </td>
        <td>
          ${isAssigned
        ? `${i.assigned_responder_name || "Responder"}<br><span style="color:#94a3b8; font-size:0.75rem;">${i.assigned_responder_phone || ""
        }</span>`
        : '<span style="color:#f97316; font-size:0.8rem;">Unassigned</span>'
      }
        </td>
        <td>
          ${statusPill(i.status || "open")}<br>
          <select onchange="window.updateIncidentStatus('${i.id}', this.value)"
            style="margin-top:0.25rem; font-size:0.75rem; padding:0.2rem 0.4rem; border-radius:999px; border:1px solid #1e293b; background:#020617; color:#e2e8f0;">
            <option value="">Change…</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <br>
          <select onchange="window.assignIncidentToResponder('${i.id}', this.value)"
            style="margin-top:0.25rem; font-size:0.75rem; padding:0.2rem 0.4rem; border-radius:999px; border:1px solid #1e293b; background:#020617; color:#e2e8f0;">
            ${assignOptionsHtml}
          </select>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Map markers
  if (dispatcherMap) {
    clearDispatcherIncidentMarkers();
    incidents.forEach((i) => {
      if (!i.latitude || !i.longitude) return;
      const marker = L.marker([i.latitude, i.longitude], {
        icon: L.divIcon({
          className: "",
          html: "🔴",
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        }),
      }).addTo(dispatcherMap);

      marker.bindPopup(
        `<strong>${i.incident_type || "Incident"}</strong><br>${new Date(
          i.timestamp
        ).toLocaleString()}`
      );

      dispatcherIncidentMarkers.push(marker);
    });

    if (dispatcherIncidentMarkers.length > 0) {
      const group = L.featureGroup(dispatcherIncidentMarkers);
      dispatcherMap.fitBounds(group.getBounds().pad(0.3));
    }
  }

  // Row click => focus, details, chat
  const rows = container.querySelectorAll("tr[data-incident-id]");
  rows.forEach((row) => {
    row.addEventListener("click", async () => {
      const incidentId = row.getAttribute("data-incident-id");
      const lat = parseFloat(row.getAttribute("data-lat"));
      const lng = parseFloat(row.getAttribute("data-lng"));
      const type = row.getAttribute("data-incident-type") || "";

      if (dispatcherMap && lat && lng) {
        dispatcherMap.setView([lat, lng], 14);
      }

      // Load incident details
      const { data, error } = await civicSupabase
        .from("incidents")
        .select("*, users!inner(full_name, phone)")
        .eq("id", incidentId)
        .single();

      if (!error && data) {
        renderDispatcherIncidentDetails(data);
      }

      // Setup chat
      currentDispatcherIncidentId = incidentId;
      const auth = await getAuthUser();
      if (!auth) return;

      const msgs = await fetchIncidentMessages(incidentId);
      renderChatMessages(
        document.getElementById("dispatcherChatMessages"),
        msgs,
        auth.id
      );

      const labelEl = document.getElementById("dispatcherChatIncidentLabel");
      if (labelEl) {
        labelEl.textContent =
          "Chat for: " + (type || "Incident #" + incidentId);
      }

      subscribeToIncidentChat(incidentId, (newMsg) => {
        msgs.push(newMsg);
        renderChatMessages(
          document.getElementById("dispatcherChatMessages"),
          msgs,
          auth.id
        );
      });
    });
  });
}

function renderDispatcherIncidentDetails(incident) {
  const pane = document.getElementById("dIncidentDetails");
  if (!pane) return;

  const citizenName = incident.users?.full_name || "Unknown";
  const citizenPhone = incident.users?.phone || "";
  const time = incident.timestamp
    ? new Date(incident.timestamp).toLocaleString()
    : "Unknown";

  const locHref =
    incident.latitude && incident.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${incident.latitude},${incident.longitude}`
      : "";

  pane.innerHTML = `
    <div><strong>Type:</strong> ${incident.incident_type || ""}</div>
    <div><strong>Time:</strong> ${time}</div>
    <div><strong>Citizen:</strong> ${citizenName} <span style="color:#64748b;">${citizenPhone}</span></div>
    <div><strong>Status:</strong> ${incident.status || "open"}</div>
    <div><strong>Risk:</strong> ${incident.risk_level
      ? incident.risk_level.toUpperCase()
      : "N/A"
    } ${incident.risk_tags
      ? `<span style="color:#94a3b8; font-size:0.75rem;">(${incident.risk_tags})</span>`
      : ""
    }</div>
    <div><strong>Assigned:</strong> ${incident.assigned_responder_name
      ? `${incident.assigned_responder_name} <span style="color:#94a3b8; font-size:0.75rem;">${incident.assigned_responder_phone || ""
      }</span>`
      : "Unassigned"
    }</div>
    <div style="margin-top:0.4rem;">
      <strong>Location:</strong>
      ${locHref
      ? `<a href="${locHref}" target="_blank">Open in Google Maps</a>`
      : "Unknown / not shared"
    }
    </div>
    <div style="margin-top:0.4rem;">
      <strong>Media:</strong>
      ${incident.media_url
      ? `<a href="${incident.media_url}" target="_blank">View attachment</a>`
      : "None"
    }
      ${incident.voice_url
      ? `<br><a href="${incident.voice_url}" target="_blank">Play voice note</a>`
      : ""
    }
    </div>
  `;
}

function renderResponderIncidents(container, incidents) {
  if (!container) return;

  if (!incidents || incidents.length === 0) {
    container.innerHTML =
      '<p style="color:#94a3b8;">No incidents found for the selected filters.</p>';
    clearResponderMarkers();
    return;
  }

  // Stats
  const statOpen = document.getElementById("statOpen");
  const statInProgress = document.getElementById("statInProgress");
  const statResolved = document.getElementById("statResolved");

  if (statOpen && statInProgress && statResolved) {
    statOpen.textContent = incidents.filter((i) => i.status === "open").length;
    statInProgress.textContent = incidents.filter(
      (i) => i.status === "in_progress"
    ).length;
    statResolved.textContent = incidents.filter(
      (i) => i.status === "resolved"
    ).length;
  }

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Citizen</th>
          <th>Location</th>
          <th>Media</th>
          <th>Risk</th>
          <th>Status / Assign</th>
        </tr>
      </thead>
      <tbody>
  `;

  incidents.forEach((i) => {
    const time = new Date(i.timestamp).toLocaleString();
    const citizenName = i.users?.full_name || "Unknown";
    const citizenPhone = i.users?.phone || "";
    const locHref =
      i.latitude && i.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${i.latitude},${i.longitude}`
        : "";

    const isAssignedToMe =
      currentResponderUser &&
      i.assigned_responder_id === currentResponderUser.id;

    let assignOptionsHtml = '<option value="">Assign…</option>';
    allResponders.forEach((r) => {
      assignOptionsHtml += `<option value="${r.id}">${r.full_name || "Responder"
        }${r.phone ? " (" + r.phone + ")" : ""}</option>`;
    });

    html += `
      <tr class="incident-row ${isAssignedToMe ? "assigned-to-me" : ""}"
          data-incident-id="${i.id}"
          data-lat="${i.latitude || ""}"
          data-lng="${i.longitude || ""}"
          data-incident-type="${i.incident_type || ""}">
        <td>${time}</td>
        <td>${i.incident_type || ""}</td>
        <td>${citizenName}<br><span style="color:#64748b;">${citizenPhone}</span></td>
        <td>
          ${locHref
        ? `<a href="${locHref}" target="_blank">Navigate</a>`
        : "—"
      }
        </td>
        <td>
          ${i.media_url
        ? `<a href="${i.media_url}" target="_blank">View</a>`
        : "—"
      }
          ${i.voice_url
        ? `<br><a href="${i.voice_url}" target="_blank">Voice Note</a>`
        : ""
      }
        </td>
        <td>
          ${i.risk_level
        ? `<span style="font-size:0.8rem;">${i.risk_level.toUpperCase()}</span><br>
                 <span style="font-size:0.7rem; color:#94a3b8;">${i.risk_tags || ""}</span>`
        : "—"
      }
        </td>
        <td>
          ${statusPill(i.status || "open")}<br>
          <select onchange="window.updateIncidentStatus('${i.id}', this.value)"
            style="margin-top:0.25rem; font-size:0.75rem; padding:0.2rem 0.4rem; border-radius:999px; border:1px solid #1e293b; background:#020617; color:#e2e8f0;">
            <option value="">Change…</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          ${currentUserRole === "dispatcher"
        ? `
          <br>
          <select onchange="window.assignIncidentToResponder('${i.id}', this.value)"
            style="margin-top:0.25rem; font-size:0.75rem; padding:0.2rem 0.4rem; border-radius:999px; border:1px solid #1e293b; background:#020617; color:#e2e8f0;">
            ${assignOptionsHtml}
          </select>
          `
        : ""
      }
          <div style="font-size:0.7rem; color:#94a3b8; margin-top:0.15rem;">
            Assigned:
            ${i.assigned_responder_name
        ? i.assigned_responder_name
        : "Unassigned"
      }
            ${isAssignedToMe ? '<span class="badge-me">Me</span>' : ""}
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  addResponderMarkers(incidents);
  updateLiveResponderMarkers();

  const rows = container.querySelectorAll("tr[data-incident-id]");
  rows.forEach((row) => {
    row.addEventListener("click", async () => {
      const lat = parseFloat(row.getAttribute("data-lat"));
      const lng = parseFloat(row.getAttribute("data-lng"));
      if (responderMap && lat && lng) {
        responderMap.setView([lat, lng], 14);
      }

      const incidentId = row.getAttribute("data-incident-id");
      const incidentType = row.getAttribute("data-incident-type") || "";

      if (responderChatIncidentLabelEl && responderChatMessagesEl) {
        responderChatIncidentLabelEl.textContent =
          "Chat for: " +
          (incidentType || "Incident #" + incidentId);

        const auth = await getAuthUser();
        if (!auth) return;

        const messages = await fetchIncidentMessages(incidentId);
        renderChatMessages(
          responderChatMessagesEl,
          messages,
          auth.id
        );

        subscribeToIncidentChat(incidentId, (newMsg) => {
          messages.push(newMsg);
          renderChatMessages(
            responderChatMessagesEl,
            messages,
            auth.id
          );
        });
      }
    });
  });
}

window.updateIncidentStatus = async function (incidentId, newStatus) {
  if (!newStatus) return;
  try {
    const { error } = await civicSupabase
      .from("incidents")
      .update({ status: newStatus })
      .eq("id", incidentId);

    if (error) {
      console.error("updateIncidentStatus error:", error);
      alert("Could not update incident status.");
      return;
    }

    const container = document.getElementById("responderIncidents");
    if (container) {
      const typeFilter = document.getElementById("filterType")?.value || "";
      const statusFilter =
        document.getElementById("filterStatus")?.value || "";
      const incidents = await fetchAllIncidentsForResponder({
        type: typeFilter || null,
        status: statusFilter || null,
      });
      renderResponderIncidents(container, incidents);
    }
  } catch (err) {
    console.error(err);
  }
};

window.assignIncidentToResponder = async function (
  incidentId,
  responderId
) {
  if (!responderId) return;

  const resp = allResponders.find((r) => r.id === responderId);
  const assignedName = resp?.full_name || "Responder";
  const assignedPhone = resp?.phone || "";

  try {
    const { error } = await civicSupabase
      .from("incidents")
      .update({
        assigned_responder_id: responderId,
        assigned_responder_name: assignedName,
        assigned_responder_phone: assignedPhone,
      })
      .eq("id", incidentId);

    if (error) {
      console.error("assignIncidentToResponder error:", error);
      alert("Could not assign responder.");
      return;
    }

    const container = document.getElementById("responderIncidents");
    if (container) {
      const typeFilter = document.getElementById("filterType")?.value || "";
      const statusFilter =
        document.getElementById("filterStatus")?.value || "";
      const incidents = await fetchAllIncidentsForResponder({
        type: typeFilter || null,
        status: statusFilter || null,
      });
      renderResponderIncidents(container, incidents);
    }
  } catch (err) {
    console.error(err);
  }
};

/* ------------ CHAT (messages table) ------------ */

function subscribeToIncidentChat(incidentId, onNewMessage) {
  if (!incidentId) return;

  if (chatChannel) {
    civicSupabase.removeChannel(chatChannel);
    chatChannel = null;
  }

  currentChatIncidentId = incidentId;

  chatChannel = civicSupabase
    .channel("incident-chat-" + incidentId)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: "incident_id=eq." + incidentId,
      },
      (payload) => {
        if (onNewMessage) onNewMessage(payload.new);
      }
    )
    .subscribe((status) => {
      console.log("Chat channel status:", status);
    });
}

async function fetchIncidentMessages(incidentId) {
  if (!incidentId) return [];
  const { data, error } = await civicSupabase
    .from("messages")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchIncidentMessages error:", error);
    return [];
  }
  return data || [];
}

function renderChatMessages(container, messages, currentUserId) {
  if (!container) return;

  if (!messages || messages.length === 0) {
    container.innerHTML =
      '<div style="color:#64748b;">No messages yet. Start the conversation.</div>';
    return;
  }

  container.innerHTML = "";

  messages.forEach((m) => {
    const isMe = String(m.sender_id) === String(currentUserId);
    const align = isMe ? "flex-end" : "flex-start";
    const bg = isMe ? "#38bdf8" : "#020617";
    const color = isMe ? "#0b1120" : "#e2e8f0";
    const roleLabel =
      m.sender_role === "responder" ? "Responder" : "Citizen";
    const time = new Date(m.created_at).toLocaleTimeString();

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.justifyContent = align;
    wrapper.style.marginBottom = "0.25rem";

    wrapper.innerHTML = `
      <div style="max-width:75%; background:${bg}; color:${color}; padding:0.35rem 0.55rem; border-radius:10px; font-size:0.8rem;">
        <div style="font-size:0.7rem; opacity:0.8; margin-bottom:0.1rem;">
          ${roleLabel} • ${time}
        </div>
        <div>${m.content}</div>
      </div>
    `;

    container.appendChild(wrapper);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(incidentId, text, senderRole) {
  if (!incidentId || !text) return;
  const authUser = await getAuthUser();
  if (!authUser) {
    alert("Session expired. Please log in again.");
    window.location.href = "login.html";
    return;
  }

  const { error } = await civicSupabase.from("messages").insert({
    incident_id: incidentId,
    sender_id: authUser.id,
    sender_role: senderRole,
    content: text.trim(),
  });

  if (error) {
    console.error("sendChatMessage error:", error);
  }
}
async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported");
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array("YOUR_PUBLIC_VAPID_KEY")
  });

  const authUser = await getAuthUser();
  if (!authUser) return;

  await civicSupabase.from("push_subscriptions").insert({
    user_id: authUser.id,
    endpoint: sub.endpoint,
    expiration_time: sub.expirationTime,
    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))),
    auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth"))))
  });
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/* ------------ MAIN DOM LOGIC ------------ */

document.addEventListener("DOMContentLoaded", () => {
  setYear();

  // UI refs
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const logoutLinks = document.querySelectorAll("[data-logout]");

  const dashboardWelcome = document.getElementById("dashboardWelcome");
  const incidentList = document.getElementById("incidentList");
  const appointmentList = document.getElementById("appointmentList");
  const emergencyButtons = document.querySelectorAll(".emergency-btn");
  const emergencyStatus = document.getElementById("emergencyStatus");
  const appointmentForm = document.getElementById("appointmentForm");

  const profileForm = document.getElementById("profileForm");
  const profileNameDisplay = document.getElementById("profileNameDisplay");
  const profileEmailDisplay = document.getElementById("profileEmailDisplay");
  const profilePhone = document.getElementById("profilePhone");
  const profileAddress = document.getElementById("profileAddress");
  const profileMedical = document.getElementById("profileMedical");
  const profileEmergencyName = document.getElementById(
    "profileEmergencyName"
  );
  const profileEmergencyPhone = document.getElementById(
    "profileEmergencyPhone"
  );
  const profileMessage = document.getElementById("profileMessage");

  const responderWelcome = document.getElementById("responderWelcome");
  const responderIncidentsContainer =
    document.getElementById("responderIncidents");
  const filterType = document.getElementById("filterType");
  const filterStatus = document.getElementById("filterStatus");
  const refreshIncidentsBtn = document.getElementById(
    "refreshIncidentsBtn"
  );

  citizenChatIncidentSelectEl = document.getElementById(
    "citizenChatIncidentSelect"
  );
  citizenChatMessagesEl = document.getElementById("citizenChatMessages");
  citizenChatFormEl = document.getElementById("citizenChatForm");
  citizenChatInputEl = document.getElementById("citizenChatInput");

  responderChatIncidentLabelEl = document.getElementById(
    "responderChatIncidentLabel"
  );
  responderChatMessagesEl = document.getElementById(
    "responderChatMessages"
  );
  responderChatFormEl = document.getElementById("responderChatForm");
  responderChatInputEl = document.getElementById("responderChatInput");

  const navToggle = document.getElementById("navToggle");
  const navMobile = document.getElementById("navMobile");

  const btnStartShare = document.getElementById("startLocationSharing");
  const btnStopShare = document.getElementById("stopLocationSharing");

  // 🔥 NEW: speed dial button on citizen dashboard
  speedDialBtn = document.getElementById("speedDialBtn");

  // Nav toggle
  if (navToggle && navMobile) {
    navToggle.addEventListener("click", () => {
      navMobile.classList.toggle("nav-mobile-open");
    });
  }

  // Request Notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch((err) =>
      console.warn("Notification permission error:", err)
    );
  }
  if ("serviceWorker" in navigator && "PushManager" in window) {
    navigator.serviceWorker.register("service-worker.js").then(() => {
      console.log("Service worker registered for push");
    });
  }

  // LOGOUT
  logoutLinks.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await civicSupabase.auth.signOut();
      window.location.href = "login.html";
    });
  });

  // REGISTER
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("registerMessage");

      const full_name =
        document.getElementById("regFullName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const phone = document.getElementById("regPhone").value.trim();
      const address =
        document.getElementById("regAddress").value.trim();
      const medical_info =
        document.getElementById("regMedical").value.trim();
      const emergency_contact_name =
        document
          .getElementById("regEmergencyContactName")
          .value.trim();
      const emergency_contact_phone =
        document
          .getElementById("regEmergencyContactPhone")
          .value.trim();
      const password = document.getElementById("regPassword").value;

      msg.textContent = "Creating your account...";
      msg.style.color = "#38bdf8";

      const { data, error } = await civicSupabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        msg.textContent = error.message;
        msg.style.color = "orange";
        return;
      }

      if (!data.user) {
        msg.textContent =
          "Account created. Please check your email to confirm before logging in.";
        msg.style.color = "#22c55e";
        return;
      }

      const user = data.user;
      const { error: profileError } = await civicSupabase
        .from("users")
        .insert({
          id: user.id,
          full_name,
          email,
          phone,
          address,
          medical_info,
          emergency_contact_name,
          emergency_contact_phone,
          user_role: "citizen",
        });

      if (profileError) {
        console.error("Profile insert error:", profileError);
        msg.textContent =
          "Account created but failed to save profile. Please try again.";
        msg.style.color = "orange";
        return;
      }

      msg.textContent = "Account created! Redirecting…";
      msg.style.color = "#22c55e";
      setTimeout(() => {
        window.location.href = "app.html";
      }, 800);
    });
  }

  // LOGIN
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password =
        document.getElementById("loginPassword").value;
      const msg = document.getElementById("loginMessage");

      msg.textContent = "Checking credentials...";
      msg.style.color = "#38bdf8";

      const { data, error } =
        await civicSupabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        msg.textContent = error.message;
        msg.style.color = "orange";
        return;
      }

      msg.textContent = "Success! Redirecting…";
      msg.style.color = "#22c55e";
      setTimeout(() => {
        window.location.href = "app.html";
      }, 600);
    });
  }

  // SHOW/HIDE RESPONDER LINK
  (async () => {
    const responderLink = document.getElementById("responderLink");
    const responderLinkMobile =
      document.getElementById("responderLinkMobile");
    if (!responderLink && !responderLinkMobile) return;

    const profile = await getUserProfile();
    if (profile && profile.user_role === "responder") {
      if (responderLink) responderLink.style.display = "inline-flex";
      if (responderLinkMobile)
        responderLinkMobile.style.display = "block";
    }
  })();

  // CITIZEN DASHBOARD
  if (dashboardWelcome) {
    (async () => {
      const auth = await getAuthUser();
      if (!auth) {
        window.location.href = "login.html";
        return;
      }

      const profile = await getUserProfile();
      const firstName =
        (profile &&
          profile.full_name &&
          profile.full_name.split(" ")[0]) ||
        "User";

      dashboardWelcome.textContent = "Hi, " + firstName;

      // Load incidents for this citizen
      const incidents = await fetchIncidents();
      renderIncidentsList(incidentList, incidents);

      // Populate citizen chat incident dropdown
      if (citizenChatIncidentSelectEl) {
        citizenChatIncidentSelectEl.innerHTML =
          '<option value="">Select an incident…</option>';
        incidents.forEach((i) => {
          const opt = document.createElement("option");
          opt.value = i.id;
          const time = new Date(i.timestamp).toLocaleString();
          opt.textContent = `${i.incident_type} • ${time}`;
          citizenChatIncidentSelectEl.appendChild(opt);
        });
      }

      // Load appointments
      const appointments = await fetchAppointments();
      renderAppointments(appointmentList, appointments);

      // 🔊 Voice notes
      initVoiceRecordingControls();

      // 📷 Camera + media controls (NEW)
      initCameraControls();
    })();
  }

  // EMERGENCY BUTTONS
  if (emergencyButtons && emergencyStatus) {
    emergencyButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        handleEmergency(type, emergencyStatus, incidentList);
      });
    });
  }

  // APPOINTMENTS
  if (appointmentForm) {
    appointmentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const facility =
        document.getElementById("apptFacility").value.trim();
      const date = document.getElementById("apptDate").value;
      const time = document.getElementById("apptTime").value;
      const notes =
        document.getElementById("apptNotes").value.trim();

      const auth = await getAuthUser();
      if (!auth) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
      }

      const { error } = await civicSupabase
        .from("appointments")
        .insert({
          user_id: auth.id,
          facility,
          appointment_date: date,
          appointment_time: time,
          notes,
        });

      if (error) {
        console.error("Appointment insert error:", error);
        alert("Could not save appointment. Try again.");
        return;
      }

      const updated = await fetchAppointments();
      renderAppointments(appointmentList, updated);
      appointmentForm.reset();
    });
  }

  // CITIZEN CHAT
  if (
    citizenChatIncidentSelectEl &&
    citizenChatMessagesEl &&
    citizenChatFormEl
  ) {
    citizenChatIncidentSelectEl.addEventListener("change", async () => {
      const incidentId = citizenChatIncidentSelectEl.value;
      const auth = await getAuthUser();
      if (!incidentId || !auth) {
        citizenChatMessagesEl.innerHTML =
          '<div style="color:#64748b;">No incident selected.</div>';
        return;
      }

      const messages = await fetchIncidentMessages(incidentId);
      renderChatMessages(citizenChatMessagesEl, messages, auth.id);

      subscribeToIncidentChat(incidentId, (newMsg) => {
        messages.push(newMsg);
        renderChatMessages(
          citizenChatMessagesEl,
          messages,
          auth.id
        );
      });
    });

    citizenChatFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = citizenChatInputEl.value.trim();
      const incidentId = citizenChatIncidentSelectEl.value;
      if (!incidentId) {
        alert("Select an incident first.");
        return;
      }
      if (!text) return;

      await sendChatMessage(incidentId, text, "citizen");
      citizenChatInputEl.value = "";
    });
  }

  // PROFILE PAGE
  if (profileForm) {
    (async () => {
      const auth = await getAuthUser();
      if (!auth) {
        window.location.href = "login.html";
        return;
      }

      const profile = await getUserProfile();
      if (profile) {
        if (profileNameDisplay)
          profileNameDisplay.textContent =
            profile.full_name || "";
        if (profileEmailDisplay)
          profileEmailDisplay.textContent =
            profile.email || "";

        if (profilePhone) profilePhone.value = profile.phone || "";
        if (profileAddress)
          profileAddress.value = profile.address || "";
        if (profileMedical)
          profileMedical.value = profile.medical_info || "";
        if (profileEmergencyName)
          profileEmergencyName.value =
            profile.emergency_contact_name || "";
        if (profileEmergencyPhone)
          profileEmergencyPhone.value =
            profile.emergency_contact_phone || "";
      }
    })();

    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!profileMessage) return;

      profileMessage.textContent = "Saving changes...";
      profileMessage.style.color = "#38bdf8";

      const auth = await getAuthUser();
      if (!auth) {
        profileMessage.textContent =
          "Session expired. Please log in again.";
        profileMessage.style.color = "orange";
        setTimeout(
          () => (window.location.href = "login.html"),
          800
        );
        return;
      }

      const updates = {
        phone: profilePhone ? profilePhone.value.trim() : null,
        address: profileAddress
          ? profileAddress.value.trim()
          : null,
        medical_info: profileMedical
          ? profileMedical.value.trim()
          : null,
        emergency_contact_name: profileEmergencyName
          ? profileEmergencyName.value.trim()
          : null,
        emergency_contact_phone: profileEmergencyPhone
          ? profileEmergencyPhone.value.trim()
          : null,
      };

      const { error } = await civicSupabase
        .from("users")
        .update(updates)
        .eq("id", auth.id);

      if (error) {
        console.error("Profile update error:", error);
        profileMessage.textContent =
          "Could not save changes. Please try again.";
        profileMessage.style.color = "orange";
        return;
      }

      profileMessage.textContent = "Profile updated successfully.";
      profileMessage.style.color = "#22c55e";
    });
  }

  // RESET PASSWORD
  const resetForm = document.getElementById("resetForm");
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("resetMessage");
      const email =
        document.getElementById("resetEmail").value.trim();

      msg.textContent = "Sending reset email...";
      msg.style.color = "#38bdf8";

      const { error } =
        await civicSupabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            window.location.origin +
            "/bab-civic-connect/update-password.html",
        });

      if (error) {
        msg.textContent = error.message;
        msg.style.color = "orange";
        return;
      }

      msg.textContent = "Reset link sent! Check your email.";
      msg.style.color = "#22c55e";
    });
  }

  // UPDATE PASSWORD
  const updatePasswordForm =
    document.getElementById("updatePasswordForm");
  if (updatePasswordForm) {
    updatePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg =
        document.getElementById("updatePasswordMessage");
      const newPass =
        document.getElementById("newPassword").value.trim();

      msg.textContent = "Updating password...";
      msg.style.color = "#38bdf8";

      const { error } = await civicSupabase.auth.updateUser({
        password: newPass,
      });

      if (error) {
        msg.textContent = error.message;
        msg.style.color = "orange";
        return;
      }

      msg.textContent = "Password updated successfully!";
      msg.style.color = "#22c55e";
    });
  }

  // RESPONDERS DASHBOARD
  if (responderIncidentsContainer) {
    (async () => {
      const auth = await getAuthUser();
      if (!auth) {
        window.location.href = "login.html";
        return;
      }

      const profile = await getUserProfile();
      currentResponderUser = auth; // remember current responder auth user

      if (
        !profile ||
        (profile.user_role !== "responder" &&
          profile.user_role !== "dispatcher")
      ) {
        alert("Access denied. You are not a responder.");
        window.location.href = "app.html";
        return;
      }

      currentUserRole = profile.user_role;

      if (currentUserRole === "dispatcher") {
        allResponders = await loadRespondersList();
      } else if (currentUserRole === "responder") {
        allResponders = [profile];
      }

      if (responderWelcome) {
        const firstName =
          (profile.full_name &&
            profile.full_name.split(" ")[0]) ||
          "Responder";
        responderWelcome.textContent = "Hi, " + firstName;
      }

      initResponderMap();

      const incidents =
        await fetchAllIncidentsForResponder({});
      renderResponderIncidents(
        responderIncidentsContainer,
        incidents
      );

      initRealtimeIncidentsResponder();
      updateLiveResponderMarkers();
    })();

    if (filterType || filterStatus || refreshIncidentsBtn) {
      const reloadWithFilters = async () => {
        const typeVal = filterType?.value || "";
        const statusVal = filterStatus?.value || "";

        const incidents =
          await fetchAllIncidentsForResponder({
            type: typeVal || null,
            status: statusVal || null,
          });
        renderResponderIncidents(
          responderIncidentsContainer,
          incidents
        );
      };

      if (filterType)
        filterType.addEventListener(
          "change",
          reloadWithFilters
        );
      if (filterStatus)
        filterStatus.addEventListener(
          "change",
          reloadWithFilters
        );
      if (refreshIncidentsBtn)
        refreshIncidentsBtn.addEventListener(
          "click",
          reloadWithFilters
        );
    }

    // GPS sharing buttons
    if (btnStartShare && btnStopShare) {
      btnStartShare.addEventListener("click", async () => {
        await startSharingLocation();
        btnStartShare.disabled = true;
        btnStopShare.style.display = "inline-flex";
      });

      btnStopShare.addEventListener("click", () => {
        stopSharingLocation();
        btnStartShare.disabled = false;
        btnStopShare.style.display = "none";
      });
    }

    // Periodically update live responder markers
    setInterval(updateLiveResponderMarkers, 5000);
  }

  // RESPONDER CHAT
  if (responderChatFormEl && responderChatMessagesEl) {
    responderChatFormEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = responderChatInputEl.value.trim();
      if (!text) return;

      const incidentId = currentChatIncidentId;
      if (!incidentId) {
        alert("Select an incident from the table first.");
        return;
      }

      await sendChatMessage(incidentId, text, "responder");
      responderChatInputEl.value = "";
    });
  }
});

async function fetchStaffList(filters) {
  let query = civicSupabase
    .from("users")
    .select("id, full_name, email, phone, user_role, responder_status, is_active")
    .order("full_name", { ascending: true });

  if (filters?.role) {
    query = query.eq("user_role", filters.role);
  }
  if (filters?.active === "active") {
    query = query.eq("is_active", true);
  } else if (filters?.active === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchStaffList error:", error);
    return [];
  }
  return data || [];
}

// DISPATCHER DASHBOARD
const dispatcherIncidentsContainer =
  document.getElementById("dispatcherIncidents");
if (dispatcherIncidentsContainer) {
  (async () => {
    const auth = await getAuthUser();
    if (!auth) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getUserProfile();
    if (!profile || profile.user_role !== "dispatcher") {
      alert("Access denied. You are not a dispatcher.");
      window.location.href = "app.html";
      return;
    }

    currentDispatcherUser = auth;
    currentUserRole = "dispatcher";

    const dWelcome = document.getElementById("dispatcherWelcome");
    if (dWelcome) {
      const firstName =
        (profile.full_name && profile.full_name.split(" ")[0]) ||
        "Dispatcher";
      dWelcome.textContent = "Hi, " + firstName;
    }

    // Load responders (for assignment dropdowns)
    allResponders = await loadRespondersList();

    // Initialize map
    const mapContainer = document.getElementById("dispatcherMap");
    if (mapContainer && typeof L !== "undefined") {
      dispatcherMap = L.map("dispatcherMap").setView([-28.5, 24.7], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(dispatcherMap);
    }

    // Load incidents
    const incidents = await fetchAllIncidentsForResponder({});
    renderDispatcherIncidents(dispatcherIncidentsContainer, incidents);
    updateDispatcherResponderMarkers();

    // Filters
    const dFilterType = document.getElementById("dFilterType");
    const dFilterStatus = document.getElementById("dFilterStatus");
    const dFilterAssignment = document.getElementById("dFilterAssignment");
    const dRefreshBtn = document.getElementById("dRefreshIncidentsBtn");

    const reloadWithFilters = async () => {
      const typeVal = dFilterType?.value || "";
      const statusVal = dFilterStatus?.value || "";
      const assignVal = dFilterAssignment?.value || "";

      let queryFilters = {
        type: typeVal || null,
        status: statusVal || null,
      };

      let all = await fetchAllIncidentsForResponder(queryFilters);
      if (assignVal === "unassigned") {
        all = all.filter((i) => !i.assigned_responder_id);
      } else if (assignVal === "assigned") {
        all = all.filter((i) => !!i.assigned_responder_id);
      }

      renderDispatcherIncidents(dispatcherIncidentsContainer, all);
      updateDispatcherResponderMarkers();
    };

    if (dFilterType)
      dFilterType.addEventListener("change", reloadWithFilters);
    if (dFilterStatus)
      dFilterStatus.addEventListener("change", reloadWithFilters);
    if (dFilterAssignment)
      dFilterAssignment.addEventListener("change", reloadWithFilters);
    if (dRefreshBtn)
      dRefreshBtn.addEventListener("click", reloadWithFilters);

    // Realtime incidents
    initRealtimeIncidentsResponder(); // re-use, it reloads incidents and plays sound

    // Periodic responder marker updates
    setInterval(updateDispatcherResponderMarkers, 5000);

    // Staff management
    const staffRoleFilter = document.getElementById("staffFilterRole");
    const staffActiveFilter = document.getElementById("staffFilterActive");
    const staffRefreshBtn = document.getElementById("staffRefreshBtn");
    const staffWrapper = document.getElementById("staffTableWrapper");

    const reloadStaff = async () => {
      if (!staffWrapper) return;
      const roleVal = staffRoleFilter?.value || "";
      const activeVal = staffActiveFilter?.value || "";
      const list = await fetchStaffList({
        role: roleVal || null,
        active: activeVal || null,
      });
      renderStaffTable(staffWrapper, list);
    };

    if (staffWrapper) {
      reloadStaff();
    }
    if (staffRoleFilter)
      staffRoleFilter.addEventListener("change", reloadStaff);
    if (staffActiveFilter)
      staffActiveFilter.addEventListener("change", reloadStaff);
    if (staffRefreshBtn)
      staffRefreshBtn.addEventListener("click", reloadStaff);

    // Dispatcher chat send
    const dChatForm = document.getElementById("dispatcherChatForm");
    const dChatInput = document.getElementById("dispatcherChatInput");
    if (dChatForm && dChatInput) {
      dChatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = dChatInput.value.trim();
        if (!text) return;

        const incId = currentDispatcherIncidentId;
        if (!incId) {
          alert("Select an incident first.");
          return;
        }

        await sendChatMessage(incId, text, "dispatcher");
        dChatInput.value = "";
      });
    }
  })();
}
function renderStaffTable(container, staff) {
  if (!container) return;

  if (!staff || staff.length === 0) {
    container.innerHTML =
      '<p style="color:#94a3b8;">No staff found for the selected filters.</p>';
    document.getElementById("dStatActiveResponders").textContent = "0";
    return;
  }

  const activeResponders = staff.filter(
    (u) => u.user_role === "responder" && u.is_active
  ).length;
  const activeRespEl = document.getElementById("dStatActiveResponders");
  if (activeRespEl) activeRespEl.textContent = activeResponders;

  let html = `
    <table class="staff-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Contact</th>
          <th>Role</th>
          <th>Responder Status</th>
          <th>Active</th>
        </tr>
      </thead>
      <tbody>
  `;

  staff.forEach((u) => {
    const roleClass =
      u.user_role === "responder"
        ? "staff-role-responder"
        : u.user_role === "dispatcher"
          ? "staff-role-dispatcher"
          : "staff-role-citizen";

    html += `
      <tr>
        <td>${u.full_name || "Unknown"}</td>
        <td>
          ${u.email || ""}<br>
          <span style="color:#94a3b8; font-size:0.8rem;">${u.phone || ""}</span>
        </td>
        <td>
          <span class="staff-tag-role ${roleClass}">
            ${u.user_role || "citizen"}
          </span>
          <br>
          <select class="staff-role-select" data-user-id="${u.id}">
            <option value="">Change role…</option>
            <option value="citizen">Citizen</option>
            <option value="responder">Responder</option>
            <option value="dispatcher">Dispatcher</option>
          </select>
        </td>
        <td>
          ${u.user_role === "responder"
        ? `
            <select class="staff-status-select" data-user-id="${u.id}">
              <option value="">--</option>
              <option value="available"${u.responder_status === "available" ? " selected" : ""
        }>Available</option>
              <option value="busy"${u.responder_status === "busy" ? " selected" : ""
        }>Busy</option>
              <option value="offline"${u.responder_status === "offline" ? " selected" : ""
        }>Offline</option>
            </select>
          `
        : '<span style="color:#64748b; font-size:0.8rem;">N/A</span>'
      }
        </td>
        <td>
          <span class="staff-active-pill ${u.is_active ? "staff-active-yes" : "staff-active-no"
      }">
            ${u.is_active ? "Active" : "Inactive"}
          </span>
          <br>
          <button class="btn-outline staff-toggle-active-btn"
            data-user-id="${u.id}"
            data-active="${u.is_active ? "1" : "0"}"
            style="margin-top:0.2rem; padding:0.1rem 0.6rem; font-size:0.7rem;">
            ${u.is_active ? "Deactivate" : "Activate"}
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Wire role changes
  container.querySelectorAll(".staff-role-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const newRole = e.target.value;
      const userId = e.target.getAttribute("data-user-id");
      if (!newRole || !userId) return;

      const { error } = await civicSupabase
        .from("users")
        .update({ user_role: newRole })
        .eq("id", userId);

      if (error) {
        console.error("Update user_role error:", error);
        alert("Could not update role.");
        return;
      }

      alert("Role updated.");
      const wrapper = document.getElementById("staffTableWrapper");
      if (wrapper) {
        const roleFilter =
          document.getElementById("staffFilterRole")?.value || "";
        const activeFilter =
          document.getElementById("staffFilterActive")?.value || "";
        fetchStaffList({
          role: roleFilter || null,
          active: activeFilter || null,
        }).then((list) => renderStaffTable(wrapper, list));
      }
    });
  });

  // Wire responder status changes
  container.querySelectorAll(".staff-status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const newStatus = e.target.value;
      const userId = e.target.getAttribute("data-user-id");
      if (!newStatus || !userId) return;

      const { error } = await civicSupabase
        .from("users")
        .update({ responder_status: newStatus })
        .eq("id", userId);

      if (error) {
        console.error("Update responder_status error:", error);
        alert("Could not update responder status.");
        return;
      }
    });
  });

  // Wire active toggle
  container.querySelectorAll(".staff-toggle-active-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");
      const currentActive = btn.getAttribute("data-active") === "1";
      const newValue = !currentActive;

      const { error } = await civicSupabase
        .from("users")
        .update({ is_active: newValue })
        .eq("id", userId);

      if (error) {
        console.error("Update is_active error:", error);
        alert("Could not update active status.");
        return;
      }

      alert("User " + (newValue ? "activated" : "deactivated") + ".");
      const wrapper = document.getElementById("staffTableWrapper");
      if (wrapper) {
        const roleFilter =
          document.getElementById("staffFilterRole")?.value || "";
        const activeFilter =
          document.getElementById("staffFilterActive")?.value || "";
        fetchStaffList({
          role: roleFilter || null,
          active: activeFilter || null,
        }).then((list) => renderStaffTable(wrapper, list));
      }
    });
  });
}