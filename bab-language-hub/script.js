const languages = [
    { code: "auto", name: "Auto Detect" },
    { code: "af", name: "Afrikaans" },
    { code: "sq", name: "Albanian" },
    { code: "am", name: "Amharic" },
    { code: "ar", name: "Arabic" },
    { code: "hy", name: "Armenian" },
    { code: "az", name: "Azerbaijani" },
    { code: "eu", name: "Basque" },
    { code: "be", name: "Belarusian" },
    { code: "bn", name: "Bengali" },
    { code: "bs", name: "Bosnian" },
    { code: "bg", name: "Bulgarian" },
    { code: "ca", name: "Catalan" },
    { code: "ceb", name: "Cebuano" },
    { code: "ny", name: "Chichewa" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" },
    { code: "co", name: "Corsican" },
    { code: "hr", name: "Croatian" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "eo", name: "Esperanto" },
    { code: "et", name: "Estonian" },
    { code: "tl", name: "Filipino" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "fy", name: "Frisian" },
    { code: "gl", name: "Galician" },
    { code: "ka", name: "Georgian" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "gu", name: "Gujarati" },
    { code: "ht", name: "Haitian Creole" },
    { code: "ha", name: "Hausa" },
    { code: "haw", name: "Hawaiian" },
    { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" },
    { code: "hmn", name: "Hmong" },
    { code: "hu", name: "Hungarian" },
    { code: "is", name: "Icelandic" },
    { code: "ig", name: "Igbo" },
    { code: "id", name: "Indonesian" },
    { code: "ga", name: "Irish" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "jw", name: "Javanese" },
    { code: "kn", name: "Kannada" },
    { code: "kk", name: "Kazakh" },
    { code: "km", name: "Khmer" },
    { code: "ko", name: "Korean" },
    { code: "ku", name: "Kurdish (Kurmanji)" },
    { code: "ky", name: "Kyrgyz" },
    { code: "lo", name: "Lao" },
    { code: "la", name: "Latin" },
    { code: "lv", name: "Latvian" },
    { code: "lt", name: "Lithuanian" },
    { code: "lb", name: "Luxembourgish" },
    { code: "mk", name: "Macedonian" },
    { code: "mg", name: "Malagasy" },
    { code: "ms", name: "Malay" },
    { code: "ml", name: "Malayalam" },
    { code: "mt", name: "Maltese" },
    { code: "mi", name: "Maori" },
    { code: "mr", name: "Marathi" },
    { code: "mn", name: "Mongolian" },
    { code: "my", name: "Myanmar (Burmese)" },
    { code: "ne", name: "Nepali" },
    { code: "no", name: "Norwegian" },
    { code: "ps", name: "Pashto" },
    { code: "fa", name: "Persian" },
    { code: "pl", name: "Polish" },
    { code: "pt", name: "Portuguese" },
    { code: "pa", name: "Punjabi" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sm", name: "Samoan" },
    { code: "gd", name: "Scots Gaelic" },
    { code: "sr", name: "Serbian" },
    { code: "st", name: "Sesotho" },
    { code: "sn", name: "Shona" },
    { code: "sd", name: "Sindhi" },
    { code: "si", name: "Sinhala" },
    { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" },
    { code: "so", name: "Somali" },
    { code: "es", name: "Spanish" },
    { code: "su", name: "Sundanese" },
    { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" },
    { code: "tg", name: "Tajik" },
    { code: "ta", name: "Tamil" },
    { code: "te", name: "Telugu" },
    { code: "th", name: "Thai" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" },
    { code: "uz", name: "Uzbek" },
    { code: "vi", name: "Vietnamese" },
    { code: "cy", name: "Welsh" },
    { code: "xh", name: "Xhosa" },
    { code: "yi", name: "Yiddish" },
    { code: "yo", name: "Yoruba" },
    { code: "zu", name: "Zulu" },
];

const sourceLanguage = document.getElementById("sourceLanguage");
const targetLanguage = document.getElementById("targetLanguage");
const sourceText = document.getElementById("sourceText");
const translatedText = document.getElementById("translatedText");
const translateBtn = document.getElementById("translateBtn");
const swapLanguages = document.getElementById("swapLanguages");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const statusMessage = document.getElementById("statusMessage");
const detectedLanguage = document.getElementById("detectedLanguage");
const charCount = document.getElementById("charCount");
const brandLogo = document.getElementById("brandLogo");
const brandBadge = document.getElementById("brandBadge");
const voiceInputBtn = document.getElementById("voiceInputBtn");
const speakBtn = document.getElementById("speakBtn");
const stopAudioBtn = document.getElementById("stopAudioBtn");
const autoVoiceTranslateToggle = document.getElementById("autoVoiceTranslateToggle");
const installAppBtn = document.getElementById("installAppBtn");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let autoTranslateTimer = null;
let hasAutoStartedVoice = false;
let deferredInstallPrompt = null;

function setStatus(message) {
    statusMessage.textContent = message;
}

function normalizeLangCode(code) {
    if (!code || code === "auto") return "auto";
    const lowered = code.toLowerCase();
    if (lowered === "zh-cn") return "zh-CN";
    if (lowered === "zh-tw") return "zh-TW";
    if (lowered === "he") return "iw";
    return lowered;
}

function toShortCode(code) {
    if (!code || code === "auto") return "auto";
    return String(code).split("-")[0].toLowerCase();
}

function toSpeechLocale(code, fallback = "en-US") {
    if (!code || code === "auto") return fallback;

    const map = {
        en: "en-US",
        fr: "fr-FR",
        es: "es-ES",
        pt: "pt-PT",
        ar: "ar-SA",
        zh: "zh-CN",
        "zh-CN": "zh-CN",
        "zh-TW": "zh-TW",
        hi: "hi-IN",
        sw: "sw-KE",
        zu: "zu-ZA",
        xh: "xh-ZA",
        af: "af-ZA",
    };

    return map[code] || map[toShortCode(code)] || fallback;
}

function scheduleAutoTranslate() {
    if (!autoVoiceTranslateToggle || !autoVoiceTranslateToggle.checked) {
        return;
    }

    if (autoTranslateTimer) {
        clearTimeout(autoTranslateTimer);
    }

    autoTranslateTimer = setTimeout(() => {
        if (!sourceText.value.trim()) {
            return;
        }

        translateText();
    }, 650);
}

function setupRecognition() {
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
        isListening = true;
        setStatus("Listening... speak now.");
    };

    recognition.onend = () => {
        if (isListening) {
            isListening = false;
            setStatus("Voice input stopped.");
        }
    };

    recognition.onerror = () => {
        isListening = false;
        setStatus("Voice input unavailable or permission denied.");
    };

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript || "")
            .join(" ")
            .trim();

        sourceText.value = transcript;
        updateCharCount();
        scheduleAutoTranslate();
    };
}

function startVoiceInput() {
    if (!recognition) {
        setStatus("Voice input is not supported in this browser.");
        return;
    }

    if (isListening) {
        setStatus("Already listening...");
        return;
    }

    try {
        recognition.lang = toSpeechLocale(sourceLanguage.value, "en-US");
        recognition.start();
    } catch (error) {
        setStatus("Voice input could not start.");
    }
}

function speakTranslation() {
    const text = translatedText.value.trim();
    if (!text) {
        setStatus("Translate text first, then use Speak Translation.");
        return;
    }

    if (!window.speechSynthesis) {
        setStatus("Audio playback is not supported in this browser.");
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = toSpeechLocale(targetLanguage.value, "en-US");
    utterance.rate = 1;

    utterance.onstart = () => setStatus("Playing translated audio...");
    utterance.onend = () => setStatus("Audio playback complete.");
    utterance.onerror = () => setStatus("Could not play translated audio.");

    window.speechSynthesis.speak(utterance);
}

function stopAudioFeatures() {
    if (recognition && isListening) {
        isListening = false;
        recognition.stop();
    }

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    setStatus("Audio stopped.");
}

function setupAutoStartVoiceListening() {
    if (!recognition) {
        return;
    }

    const triggerAutoStart = () => {
        if (hasAutoStartedVoice) {
            return;
        }

        hasAutoStartedVoice = true;

        if (autoVoiceTranslateToggle && autoVoiceTranslateToggle.checked) {
            startVoiceInput();
        }
    };

    document.addEventListener("pointerdown", triggerAutoStart, { once: true });
    document.addEventListener("keydown", triggerAutoStart, { once: true });
}

async function tryGoogleTranslate(text, from, to) {
    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(normalizeLangCode(from))}&tl=${encodeURIComponent(normalizeLangCode(to))}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error("Google endpoint failed.");
    }

    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((part) => part[0]).join("") : "";
    if (!translated) {
        throw new Error("Google returned empty translation.");
    }

    return {
        translated,
        detected: data?.[2] || (from === "auto" ? "unknown" : from),
        provider: "Google",
    };
}

async function tryMyMemoryTranslate(text, from, to) {
    const fromCode = toShortCode(from === "auto" ? "en" : from);
    const toCode = toShortCode(to);
    const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(fromCode)}|${encodeURIComponent(toCode)}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error("MyMemory endpoint failed.");
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText || "";
    if (!translated) {
        throw new Error("MyMemory returned empty translation.");
    }

    return {
        translated,
        detected: from === "auto" ? fromCode : from,
        provider: "MyMemory",
    };
}

function findLanguageName(code) {
    const found = languages.find((item) => item.code.toLowerCase() === String(code).toLowerCase());
    return found ? found.name : code;
}

function buildLanguageOptions() {
    const sourceOptions = languages
        .map((item) => `<option value="${item.code}">${item.name}</option>`)
        .join("");

    const targetOptions = languages
        .filter((item) => item.code !== "auto")
        .map((item) => `<option value="${item.code}">${item.name}</option>`)
        .join("");

    sourceLanguage.innerHTML = sourceOptions;
    targetLanguage.innerHTML = targetOptions;

    sourceLanguage.value = "auto";
    targetLanguage.value = "en";
}

function updateCharCount() {
    charCount.textContent = `${sourceText.value.length} characters`;
}

async function translateText() {
    const text = sourceText.value.trim();
    const from = sourceLanguage.value;
    const to = targetLanguage.value;

    if (!text) {
        translatedText.value = "";
        detectedLanguage.textContent = "Detected: —";
        setStatus("Enter text first.");
        return;
    }

    if (from === to) {
        translatedText.value = text;
        detectedLanguage.textContent = `Detected: ${findLanguageName(from)}`;
        setStatus("Source and target are the same.");
        return;
    }

    setStatus("Translating...");
    translateBtn.disabled = true;

    try {
        let result;
        try {
            result = await tryGoogleTranslate(text, from, to);
        } catch (googleError) {
            result = await tryMyMemoryTranslate(text, from, to);
        }

        translatedText.value = result.translated;
        detectedLanguage.textContent = `Detected: ${findLanguageName(result.detected)}`;
        setStatus(`Translation complete (${result.provider}).`);
    } catch (error) {
        translatedText.value = "";
        detectedLanguage.textContent = "Detected: —";
        setStatus("Could not translate right now. Please try again.");
    } finally {
        translateBtn.disabled = false;
    }
}

function swapLanguageValues() {
    if (sourceLanguage.value === "auto") {
        setStatus("Select a source language first to swap.");
        return;
    }

    const previousSource = sourceLanguage.value;
    sourceLanguage.value = targetLanguage.value;
    targetLanguage.value = previousSource;

    const previousText = sourceText.value;
    sourceText.value = translatedText.value;
    translatedText.value = previousText;

    updateCharCount();
    setStatus("Languages swapped.");
}

function clearAll() {
    sourceText.value = "";
    translatedText.value = "";
    detectedLanguage.textContent = "Detected: —";
    updateCharCount();
    setStatus("Cleared.");
}

async function copyTranslation() {
    if (!translatedText.value.trim()) {
        setStatus("Nothing to copy yet.");
        return;
    }

    try {
        await navigator.clipboard.writeText(translatedText.value);
        setStatus("Translation copied.");
    } catch (error) {
        setStatus("Copy failed. You can copy manually.");
    }
}

function bindEvents() {
    translateBtn.addEventListener("click", translateText);
    swapLanguages.addEventListener("click", swapLanguageValues);
    clearBtn.addEventListener("click", clearAll);
    copyBtn.addEventListener("click", copyTranslation);
    voiceInputBtn.addEventListener("click", startVoiceInput);
    speakBtn.addEventListener("click", speakTranslation);
    stopAudioBtn.addEventListener("click", stopAudioFeatures);
    if (autoVoiceTranslateToggle) {
        autoVoiceTranslateToggle.addEventListener("change", () => {
            setStatus(autoVoiceTranslateToggle.checked
                ? "Auto-translate while speaking enabled."
                : "Auto-translate while speaking disabled.");
        });
    }

    sourceText.addEventListener("input", updateCharCount);
    sourceText.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            translateText();
        }
    });
}

function setupInstallPrompt() {
    if (!installAppBtn) {
        return;
    }

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installAppBtn.hidden = false;
    });

    window.addEventListener("appinstalled", () => {
        installAppBtn.hidden = true;
        deferredInstallPrompt = null;
        setStatus("App installed successfully.");
    });

    installAppBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) {
            setStatus("Install option is not available on this browser yet.");
            return;
        }

        deferredInstallPrompt.prompt();
        try {
            await deferredInstallPrompt.userChoice;
        } catch (error) {
            // no-op
        }

        deferredInstallPrompt = null;
        installAppBtn.hidden = true;
    });
}

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    try {
        await navigator.serviceWorker.register("service-worker.js");
    } catch (error) {
        setStatus("PWA background support could not start.");
    }
}

function init() {
    buildLanguageOptions();
    setupRecognition();
    setupAutoStartVoiceListening();
    bindEvents();
    updateCharCount();
    if (autoVoiceTranslateToggle && autoVoiceTranslateToggle.checked) {
        setStatus("Auto-translate while speaking enabled.");
    }
    if (brandLogo && brandBadge) {
        brandLogo.addEventListener("error", () => {
            brandLogo.style.display = "none";
            brandBadge.style.display = "grid";
        });
    }
    document.getElementById("year").textContent = new Date().getFullYear();
    setupInstallPrompt();
    registerServiceWorker();
}

init();
