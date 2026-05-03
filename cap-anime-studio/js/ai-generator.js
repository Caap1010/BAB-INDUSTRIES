(function () {
  'use strict';

  const STORE_KEY = 'cap_studio_assets_v1';
  const AI_STORE_KEY = 'cap_ai_generator_state_v1';
  const AI_PREFS_KEY = 'cap_ai_generator_prefs_v1';
  const AI_MASK_PRESET_KEY = 'cap_ai_mask_preset_v2';
  const AI_REVIEW_KEY = 'cap_ai_reviews_v1';

  const $ = (id) => document.getElementById(id);

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('cap:assets-updated'));
  }

  function ensureStore() {
    const s = loadStore();
    s.visualAssets = s.visualAssets || [];
    s.episodeProjects = s.episodeProjects || [];
    s.exportQueue = s.exportQueue || [];
    return s;
  }

  function hashString(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h << 5) - h + text.charCodeAt(i);
    return Math.abs(h);
  }

  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BASE_NEGATIVE_PROMPT = [
    'low quality', 'low resolution', 'blurry', 'pixelated',
    'cartoon', 'flat shading', 'bad lighting', 'bad anatomy',
    'distorted perspective', 'incorrect proportions',
    'oversaturated colors', 'jpeg artifacts'
  ].join(', ');

  const STYLE_LOCKS = {
    anime: {
      id: 'anime-realism-lock',
      label: 'Anime Realism',
      renderTraits: 'anime realism, crisp line clarity, balanced color contrast, physically inspired lighting',
      grain: 0.04,
      sharpen: 0.26,
      contrast: 1.08,
      saturation: 1.06,
      temperature: 0.02,
    },
    cinematic: {
      id: 'cinematic-cgi-lock',
      label: 'Ultra Real Cinematic',
      renderTraits: 'ultra-real cinematic CGI, physically based lighting, dynamic range, filmic highlights',
      grain: 0.05,
      sharpen: 0.3,
      contrast: 1.12,
      saturation: 1.02,
      temperature: -0.01,
    },
    manga: {
      id: 'manga-ink-lock',
      label: 'Stylized Manga',
      renderTraits: 'stylized manga ink treatment, high micro-contrast, controlled grayscale depth',
      grain: 0.03,
      sharpen: 0.34,
      contrast: 1.2,
      saturation: 0.82,
      temperature: 0,
    },
    concept: {
      id: 'concept-painterly-lock',
      label: 'Concept Art Lock',
      renderTraits: 'high-end concept painting with production-grade composition and atmospheric perspective',
      grain: 0.035,
      sharpen: 0.24,
      contrast: 1.06,
      saturation: 1.04,
      temperature: 0.01,
    },
  };

  const RENDER_QUALITY_PROFILES = {
    standard: {
      baseScale: 0.56,
      sharpenBoost: 1,
      contrastBoost: 1,
      saturationBoost: 1,
      grainBoost: 1,
      detailBoost: 1,
      postPasses: 1,
    },
    high: {
      baseScale: 0.72,
      sharpenBoost: 1.18,
      contrastBoost: 1.04,
      saturationBoost: 1.03,
      grainBoost: 0.85,
      detailBoost: 1.22,
      postPasses: 2,
    },
    ultra: {
      baseScale: 0.86,
      sharpenBoost: 1.34,
      contrastBoost: 1.08,
      saturationBoost: 1.06,
      grainBoost: 0.72,
      detailBoost: 1.46,
      postPasses: 3,
    },
  };

  function getRenderProfile(renderQuality) {
    const key = String(renderQuality || 'high').toLowerCase();
    return RENDER_QUALITY_PROFILES[key] || RENDER_QUALITY_PROFILES.high;
  }

  function getAutoHighQualityProfile() {
    return RENDER_QUALITY_PROFILES.ultra;
  }

  function ensureMinimumHdDimensions(width, height) {
    const w = Math.max(1, Math.round(Number(width) || 0));
    const h = Math.max(1, Math.round(Number(height) || 0));
    const targetW = 1920;
    const targetH = 1080;
    if (w >= targetW && h >= targetH) {
      return { width: w, height: h };
    }
    const scale = Math.max(targetW / w, targetH / h);
    return {
      width: Math.round(w * scale),
      height: Math.round(h * scale),
    };
  }

  // ===== UNDO/REDO STATE STACK =====
  let canvasUndoStack = [];
  let canvasRedoStack = [];
  const MAX_UNDO_DEPTH = 20;

  function pushCanvasUndo(canvas) {
    if (canvasUndoStack.length >= MAX_UNDO_DEPTH) canvasUndoStack.shift();
    canvasUndoStack.push(canvas.toDataURL('image/png'));
    canvasRedoStack = [];
  }

  function performUndo(canvas) {
    if (canvasUndoStack.length === 0) return false;
    canvasRedoStack.push(canvas.toDataURL('image/png'));
    const dataUrl = canvasUndoStack.pop();
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
    return true;
  }

  function performRedo(canvas) {
    if (canvasRedoStack.length === 0) return false;
    canvasUndoStack.push(canvas.toDataURL('image/png'));
    const dataUrl = canvasRedoStack.pop();
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
    return true;
  }

  // ===== GENERATION HISTORY & FAVORITES =====
  const HISTORY_KEY = 'cap_ai_history_v1';
  const FAVORITES_KEY = 'cap_ai_favorites_v1';
  const DRAFTS_KEY = 'cap_ai_drafts_v1';

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100)));
  }

  function loadMaskPresetMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AI_MASK_PRESET_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveMaskPresetMap(map) {
    localStorage.setItem(AI_MASK_PRESET_KEY, JSON.stringify(map || {}));
  }

  function addToHistory(prompt, style, dataUrl, settings) {
    const history = loadHistory();
    history.push({
      id: 'H' + Date.now(),
      prompt,
      style,
      thumbnail: dataUrl,
      settings: Object.assign({}, settings),
      timestamp: new Date().toISOString(),
      favorite: false,
      tags: [],
    });
    saveHistory(history);
    return history[history.length - 1];
  }

  function toggleFavorite(itemId) {
    const history = loadHistory();
    const item = history.find((h) => h.id === itemId);
    if (item) item.favorite = !item.favorite;
    saveHistory(history);
    return item;
  }

  function saveDraft(state) {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(Object.assign({}, state, { savedAt: new Date().toISOString() })));
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  // ===== BATCH QUEUE MANAGEMENT =====
  let generationQueue = [];
  let isGenerating = false;
  let lastRemoteGenerateError = '';
  let generationToken = null;

  function addToQueue(prompt, style, size, settings) {
    generationQueue.push({
      id: 'Q' + Date.now() + Math.random(),
      prompt,
      style,
      size,
      settings: Object.assign({}, settings),
      status: 'pending',
    });
  }

  function getNextQueueItem() {
    return generationQueue.find((i) => i.status === 'pending');
  }

  function cancelGeneration() {
    generationToken = null;
    isGenerating = false;
  }

  function updateProgressBar(barEl, statusEl, progress, text) {
    if (barEl) barEl.style.width = Math.round(clamp(progress, 0, 1) * 100) + '%';
    if (statusEl && typeof text === 'string') statusEl.textContent = text;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = String(reader.result || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function nextFrame() {
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  const CAMERA_KEYWORDS = [
    'tracking shot', 'dolly', 'crane shot', 'handheld', 'shallow depth of field',
    '35mm lens', '50mm lens', '85mm lens', 'motion blur', 'dynamic camera pan',
    'speed lines', 'impact frame', 'cinematic cut', 'low-angle', 'high-angle',
    'bird eye', 'bird\'s eye', 'close-up', 'wide shot', 'overhead'
  ];

  function pickStyleLock(style) {
    return STYLE_LOCKS[style] || STYLE_LOCKS.anime;
  }

  function extractCameraDirectives(prompt) {
    const text = String(prompt || '').toLowerCase();
    const found = CAMERA_KEYWORDS.filter((k) => text.includes(k));
    let primaryShot = 'medium';
    if (text.includes('close-up') || text.includes('close up') || text.includes('closeup')) {
      primaryShot = 'closeup';
    } else if (text.includes('wide shot') || text.includes('wide angle')) {
      primaryShot = 'wide';
    } else if (text.includes('bird eye') || text.includes('bird\'s eye') || text.includes('overhead')) {
      primaryShot = 'birdseye';
    } else if (text.includes('low-angle') || text.includes('low angle') || text.includes('worm eye')) {
      primaryShot = 'lowangle';
    }
    const motion = text.includes('tracking shot') || text.includes('dolly') || text.includes('dynamic camera pan')
      ? 'tracking'
      : (text.includes('handheld') ? 'handheld' : 'static');
    const lens = text.includes('85mm lens') ? '85mm'
      : (text.includes('50mm lens') ? '50mm' : (text.includes('35mm lens') ? '35mm' : '35mm'));
    return { found, primaryShot, motion, lens };
  }

  function buildPromptPackage(userPrompt, mode, style, styleLock, extra) {
    const clean = String(userPrompt || '').trim();
    const camera = extractCameraDirectives(clean);
    const scope = mode === 'clip'
      ? 'dynamic short cinematic animation clip'
      : (mode === 'trailer'
        ? 'high-impact trailer sequence'
        : (mode === 'scene' ? 'multi-shot scene plan for anime production' : 'single high-quality cinematic still'));
    const sceneHint = clean || 'cinematic character and environment scene';
    const expandedPrompt = [
      `Subject: ${sceneHint}.`,
      `Mode: ${scope}.`,
      `Camera: ${camera.primaryShot}, ${camera.motion}, ${camera.lens} lens, motion blur ${camera.found.includes('motion blur') ? 'enabled' : 'subtle'}.`,
      `Lighting and composition: dramatic cinematic lighting, realistic shadows, depth layering, strong foreground-midground-background separation.`,
      `Style lock: ${styleLock.renderTraits}.`,
      `Quality target: ultra-detailed textures, clean edges, coherent anatomy, production-ready polish, 4K finishing intent.`
    ].join(' ');
    const negativePrompt = BASE_NEGATIVE_PROMPT;
    const seedText = `${clean}|${mode}|${style}|${styleLock.id}|${extra || ''}`;
    return { userPrompt: clean, expandedPrompt, negativePrompt, camera, styleLock, seedText };
  }

  function enhanceImageData(ctx, w, h, styleLock, renderProfile) {
    const profile = renderProfile || RENDER_QUALITY_PROFILES.high;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const contrast = styleLock.contrast * (profile.contrastBoost || 1);
    const sat = styleLock.saturation * (profile.saturationBoost || 1);
    const temp = styleLock.temperature;
    const sharp = styleLock.sharpen * (profile.sharpenBoost || 1);
    const grain = styleLock.grain * (profile.grainBoost || 1);

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      // Contrast and tone shaping.
      r = ((r - 0.5) * contrast) + 0.5;
      g = ((g - 0.5) * contrast) + 0.5;
      b = ((b - 0.5) * contrast) + 0.5;

      // Saturation in luma space.
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * sat;
      g = luma + (g - luma) * sat;
      b = luma + (b - luma) * sat;

      // Temperature shift.
      r += temp;
      b -= temp;

      // Lightweight edge pop via local luminance boost.
      const pop = sharp * 0.03;
      r += pop;
      g += pop;
      b += pop;

      // Film grain.
      const n = (Math.random() - 0.5) * grain;
      r += n;
      g += n;
      b += n;

      data[i] = Math.round(clamp(r, 0, 1) * 255);
      data[i + 1] = Math.round(clamp(g, 0, 1) * 255);
      data[i + 2] = Math.round(clamp(b, 0, 1) * 255);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function upscaleAndEnhance(sourceCanvas, outW, outH, styleLock, renderProfile) {
    const profile = renderProfile || RENDER_QUALITY_PROFILES.high;
    const upscaled = document.createElement('canvas');
    upscaled.width = outW;
    upscaled.height = outH;
    const uctx = upscaled.getContext('2d');
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = 'high';
    uctx.drawImage(sourceCanvas, 0, 0, outW, outH);
    for (let pass = 0; pass < (profile.postPasses || 1); pass += 1) {
      enhanceImageData(uctx, outW, outH, styleLock, profile);
    }
    return upscaled;
  }

  function drawGeneratedImage(canvas, prompt, style, options) { // eslint-disable-line max-lines-per-function
    const opts = options || {};
    const styleLock = opts.styleLock || pickStyleLock(style);
    const renderProfile = opts.renderProfile || RENDER_QUALITY_PROFILES.high;
    const detailBoost = renderProfile.detailBoost || 1;
    const camera = opts.camera || extractCameraDirectives(prompt);
    const ctx = canvas.getContext('2d');
    const seed = hashString((opts.seedText || prompt) + '|' + style + '|' + styleLock.id);
    const rand = seededRandom(seed);
    const w = canvas.width;
    const h = canvas.height;

    const text = String(opts.expandedPrompt || prompt || '').toLowerCase();
    const hasAny = (words) => words.some((word) => text.includes(word));

    const paletteByStyle = {
      anime: ['#7dd3fc', '#38bdf8', '#1d4ed8'],
      cinematic: ['#93c5fd', '#3b82f6', '#1e3a8a'],
      manga: ['#e5e7eb', '#9ca3af', '#111827'],
      concept: ['#c4b5fd', '#818cf8', '#312e81'],
    };

    const colorMap = {
      blue: '#60a5fa',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      orange: '#fb923c',
      purple: '#a78bfa',
      pink: '#f472b6',
      cyan: '#22d3ee',
      teal: '#2dd4bf',
      gold: '#fbbf24',
      white: '#f8fafc',
      black: '#111827',
    };

    let accent = '#38bdf8';
    Object.keys(colorMap).forEach((name) => {
      if (text.includes(name)) accent = colorMap[name];
    });

    const palette = paletteByStyle[style] || paletteByStyle.anime;
    const isNight = hasAny(['night', 'moon', 'dark', 'midnight', 'evening']);
    const floating = hasAny(['floating', 'flying', 'fly', 'hover', 'levitating']);
    const needsPerson = hasAny(['man', 'person', 'human', 'boy', 'guy', 'woman', 'girl']);
    const skyScene = hasAny(['sky', 'cloud', 'air']) || floating;
    const cityScene = hasAny(['city', 'building', 'street', 'tower']);

    // --- FACE ANGLE ---
    const faceAngle = hasAny(['side profile', 'side view', 'profile view']) ? 'side'
      : hasAny(['back view', 'from behind', 'rear view']) ? 'back'
      : hasAny(['low angle', 'low-angle', 'worm eye']) ? 'low'
      : hasAny(['high angle', 'bird eye', 'bird\'s eye']) ? 'high'
      : 'front';

    // --- OUTFIT ---
    const outfitTop = hasAny(['hoodie']) ? 'hoodie'
      : hasAny(['jacket', 'bomber']) ? 'jacket'
      : hasAny(['school uniform', 'uniform', 'blazer']) ? 'uniform'
      : hasAny(['coat', 'trench']) ? 'coat'
      : hasAny(['white shirt', 'shirt']) ? 'shirt'
      : 'shirt';
    const outfitTopColor = (() => {
      const topPairs = [['red hoodie','#ef4444'],['blue hoodie','#3b82f6'],['green hoodie','#22c55e'],['black hoodie','#1e293b'],['yellow hoodie','#facc15'],['red jacket','#ef4444'],['blue jacket','#3b82f6'],['black jacket','#1e293b'],['white jacket','#f8fafc'],['white uniform','#f8fafc'],['black uniform','#1e293b'],['navy uniform','#1e3a8a'],['red coat','#ef4444'],['grey coat','#6b7280'],['black coat','#1e293b']];
      for (const [phrase, col] of topPairs) { if (text.includes(phrase)) return col; }
      return outfitTop === 'hoodie' ? '#6366f1' : outfitTop === 'jacket' ? '#334155' : outfitTop === 'uniform' ? '#1e3a8a' : outfitTop === 'coat' ? '#374151' : '#e2e8f0';
    })();
    const pantsColor = hasAny(['shorts']) ? '#334155' : hasAny(['jeans', 'blue pants']) ? '#1d4ed8' : hasAny(['black pants', 'dark pants']) ? '#1e293b' : '#475569';
    const bagColor = hasAny(['red bag', 'red backpack']) ? '#f97316' : hasAny(['blue bag', 'blue backpack']) ? '#2563eb' : hasAny(['black bag', 'black backpack']) ? '#1e293b' : '#7c3aed';
    const hasBag = hasAny(['backpack', 'bag', 'school bag']);

    // --- CAMERA FRAMING ---
    const cameraFrame = camera.primaryShot || (hasAny(['close-up', 'close up', 'closeup']) ? 'closeup'
      : hasAny(['wide shot', 'wide angle', 'wide-angle']) ? 'wide'
      : hasAny(['bird\'s eye', 'bird eye', 'top down', 'overhead']) ? 'birdseye'
      : hasAny(['low angle', 'low-angle', 'worm eye']) ? 'lowangle'
      : 'medium');

    function fillSky() {
      const top = text.includes('blue') ? '#76b9ff' : (isNight ? '#0b1637' : palette[0]);
      const mid = text.includes('blue') ? '#4ea9f8' : accent;
      const bottom = isNight ? '#1f2b52' : '#c3e8ff';
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top);
      g.addColorStop(0.5, mid);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.52, h * 0.74, 0, w * 0.52, h * 0.74, h * 0.52);
      glow.addColorStop(0, 'rgba(255,255,255,0.55)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const sunX = w * (0.78 + rand() * 0.12);
      const sunY = h * (0.14 + rand() * 0.1);
      const sunR = h * 0.07;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.8);
      sunGlow.addColorStop(0, isNight ? 'rgba(229,231,235,0.95)' : 'rgba(253,230,138,0.95)');
      sunGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isNight ? '#e5e7eb' : '#fde68a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawCloudHQ(x, y, scale, depth) {
      const shadowAlpha = 0.12 + depth * 0.1;
      const cloudAlpha = 0.65 + depth * 0.2;
      ctx.fillStyle = 'rgba(15,23,42,' + shadowAlpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(x + 18 * scale, y + 10 * scale, 78 * scale, 24 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,' + cloudAlpha.toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(x - 30 * scale, y, 28 * scale, 20 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 5 * scale, y - 10 * scale, 34 * scale, 26 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 42 * scale, y - 2 * scale, 30 * scale, 22 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 72 * scale, y + 2 * scale, 20 * scale, 16 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawDepthParticles() {
      const count = Math.round((style === 'manga' ? 80 : 120) * detailBoost);
      for (let i = 0; i < count; i += 1) {
        const px = rand() * w;
        const py = rand() * h;
        const sz = 0.8 + rand() * 2.4;
        const alpha = py / h * (0.16 + styleLock.grain * 0.8);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
        ctx.fillRect(px, py, sz, sz);
      }
    }

    function drawCityPerspective() {
      const center = w * 0.5;
      const baseY = h * 0.92;
      const towerCount = Math.round(14 * Math.min(1.45, detailBoost));
      for (let i = 0; i < towerCount; i += 1) {
        const side = i < towerCount / 2 ? -1 : 1;
        const lane = i % (towerCount / 2);
        const laneRatio = lane / (towerCount / 2 - 1);
        const dist = 0.2 + laneRatio * 0.9;
        const bw = (w * 0.08) * (1.12 - laneRatio * 0.6);
        const bh = h * (0.2 + (1 - laneRatio) * 0.45) + rand() * 26;
        const x = center + side * (w * (0.12 + laneRatio * 0.44));
        const y = baseY - bh;

        const bodyGrad = ctx.createLinearGradient(x, y, x, y + bh);
        bodyGrad.addColorStop(0, 'rgba(30,58,138,0.78)');
        bodyGrad.addColorStop(1, 'rgba(15,23,42,0.88)');
        ctx.fillStyle = bodyGrad;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + bw, y + dist * 26);
        ctx.lineTo(x + bw * 0.86, y + bh);
        ctx.lineTo(x - bw * 0.14, y + bh - dist * 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(186,230,253,0.22)';
        for (let r = 0; r < 9; r += 1) {
          const yy = y + 14 + r * (bh / 10);
          if (rand() > 0.4) {
            ctx.fillRect(x + bw * 0.1, yy, bw * 0.65, 2.4);
          }
        }
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i += 1) {
        const yy = h * (0.65 + i * 0.045);
        ctx.beginPath();
        ctx.moveTo(center, h * 0.72);
        ctx.lineTo(w, yy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(center, h * 0.72);
        ctx.lineTo(0, yy);
        ctx.stroke();
      }
    }

    function drawFigure(x, y, scale) {
      const s = scale;

      // Apply camera-framing vertical offset and scale multiplier
      let camScaleMul = 1;
      let camYOff = 0;
      let camSkewY = 0;
      if (cameraFrame === 'closeup') { camScaleMul = 1.7; camYOff = h * 0.12; }
      else if (cameraFrame === 'wide') { camScaleMul = 0.68; }
      else if (cameraFrame === 'birdseye') { camScaleMul = 0.75; camSkewY = 0.28; }
      else if (cameraFrame === 'lowangle') { camScaleMul = 1.2; camYOff = -h * 0.06; }

      ctx.save();
      ctx.translate(x, y + camYOff);
      ctx.scale(s * camScaleMul, s * camScaleMul);
      if (camSkewY !== 0) ctx.transform(1, camSkewY, 0, 1, 0, 0);

      // Drop shadow
      ctx.fillStyle = 'rgba(15,23,42,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 112, 46, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      if (faceAngle === 'back') {
        // --- BACK VIEW ---
        // torso back
        ctx.fillStyle = outfitTopColor;
        ctx.beginPath();
        ctx.moveTo(-20, -36); ctx.lineTo(20, -36); ctx.lineTo(22, 16); ctx.lineTo(-22, 16); ctx.closePath(); ctx.fill();
        // hoodie hood or collar bulge on back
        if (outfitTop === 'hoodie') {
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath(); ctx.arc(0, -42, 14, Math.PI, 0); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = darken(outfitTopColor, 0.25); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, -42, 14, Math.PI, 0); ctx.stroke();
        }
        // hair from behind
        ctx.fillStyle = '#3f2a1f';
        ctx.beginPath(); ctx.arc(0, -54, 17, 0, Math.PI * 2); ctx.fill();
        // nape skin
        ctx.fillStyle = '#f1c6a8';
        ctx.beginPath(); ctx.arc(0, -42, 5, Math.PI, 0); ctx.fill();
        // bag on back (always visible from behind)
        ctx.fillStyle = bagColor;
        ctx.beginPath(); ctx.roundRect(-12, -24, 24, 36, 3); ctx.fill();
        ctx.strokeStyle = darken(bagColor, 0.3); ctx.lineWidth = 2;
        ctx.strokeRect(-12, -24, 24, 36);
        ctx.fillStyle = darken(bagColor, 0.2);
        ctx.fillRect(-2, -24, 4, 36);
        // arms (back)
        ctx.strokeStyle = outfitTopColor; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-20, -28); ctx.lineTo(-36, 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, -28); ctx.lineTo(36, 18); ctx.stroke();
        // hand skin
        ctx.fillStyle = '#f1c6a8';
        ctx.beginPath(); ctx.arc(-36, 22, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(36, 22, 5, 0, Math.PI * 2); ctx.fill();
        // pants
        ctx.fillStyle = pantsColor;
        ctx.fillRect(-20, 16, 40, 28);
        // leg division
        ctx.strokeStyle = darken(pantsColor, 0.2); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, 44); ctx.stroke();

      } else if (faceAngle === 'side') {
        // --- SIDE PROFILE ---
        ctx.save(); ctx.scale(-1, 1); // face right
        // torso side
        ctx.fillStyle = outfitTopColor;
        ctx.beginPath();
        ctx.moveTo(-8, -36); ctx.lineTo(22, -32); ctx.lineTo(20, 18); ctx.lineTo(-6, 16); ctx.closePath(); ctx.fill();
        // arm front
        ctx.strokeStyle = darken(outfitTopColor, 0.15); ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(16, -26); ctx.quadraticCurveTo(42, 0, 36, 28); ctx.stroke();
        // arm back (light)
        ctx.strokeStyle = darken(outfitTopColor, 0.35); ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(-4, -28); ctx.quadraticCurveTo(-26, -4, -22, 22); ctx.stroke();
        // pants
        ctx.fillStyle = pantsColor;
        ctx.fillRect(-6, 16, 28, 26);
        // leg overlap
        ctx.fillStyle = darken(pantsColor, 0.12);
        ctx.fillRect(-6, 16, 12, 26);
        // head
        ctx.fillStyle = '#f1c6a8';
        ctx.beginPath();
        ctx.moveTo(0, -42); ctx.bezierCurveTo(4, -72, 26, -72, 28, -46);
        ctx.bezierCurveTo(28, -38, 22, -34, 18, -36);
        ctx.bezierCurveTo(16, -32, 8, -30, 0, -42); ctx.closePath(); ctx.fill();
        // eye (single, side)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(22, -56, 2.5, 0, Math.PI * 2); ctx.fill();
        // hair side
        ctx.fillStyle = '#3f2a1f';
        ctx.beginPath(); ctx.moveTo(2, -48); ctx.quadraticCurveTo(10, -76, 30, -66); ctx.lineTo(26, -44); ctx.closePath(); ctx.fill();
        // ear
        ctx.fillStyle = '#e8b89a';
        ctx.beginPath(); ctx.ellipse(0, -50, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        // bag (side)
        if (hasBag) {
          ctx.fillStyle = bagColor;
          ctx.beginPath(); ctx.roundRect(-22, -22, 18, 28, 3); ctx.fill();
        }
        ctx.restore();

      } else if (faceAngle === 'low') {
        // --- LOW ANGLE (looking up at figure) ---
        // foreshortened: head large, feet near bottom
        ctx.fillStyle = '#f1c6a8';
        ctx.beginPath(); ctx.ellipse(0, -52, 19, 16, 0, 0, Math.PI * 2); ctx.fill(); // bigger head
        ctx.fillStyle = '#3f2a1f';
        ctx.beginPath();
        ctx.moveTo(-16, -58); ctx.quadraticCurveTo(2, -78, 20, -56);
        ctx.lineTo(2, -44); ctx.closePath(); ctx.fill();
        // eyes upward (visible whites)
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.ellipse(-6, -54, 5, 4, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, -53, 5, 4, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(-6, -53, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, -52, 2.5, 0, Math.PI * 2); ctx.fill();
        // torso foreshortened (flatter)
        ctx.fillStyle = outfitTopColor;
        ctx.beginPath();
        ctx.moveTo(-22, -32); ctx.lineTo(22, -32); ctx.lineTo(16, 8); ctx.lineTo(-16, 8); ctx.closePath(); ctx.fill();
        // arms
        ctx.strokeStyle = darken(outfitTopColor, 0.15); ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(-32, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, -24); ctx.lineTo(34, 10); ctx.stroke();
        // pants (short, foreshortened)
        ctx.fillStyle = pantsColor;
        ctx.fillRect(-15, 8, 30, 14);
        if (hasBag) {
          ctx.fillStyle = bagColor;
          ctx.beginPath(); ctx.roundRect(10, -28, 20, 30, 3); ctx.fill();
        }

      } else {
        // --- FRONT VIEW (default) ---
        ctx.fillStyle = '#f1c6a8';
        ctx.beginPath();
        ctx.arc(0, -54, 16, 0, Math.PI * 2);
        ctx.fill();
        // eyes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(-6, -56, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, -56, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.arc(-5, -57, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, -57, 1.2, 0, Math.PI * 2); ctx.fill();
        // eyebrows
        ctx.strokeStyle = '#3f2a1f'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-9, -63); ctx.lineTo(-3, -62); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(3, -62); ctx.lineTo(9, -63); ctx.stroke();
        // mouth
        ctx.strokeStyle = '#c97b5a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, -48, 5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();

        // hair
        ctx.fillStyle = '#3f2a1f';
        ctx.beginPath();
        ctx.moveTo(-14, -60);
        ctx.quadraticCurveTo(3, -83, 18, -58);
        ctx.lineTo(2, -44);
        ctx.closePath();
        ctx.fill();

        // outfit-specific torso
        if (outfitTop === 'hoodie') {
          // hoodie body
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath();
          ctx.moveTo(-22, -36); ctx.lineTo(18, -30); ctx.lineTo(22, 16); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
          // hood collar
          ctx.fillStyle = darken(outfitTopColor, 0.18);
          ctx.beginPath(); ctx.arc(0, -42, 11, Math.PI * 1.1, 0, true); ctx.lineTo(0, -30); ctx.closePath(); ctx.fill();
          // pocket
          ctx.strokeStyle = darken(outfitTopColor, 0.3); ctx.lineWidth = 1.5;
          ctx.strokeRect(-10, 2, 20, 12);
        } else if (outfitTop === 'jacket') {
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath();
          ctx.moveTo(-22, -36); ctx.lineTo(18, -30); ctx.lineTo(22, 16); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
          // lapels
          ctx.fillStyle = darken(outfitTopColor, 0.22);
          ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(0, -18); ctx.lineTo(-14, -16); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(0, -18); ctx.lineTo(12, -14); ctx.closePath(); ctx.fill();
        } else if (outfitTop === 'uniform') {
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath();
          ctx.moveTo(-22, -36); ctx.lineTo(18, -30); ctx.lineTo(22, 16); ctx.lineTo(-16, 18); ctx.closePath(); ctx.fill();
          // blazer lapels & tie
          ctx.fillStyle = darken(outfitTopColor, 0.2);
          ctx.beginPath(); ctx.moveTo(-4, -34); ctx.lineTo(1, -16); ctx.lineTo(-14, -14); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(-1, -16); ctx.lineTo(14, -12); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(-2, -26, 4, 16); // tie
        } else if (outfitTop === 'coat') {
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath();
          ctx.moveTo(-24, -36); ctx.lineTo(20, -30); ctx.lineTo(24, 22); ctx.lineTo(-18, 22); ctx.closePath(); ctx.fill();
          ctx.fillStyle = darken(outfitTopColor, 0.2);
          ctx.beginPath(); ctx.moveTo(-5, -34); ctx.lineTo(0, -10); ctx.lineTo(-16, -8); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(5, -32); ctx.lineTo(0, -10); ctx.lineTo(16, -6); ctx.closePath(); ctx.fill();
        } else {
          // plain shirt
          ctx.fillStyle = outfitTopColor;
          ctx.beginPath();
          ctx.moveTo(-20, -36); ctx.lineTo(16, -30); ctx.lineTo(20, 12); ctx.lineTo(-14, 18); ctx.closePath(); ctx.fill();
        }

        // bag
        if (hasBag) {
          ctx.fillStyle = bagColor;
          ctx.beginPath();
          ctx.moveTo(10, -26); ctx.lineTo(34, -16); ctx.lineTo(32, 16); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = darken(bagColor, 0.3); ctx.lineWidth = 1.5; ctx.strokeRect(12, -22, 20, 34);
        }

        // arms
        ctx.strokeStyle = darken(outfitTopColor, 0.1);
        ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-18, -28); ctx.lineTo(-32, 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, -22); ctx.lineTo(34, 14); ctx.stroke();
        ctx.fillStyle = '#f1c6a8'; // hands
        ctx.beginPath(); ctx.arc(-32, 16, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(34, 18, 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = pantsColor;
        ctx.fillRect(-15, 18, 30, 24);
        // leg line
        ctx.strokeStyle = darken(pantsColor, 0.2); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, 42); ctx.stroke();
        // feet
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(-7, 44, 9, 5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, 44, 9, 5, 0.2, 0, Math.PI * 2); ctx.fill();
      }

      if (floating) {
        ctx.strokeStyle = 'rgba(148,163,184,0.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i += 1) {
          const dx = -22 + i * 10;
          ctx.beginPath();
          ctx.moveTo(dx, 86);
          ctx.lineTo(dx + 5, 102);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function darken(hex, amount) {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
      const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
      const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
      return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    fillSky();
    drawDepthParticles();

    const cloudCount = Math.round((hasAny(['cloud', 'sky', 'flying', 'floating']) ? 9 : 6) * Math.min(1.5, detailBoost));
    for (let i = 0; i < cloudCount; i += 1) {
      const depth = 0.4 + rand() * 0.8;
      drawCloudHQ(
        rand() * w * 0.88,
        h * (0.1 + rand() * 0.5),
        (0.45 + rand() * 0.95) * (0.85 + depth * 0.2),
        depth
      );
    }

    if (cityScene || (skyScene && needsPerson)) {
      drawCityPerspective();
    }

    if (needsPerson) {
      // Camera framing adjusts figure position
      let posX = w * 0.5;
      let posY = floating ? h * 0.54 : h * 0.79;
      if (cameraFrame === 'closeup') { posY = h * 0.68; }
      else if (cameraFrame === 'wide') { posY = h * 0.82; }
      else if (cameraFrame === 'birdseye') { posY = h * 0.55; }
      else if (cameraFrame === 'lowangle') { posY = h * 0.88; }
      const figureScale = Math.max(0.9, w / 960);
      drawFigure(posX, posY, figureScale);
    }

    if (hasAny(['bird', 'birds'])) {
      ctx.strokeStyle = 'rgba(15,23,42,0.72)';
      ctx.lineWidth = 2;
      const flock = Math.round((hasAny(['many', 'flock']) ? 10 : 4) * Math.min(1.6, detailBoost));
      for (let i = 0; i < flock; i += 1) {
        const bx = w * (0.08 + rand() * 0.84);
        const by = h * (0.16 + rand() * 0.35);
        const bs = 0.8 + rand() * 1.25;
        ctx.beginPath();
        ctx.moveTo(bx - 8 * bs, by);
        ctx.quadraticCurveTo(bx, by - 7 * bs, bx + 8 * bs, by);
        ctx.stroke();
      }
    }

    if (hasAny(['plane', 'airplane', 'jet'])) {
      const x = w * (0.2 + rand() * 0.6);
      const y = h * (0.2 + rand() * 0.18);
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 90, y + 12);
      ctx.lineTo(x + 8, y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + 12, y - 8, 34, 7);
      ctx.fillRect(x + 28, y + 22, 24, 6);
    }

    if (!text.trim()) {
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = i % 2 ? palette[1] : palette[2];
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, 24 + rand() * 90, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (let pass = 0; pass < (renderProfile.postPasses || 1); pass += 1) {
      enhanceImageData(ctx, w, h, styleLock, renderProfile);
    }
  }

  async function recordCanvasAnimation(canvas, drawFrame, durationSec, fps, options) {
    const opts = options || {};
    const stream = canvas.captureStream(fps);
    if (opts.audioTrack) {
      try {
        stream.addTrack(opts.audioTrack);
      } catch (_) {
        // Keep video export functional even if audio track attach fails.
      }
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const frameCollector = Array.isArray(opts.frameCollector) ? opts.frameCollector : null;
    recorder.start();
    const frames = Math.max(1, Math.floor(durationSec * fps));
    for (let i = 0; i < frames; i += 1) {
      if (typeof opts.beforeFrame === 'function') {
        await opts.beforeFrame((i + 1) / frames, i, frames, canvas);
      }
      drawFrame(i / frames, i, frames);
      if (typeof opts.onProgress === 'function') {
        opts.onProgress((i + 1) / frames, i, frames, canvas);
      }
      if (frameCollector && (i % Math.max(1, Math.round(fps / 6)) === 0 || i === frames - 1)) {
        frameCollector.push({ frame: i, time: i / fps, dataUrl: canvas.toDataURL('image/png') });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }

    const done = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.stop();
    await done;

    return {
      blob: new Blob(chunks, { type: recorder.mimeType || 'video/webm' }),
      mimeType: recorder.mimeType || 'video/webm',
    };
  }

  function createDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function nowMeta(tag) {
    return tag + ' · ' + new Date().toLocaleString();
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent || '';
    }
    button.disabled = !!busy;
    button.textContent = busy ? (busyLabel || 'Working...') : button.dataset.defaultLabel;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  async function createVideoPosterDataUrl(blob) {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    try {
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Unable to generate preview frame'));
        };
        const cleanup = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadeddata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.src = url;
      });

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function persistState(partialState) {
    const prev = loadState();
    localStorage.setItem(AI_STORE_KEY, JSON.stringify(Object.assign({}, prev, partialState)));
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(AI_STORE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function defaultCompositionFxPresets() {
    return {
      Clean: { brightness: 1, contrast: 1, saturation: 1, vignette: 0, monochrome: false },
      Cinematic: { brightness: 0.96, contrast: 1.18, saturation: 1.08, vignette: 0.26, monochrome: false },
      'Anime Punch': { brightness: 1.08, contrast: 1.14, saturation: 1.34, vignette: 0.12, monochrome: false },
      Noir: { brightness: 0.92, contrast: 1.24, saturation: 0.05, vignette: 0.34, monochrome: true },
    };
  }

  function normalizeCompositionFxRecord(raw) {
    const input = raw || {};
    return {
      brightness: clamp(Number(input.brightness || 1), 0.6, 1.6),
      contrast: clamp(Number(input.contrast || 1), 0.6, 1.6),
      saturation: clamp(Number(input.saturation || 1), 0, 2),
      vignette: clamp(Number(input.vignette || 0), 0, 0.8),
      monochrome: Boolean(input.monochrome),
    };
  }

  function normalizeCompositionFxPresetMap(raw) {
    const defaults = defaultCompositionFxPresets();
    const incoming = raw && typeof raw === 'object' ? raw : {};
    const merged = Object.assign({}, defaults, incoming);
    const out = {};
    Object.keys(merged).forEach((name) => {
      out[name] = normalizeCompositionFxRecord(merged[name]);
    });
    return out;
  }

  function loadPrefs() {
    try {
      const prefs = JSON.parse(localStorage.getItem(AI_PREFS_KEY) || '{}');
      const storedProvider = String(prefs.backendProvider || '').toLowerCase();
      const hasApiConfig = !!String(prefs.apiKey || '').trim() || !!String(prefs.customEndpoint || '').trim();
      const normalizedProvider = storedProvider
        ? ((storedProvider === 'none' && !hasApiConfig) ? 'pollinations' : storedProvider)
        : 'pollinations';
      return {
        toastDuration: clamp(Number(prefs.toastDuration || 2600), 1200, 7000),
        autoOpenProduction: !!prefs.autoOpenProduction,
        renderQuality: ['standard', 'high', 'ultra'].includes(String(prefs.renderQuality || '').toLowerCase())
          ? String(prefs.renderQuality).toLowerCase()
          : 'high',
        backendProvider: normalizedProvider,
        apiKey: prefs.apiKey || '',
        customEndpoint: prefs.customEndpoint || '',
        qualityThreshold: clamp(Number(prefs.qualityThreshold || 72), 20, 98),
        maxRegens: clamp(Number(prefs.maxRegens || 2), 0, 6),
        styleModels: Object.assign({
          anime: 'stabilityai/stable-diffusion-xl-base-1.0',
          cinematic: 'stabilityai/stable-diffusion-xl-base-1.0',
          manga: 'stabilityai/stable-diffusion-xl-base-1.0',
          concept: 'stabilityai/stable-diffusion-xl-base-1.0',
        }, prefs.styleModels || {}),
        moderationMode: ['off', 'standard', 'strict'].includes(String(prefs.moderationMode || '').toLowerCase())
          ? String(prefs.moderationMode).toLowerCase()
          : 'standard',
        blockedTerms: String(prefs.blockedTerms || ''),
        licenseProfile: prefs.licenseProfile || 'commercial',
        webhookUrl: String(prefs.webhookUrl || ''),
        identityProfiles: (prefs.identityProfiles && typeof prefs.identityProfiles === 'object') ? prefs.identityProfiles : {},
        fineTunePresets: (prefs.fineTunePresets && typeof prefs.fineTunePresets === 'object') ? prefs.fineTunePresets : {},
        activeFineTune: String(prefs.activeFineTune || ''),
        interpolationFactor: clamp(Number(prefs.interpolationFactor || 1), 0, 3),
        socialPreset: String(prefs.socialPreset || 'tiktok'),
        teamWorkspace: String(prefs.teamWorkspace || ''),
        compositionFxDefaults: normalizeCompositionFxRecord(prefs.compositionFxDefaults),
        compositionFxPresets: normalizeCompositionFxPresetMap(prefs.compositionFxPresets),
      };
    } catch (_) {
      return {
        toastDuration: 2600,
        autoOpenProduction: false,
        renderQuality: 'high',
        backendProvider: 'pollinations',
        apiKey: '',
        customEndpoint: '',
        qualityThreshold: 72,
        maxRegens: 2,
        styleModels: {
          anime: 'stabilityai/stable-diffusion-xl-base-1.0',
          cinematic: 'stabilityai/stable-diffusion-xl-base-1.0',
          manga: 'stabilityai/stable-diffusion-xl-base-1.0',
          concept: 'stabilityai/stable-diffusion-xl-base-1.0',
        },
        moderationMode: 'standard',
        blockedTerms: '',
        licenseProfile: 'commercial',
        webhookUrl: '',
        identityProfiles: {},
        fineTunePresets: {},
        activeFineTune: '',
        interpolationFactor: 1,
        socialPreset: 'tiktok',
        teamWorkspace: '',
        compositionFxDefaults: normalizeCompositionFxRecord(),
        compositionFxPresets: normalizeCompositionFxPresetMap(),
      };
    }
  }

  function persistPrefs(prefs) {
    localStorage.setItem(AI_PREFS_KEY, JSON.stringify(prefs));
  }

  function sizePresetToDimensions(value) {
    const parsed = String(value || '1280x720').split('x').map((v) => Number(v));
    return {
      width: clamp(parsed[0] || 1280, 256, 4096),
      height: clamp(parsed[1] || 720, 256, 4096),
    };
  }

  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) return new Blob([], { type: 'application/octet-stream' });
    const header = parts[0];
    const b64 = parts[1];
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function drawDataUrlToCanvas(dataUrl, targetCanvas) {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const ctx = targetCanvas.getContext('2d');
    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    ctx.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  function getStyleModel(style, prefs) {
    const map = prefs.styleModels || {};
    return map[style] || map.anime || 'stabilityai/stable-diffusion-xl-base-1.0';
  }

  function isLikelyBlankCanvas(canvas) {
    if (!canvas || canvas.width < 2 || canvas.height < 2) return true;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 16) {
      const l = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
      min = Math.min(min, l);
      max = Math.max(max, l);
    }
    return (max - min) < 4;
  }

  function pulseCanvasPreview(canvas) {
    if (!canvas) return;
    canvas.style.transition = 'box-shadow 180ms ease, border-color 180ms ease';
    canvas.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.35), 0 0 0 6px rgba(56, 189, 248, 0.15)';
    canvas.style.borderColor = '#38bdf8';
    setTimeout(() => {
      canvas.style.boxShadow = '';
      canvas.style.borderColor = '';
    }, 260);
  }

  function computeImageQualityScore(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    let lumaSum = 0;
    let lumaSq = 0;
    let edgeEnergy = 0;
    let satSum = 0;
    let count = 0;

    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumaSum += l;
        lumaSq += l * l;
        const maxc = Math.max(r, g, b);
        const minc = Math.min(r, g, b);
        satSum += maxc === 0 ? 0 : (maxc - minc) / maxc;

        const li = ((y - 1) * w + x) * 4;
        const ri = ((y + 1) * w + x) * 4;
        const ui = (y * w + (x - 1)) * 4;
        const di = (y * w + (x + 1)) * 4;
        const l1 = 0.2126 * data[li] + 0.7152 * data[li + 1] + 0.0722 * data[li + 2];
        const l2 = 0.2126 * data[ri] + 0.7152 * data[ri + 1] + 0.0722 * data[ri + 2];
        const l3 = 0.2126 * data[ui] + 0.7152 * data[ui + 1] + 0.0722 * data[ui + 2];
        const l4 = 0.2126 * data[di] + 0.7152 * data[di + 1] + 0.0722 * data[di + 2];
        edgeEnergy += Math.abs(l1 - l2) + Math.abs(l3 - l4);
        count += 1;
      }
    }

    const mean = lumaSum / Math.max(1, count);
    const variance = Math.max(0, (lumaSq / Math.max(1, count)) - mean * mean);
    const contrast = Math.sqrt(variance) / 128;
    const edge = edgeEnergy / Math.max(1, count) / 64;
    const sat = satSum / Math.max(1, count);

    const score = clamp((contrast * 34) + (edge * 38) + (sat * 28), 0, 100);
    return Number(score.toFixed(1));
  }

  async function generateRemoteImageDataUrl(promptPackage, style, sizeValue, prefs) {
    lastRemoteGenerateError = '';
    if (!prefs || !prefs.backendProvider || prefs.backendProvider === 'none') {
      lastRemoteGenerateError = 'No backend provider selected';
      return null;
    }
    const { width, height } = sizePresetToDimensions(sizeValue);
    const model = getStyleModel(style, prefs);

    // Prefer backend route first for provider retries/configuration in one place.
    try {
      const backendAspect = width === height ? '1:1' : (height > width ? '9:16' : '16:9');
      const backendRes = await fetch(backendApiUrl('/api/cap-anime/generate-image/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptPackage.expandedPrompt || promptPackage.rawPrompt || 'anime key art',
          aspect: backendAspect,
          model: style === 'manga' ? 'sdxl' : 'flux',
          seed: Number(aiSeedLock?.checked ? (aiSeedValue?.value || 0) : Math.floor(Math.random() * 9999999)),
        }),
      });
      const backendPayload = await backendRes.json().catch(() => ({}));
      if (backendRes.ok && backendPayload && backendPayload.ok && backendPayload.image) {
        return backendPayload.image;
      }
      if (!backendRes.ok) {
        lastRemoteGenerateError = (backendPayload && backendPayload.error) || ('Backend image HTTP ' + backendRes.status);
      }
    } catch (_) {
      // Continue with direct provider fallback.
    }

    if (prefs.backendProvider === 'pollinations') {
      const prompt = encodeURIComponent(promptPackage.expandedPrompt || 'anime key art');
      const seed = Number(aiSeedLock?.checked ? (aiSeedValue?.value || 0) : Math.floor(Math.random() * 9999999));
      const endpoint = `https://image.pollinations.ai/prompt/${prompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      try {
        const res = await fetch(endpoint, { method: 'GET' });
        if (!res.ok) {
          lastRemoteGenerateError = `Pollinations HTTP ${res.status}`;
          return null;
        }
        const blob = await res.blob();
        if (!blob || !blob.type.startsWith('image/')) {
          lastRemoteGenerateError = 'Pollinations did not return an image';
          return null;
        }
        return await dataUrlFromBlob(blob);
      } catch (err) {
        lastRemoteGenerateError = err?.message || 'Pollinations request failed';
        return null;
      }
    }

    if (!prefs.apiKey) {
      lastRemoteGenerateError = 'API key is missing';
      return null;
    }

    if (prefs.backendProvider === 'huggingface') {
      const endpoint = (prefs.customEndpoint || '').trim() || `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${prefs.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `${promptPackage.expandedPrompt}\nNegative prompt: ${promptPackage.negativePrompt}`,
            parameters: {
              negative_prompt: promptPackage.negativePrompt,
              width,
              height,
              guidance_scale: 7,
              num_inference_steps: 30,
            },
            options: {
              wait_for_model: true,
            },
          }),
        });
        if (!res.ok) {
          lastRemoteGenerateError = `Hugging Face HTTP ${res.status}`;
          return null;
        }
        const blob = await res.blob();
        if (!blob || !blob.type.startsWith('image/')) {
          lastRemoteGenerateError = 'Hugging Face did not return an image';
          return null;
        }
        return await dataUrlFromBlob(blob);
      } catch (err) {
        lastRemoteGenerateError = err?.message || 'Hugging Face request failed';
        return null;
      }
    }

    if (prefs.backendProvider === 'custom') {
      const endpoint = (prefs.customEndpoint || '').trim();
      if (!endpoint) {
        lastRemoteGenerateError = 'Custom endpoint URL is missing';
        return null;
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${prefs.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptPackage.expandedPrompt,
            negative_prompt: promptPackage.negativePrompt,
            style,
            model,
            width,
            height,
            camera: promptPackage.camera,
          }),
        });
        if (!res.ok) {
          lastRemoteGenerateError = `Custom endpoint HTTP ${res.status}`;
          return null;
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const payload = await res.json();
          if (payload.imageBase64) return `data:image/png;base64,${payload.imageBase64}`;
          if (payload.imageDataUrl) return payload.imageDataUrl;
          if (payload.imageUrl) {
            const imgRes = await fetch(payload.imageUrl);
            if (!imgRes.ok) {
              lastRemoteGenerateError = `imageUrl fetch HTTP ${imgRes.status}`;
              return null;
            }
            const blob = await imgRes.blob();
            return await dataUrlFromBlob(blob);
          }
          lastRemoteGenerateError = 'Custom endpoint JSON missing image fields';
          return null;
        }
        const blob = await res.blob();
        if (!blob || !blob.type.startsWith('image/')) {
          lastRemoteGenerateError = 'Custom endpoint did not return an image';
          return null;
        }
        return await dataUrlFromBlob(blob);
      } catch (err) {
        lastRemoteGenerateError = err?.message || 'Custom endpoint request failed';
        return null;
      }
    }

    lastRemoteGenerateError = `Unsupported provider: ${prefs.backendProvider}`;
    return null;
  }

  const IMAGE_PRESETS = {
    'ember-samurai': {
      prompt: 'Ashurai samurai in burning rain, torn cloak, katana raised, cinematic embers and dramatic rim light',
      style: 'cinematic',
      size: '1280x720',
    },
    'sky-ruins': {
      prompt: 'Floating sky ruins at dawn with shattered bridges and storm clouds opening to sunlight',
      style: 'concept',
      size: '1280x720',
    },
    'void-courtyard': {
      prompt: 'Two rivals duel in a void-lit courtyard with ink shadows and moon halos, manga panel framing',
      style: 'manga',
      size: '1024x1024',
    },
    'night-market': {
      prompt: 'Neon-lit market street in Ironspire with masked vendors, wet stone reflections, anime color grade',
      style: 'anime',
      size: '1080x1350',
    },
  };

  const VIDEO_PRESETS = {
    'power-rise': {
      prompt: 'Hero powers up as energy rings pulse outward and camera pushes in through sparks',
      mood: 'heroic',
      duration: 7,
    },
    'alley-chase': {
      prompt: 'High-speed alley chase with tight turns, drifting debris, and whipping camera movement',
      mood: 'intense',
      duration: 8,
    },
    'void-burst': {
      prompt: 'Void energy implodes then erupts in a single frame shockwave around the caster',
      mood: 'horror',
      duration: 6,
    },
    'forest-awaken': {
      prompt: 'Ancient forest spirit awakens as glowing roots spiral upward and mist rolls in',
      mood: 'mystic',
      duration: 9,
    },
  };

  const SCENE_PRESETS = {
    'ironspire-clash': {
      prompt: '30-second clash in Ironspire alley, thunder cracks, steel sparks, final stillness on the victor',
      shots: 8,
      pacing: 'balanced',
    },
    'citadel-breach': {
      prompt: 'Assault team breaches citadel gates under cannon fire, split focus between commander and frontline',
      shots: 10,
      pacing: 'fast',
    },
    'void-ritual': {
      prompt: 'Ritual chamber sequence where a void seal breaks slowly, whispers rise, and shadows consume torches',
      shots: 7,
      pacing: 'slow',
    },
    'last-stand': {
      prompt: 'Last stand at Ember Gate with exhausted defenders, collapsing walls, and one final counterstrike',
      shots: 12,
      pacing: 'fast',
    },
  };

  // ===== HELPER FUNCTIONS FOR NEW FEATURES =====
  function initializeTheme() {
    const isDark = localStorage.getItem('cap_theme') !== 'light';
    if (!isDark) document.documentElement.classList.add('light-theme');
    updateThemeButton();
  }

  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains('light-theme');
    if (isDark) {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('cap_theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('cap_theme', 'dark');
    }
    updateThemeButton();
  }

  function updateThemeButton() {
    const btnTheme = $('btnThemeToggle');
    if (!btnTheme) return;
    const isDark = !document.documentElement.classList.contains('light-theme');
    btnTheme.textContent = isDark ? '☀️' : '🌙';
  }

  function renderHistoryFiltered() {
    const search = $('aiHistorySearch')?.value?.toLowerCase() || '';
    const filter = $('aiHistoryFilter')?.value || '';
    const historyList = $('aiHistoryList');
    if (!historyList) return;

    let items = loadHistory();
    if (filter === 'favorites') items = items.filter((i) => i.favorite);
    if (search) items = items.filter((i) => (i.prompt || '').toLowerCase().includes(search));
    
    historyList.innerHTML = '';
    items.slice().reverse().forEach((item) => {
      const el = document.createElement('div');
      el.className = 'ai-history-item';
      el.innerHTML = `
        <img src="${item.thumbnail}" class="ai-history-thumbnail" alt="${item.prompt}" onclick="(() => {const canvas=$('aiImageCanvas'); const img=new Image(); img.onload=()=>{const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);}; img.src='${item.thumbnail}';})();" />
        <div class="ai-history-info">
          <div class="ai-history-prompt">${item.prompt}</div>
          <div class="ai-history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
        </div>
        <div class="ai-history-favorite" onclick="event.stopPropagation(); toggleFavorite('${item.id}'); renderHistoryFiltered();">${item.favorite ? '♥' : '♡'}</div>
      `;
      historyList.appendChild(el);
    });
  }

  function init() {
    const section = $('ai-generator');
    if (!section) return;


    const imageCanvas = $('aiImageCanvas');
    const imagePrompt = $('aiImagePrompt');
    const imageStyle = $('aiImageStyle');
    const imageSize = $('aiImageSize');

    const videoPrompt = $('aiVideoPrompt');
    const videoDuration = $('aiVideoDuration');
    const videoMood = $('aiVideoMood');
    const clipPreview = $('aiClipPreview');

    const trailerTitle = $('aiTrailerTitle');
    const trailerDuration = $('aiTrailerDuration');
    const trailerPreview = $('aiTrailerPreview');

    const imagePreset = $('aiImagePreset');
    const videoPreset = $('aiVideoPreset');
    const scenePreset = $('aiScenePreset');
    const toastDurationInput = $('aiToastDuration');
    const autoOpenProductionInput = $('aiAutoOpenProduction');
    const renderQualityInput = $('aiRenderQuality');
    const aiSettingsPanelBtn = $('btnAiSettingsPanel');
    const aiAdvancedSettingsWrap = $('aiAdvancedSettingsWrap');
    
    // Advanced generation controls
    const aiImageSize = $('aiImageSize');
    const aiCustomAspectWrap = $('aiCustomAspectWrap');
    const aiCustomWidth = $('aiCustomWidth');
    const aiCustomHeight = $('aiCustomHeight');
    const aiSeedLock = $('aiSeedLock');
    const aiSeedValue = $('aiSeedValue');
    const aiGuidanceScale = $('aiGuidanceScale');
    const aiGuidanceValue = $('aiGuidanceValue');
    const aiSamplingMethod = $('aiSamplingMethod');
    const aiSteps = $('aiSteps');
    const aiStepsValue = $('aiStepsValue');
    const aiExportFormat = $('aiExportFormat');
    const aiBatchCount = $('aiBatchCount');
    const aiImageSourceUpload = $('aiImageSourceUpload');
    const aiImageTransformStrength = $('aiImageTransformStrength');
    const aiImageTransformStrengthValue = $('aiImageTransformStrengthValue');
    const aiTileablePattern = $('aiTileablePattern');
    const aiMaskPaintMode = $('aiMaskPaintMode');
    const aiMaskBrushSize = $('aiMaskBrushSize');
    const aiMaskBrushSizeValue = $('aiMaskBrushSizeValue');
    const aiMaskEraseMode = $('aiMaskEraseMode');
    const aiMaskRectMode = $('aiMaskRectMode');
    const aiMaskPresetName = $('aiMaskPresetName');
    const aiMaskPresetSelect = $('aiMaskPresetSelect');
    const aiMaskCanvas = $('aiMaskCanvas');
    const aiCanvasViewport = $('aiCanvasViewport');
    const aiCanvasStack = $('aiCanvasStack');
    const aiGridOverlay = $('aiGridOverlay');
    const btnCanvasZoomOut = $('btnCanvasZoomOut');
    const btnCanvasZoomIn = $('btnCanvasZoomIn');
    const btnCanvasResetView = $('btnCanvasResetView');
    const aiCanvasGridToggle = $('aiCanvasGridToggle');
    const aiCanvasPanMode = $('aiCanvasPanMode');
    const btnClearMask = $('btnClearMask');
    const btnFillBorderMask = $('btnFillBorderMask');
    const btnSaveMaskPreset = $('btnSaveMaskPreset');
    const btnLoadMaskPreset = $('btnLoadMaskPreset');
    const btnDeleteMaskPreset = $('btnDeleteMaskPreset');
    const aiOutpaintDirection = $('aiOutpaintDirection');
    const btnRemixSubtle = $('btnRemixSubtle');
    const btnRemixWild = $('btnRemixWild');
    const btnOutpaintExpand = $('btnOutpaintExpand');
    const btnUpscale4x = $('btnUpscale4x');
    const btnUpscale8x = $('btnUpscale8x');
    const aiImageProgressiveBar = $('aiImageProgressiveBar');
    const aiImageProgressiveStatus = $('aiImageProgressiveStatus');
    const btnUndoGeneration = $('btnUndoGeneration');
    const btnRedoGeneration = $('btnRedoGeneration');
    const btnCancelGeneration = $('btnCancelGeneration');
    const aiGenerationQueue = $('aiGenerationQueue');
    const aiQueueCount = $('aiQueueCount');
    const aiQueueList = $('aiQueueList');
    
    // Comparison and history
    const aiComparisonPanel = $('aiComparisonPanel');
    const aiCompareCanvasA = $('aiCompareCanvasA');
    const aiCompareCanvasB = $('aiCompareCanvasB');
    const btnCompareMode = $('btnCompareMode');
    const btnSwapComparison = $('btnSwapComparison');
    const btnExitComparison = $('btnExitComparison');
    const aiHistoryPanel = $('aiHistoryPanel');
    const aiHistorySearch = $('aiHistorySearch');
    const aiHistoryFilter = $('aiHistoryFilter');
    const aiHistoryList = $('aiHistoryList');
    const btnAddToFavorites = $('btnAddToFavorites');
    const btnThemeToggle = $('btnThemeToggle');
    const aiVideoMotionPath = $('aiVideoMotionPath');
    const aiClipProgressiveBar = $('aiClipProgressiveBar');
    const aiClipProgressiveStatus = $('aiClipProgressiveStatus');
    const aiClipScrubber = $('aiClipScrubber');
    const aiClipScrubberLabel = $('aiClipScrubberLabel');
    const btnExportClipFrames = $('btnExportClipFrames');
    const btnExportClipSidecar = $('btnExportClipSidecar');
    const aiClipExportFps = $('aiClipExportFps');
    const aiClipTrimStart = $('aiClipTrimStart');
    const aiClipTrimEnd = $('aiClipTrimEnd');
    const aiClipExportPreset = $('aiClipExportPreset');
    const btnAddClipToComposition = $('btnAddClipToComposition');
    const btnAddTrailerToComposition = $('btnAddTrailerToComposition');
    const aiCompositionList = $('aiCompositionList');
    const aiCompositionPreset = $('aiCompositionPreset');
    const aiCompositionFps = $('aiCompositionFps');
    const aiCompositionTransition = $('aiCompositionTransition');
    const aiCompositionTransitionEase = $('aiCompositionTransitionEase');
    const aiCompositionDuckEnable = $('aiCompositionDuckEnable');
    const aiCompositionDuckAmount = $('aiCompositionDuckAmount');
    const aiCompositionDuckAttack = $('aiCompositionDuckAttack');
    const aiCompositionDuckRelease = $('aiCompositionDuckRelease');
    const aiCompositionExportPack = $('aiCompositionExportPack');
    const btnApplyCompositionExportPack = $('btnApplyCompositionExportPack');
    const btnClearComposition = $('btnClearComposition');
    const btnExportComposition = $('btnExportComposition');
    const aiCompositionTitleText = $('aiCompositionTitleText');
    const aiCompositionSubtitleText = $('aiCompositionSubtitleText');
    const aiCompositionTitleDuration = $('aiCompositionTitleDuration');
    const btnAddTitleLayer = $('btnAddTitleLayer');
    const aiOverlayImageUpload = $('aiOverlayImageUpload');
    const aiOverlayStart = $('aiOverlayStart');
    const aiOverlayDuration = $('aiOverlayDuration');
    const aiOverlayOpacity = $('aiOverlayOpacity');
    const aiOverlayX = $('aiOverlayX');
    const aiOverlayY = $('aiOverlayY');
    const aiOverlayScale = $('aiOverlayScale');
    const aiOverlayFadeIn = $('aiOverlayFadeIn');
    const aiOverlayFadeOut = $('aiOverlayFadeOut');
    const aiOverlayBlendMode = $('aiOverlayBlendMode');
    const aiOverlayMotionPath = $('aiOverlayMotionPath');
    const aiOverlayMotionStrength = $('aiOverlayMotionStrength');
    const aiOverlayEase = $('aiOverlayEase');
    const aiOverlayPathInterp = $('aiOverlayPathInterp');
    const aiOverlayBezierTension = $('aiOverlayBezierTension');
    const aiOverlayKeyframes = $('aiOverlayKeyframes');
    const aiOverlayPathCanvas = $('aiOverlayPathCanvas');
    const btnOverlayPreviewPath = $('btnOverlayPreviewPath');
    const btnOverlayUndoKeyframes = $('btnOverlayUndoKeyframes');
    const btnOverlayRedoKeyframes = $('btnOverlayRedoKeyframes');
    const btnOverlayClearKeyframes = $('btnOverlayClearKeyframes');
    const aiOverlayTitleText = $('aiOverlayTitleText');
    const aiOverlayTitleSize = $('aiOverlayTitleSize');
    const btnAddImageOverlay = $('btnAddImageOverlay');
    const btnAddTextOverlay = $('btnAddTextOverlay');
    const aiOverlayList = $('aiOverlayList');
    const aiFxBrightness = $('aiFxBrightness');
    const aiFxContrast = $('aiFxContrast');
    const aiFxSaturation = $('aiFxSaturation');
    const aiFxVignette = $('aiFxVignette');
    const aiFxMonochrome = $('aiFxMonochrome');
    const aiFxPresetName = $('aiFxPresetName');
    const aiFxPresetSelect = $('aiFxPresetSelect');
    const btnSaveCompositionFxPreset = $('btnSaveCompositionFxPreset');
    const btnApplyCompositionFxPreset = $('btnApplyCompositionFxPreset');
    const btnDeleteCompositionFxPreset = $('btnDeleteCompositionFxPreset');
    const btnResetCompositionFx = $('btnResetCompositionFx');
    const aiAudioUpload = $('aiAudioUpload');
    const btnAnalyzeAudio = $('btnAnalyzeAudio');
    const btnApplyDialogueTiming = $('btnApplyDialogueTiming');
    const aiAudioWaveform = $('aiAudioWaveform');
    const aiDialogueLines = $('aiDialogueLines');
    const aiDialogueCueList = $('aiDialogueCueList');

    const toggleShortcutHelpBtn = $('btnToggleShortcutHelp');
    const shortcutHelp = $('aiShortcutHelp');
    const recentOutputsEl = $('aiRecentOutputs');
    const clearRecentBtn = $('btnClearRecentOutputs');

    const toastRegion = $('aiToastRegion');

    const scenePrompt = $('aiScenePrompt');
    const sceneShots = $('aiSceneShots');
    const sceneDuration = $('aiSceneDuration');
    const sceneTimingMode = $('aiSceneTimingMode');
    const sceneCustomDurations = $('aiSceneCustomDurations');
    const sceneTimingTemplates = $('aiSceneTimingTemplates');
    const btnSceneTimingFastCurve = $('btnSceneTimingFastCurve');
    const btnSceneTimingDramaticRamp = $('btnSceneTimingDramaticRamp');
    const btnSceneTimingFinaleBurst = $('btnSceneTimingFinaleBurst');
    const btnSceneTimingPreview = $('btnSceneTimingPreview');
    const btnSceneTimingClear = $('btnSceneTimingClear');
    const sceneTimingGraph = $('aiSceneTimingGraph');
    const scenePacing = $('aiScenePacing');
    const scenePlan = $('aiScenePlan');
    const sceneDurationDisplay = $('aiSceneDurationDisplay');
    const backendProviderInput = $('aiBackendProvider');
    const apiKeyInput = $('aiApiKey');
    const customEndpointInput = $('aiCustomEndpoint');
    const qualityThresholdInput = $('aiQualityThreshold');
    const maxRegensInput = $('aiMaxRegens');
    const modelAnimeInput = $('aiModelAnime');
    const modelCinematicInput = $('aiModelCinematic');
    const modelMangaInput = $('aiModelManga');
    const modelConceptInput = $('aiModelConcept');
    const aiModerationMode = $('aiModerationMode');
    const aiBlockedTerms = $('aiBlockedTerms');
    const aiLicenseProfile = $('aiLicenseProfile');
    const aiWebhookUrl = $('aiWebhookUrl');
    const btnTestWebhook = $('btnTestWebhook');
    const aiIdentityProfile = $('aiIdentityProfile');
    const aiFaceReferenceUpload = $('aiFaceReferenceUpload');
    const btnSaveIdentityProfile = $('btnSaveIdentityProfile');
    const aiPromptEditInstruction = $('aiPromptEditInstruction');
    const btnApplyPromptEdit = $('btnApplyPromptEdit');
    const aiFineTuneName = $('aiFineTuneName');
    const aiFineTuneStrength = $('aiFineTuneStrength');
    const btnSaveFineTunePreset = $('btnSaveFineTunePreset');
    const btnGenerateTextToVideo = $('btnGenerateTextToVideo');
    const btnAnimateImageToVideo = $('btnAnimateImageToVideo');
    const aiInterpolationFactor = $('aiInterpolationFactor');
    const btnInterpolateClip = $('btnInterpolateClip');
    const aiDubScript = $('aiDubScript');
    const aiDubLanguage = $('aiDubLanguage');
    const btnGenerateDub = $('btnGenerateDub');
    const aiSoundtrackMood = $('aiSoundtrackMood');
    const aiSoundtrackDuration = $('aiSoundtrackDuration');
    const btnGenerateSoundtrack = $('btnGenerateSoundtrack');
    const aiTeamWorkspace = $('aiTeamWorkspace');
    const aiReviewNotes = $('aiReviewNotes');
    const btnSubmitForReview = $('btnSubmitForReview');
    const btnApproveReview = $('btnApproveReview');
    const aiSocialPreset = $('aiSocialPreset');
    const btnExportSocialPreset = $('btnExportSocialPreset');

    let latestImageDataUrl = '';
    let latestClipBlob = null;
    let latestTrailerBlob = null;
    let latestScenePlan = null;
    let latestClipPreviewUrl = '';
    let latestTrailerPreviewUrl = '';
    let latestImagePromptPackage = null;
    let latestClipPromptPackage = null;
    let latestTrailerPromptPackage = null;
    let latestScenePromptPackage = null;
    let latestSourceImage = null;
    let latestClipFrames = [];
    let latestBaseImageDataUrl = '';
    let remixMode = '';
    let outpaintPadding = 0;
    let outpaintDirection = 'all';
    let maskPainting = false;
    let maskRectStart = null;
    let maskRectSnapshot = null;
    let canvasView = { scale: 1, x: 0, y: 0 };
    let canvasPanning = false;
    let canvasPanStart = null;
    let compositionQueue = [];
    let compositionOverlays = [];
    let compositionFx = normalizeCompositionFxRecord();
    let latestAudioAnalysis = null;
    let latestGeneratedAudioBlob = null;
    let latestDialogueCues = [];
    let overlayKeyframeDrag = null;
    let overlayKeyframeDragMoved = false;
    let overlaySelectedKeyframeIndex = -1;
    let overlaySegmentTensions = [];
    let overlayBezierHandleHits = [];
    let overlayBezierHandleDrag = null;
    let overlayKeyframeHistory = [];
    let overlayKeyframeFuture = [];
    let overlayTouchTracking = false;

    const cached = loadState();
    const prefs = loadPrefs();
    if (cached.imagePrompt) imagePrompt.value = cached.imagePrompt;
    if (cached.videoPrompt) videoPrompt.value = cached.videoPrompt;
    if (cached.scenePrompt) scenePrompt.value = cached.scenePrompt;
    if (cached.sceneDuration) sceneDuration.value = String(clamp(Number(cached.sceneDuration), 6, 180));
    if (cached.sceneTimingMode) sceneTimingMode.value = cached.sceneTimingMode;
    if (cached.sceneCustomDurations) sceneCustomDurations.value = cached.sceneCustomDurations;
    if (toastDurationInput) toastDurationInput.value = String(prefs.toastDuration);
    if (autoOpenProductionInput) autoOpenProductionInput.checked = prefs.autoOpenProduction;
    if (renderQualityInput) renderQualityInput.value = prefs.renderQuality || 'high';
    if (backendProviderInput) backendProviderInput.value = prefs.backendProvider;
    if (apiKeyInput) apiKeyInput.value = prefs.apiKey || '';
    if (customEndpointInput) customEndpointInput.value = prefs.customEndpoint || '';
    if (qualityThresholdInput) qualityThresholdInput.value = String(prefs.qualityThreshold);
    if (maxRegensInput) maxRegensInput.value = String(prefs.maxRegens);
    if (modelAnimeInput) modelAnimeInput.value = prefs.styleModels.anime || '';
    if (modelCinematicInput) modelCinematicInput.value = prefs.styleModels.cinematic || '';
    if (modelMangaInput) modelMangaInput.value = prefs.styleModels.manga || '';
    if (modelConceptInput) modelConceptInput.value = prefs.styleModels.concept || '';
    if (aiModerationMode) aiModerationMode.value = prefs.moderationMode || 'standard';
    if (aiBlockedTerms) aiBlockedTerms.value = prefs.blockedTerms || '';
    if (aiLicenseProfile) aiLicenseProfile.value = prefs.licenseProfile || 'commercial';
    if (aiWebhookUrl) aiWebhookUrl.value = prefs.webhookUrl || '';
    if (aiInterpolationFactor) aiInterpolationFactor.value = String(prefs.interpolationFactor || 1);
    if (aiSocialPreset) aiSocialPreset.value = prefs.socialPreset || 'tiktok';
    if (aiTeamWorkspace) aiTeamWorkspace.value = prefs.teamWorkspace || '';
    if (aiFxBrightness) aiFxBrightness.value = String(prefs.compositionFxDefaults.brightness);
    if (aiFxContrast) aiFxContrast.value = String(prefs.compositionFxDefaults.contrast);
    if (aiFxSaturation) aiFxSaturation.value = String(prefs.compositionFxDefaults.saturation);
    if (aiFxVignette) aiFxVignette.value = String(prefs.compositionFxDefaults.vignette);
    if (aiFxMonochrome) aiFxMonochrome.checked = !!prefs.compositionFxDefaults.monochrome;
    setAiSettingsPanelOpen(false);

    function showToast(message, kind) {
      if (!toastRegion) return;
      const toast = document.createElement('div');
      toast.className = 'ai-toast ' + (kind || 'info');
      toast.textContent = message;
      toastRegion.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 180);
      }, prefs.toastDuration);
    }

    function openProduction(message) {
      const navItem = document.querySelector('.nav-item[data-section="production"]');
      if (navItem) navItem.click();
      const statusMsg = document.getElementById('statusMsg');
      if (statusMsg && message) statusMsg.textContent = message;
    }

    function saveInputsState() {
      persistState({
        imagePrompt: imagePrompt.value,
        videoPrompt: videoPrompt.value,
        scenePrompt: scenePrompt.value,
        sceneDuration: sceneDuration.value,
        sceneTimingMode: sceneTimingMode.value,
        sceneCustomDurations: sceneCustomDurations.value,
      });
    }

    function toggleShortcutHelp() {
      if (!shortcutHelp || !toggleShortcutHelpBtn) return;
      const hidden = shortcutHelp.hidden;
      shortcutHelp.hidden = !hidden;
      toggleShortcutHelpBtn.textContent = hidden ? 'Hide Shortcut Cheat Sheet' : 'Show Shortcut Cheat Sheet';
    }

    function setAiSettingsPanelOpen(open) {
      if (!aiAdvancedSettingsWrap || !aiSettingsPanelBtn) return;
      const shouldOpen = !!open;
      aiAdvancedSettingsWrap.hidden = !shouldOpen;
      aiSettingsPanelBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    function toggleAiSettingsPanel() {
      if (!aiAdvancedSettingsWrap) return;
      setAiSettingsPanelOpen(aiAdvancedSettingsWrap.hidden);
    }

    function syncMaskCanvasSize() {
      if (!aiMaskCanvas || !imageCanvas) return;
      aiMaskCanvas.width = imageCanvas.width;
      aiMaskCanvas.height = imageCanvas.height;
      aiMaskCanvas.classList.toggle('is-passive', !aiMaskPaintMode?.checked);
      repaintMaskOverlay();
    }

    function getMaskContext() {
      return aiMaskCanvas ? aiMaskCanvas.getContext('2d') : null;
    }

    function repaintMaskOverlay() {
      const maskCtx = getMaskContext();
      if (!maskCtx || !aiMaskCanvas) return;
      const img = maskCtx.getImageData(0, 0, aiMaskCanvas.width, aiMaskCanvas.height);
      let hasMask = false;
      for (let i = 3; i < img.data.length; i += 4) {
        if (img.data[i] > 0) {
          hasMask = true;
          break;
        }
      }
      aiMaskCanvas.style.opacity = hasMask ? '1' : '0.65';
    }

    function clearMaskCanvas() {
      const maskCtx = getMaskContext();
      if (!maskCtx || !aiMaskCanvas) return;
      maskCtx.clearRect(0, 0, aiMaskCanvas.width, aiMaskCanvas.height);
      repaintMaskOverlay();
    }

    function renderMaskPresetOptions(selectedName) {
      if (!aiMaskPresetSelect) return;
      const presets = loadMaskPresetMap();
      const names = Object.keys(presets).sort((a, b) => a.localeCompare(b));
      aiMaskPresetSelect.innerHTML = '<option value="">Saved Mask Presets</option>';
      names.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (selectedName && selectedName === name) option.selected = true;
        aiMaskPresetSelect.appendChild(option);
      });
    }

    function saveMaskPreset(name) {
      if (!aiMaskCanvas || !name) return false;
      try {
        const presets = loadMaskPresetMap();
        presets[name] = aiMaskCanvas.toDataURL('image/png');
        saveMaskPresetMap(presets);
        renderMaskPresetOptions(name);
        return true;
      } catch (_) {
        return false;
      }
    }

    async function loadMaskPreset(name) {
      const presets = loadMaskPresetMap();
      const dataUrl = presets[name || ''];
      if (!dataUrl || !aiMaskCanvas) return false;
      const img = await loadImageFromUrl(dataUrl).catch(() => null);
      const maskCtx = getMaskContext();
      if (!img || !maskCtx) return false;
      maskCtx.clearRect(0, 0, aiMaskCanvas.width, aiMaskCanvas.height);
      maskCtx.drawImage(img, 0, 0, aiMaskCanvas.width, aiMaskCanvas.height);
      repaintMaskOverlay();
      return true;
    }

    function deleteMaskPreset(name) {
      if (!name) return false;
      const presets = loadMaskPresetMap();
      if (!presets[name]) return false;
      delete presets[name];
      saveMaskPresetMap(presets);
      renderMaskPresetOptions('');
      return true;
    }

    function hasMaskPixels() {
      const maskCtx = getMaskContext();
      if (!maskCtx || !aiMaskCanvas) return false;
      const img = maskCtx.getImageData(0, 0, aiMaskCanvas.width, aiMaskCanvas.height).data;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] > 0) return true;
      }
      return false;
    }

    function fillBorderMask(direction) {
      const maskCtx = getMaskContext();
      if (!maskCtx || !aiMaskCanvas) return;
      const border = Math.max(28, Math.round(Math.min(aiMaskCanvas.width, aiMaskCanvas.height) * 0.08));
      const dir = direction || outpaintDirection || 'all';
      maskCtx.clearRect(0, 0, aiMaskCanvas.width, aiMaskCanvas.height);
      maskCtx.fillStyle = 'rgba(56,189,248,0.34)';
      if (dir === 'all' || dir === 'top') maskCtx.fillRect(0, 0, aiMaskCanvas.width, border);
      if (dir === 'all' || dir === 'bottom') maskCtx.fillRect(0, aiMaskCanvas.height - border, aiMaskCanvas.width, border);
      if (dir === 'all' || dir === 'left') maskCtx.fillRect(0, 0, border, aiMaskCanvas.height);
      if (dir === 'all' || dir === 'right') maskCtx.fillRect(aiMaskCanvas.width - border, 0, border, aiMaskCanvas.height);
      repaintMaskOverlay();
    }

    function drawMaskStroke(event) {
      if (!maskPainting || !aiMaskCanvas) return;
      const maskCtx = getMaskContext();
      if (!maskCtx) return;
      const rect = aiMaskCanvas.getBoundingClientRect();
      const scaleX = aiMaskCanvas.width / Math.max(rect.width, 1);
      const scaleY = aiMaskCanvas.height / Math.max(rect.height, 1);
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const eraseMode = !!aiMaskEraseMode?.checked;
      maskCtx.save();
      maskCtx.globalCompositeOperation = eraseMode ? 'destination-out' : 'source-over';
      maskCtx.fillStyle = eraseMode ? 'rgba(0,0,0,1)' : 'rgba(56,189,248,0.34)';
      maskCtx.strokeStyle = eraseMode ? 'rgba(0,0,0,1)' : 'rgba(56,189,248,0.34)';
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = clamp(Number(aiMaskBrushSize?.value || 32), 8, 120);
      if (typeof drawMaskStroke.lastX !== 'number') {
        drawMaskStroke.lastX = x;
        drawMaskStroke.lastY = y;
      }
      maskCtx.beginPath();
      maskCtx.moveTo(drawMaskStroke.lastX, drawMaskStroke.lastY);
      maskCtx.lineTo(x, y);
      maskCtx.stroke();
      maskCtx.restore();
      drawMaskStroke.lastX = x;
      drawMaskStroke.lastY = y;
      repaintMaskOverlay();
    }

    function getMaskPoint(event) {
      if (!aiMaskCanvas) return null;
      const rect = aiMaskCanvas.getBoundingClientRect();
      const scaleX = aiMaskCanvas.width / Math.max(rect.width, 1);
      const scaleY = aiMaskCanvas.height / Math.max(rect.height, 1);
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    function drawMaskRectangle(start, end) {
      if (!start || !end) return;
      const maskCtx = getMaskContext();
      if (!maskCtx) return;
      const eraseMode = !!aiMaskEraseMode?.checked;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      maskCtx.save();
      maskCtx.globalCompositeOperation = eraseMode ? 'destination-out' : 'source-over';
      maskCtx.fillStyle = eraseMode ? 'rgba(0,0,0,1)' : 'rgba(56,189,248,0.34)';
      maskCtx.fillRect(x, y, w, h);
      maskCtx.restore();
      repaintMaskOverlay();
    }

    function previewMaskRectangle(start, end) {
      if (!start || !end) return;
      const maskCtx = getMaskContext();
      if (!maskCtx || !maskRectSnapshot || !aiMaskCanvas) return;
      maskCtx.putImageData(maskRectSnapshot, 0, 0);
      const eraseMode = !!aiMaskEraseMode?.checked;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      maskCtx.save();
      maskCtx.fillStyle = eraseMode ? 'rgba(239,68,68,0.18)' : 'rgba(56,189,248,0.22)';
      maskCtx.strokeStyle = eraseMode ? 'rgba(239,68,68,0.8)' : 'rgba(56,189,248,0.8)';
      maskCtx.lineWidth = 2;
      maskCtx.setLineDash([8, 6]);
      maskCtx.fillRect(x, y, w, h);
      maskCtx.strokeRect(x, y, w, h);
      maskCtx.restore();
      repaintMaskOverlay();
    }

    function dataUrlToUint8Array(dataUrl) {
      const base64 = String(dataUrl || '').split(',')[1] || '';
      const binary = atob(base64);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }

    function textToUint8Array(text) {
      return new TextEncoder().encode(String(text || ''));
    }

    function crc32(bytes) {
      let crc = -1;
      for (let i = 0; i < bytes.length; i += 1) {
        crc ^= bytes[i];
        for (let bit = 0; bit < 8; bit += 1) {
          crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
      }
      return (crc ^ -1) >>> 0;
    }

    function uint16LE(value) {
      return [value & 0xff, (value >>> 8) & 0xff];
    }

    function uint32LE(value) {
      return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
    }

    function createZipBlob(files) {
      const encoder = new TextEncoder();
      const localParts = [];
      const centralParts = [];
      let offset = 0;
      files.forEach((file) => {
        const nameBytes = encoder.encode(file.name);
        const dataBytes = file.bytes;
        const crc = crc32(dataBytes);
        const localHeader = new Uint8Array([
          0x50, 0x4b, 0x03, 0x04,
          ...uint16LE(20),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint32LE(crc),
          ...uint32LE(dataBytes.length),
          ...uint32LE(dataBytes.length),
          ...uint16LE(nameBytes.length),
          ...uint16LE(0),
        ]);
        localParts.push(localHeader, nameBytes, dataBytes);
        const centralHeader = new Uint8Array([
          0x50, 0x4b, 0x01, 0x02,
          ...uint16LE(20),
          ...uint16LE(20),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint32LE(crc),
          ...uint32LE(dataBytes.length),
          ...uint32LE(dataBytes.length),
          ...uint16LE(nameBytes.length),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint16LE(0),
          ...uint32LE(0),
          ...uint32LE(offset),
        ]);
        centralParts.push(centralHeader, nameBytes);
        offset += localHeader.length + nameBytes.length + dataBytes.length;
      });
      const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
      const endRecord = new Uint8Array([
        0x50, 0x4b, 0x05, 0x06,
        ...uint16LE(0),
        ...uint16LE(0),
        ...uint16LE(files.length),
        ...uint16LE(files.length),
        ...uint32LE(centralSize),
        ...uint32LE(offset),
        ...uint16LE(0),
      ]);
      return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
    }

    function buildClipSidecar(decodedFrames, exportFps) {
      return {
        title: videoPrompt?.value || 'AI Clip',
        exportedAt: new Date().toISOString(),
        frameCount: decodedFrames.length,
        duration: Number(videoDuration?.value || 0),
        motionPath: aiVideoMotionPath?.value || 'tracking',
        exportFps,
        frames: decodedFrames.map((frame, index) => ({
          index,
          frame: frame.frame,
          time: Number(frame.time.toFixed(4)),
          file: 'frame-' + String(index).padStart(4, '0') + '.png',
        })),
      };
    }

    function applyCanvasView() {
      if (!aiCanvasStack) return;
      aiCanvasStack.style.transform = 'translate(' + canvasView.x + 'px, ' + canvasView.y + 'px) scale(' + canvasView.scale + ')';
      if (aiGridOverlay) aiGridOverlay.hidden = !aiCanvasGridToggle?.checked;
    }

    function resetCanvasView() {
      canvasView = { scale: 1, x: 0, y: 0 };
      applyCanvasView();
    }

    function getVideoExportDimensions(preset, sourceWidth, sourceHeight) {
      const key = String(preset || 'original');
      if (key === 'landscape-1080') return { width: 1920, height: 1080 };
      if (key === 'square-1080') return { width: 1080, height: 1080 };
      if (key === 'vertical-1080') return { width: 1080, height: 1920 };
      return { width: sourceWidth || 1280, height: sourceHeight || 720 };
    }

    function drawVideoIntoPreset(ctx, source, width, height) {
      const sourceWidth = source.videoWidth || source.width || width;
      const sourceHeight = source.videoHeight || source.height || height;
      const scale = Math.min(width / sourceWidth, height / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
    }

    async function loadVideoForBlob(blob) {
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Unable to load video'));
        };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.src = url;
      });
      return { video, url };
    }

    async function seekVideo(video, time) {
      await new Promise((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Video seek failed'));
        };
        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = time;
      });
    }

    async function renderVideoExport(blob, options) {
      const loaded = await loadVideoForBlob(blob);
      const video = loaded.video;
      const duration = Math.max(video.duration || 0, 0.01);
      const fps = clamp(Number(options.fps || 24), 1, 30);
      const start = clamp(Number(options.start || 0), 0, Math.max(0, duration - 0.04));
      const end = clamp(Number(options.end || duration), start + 0.04, duration);
      const dims = getVideoExportDimensions(options.preset, video.videoWidth, video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      try {
        return await recordCanvasAnimation(canvas, function (_t, frameIndex) {
          const currentTime = Math.min(end, start + (frameIndex / fps));
          drawVideoIntoPreset(ctx, video, dims.width, dims.height);
          return currentTime;
        }, end - start, fps, {
          beforeFrame: async (_progress, frameIndex) => {
            const currentTime = Math.min(end, start + (frameIndex / fps));
            await seekVideo(video, currentTime);
          },
        });
      } finally {
        URL.revokeObjectURL(loaded.url);
      }
    }

    function renderCompositionList() {
      if (!aiCompositionList) return;
      aiCompositionList.innerHTML = '';
      if (!compositionQueue.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-recent-empty';
        empty.textContent = 'No composition segments yet. Add a generated clip or trailer.';
        aiCompositionList.appendChild(empty);
        return;
      }
      compositionQueue.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'ai-recent-item';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'ai-recent-title';
        title.textContent = (index + 1) + '. ' + item.title;
        const sub = document.createElement('div');
        sub.className = 'ai-recent-sub';
        sub.textContent = item.kind + ' · ' + item.duration.toFixed(1) + 's';
        left.append(title, sub);
        const remove = document.createElement('button');
        remove.className = 'btn-outline-sm';
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => {
          compositionQueue.splice(index, 1);
          renderCompositionList();
        });
        row.append(left, remove);
        aiCompositionList.appendChild(row);
      });
    }

    function renderOverlayList() {
      if (!aiOverlayList) return;
      aiOverlayList.innerHTML = '';
      if (!compositionOverlays.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-recent-empty';
        empty.textContent = 'No overlay tracks yet. Add image or text overlays.';
        aiOverlayList.appendChild(empty);
        return;
      }
      compositionOverlays.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'ai-recent-item';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'ai-recent-title';
        title.textContent = (index + 1) + '. ' + (item.label || item.kind);
        const sub = document.createElement('div');
        sub.className = 'ai-recent-sub';
        sub.textContent = item.kind
          + ' · ' + item.start.toFixed(1) + 's'
          + ' · ' + item.duration.toFixed(1) + 's'
          + ' · op ' + item.opacity.toFixed(2)
          + ' · ' + String(item.blendMode || 'source-over')
          + ' · ' + String(item.motionPath || 'none')
          + ' · ease ' + String(item.ease || 'linear')
          + ' · kf ' + ((item.keyframes && item.keyframes.length) ? item.keyframes.length : 2)
          + ' · f(' + Number(item.fadeIn || 0).toFixed(1) + '/' + Number(item.fadeOut || 0).toFixed(1) + ')';
        left.append(title, sub);
        const remove = document.createElement('button');
        remove.className = 'btn-outline-sm';
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => {
          compositionOverlays.splice(index, 1);
          renderOverlayList();
        });
        row.append(left, remove);
        aiOverlayList.appendChild(row);
      });
    }

    function getCompositionSelection(items, elapsedSec) {
      let remaining = Math.max(0, elapsedSec);
      let segmentStart = 0;
      let selectedIndex = 0;
      for (let i = 0; i < items.length; i += 1) {
        if (remaining <= items[i].duration || i === items.length - 1) {
          selectedIndex = i;
          break;
        }
        segmentStart += items[i].duration;
        remaining -= items[i].duration;
      }
      return {
        selectedIndex,
        selected: items[selectedIndex],
        localTime: remaining,
        segmentStart,
        segmentEnd: segmentStart + items[selectedIndex].duration,
        prevIndex: Math.max(0, selectedIndex - 1),
      };
    }

    function drawCompositionSegment(ctx, dims, item, resolvedEntry) {
      if (!item) return;
      if (item.kind === 'Title Layer') {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, dims.width, dims.height);
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.font = '700 64px Inter, sans-serif';
        ctx.fillText((item.title || 'Title').slice(0, 42), dims.width / 2, dims.height * 0.46);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '500 28px Inter, sans-serif';
        ctx.fillText((item.subtitle || '').slice(0, 72), dims.width / 2, dims.height * 0.58);
        ctx.textAlign = 'left';
        return;
      }
      const current = resolvedEntry && resolvedEntry.video;
      if (!current) return;
      drawVideoIntoPreset(ctx, current, dims.width, dims.height);
    }

    function renderCompositionFxPresetOptions(selectedName) {
      if (!aiFxPresetSelect) return;
      aiFxPresetSelect.innerHTML = '<option value="">FX Presets</option>';
      const map = normalizeCompositionFxPresetMap(prefs.compositionFxPresets);
      Object.keys(map).sort((a, b) => a.localeCompare(b)).forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (selectedName && selectedName === name) option.selected = true;
        aiFxPresetSelect.appendChild(option);
      });
    }

    function applyCompositionFxToInputs(fx) {
      const normalized = normalizeCompositionFxRecord(fx);
      if (aiFxBrightness) aiFxBrightness.value = String(normalized.brightness);
      if (aiFxContrast) aiFxContrast.value = String(normalized.contrast);
      if (aiFxSaturation) aiFxSaturation.value = String(normalized.saturation);
      if (aiFxVignette) aiFxVignette.value = String(normalized.vignette);
      if (aiFxMonochrome) aiFxMonochrome.checked = !!normalized.monochrome;
      compositionFx = normalized;
    }

    function easeProgress(value, easing) {
      const t = clamp(Number(value || 0), 0, 1);
      const mode = String(easing || 'linear');
      if (mode === 'ease-in') return t * t;
      if (mode === 'ease-out') return 1 - Math.pow(1 - t, 2);
      if (mode === 'ease-in-out') {
        return t < 0.5 ? 2 * t * t : 1 - (Math.pow(-2 * t + 2, 2) / 2);
      }
      return t;
    }

    function getOverlayMotion(overlay, dims, progress) {
      const path = String(overlay.motionPath || 'none');
      const strength = clamp(Number(overlay.motionStrength || 0), 0, 120) / 100;
      const ampX = dims.width * 0.18 * strength;
      const ampY = dims.height * 0.18 * strength;
      const theta = progress * Math.PI * 2;
      if (path === 'drift-right') return { x: ampX * progress, y: 0, scale: 1 };
      if (path === 'drift-left') return { x: -ampX * progress, y: 0, scale: 1 };
      if (path === 'rise') return { x: 0, y: -ampY * progress, scale: 1 };
      if (path === 'drop') return { x: 0, y: ampY * progress, scale: 1 };
      if (path === 'orbit') return { x: Math.cos(theta) * ampX * 0.85, y: Math.sin(theta) * ampY * 0.85, scale: 1 };
      if (path === 'pulse') return { x: 0, y: 0, scale: 1 + (Math.sin(theta) * 0.08 * strength) };
      return { x: 0, y: 0, scale: 1 };
    }

    function parseOverlayKeyframes(textValue, fallback) {
      const base = {
        x: clamp(Number(fallback?.x || 50), 0, 100),
        y: clamp(Number(fallback?.y || 50), 0, 100),
        scale: clamp(Number(fallback?.scale || 38), 10, 260),
        opacity: clamp(Number(fallback?.opacity || 0.85), 0.1, 1),
      };
      const source = String(textValue || '').trim();
      if (!source) {
        return [
          { t: 0, x: base.x, y: base.y, scale: base.scale, opacity: base.opacity },
          { t: 1, x: base.x, y: base.y, scale: base.scale, opacity: base.opacity },
        ];
      }
      const points = source
        .split('|')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const pair = entry.split(':');
          if (pair.length !== 2) return null;
          const t = clamp(Number(pair[0].trim()), 0, 1);
          const values = pair[1].split(',').map((v) => Number(v.trim()));
          if (values.length < 2 || Number.isNaN(t)) return null;
          return {
            t,
            x: clamp(Number(values[0]), 0, 100),
            y: clamp(Number(values[1]), 0, 100),
            scale: clamp(Number(values[2] || base.scale), 10, 260),
            opacity: clamp(Number(values[3] || base.opacity), 0.1, 1),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.t - b.t);
      if (!points.length) {
        return [
          { t: 0, x: base.x, y: base.y, scale: base.scale, opacity: base.opacity },
          { t: 1, x: base.x, y: base.y, scale: base.scale, opacity: base.opacity },
        ];
      }
      if (points[0].t > 0) points.unshift(Object.assign({}, points[0], { t: 0 }));
      if (points[points.length - 1].t < 1) points.push(Object.assign({}, points[points.length - 1], { t: 1 }));
      return points;
    }

    function sampleOverlayKeyframes(overlay, progress) {
      const keys = Array.isArray(overlay.keyframes) && overlay.keyframes.length
        ? overlay.keyframes
        : parseOverlayKeyframes('', overlay);
      const p = clamp(Number(progress || 0), 0, 1);
      if (p <= keys[0].t) return keys[0];
      if (p >= keys[keys.length - 1].t) return keys[keys.length - 1];
      let left = keys[0];
      let right = keys[keys.length - 1];
      let segIndex = 0;
      for (let i = 0; i < keys.length - 1; i += 1) {
        if (p >= keys[i].t && p <= keys[i + 1].t) {
          left = keys[i];
          right = keys[i + 1];
          segIndex = i;
          break;
        }
      }
      const span = Math.max(0.0001, right.t - left.t);
      const local = clamp((p - left.t) / span, 0, 1);
      const pathInterp = String(overlay.pathInterp || 'linear');
      const segmentTension = Array.isArray(overlay.segmentTensions) && Number.isFinite(Number(overlay.segmentTensions[segIndex]))
        ? Number(overlay.segmentTensions[segIndex])
        : Number(overlay.bezierTension || 0.55);
      const tension = clamp(segmentTension, 0, 1);
      const k = pathInterp === 'bezier'
        ? ((local * (1 - tension)) + ((local * local * (3 - 2 * local)) * tension))
        : local;
      return {
        x: left.x + ((right.x - left.x) * k),
        y: left.y + ((right.y - left.y) * k),
        scale: left.scale + ((right.scale - left.scale) * k),
        opacity: left.opacity + ((right.opacity - left.opacity) * k),
      };
    }

    function formatOverlayKeyframesText(keys) {
      return (keys || [])
        .map((pt) => {
          const t = clamp(Number(pt.t || 0), 0, 1).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
          const x = clamp(Number(pt.x || 50), 0, 100).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
          const y = clamp(Number(pt.y || 50), 0, 100).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
          const scale = clamp(Number(pt.scale || 38), 10, 260).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
          const opacity = clamp(Number(pt.opacity || 0.85), 0.1, 1).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
          return t + ':' + x + ',' + y + ',' + scale + ',' + opacity;
        })
        .join(' | ');
    }

    function getOverlayEditorFallbackPoint() {
      return {
        x: clamp(Number(aiOverlayX?.value || 50), 0, 100),
        y: clamp(Number(aiOverlayY?.value || 50), 0, 100),
        scale: clamp(Number(aiOverlayScale?.value || 38), 10, 260),
        opacity: clamp(Number(aiOverlayOpacity?.value || 0.85), 0.1, 1),
      };
    }

    function getOverlayEditorCanvasPosition(evt) {
      if (!aiOverlayPathCanvas) return null;
      const rect = aiOverlayPathCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        px: clamp((evt.clientX - rect.left) / rect.width, 0, 1),
        py: clamp((evt.clientY - rect.top) / rect.height, 0, 1),
      };
    }

    function findNearestOverlayKeyframe(points, px, py) {
      return (points || []).reduce((best, pt, idx) => {
        const tx = clamp(Number(pt.t || 0), 0, 1);
        const ty = 1 - (clamp(Number(pt.y || 50), 0, 100) / 100);
        const dist = Math.hypot(tx - px, ty - py);
        return dist < best.dist ? { idx, dist } : best;
      }, { idx: -1, dist: 999 });
    }

    function getOverlaySegmentTensions(points, fallbackTension) {
      const count = Math.max(0, (points?.length || 0) - 1);
      const base = clamp(Number(fallbackTension || 0.55), 0, 1);
      const source = Array.isArray(overlaySegmentTensions) ? overlaySegmentTensions : [];
      const out = [];
      for (let i = 0; i < count; i += 1) {
        const value = Number(source[i]);
        out.push(Number.isFinite(value) ? clamp(value, 0, 1) : base);
      }
      overlaySegmentTensions = out;
      return out;
    }

    function getOverlayKeyframeSnapshot() {
      return JSON.stringify({
        keyframesText: String(aiOverlayKeyframes?.value || ''),
        segmentTensions: Array.isArray(overlaySegmentTensions) ? overlaySegmentTensions.slice() : [],
        selectedIndex: overlaySelectedKeyframeIndex,
      });
    }

    function applyOverlayKeyframeSnapshot(snapshotText) {
      if (!aiOverlayKeyframes || !snapshotText) return;
      try {
        const snap = JSON.parse(snapshotText);
        aiOverlayKeyframes.value = String(snap.keyframesText || '');
        overlaySegmentTensions = Array.isArray(snap.segmentTensions)
          ? snap.segmentTensions.map((value) => clamp(Number(value), 0, 1))
          : [];
        overlaySelectedKeyframeIndex = Number.isFinite(Number(snap.selectedIndex))
          ? Number(snap.selectedIndex)
          : -1;
      } catch (_) {
        return;
      }
      renderOverlayKeyframeEditor();
      saveInputsState();
    }

    function pushOverlayKeyframeHistory() {
      const snapshot = getOverlayKeyframeSnapshot();
      if (!snapshot) return;
      if (overlayKeyframeHistory.length && overlayKeyframeHistory[overlayKeyframeHistory.length - 1] === snapshot) {
        return;
      }
      overlayKeyframeHistory.push(snapshot);
      if (overlayKeyframeHistory.length > 64) overlayKeyframeHistory.shift();
      overlayKeyframeFuture = [];
    }

    function undoOverlayKeyframeEdit() {
      if (!overlayKeyframeHistory.length) return false;
      const current = getOverlayKeyframeSnapshot();
      overlayKeyframeFuture.push(current);
      const previous = overlayKeyframeHistory.pop();
      applyOverlayKeyframeSnapshot(previous);
      return true;
    }

    function redoOverlayKeyframeEdit() {
      if (!overlayKeyframeFuture.length) return false;
      const current = getOverlayKeyframeSnapshot();
      overlayKeyframeHistory.push(current);
      const next = overlayKeyframeFuture.pop();
      applyOverlayKeyframeSnapshot(next);
      return true;
    }

    function renderOverlayKeyframeEditor() {
      if (!aiOverlayPathCanvas) return;
      const ctx = aiOverlayPathCanvas.getContext('2d');
      if (!ctx) return;
      const width = aiOverlayPathCanvas.width;
      const height = aiOverlayPathCanvas.height;
      const pad = 16;
      const fallback = getOverlayEditorFallbackPoint();
      const points = parseOverlayKeyframes(aiOverlayKeyframes?.value || '', fallback);
      const pathInterp = String(aiOverlayPathInterp?.value || 'linear');
      const tension = clamp(Number(aiOverlayBezierTension?.value || 0.55), 0, 1);
      const segmentTensions = getOverlaySegmentTensions(points, tension);
      overlayBezierHandleHits = [];

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#040b18';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(56,189,248,0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const gy = pad + ((height - (pad * 2)) * (i / 4));
        ctx.beginPath();
        ctx.moveTo(pad, gy);
        ctx.lineTo(width - pad, gy);
        ctx.stroke();
      }
      for (let i = 0; i <= 5; i += 1) {
        const gx = pad + ((width - (pad * 2)) * (i / 5));
        ctx.beginPath();
        ctx.moveTo(gx, pad);
        ctx.lineTo(gx, height - pad);
        ctx.stroke();
      }

      const overlayModel = {
        keyframes: points,
        pathInterp,
        bezierTension: tension,
      };
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 120; i += 1) {
        const t = i / 120;
        const sampled = sampleOverlayKeyframes(overlayModel, t);
        const x = pad + ((width - (pad * 2)) * t);
        const y = pad + ((height - (pad * 2)) * (1 - (sampled.y / 100)));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (pathInterp === 'bezier' && points.length > 1) {
        for (let i = 0; i < points.length - 1; i += 1) {
          const a = points[i];
          const b = points[i + 1];
          const ax = pad + ((width - (pad * 2)) * clamp(Number(a.t || 0), 0, 1));
          const ay = pad + ((height - (pad * 2)) * (1 - (clamp(Number(a.y || 50), 0, 100) / 100)));
          const bx = pad + ((width - (pad * 2)) * clamp(Number(b.t || 0), 0, 1));
          const by = pad + ((height - (pad * 2)) * (1 - (clamp(Number(b.y || 50), 0, 100) / 100)));
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / len;
          const ny = dx / len;
          const offset = (segmentTensions[i] - 0.5) * 44;
          const hx = mx + (nx * offset);
          const hy = my + (ny * offset);
          overlayBezierHandleHits.push({ index: i, mx, my, nx, ny, hx, hy });

          ctx.strokeStyle = 'rgba(56,189,248,0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(hx, hy);
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(hx, hy, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fda4af';
          ctx.font = '500 10px Inter, sans-serif';
          ctx.fillText(segmentTensions[i].toFixed(2), hx + 7, hy - 5);
        }
      }

      points.forEach((pt, idx) => {
        const x = pad + ((width - (pad * 2)) * clamp(Number(pt.t || 0), 0, 1));
        const y = pad + ((height - (pad * 2)) * (1 - (clamp(Number(pt.y || 50), 0, 100) / 100)));
        ctx.fillStyle = idx === overlaySelectedKeyframeIndex
          ? '#a78bfa'
          : (idx === 0 || idx === points.length - 1 ? '#f59e0b' : '#22d3ee');
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText('Y%', 8, 12);
      if (pathInterp === 'bezier' && segmentTensions.length) {
        const avgTension = segmentTensions.reduce((sum, value) => sum + value, 0) / segmentTensions.length;
        ctx.fillText('Bezier segments: ' + segmentTensions.length + ' · Avg tension ' + avgTension.toFixed(2), 12, height - 6);
      }
      ctx.fillText('0 -> 1 timeline', width - 86, height - 6);
    }

    function updateOverlayKeyframeFromCanvasEvent(evt, removeMode) {
      if (!aiOverlayPathCanvas || !aiOverlayKeyframes) return;
      const pos = getOverlayEditorCanvasPosition(evt);
      if (!pos) return;
      const px = pos.px;
      const py = pos.py;
      const fallback = getOverlayEditorFallbackPoint();
      const points = parseOverlayKeyframes(aiOverlayKeyframes.value || '', fallback).slice();
      const nearest = findNearestOverlayKeyframe(points, px, py);
      overlaySelectedKeyframeIndex = nearest.idx >= 0 ? nearest.idx : overlaySelectedKeyframeIndex;
      pushOverlayKeyframeHistory();

      if (removeMode) {
        if (nearest.idx > 0 && nearest.idx < points.length - 1 && nearest.dist <= 0.08) {
          points.splice(nearest.idx, 1);
        }
      } else {
        const candidate = {
          t: clamp(px, 0, 1),
          x: clamp(px * 100, 0, 100),
          y: clamp((1 - py) * 100, 0, 100),
          scale: fallback.scale,
          opacity: fallback.opacity,
        };
        if (nearest.idx >= 0 && nearest.dist <= 0.05) {
          if (nearest.idx === 0 || nearest.idx === points.length - 1) {
            const endpointT = nearest.idx === 0 ? 0 : 1;
            points[nearest.idx] = Object.assign({}, points[nearest.idx], candidate, {
              t: endpointT,
              x: endpointT * 100,
            });
          } else {
            points[nearest.idx] = Object.assign({}, points[nearest.idx], candidate);
          }
        } else {
          points.push(candidate);
          points.sort((a, b) => a.t - b.t);
        }
      }

      aiOverlayKeyframes.value = formatOverlayKeyframesText(points);
      renderOverlayKeyframeEditor();
      saveInputsState();
    }

    function beginOverlayKeyframeDrag(evt) {
      if (!aiOverlayPathCanvas || !aiOverlayKeyframes) return false;
      if (evt.button !== 0) return false;
      const pos = getOverlayEditorCanvasPosition(evt);
      if (!pos) return false;

      if (String(aiOverlayPathInterp?.value || 'linear') === 'bezier' && overlayBezierHandleHits.length) {
        const rect = aiOverlayPathCanvas.getBoundingClientRect();
        const localX = evt.clientX - rect.left;
        const localY = evt.clientY - rect.top;
        const hit = overlayBezierHandleHits.find((h) => Math.hypot(localX - h.hx, localY - h.hy) <= 10);
        if (hit) {
          pushOverlayKeyframeHistory();
          overlayBezierHandleDrag = { index: hit.index };
          overlayKeyframeDragMoved = false;
          evt.preventDefault();
          return true;
        }
      }

      const fallback = getOverlayEditorFallbackPoint();
      const points = parseOverlayKeyframes(aiOverlayKeyframes.value || '', fallback);
      const nearest = findNearestOverlayKeyframe(points, pos.px, pos.py);
      if (nearest.idx < 0 || nearest.dist > 0.06) return false;
      pushOverlayKeyframeHistory();
      overlayKeyframeDrag = { index: nearest.idx };
      overlaySelectedKeyframeIndex = nearest.idx;
      overlayKeyframeDragMoved = false;
      evt.preventDefault();
      return true;
    }

    function updateOverlayKeyframeDrag(evt) {
      if (overlayBezierHandleDrag && aiOverlayPathCanvas && aiOverlayKeyframes) {
        const fallback = getOverlayEditorFallbackPoint();
        const points = parseOverlayKeyframes(aiOverlayKeyframes.value || '', fallback).slice();
        const pathInterp = String(aiOverlayPathInterp?.value || 'linear');
        if (pathInterp === 'bezier' && points.length > 1) {
          const segmentTensions = getOverlaySegmentTensions(points, Number(aiOverlayBezierTension?.value || 0.55));
          const idx = clamp(Number(overlayBezierHandleDrag.index || 0), 0, Math.max(0, points.length - 2));
          const a = points[idx];
          const b = points[idx + 1];
          const width = aiOverlayPathCanvas.width;
          const height = aiOverlayPathCanvas.height;
          const pad = 16;
          const ax = pad + ((width - (pad * 2)) * clamp(Number(a.t || 0), 0, 1));
          const ay = pad + ((height - (pad * 2)) * (1 - (clamp(Number(a.y || 50), 0, 100) / 100)));
          const bx = pad + ((width - (pad * 2)) * clamp(Number(b.t || 0), 0, 1));
          const by = pad + ((height - (pad * 2)) * (1 - (clamp(Number(b.y || 50), 0, 100) / 100)));
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / len;
          const ny = dx / len;
          const rect = aiOverlayPathCanvas.getBoundingClientRect();
          const localX = evt.clientX - rect.left;
          const localY = evt.clientY - rect.top;
          const proj = ((localX - mx) * nx) + ((localY - my) * ny);
          const nextTension = clamp(0.5 + (proj / 44), 0, 1);
          segmentTensions[idx] = nextTension;
          overlaySegmentTensions = segmentTensions;
          if (aiOverlayBezierTension) {
            const avg = segmentTensions.length
              ? (segmentTensions.reduce((sum, value) => sum + value, 0) / segmentTensions.length)
              : Number(aiOverlayBezierTension.value || 0.55);
            aiOverlayBezierTension.value = String(avg.toFixed(2));
          }
          overlayKeyframeDragMoved = true;
          renderOverlayKeyframeEditor();
          evt.preventDefault();
        }
        return;
      }

      if (!overlayKeyframeDrag || !aiOverlayKeyframes) return;
      const pos = getOverlayEditorCanvasPosition(evt);
      if (!pos) return;
      const fallback = getOverlayEditorFallbackPoint();
      const points = parseOverlayKeyframes(aiOverlayKeyframes.value || '', fallback).slice();
      const idx = clamp(Number(overlayKeyframeDrag.index || 0), 0, Math.max(0, points.length - 1));
      if (!points[idx]) return;

      let nextT = clamp(pos.px, 0, 1);
      if (idx === 0) nextT = 0;
      else if (idx === points.length - 1) nextT = 1;
      else {
        const minT = Number(points[idx - 1].t || 0) + 0.01;
        const maxT = Number(points[idx + 1].t || 1) - 0.01;
        nextT = clamp(nextT, minT, maxT);
      }

      const prev = points[idx];
      const lockTimeline = !!evt.shiftKey && !evt.altKey;
      const lockVertical = !!evt.altKey && !evt.shiftKey;
      const nextY = lockTimeline ? Number(prev.y || 50) : clamp((1 - pos.py) * 100, 0, 100);
      const resolvedT = lockVertical ? Number(prev.t || 0) : nextT;
      points[idx] = Object.assign({}, prev, {
        t: resolvedT,
        x: resolvedT * 100,
        y: nextY,
      });
      overlaySelectedKeyframeIndex = idx;
      overlayKeyframeDragMoved = true;
      aiOverlayKeyframes.value = formatOverlayKeyframesText(points);
      renderOverlayKeyframeEditor();
      evt.preventDefault();
    }

    function handleOverlayKeyframeWheel(evt) {
      if (!aiOverlayPathCanvas || !aiOverlayKeyframes) return;
      const pos = getOverlayEditorCanvasPosition(evt);
      if (!pos) return;
      const fallback = getOverlayEditorFallbackPoint();
      const points = parseOverlayKeyframes(aiOverlayKeyframes.value || '', fallback).slice();
      const nearest = findNearestOverlayKeyframe(points, pos.px, pos.py);
      if (nearest.idx < 0 || nearest.dist > 0.09) return;
      pushOverlayKeyframeHistory();
      const idx = nearest.idx;
      const current = points[idx];
      const direction = evt.deltaY < 0 ? 1 : -1;
      if (evt.altKey) {
        points[idx] = Object.assign({}, current, {
          opacity: clamp(Number(current.opacity || 0.85) + (direction * 0.03), 0.1, 1),
        });
      } else {
        points[idx] = Object.assign({}, current, {
          scale: clamp(Number(current.scale || 38) + (direction * 2), 10, 260),
        });
      }
      overlaySelectedKeyframeIndex = idx;
      aiOverlayKeyframes.value = formatOverlayKeyframesText(points);
      renderOverlayKeyframeEditor();
      saveInputsState();
      evt.preventDefault();
    }

    function endOverlayKeyframeDrag() {
      if (!overlayKeyframeDrag && !overlayBezierHandleDrag) return;
      overlayKeyframeDrag = null;
      overlayBezierHandleDrag = null;
      if (overlayKeyframeDragMoved) {
        saveInputsState();
      }
    }

    async function createCompositionAudioSession(totalDurationSec, duckOptions) {
      const file = aiAudioUpload?.files && aiAudioUpload.files[0];
      const sourceBlob = file || latestGeneratedAudioBlob;
      if (!sourceBlob) return null;
      const audioUrl = URL.createObjectURL(sourceBlob);
      const audioEl = document.createElement('audio');
      audioEl.src = audioUrl;
      audioEl.preload = 'auto';
      audioEl.crossOrigin = 'anonymous';
      audioEl.loop = false;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioEl);
      const gainNode = audioCtx.createGain();
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);
      gainNode.gain.value = 1;
      try {
        await new Promise((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Audio load failed'));
          };
          const cleanup = () => {
            audioEl.removeEventListener('loadeddata', onLoaded);
            audioEl.removeEventListener('error', onError);
          };
          audioEl.addEventListener('loadeddata', onLoaded, { once: true });
          audioEl.addEventListener('error', onError, { once: true });
          audioEl.load();
        });
        await audioCtx.resume().catch(() => {});
        audioEl.currentTime = 0;
        await audioEl.play().catch(() => {});
      } catch (_) {
        URL.revokeObjectURL(audioUrl);
        audioCtx.close().catch(() => {});
        return null;
      }
      return {
        audioTrack: destination.stream.getAudioTracks()[0] || null,
        gainNode,
        options: {
          enabled: !!duckOptions?.enabled,
          amount: clamp(Number(duckOptions?.amount || 0.35), 0, 0.85),
          attack: clamp(Number(duckOptions?.attack || 0.2), 0.05, 2),
          release: clamp(Number(duckOptions?.release || 0.4), 0.05, 3),
        },
        lastGain: 1,
        cleanup: () => {
          try {
            audioEl.pause();
          } catch (_) {}
          URL.revokeObjectURL(audioUrl);
          audioCtx.close().catch(() => {});
        },
        syncGain: (target, dt) => {
          if (!gainNode) return;
          const rise = dt / Math.max(0.05, Number(duckOptions?.release || 0.4));
          const fall = dt / Math.max(0.05, Number(duckOptions?.attack || 0.2));
          const step = target < (duckOptions?.lastGain || 1) ? fall : rise;
          const current = Number(gainNode.gain.value || 1);
          const next = current + ((target - current) * clamp(step, 0, 1));
          gainNode.gain.value = clamp(next, 0, 1.25);
        },
      };
    }

    function getOverlayAlphaMultiplier(overlay, elapsedSec, lifeStart, lifeEnd) {
      const fadeIn = clamp(Number(overlay.fadeIn || 0), 0, Math.max(0, lifeEnd - lifeStart));
      const fadeOut = clamp(Number(overlay.fadeOut || 0), 0, Math.max(0, lifeEnd - lifeStart));
      const lifeProgress = elapsedSec - lifeStart;
      const timeLeft = lifeEnd - elapsedSec;
      const easing = String(overlay.ease || 'linear');
      let alpha = 1;
      if (fadeIn > 0) alpha = Math.min(alpha, easeProgress(clamp(lifeProgress / fadeIn, 0, 1), easing));
      if (fadeOut > 0) alpha = Math.min(alpha, easeProgress(clamp(timeLeft / fadeOut, 0, 1), easing));
      return clamp(alpha, 0, 1);
    }

    function normalizeCompositionFx() {
      return normalizeCompositionFxRecord({
        brightness: aiFxBrightness?.value,
        contrast: aiFxContrast?.value,
        saturation: aiFxSaturation?.value,
        vignette: aiFxVignette?.value,
        monochrome: aiFxMonochrome?.checked,
      });
    }

    function isCompositionFxNeutral(fx) {
      return Math.abs((fx?.brightness || 1) - 1) < 0.001
        && Math.abs((fx?.contrast || 1) - 1) < 0.001
        && Math.abs((fx?.saturation || 1) - 1) < 0.001
        && Math.abs((fx?.vignette || 0)) < 0.001
        && !fx?.monochrome;
    }

    function applyCompositionFx(ctx, fxCanvas, fxCtx, width, height, fx) {
      if (!fxCanvas || !fxCtx || isCompositionFxNeutral(fx)) return;
      fxCtx.clearRect(0, 0, width, height);
      const grayscale = fx.monochrome ? 1 : 0;
      fxCtx.filter = 'brightness(' + fx.brightness + ') contrast(' + fx.contrast + ') saturate(' + fx.saturation + ') grayscale(' + grayscale + ')';
      fxCtx.drawImage(ctx.canvas, 0, 0, width, height);
      fxCtx.filter = 'none';

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(fxCanvas, 0, 0, width, height);
      if (fx.vignette > 0.001) {
        const gradient = ctx.createRadialGradient(
          width * 0.5,
          height * 0.5,
          Math.min(width, height) * 0.22,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.68
        );
        gradient.addColorStop(0, 'rgba(2,6,23,0)');
        gradient.addColorStop(1, 'rgba(2,6,23,' + fx.vignette.toFixed(3) + ')');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    }

    async function resolveCompositionOverlayAssets(overlays) {
      const resolved = [];
      for (const overlay of overlays || []) {
        if (overlay.kind === 'Image Overlay' && overlay.dataUrl) {
          const asset = await loadImageFromUrl(overlay.dataUrl).catch(() => null);
          resolved.push(Object.assign({}, overlay, { asset }));
        } else {
          resolved.push(Object.assign({}, overlay));
        }
      }
      return resolved;
    }

    function drawActiveOverlays(ctx, dims, overlays, elapsedSec) {
      if (!overlays || !overlays.length) return;
      overlays.forEach((overlay) => {
        const start = Math.max(0, Number(overlay.start) || 0);
        const end = start + Math.max(0.2, Number(overlay.duration) || 0);
        if (elapsedSec < start || elapsedSec > end) return;
        const progress = easeProgress((elapsedSec - start) / Math.max(0.0001, end - start), overlay.ease || 'linear');
        const keyed = sampleOverlayKeyframes(overlay, progress);
        const x = clamp(Number(keyed?.x || overlay.x || 50), 0, 100) / 100;
        const y = clamp(Number(keyed?.y || overlay.y || 50), 0, 100) / 100;
        const motion = getOverlayMotion(overlay, dims, progress);
        const opacity = clamp(Number(keyed?.opacity || overlay.opacity || 0.85), 0.1, 1);
        const overlayBlend = String(overlay.blendMode || 'source-over');
        const alphaMul = getOverlayAlphaMultiplier(overlay, elapsedSec, start, end);
        const scale = clamp(Number(keyed?.scale || overlay.scale || 38), 10, 260) / 100;
        ctx.save();
        ctx.globalAlpha = opacity * alphaMul;
        ctx.globalCompositeOperation = overlayBlend;
        if (overlay.kind === 'Image Overlay' && overlay.asset) {
          const sourceWidth = overlay.asset.naturalWidth || overlay.asset.width || 256;
          const sourceHeight = overlay.asset.naturalHeight || overlay.asset.height || 256;
          const baseWidth = dims.width * scale;
          let drawWidth = baseWidth;
          let drawHeight = (sourceHeight / Math.max(1, sourceWidth)) * drawWidth;
          if (drawHeight > dims.height * 0.88) {
            drawHeight = dims.height * 0.88;
            drawWidth = (sourceWidth / Math.max(1, sourceHeight)) * drawHeight;
          }
          drawWidth *= motion.scale;
          drawHeight *= motion.scale;
          const px = (dims.width * x) + motion.x;
          const py = (dims.height * y) + motion.y;
          ctx.drawImage(overlay.asset, px - (drawWidth / 2), py - (drawHeight / 2), drawWidth, drawHeight);
        } else if (overlay.kind === 'Text Overlay') {
          const fontSize = clamp(Number(overlay.fontSize || 56), 16, 140);
          const text = String(overlay.text || 'Overlay').slice(0, 84);
          ctx.textAlign = 'center';
          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 ' + Math.round(fontSize * motion.scale) + 'px Inter, sans-serif';
          ctx.fillText(text, (dims.width * x) + motion.x, (dims.height * y) + motion.y);
          ctx.lineWidth = Math.max(2, fontSize * 0.06);
          ctx.strokeStyle = 'rgba(2,6,23,0.65)';
          ctx.strokeText(text, (dims.width * x) + motion.x, (dims.height * y) + motion.y);
          ctx.textAlign = 'left';
        }
        ctx.restore();
      });
    }

    async function renderCompositionBlob(items, preset, fps, overlays, fx, options) {
      const resolved = [];
      for (const item of items) {
        if (item.kind === 'Title Layer') {
          resolved.push(null);
        } else {
          const loaded = await loadVideoForBlob(item.blob);
          resolved.push(loaded);
        }
      }
      const firstVideo = resolved.find((entry) => entry && entry.video);
      const sourceWidth = firstVideo?.video.videoWidth || 1280;
      const sourceHeight = firstVideo?.video.videoHeight || 720;
      const dims = getVideoExportDimensions(preset, sourceWidth, sourceHeight);
      const canvas = document.createElement('canvas');
      canvas.width = dims.width;
      canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      const fxCanvas = document.createElement('canvas');
      fxCanvas.width = dims.width;
      fxCanvas.height = dims.height;
      const fxCtx = fxCanvas.getContext('2d');
      const renderOptions = options || {};
      const transitionSec = clamp(Number(renderOptions.transitionSec || 0), 0, 3);
      const transitionEase = String(renderOptions.transitionEase || 'linear');
      const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);
      const resolvedOverlays = await resolveCompositionOverlayAssets(overlays || []);
      const audioSession = await createCompositionAudioSession(totalDuration, renderOptions.ducking || null);
      try {
        return await recordCanvasAnimation(canvas, function (_t, frameIndex) {
          const elapsedSec = frameIndex / fps;
          const selection = getCompositionSelection(items, elapsedSec);
          const selected = selection.selected;
          const useTransition = transitionSec > 0.001 && selection.selectedIndex > 0 && selection.localTime < transitionSec;
          if (useTransition) {
            const previousItem = items[selection.prevIndex];
            drawCompositionSegment(ctx, dims, previousItem, resolved[selection.prevIndex]);
            const blendAlpha = easeProgress(clamp(selection.localTime / transitionSec, 0, 1), transitionEase);
            ctx.save();
            ctx.globalAlpha = blendAlpha;
            drawCompositionSegment(ctx, dims, selected, resolved[selection.selectedIndex]);
            ctx.restore();
          } else {
            drawCompositionSegment(ctx, dims, selected, resolved[selection.selectedIndex]);
          }
          drawActiveOverlays(ctx, dims, resolvedOverlays, elapsedSec);
          applyCompositionFx(ctx, fxCanvas, fxCtx, dims.width, dims.height, fx || compositionFx);
          ctx.fillStyle = 'rgba(2,6,23,0.18)';
          ctx.fillRect(0, dims.height - 44, dims.width, 44);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '600 18px Inter, sans-serif';
          ctx.fillText(String(selected.title || 'Composition').slice(0, 42), 20, dims.height - 16);
        }, totalDuration, fps, {
          audioTrack: audioSession?.audioTrack || null,
          beforeFrame: async (_progress, frameIndex) => {
            const elapsedSec = frameIndex / fps;
            const selection = getCompositionSelection(items, elapsedSec);
            if (selection.selected.kind !== 'Title Layer') {
              await seekVideo(resolved[selection.selectedIndex].video, selection.localTime);
            }
            const useTransition = transitionSec > 0.001 && selection.selectedIndex > 0 && selection.localTime < transitionSec;
            if (useTransition) {
              const previousItem = items[selection.prevIndex];
              if (previousItem.kind !== 'Title Layer') {
                const prevTime = Math.max(0, previousItem.duration - (transitionSec - selection.localTime));
                await seekVideo(resolved[selection.prevIndex].video, prevTime);
              }
            }
            if (audioSession?.gainNode && audioSession?.options?.enabled) {
              const hasActiveTextOverlay = resolvedOverlays.some((overlay) => {
                if (overlay.kind !== 'Text Overlay') return false;
                const ovStart = Math.max(0, Number(overlay.start) || 0);
                const ovEnd = ovStart + Math.max(0.2, Number(overlay.duration) || 0);
                return elapsedSec >= ovStart && elapsedSec <= ovEnd;
              });
              const targetGain = hasActiveTextOverlay
                ? 1 - clamp(Number(audioSession.options.amount || 0.35), 0, 0.85)
                : 1;
              const current = Number(audioSession.gainNode.gain.value || 1);
              const dt = 1 / Math.max(1, fps);
              const attack = Math.max(0.05, Number(audioSession.options.attack || 0.2));
              const release = Math.max(0.05, Number(audioSession.options.release || 0.4));
              const blend = targetGain < current
                ? clamp(dt / attack, 0, 1)
                : clamp(dt / release, 0, 1);
              audioSession.gainNode.gain.value = current + ((targetGain - current) * blend);
            }
          },
        });
      } finally {
        if (audioSession && typeof audioSession.cleanup === 'function') {
          audioSession.cleanup();
        }
        resolved.forEach((entry) => {
          if (entry && entry.url) URL.revokeObjectURL(entry.url);
        });
      }
    }

    async function analyzeAudioFile(file) {
      if (!file) return null;
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      try {
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        return {
          duration: decoded.duration,
          sampleRate: decoded.sampleRate,
          channelData: decoded.getChannelData(0),
        };
      } finally {
        if (audioCtx && typeof audioCtx.close === 'function') {
          audioCtx.close().catch(() => {});
        }
      }
    }

    function drawWaveform(analysis) {
      if (!aiAudioWaveform) return;
      const ctx = aiAudioWaveform.getContext('2d');
      const width = aiAudioWaveform.width;
      const height = aiAudioWaveform.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      if (!analysis || !analysis.channelData) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 20px Inter, sans-serif';
        ctx.fillText('Upload audio to analyze waveform', 28, height / 2);
        return;
      }
      const data = analysis.channelData;
      const step = Math.max(1, Math.floor(data.length / width));
      const mid = height / 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < width; x += 1) {
        let min = 1;
        let max = -1;
        for (let i = 0; i < step; i += 1) {
          const sample = data[(x * step) + i] || 0;
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
        ctx.moveTo(x, mid + min * mid * 0.85);
        ctx.lineTo(x, mid + max * mid * 0.85);
      }
      ctx.stroke();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText('Duration: ' + analysis.duration.toFixed(2) + 's', 16, 24);
    }

    function buildDialogueCues(lines, totalDuration) {
      const entries = String(lines || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (!entries.length) return [];
      const segment = totalDuration / entries.length;
      return entries.map((text, index) => ({
        index: index + 1,
        text,
        start: Number((segment * index).toFixed(2)),
        end: Number((segment * (index + 1)).toFixed(2)),
        duration: Number(segment.toFixed(2)),
      }));
    }

    function renderDialogueCues(cues) {
      if (!aiDialogueCueList) return;
      aiDialogueCueList.innerHTML = '';
      if (!cues.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-recent-empty';
        empty.textContent = 'No dialogue cues yet. Upload audio and add dialogue lines.';
        aiDialogueCueList.appendChild(empty);
        return;
      }
      cues.forEach((cue) => {
        const row = document.createElement('div');
        row.className = 'ai-recent-item';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'ai-recent-title';
        title.textContent = cue.index + '. ' + cue.text;
        const sub = document.createElement('div');
        sub.className = 'ai-recent-sub';
        sub.textContent = cue.start.toFixed(2) + 's - ' + cue.end.toFixed(2) + 's';
        left.append(title, sub);
        row.append(left);
        aiDialogueCueList.appendChild(row);
      });
    }

    async function extractDecodedFramesFromVideoBlob(blob, fps) {
      if (!blob) return [];
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      const targetFps = clamp(Number(fps || 24), 1, 30);
      try {
        await new Promise((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Unable to decode video'));
          };
          const cleanup = () => {
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onError);
          };
          video.addEventListener('loadedmetadata', onLoaded, { once: true });
          video.addEventListener('error', onError, { once: true });
          video.src = url;
        });

        const duration = Math.max(video.duration || 0, 0.01);
        const totalFrames = Math.max(1, Math.round(duration * targetFps));
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        const frames = [];

        for (let i = 0; i < totalFrames; i += 1) {
          const time = Math.min(duration, i / targetFps);
          await new Promise((resolve, reject) => {
            const onSeeked = () => {
              cleanup();
              resolve();
            };
            const onError = () => {
              cleanup();
              reject(new Error('Seek failed'));
            };
            const cleanup = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onError);
            };
            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onError, { once: true });
            video.currentTime = time;
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push({
            index: i,
            frame: i,
            time,
            dataUrl: canvas.toDataURL('image/png'),
          });
        }
        return frames;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function applyMaskedComposite() {
      if (!imageCanvas || !latestBaseImageDataUrl || !hasMaskPixels()) return;
      const maskCtx = getMaskContext();
      const finalCtx = imageCanvas.getContext('2d');
      const generatedUrl = imageCanvas.toDataURL('image/png');
      const baseImg = new Image();
      const genImg = new Image();
      baseImg.onload = () => {
        genImg.onload = () => {
          finalCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
          finalCtx.drawImage(baseImg, 0, 0, imageCanvas.width, imageCanvas.height);
          finalCtx.save();
          finalCtx.drawImage(aiMaskCanvas, 0, 0, imageCanvas.width, imageCanvas.height);
          finalCtx.globalCompositeOperation = 'source-in';
          finalCtx.drawImage(genImg, 0, 0, imageCanvas.width, imageCanvas.height);
          finalCtx.restore();
          finalCtx.save();
          finalCtx.globalCompositeOperation = 'destination-over';
          finalCtx.drawImage(baseImg, 0, 0, imageCanvas.width, imageCanvas.height);
          finalCtx.restore();
          latestImageDataUrl = imageCanvas.toDataURL('image/png');
        };
        genImg.src = generatedUrl;
      };
      baseImg.src = latestBaseImageDataUrl;
      if (maskCtx) repaintMaskOverlay();
    }

    function currentImageFilename(ext, suffix) {
      return 'ai-' + (suffix || 'output') + '-' + Date.now() + '.' + ext;
    }

    function downloadTextFile(text, filename, mimeType) {
      const blob = new Blob([text], { type: mimeType || 'application/json' });
      createDownload(blob, filename);
    }

    function setPrefs(partial) {
      Object.assign(prefs, partial);
      persistPrefs(prefs);
    }

    function persistStyleModelsFromInputs() {
      const styleModels = Object.assign({}, prefs.styleModels, {
        anime: (modelAnimeInput && modelAnimeInput.value.trim()) || prefs.styleModels.anime,
        cinematic: (modelCinematicInput && modelCinematicInput.value.trim()) || prefs.styleModels.cinematic,
        manga: (modelMangaInput && modelMangaInput.value.trim()) || prefs.styleModels.manga,
        concept: (modelConceptInput && modelConceptInput.value.trim()) || prefs.styleModels.concept,
      });
      setPrefs({ styleModels });
    }

    function guessBackendBase() {
      const explicit = String(window.BAB_API_BASE || '').trim();
      if (explicit) return explicit.replace(/\/$/, '');

      const current = window.location;
      const host = String(current.hostname || '');
      if (/\.app\.github\.dev$/i.test(host) && /-\d+\.app\.github\.dev$/i.test(host)) {
        const backendHost = host.replace(/-\d+\.app\.github\.dev$/i, '-8000.app.github.dev');
        return current.protocol + '//' + backendHost;
      }

      if (host === 'localhost' || host === '127.0.0.1') {
        return current.protocol + '//' + host + ':8000';
      }

      return current.origin;
    }

    const BACKEND_BASE = guessBackendBase();

    function backendApiUrl(path) {
      const text = String(path || '').trim();
      if (!text) return BACKEND_BASE;
      if (text.startsWith('http://') || text.startsWith('https://')) return text;
      const suffix = text.startsWith('/') ? text : ('/' + text);
      return BACKEND_BASE.replace(/\/$/, '') + suffix;
    }

    async function postAiSuite(path, payload) {
      try {
        const res = await fetch(backendApiUrl(path), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, status: res.status, data };
        return { ok: true, status: res.status, data };
      } catch (_) {
        return { ok: false, status: 0, data: {} };
      }
    }

    function normalizeApiMediaUrl(url) {
      const text = String(url || '').trim();
      if (!text) return '';
      if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('blob:') || text.startsWith('data:')) {
        return text;
      }
      if (text.startsWith('/')) {
        return BACKEND_BASE.replace(/\/$/, '') + text;
      }
      return BACKEND_BASE.replace(/\/$/, '') + '/' + text;
    }

    async function generateRemoteVideoClipAsset(prompt, durationSec, mood, promptPackage) {
      const clipAspect = ((aiClipExportPreset?.value || '') === 'vertical-1080') ? '9:16' : '16:9';
      const response = await postAiSuite('/api/cap-anime/generate-video/', {
        prompt: String(promptPackage?.expandedPrompt || prompt || 'CAP clip').slice(0, 420),
        aspect: clipAspect,
        duration: clamp(Number(durationSec || 6), 2, 120),
        model: pickStyleLock(imageStyle?.value || 'cinematic').toLowerCase().includes('manga') ? 'sdxl' : 'flux',
        mood: mood || 'intense',
      });
      if (!response.ok || !response.data || !response.data.videoUrl) return null;

      const remoteVideoUrl = normalizeApiMediaUrl(response.data.videoUrl);
      const thumbUrl = normalizeApiMediaUrl(response.data.thumbnailUrl || response.data.imageUrl || '');
      const videoRes = await fetch(remoteVideoUrl);
      if (!videoRes.ok) return null;
      const blob = await videoRes.blob();
      if (!blob || !String(blob.type || '').startsWith('video/')) return null;
      return {
        blob,
        remoteVideoUrl,
        thumbnailUrl: thumbUrl,
        source: response.data.source || 'backend',
      };
    }

    function getBlockedTermsList() {
      const custom = String(prefs.blockedTerms || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const strict = ['nudity', 'sexual', 'explicit', 'gore', 'violent assault', 'hate symbol'];
      return prefs.moderationMode === 'strict' ? custom.concat(strict) : custom;
    }

    function isPromptAllowed(promptText) {
      if (prefs.moderationMode === 'off') return true;
      const txt = String(promptText || '').toLowerCase();
      const blocked = getBlockedTermsList();
      return !blocked.some((term) => term && txt.includes(term));
    }

    async function ensurePromptAllowed(promptText) {
      if (prefs.moderationMode === 'off') return true;
      const blockedTerms = String(prefs.blockedTerms || '')
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean);
      const remote = await postAiSuite('/api/ai-suite/moderate/', {
        prompt: String(promptText || ''),
        mode: prefs.moderationMode || 'standard',
        blockedTerms,
      });
      if (remote.ok && remote.data && typeof remote.data.allowed === 'boolean') {
        return !!remote.data.allowed;
      }
      return isPromptAllowed(promptText);
    }

    function appendFineTunePrompt(promptText) {
      const active = String(prefs.activeFineTune || '');
      if (!active) return String(promptText || '');
      const preset = prefs.fineTunePresets && prefs.fineTunePresets[active];
      if (!preset) return String(promptText || '');
      const strength = clamp(Number(preset.strength || 0.85), 0.1, 1.5).toFixed(2);
      return String(promptText || '') + ' | adapter:' + active + ' strength:' + strength;
    }

    async function emitWebhookEvent(eventName, payload) {
      const url = String(prefs.webhookUrl || '').trim();
      if (!url) return;
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: eventName,
            at: new Date().toISOString(),
            license: prefs.licenseProfile || 'commercial',
            workspace: prefs.teamWorkspace || '',
            payload: payload || {},
          }),
        });
      } catch (_) {
        // Keep generation resilient if webhooks fail.
      }
    }

    function loadReviews() {
      try {
        return JSON.parse(localStorage.getItem(AI_REVIEW_KEY) || '[]');
      } catch (_) {
        return [];
      }
    }

    function saveReviews(items) {
      localStorage.setItem(AI_REVIEW_KEY, JSON.stringify(items || []));
    }

    function encodeWavFromMonoFloat32(samples, sampleRate) {
      const pcmBytes = samples.length * 2;
      const buffer = new ArrayBuffer(44 + pcmBytes);
      const view = new DataView(buffer);
      function writeStr(offset, str) {
        for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + pcmBytes, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, pcmBytes, true);
      let off = 44;
      for (let i = 0; i < samples.length; i += 1) {
        const s = clamp(samples[i], -1, 1);
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
      return new Blob([buffer], { type: 'audio/wav' });
    }

    function createProceduralSoundtrackBlob(mood, durationSec) {
      const sr = 44100;
      const total = Math.max(1, Math.floor(sr * durationSec));
      const out = new Float32Array(total);
      const baseHz = mood === 'heroic' ? 180 : (mood === 'mystic' ? 132 : (mood === 'ambient' ? 96 : 148));
      for (let i = 0; i < total; i += 1) {
        const t = i / sr;
        const env = Math.min(1, t / 0.4) * Math.min(1, (durationSec - t) / 0.6);
        const drone = Math.sin(2 * Math.PI * baseHz * t) * 0.24;
        const pad = Math.sin(2 * Math.PI * (baseHz * 0.5) * t) * 0.16;
        const pulseRate = mood === 'intense' ? 2.8 : (mood === 'heroic' ? 2.1 : 1.2);
        const pulse = (Math.sin(2 * Math.PI * pulseRate * t) * 0.5 + 0.5) * 0.18;
        const noise = (Math.random() * 2 - 1) * (mood === 'ambient' ? 0.015 : 0.03);
        out[i] = clamp((drone + pad + pulse + noise) * env, -1, 1);
      }
      return encodeWavFromMonoFloat32(out, sr);
    }

    async function renderInterpolatedClip(blob, factor, fps) {
      const decoded = await extractDecodedFramesFromVideoBlob(blob, fps).catch(() => null);
      if (!decoded || decoded.length < 2) throw new Error('not enough frames');
      const first = await loadImageFromUrl(decoded[0].dataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = first.naturalWidth || first.width || 1280;
      canvas.height = first.naturalHeight || first.height || 720;
      const ctx = canvas.getContext('2d');
      const loaded = await Promise.all(decoded.map((f) => loadImageFromUrl(f.dataUrl).catch(() => null)));
      const span = Math.max(0, Number(factor || 0));
      const totalFrames = ((decoded.length - 1) * (span + 1)) + 1;
      const duration = totalFrames / fps;
      return recordCanvasAnimation(canvas, (_t, frameIndex) => {
        const base = Math.min(decoded.length - 2, Math.floor(frameIndex / (span + 1)));
        const sub = frameIndex % (span + 1);
        const alpha = sub / Math.max(1, span + 1);
        const a = loaded[base];
        const b = loaded[Math.min(decoded.length - 1, base + 1)];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (a) ctx.drawImage(a, 0, 0, canvas.width, canvas.height);
        if (b && alpha > 0.001) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }, duration, fps);
    }

    function navigateToSection(sectionId) {
      const navItem = document.querySelector('.nav-item[data-section="' + sectionId + '"]');
      if (navItem) navItem.click();
    }

    function recentOutputSummary(kind, title) {
      return {
        id: 'R' + Date.now() + Math.floor(Math.random() * 1000),
        kind,
        title,
        createdAt: new Date().toISOString(),
      };
    }

    function renderRecentOutputs(items) {
      if (!recentOutputsEl) return;
      recentOutputsEl.innerHTML = '';
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'ai-recent-empty';
        empty.textContent = 'No AI outputs yet. Generate and save content to build your quick history.';
        recentOutputsEl.appendChild(empty);
        return;
      }
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'ai-recent-item';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'ai-recent-title';
        title.textContent = item.title;
        const sub = document.createElement('div');
        sub.className = 'ai-recent-sub';
        sub.textContent = item.kind + ' · ' + new Date(item.createdAt).toLocaleTimeString();
        left.appendChild(title);
        left.appendChild(sub);

        const btn = document.createElement('button');
        btn.className = 'btn-outline';
        btn.textContent = item.kind === 'Scene Pack' ? 'Open Production' : 'Open Assets';
        btn.addEventListener('click', () => {
          navigateToSection(item.kind === 'Scene Pack' ? 'production' : 'assets');
        });

        row.appendChild(left);
        row.appendChild(btn);
        recentOutputsEl.appendChild(row);
      });
    }

    function addRecentOutput(kind, title) {
      const state = loadState();
      const existing = Array.isArray(state.recentOutputs) ? state.recentOutputs : [];
      const next = [recentOutputSummary(kind, title)].concat(existing).slice(0, 8);
      persistState({ recentOutputs: next });
      renderRecentOutputs(next);
    }

    function clearRecentOutputs() {
      persistState({ recentOutputs: [] });
      renderRecentOutputs([]);
      showToast('Recent outputs cleared', 'info');
    }

    function parseCustomDurationsInput(raw, expectedShots) {
      const parts = String(raw || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      if (!parts.length) {
        return { ok: false, reason: 'Enter comma-separated shot durations', values: [] };
      }

      const values = parts.map((part) => Number(part));
      if (values.some((n) => !Number.isFinite(n) || n <= 0)) {
        return { ok: false, reason: 'Every shot duration must be a positive number', values: [] };
      }

      if (values.length !== expectedShots) {
        return {
          ok: false,
          reason: 'Add exactly ' + expectedShots + ' values (one for each shot)',
          values,
        };
      }

      return { ok: true, values };
    }

    function weightedDurations(totalSeconds, weights) {
      const sum = weights.reduce((s, w) => s + w, 0);
      const values = weights.map((w) => Number(((totalSeconds * w) / sum).toFixed(2)));
      const consumed = values.slice(0, -1).reduce((s, v) => s + v, 0);
      values[values.length - 1] = Number((totalSeconds - consumed).toFixed(2));
      return values;
    }

    function buildTemplateWeights(templateName, shots) {
      if (templateName === 'fast-curve') {
        return Array.from({ length: shots }, (_, i) => shots - i);
      }
      if (templateName === 'dramatic-ramp') {
        return Array.from({ length: shots }, (_, i) => i + 1);
      }
      if (templateName === 'finale-burst') {
        const burstStart = Math.max(0, shots - Math.ceil(shots / 3));
        return Array.from({ length: shots }, (_, i) => {
          if (i >= burstStart) return 0.65;
          if (i === burstStart - 1) return 1.35;
          return 1;
        });
      }
      return Array.from({ length: shots }, () => 1);
    }

    function applySceneTimingTemplate(templateName) {
      const shots = clamp(Number(sceneShots.value || 8), 3, 24);
      const total = clamp(Number(sceneDuration.value || 24), 6, 1800);
      sceneTimingMode.value = 'custom';
      updateSceneTimingModeUI();

      const weights = buildTemplateWeights(templateName, shots);
      const durations = weightedDurations(total, weights);
      sceneCustomDurations.value = durations.join(', ');
      updateSceneDurationDisplay();
      renderSceneTimingGraph(durations);
      saveInputsState();
      showToast('Applied ' + templateName.replace('-', ' ') + ' timing template', 'success');
    }

    function clearSceneCustomTiming() {
      sceneCustomDurations.value = '';
      updateSceneDurationDisplay();
      clearSceneTimingGraph();
      saveInputsState();
      showToast('Custom timing values cleared', 'info');
    }

    function clearSceneTimingGraph() {
      if (!sceneTimingGraph) return;
      sceneTimingGraph.hidden = true;
      sceneTimingGraph.innerHTML = '';
    }

    function renderSceneTimingGraph(values) {
      if (!sceneTimingGraph) return;
      const total = values.reduce((sum, n) => sum + n, 0);
      sceneTimingGraph.innerHTML = '';

      const track = document.createElement('div');
      track.className = 'ai-timing-track';

      const legend = document.createElement('div');
      legend.className = 'ai-timing-legend';

      values.forEach((duration, idx) => {
        const width = Math.max(2.5, (duration / total) * 100);
        const seg = document.createElement('div');
        seg.className = 'ai-timing-seg';
        seg.style.width = width + '%';
        seg.style.background = `hsl(${(idx * 29) % 360} 70% 40% / 0.95)`;
        seg.title = 'Shot ' + (idx + 1) + ': ' + duration.toFixed(2) + 's';
        seg.textContent = 'S' + (idx + 1);
        track.appendChild(seg);

        const item = document.createElement('div');
        item.className = 'ai-timing-item';
        item.textContent = 'S' + (idx + 1) + ': ' + duration.toFixed(2) + 's';
        legend.appendChild(item);
      });

      sceneTimingGraph.appendChild(track);
      sceneTimingGraph.appendChild(legend);
      sceneTimingGraph.hidden = false;
    }

    function previewSceneTimingGraph() {
      if ((sceneTimingMode.value || 'even') !== 'custom') {
        showToast('Switch to Custom Shot Timing first', 'error');
        return;
      }
      const shots = clamp(Number(sceneShots.value || 8), 3, 24);
      const parsed = parseCustomDurationsInput(sceneCustomDurations.value, shots);
      if (!parsed.ok) {
        showToast(parsed.reason, 'error');
        return;
      }
      renderSceneTimingGraph(parsed.values);
      showToast('Timeline graph preview updated', 'success');
    }

    function exportTimelineGraphAsPng() {
      if ((sceneTimingMode.value || 'even') !== 'custom') {
        showToast('Switch to Custom Shot Timing first to preview the graph', 'error');
        return;
      }
      const shots = clamp(Number(sceneShots.value || 8), 3, 24);
      const parsed = parseCustomDurationsInput(sceneCustomDurations.value, shots);
      if (!parsed.ok) {
        showToast(parsed.reason, 'error');
        return;
      }
      renderSceneTimingGraph(parsed.values);

      const values = parsed.values;
      const total = values.reduce((sum, n) => sum + n, 0);
      const cw = 900;
      const ch = 160 + values.length * 22 + 40;
      const cnv = document.createElement('canvas');
      cnv.width = cw;
      cnv.height = ch;
      const c = cnv.getContext('2d');

      // background
      c.fillStyle = '#0f172a';
      c.fillRect(0, 0, cw, ch);

      // title
      c.fillStyle = '#94a3b8';
      c.font = 'bold 14px sans-serif';
      c.fillText('Timeline Graph — ' + (scenePrompt?.value || 'Scene').slice(0, 60), 16, 22);

      // track bar
      const trackY = 44;
      const trackH = 48;
      let cx = 16;
      const trackW = cw - 32;
      values.forEach((dur, idx) => {
        const segW = Math.max(4, (dur / total) * trackW);
        const hue = (idx * 29) % 360;
        c.fillStyle = `hsl(${hue} 65% 42%)`;
        c.fillRect(cx, trackY, segW - 2, trackH);
        // shot label
        if (segW > 22) {
          c.fillStyle = '#f8fafc';
          c.font = 'bold 11px sans-serif';
          c.fillText('S' + (idx + 1), cx + 5, trackY + trackH / 2 + 4);
        }
        cx += segW;
      });

      // legend
      let startSec = 0;
      values.forEach((dur, idx) => {
        const row = idx % 2;
        const col = Math.floor(idx / 2);
        const lx = 16 + col * 220;
        const ly = trackY + trackH + 16 + row * 18 + Math.floor(idx / 2) * 0;
        const actualLy = trackY + trackH + 12 + idx * 19;
        const hue = (idx * 29) % 360;
        c.fillStyle = `hsl(${hue} 65% 42%)`;
        c.fillRect(16, actualLy, 12, 12);
        c.fillStyle = '#cbd5e1';
        c.font = '11px sans-serif';
        c.fillText(`Shot ${idx + 1}: ${startSec.toFixed(1)}s – ${(startSec + dur).toFixed(1)}s  (${dur.toFixed(2)}s)`, 34, actualLy + 10);
        startSec += dur;
      });

      cnv.toBlob((blob) => {
        if (!blob) { showToast('Export failed', 'error'); return; }
        createDownload(blob, 'timeline-graph.png');
        showToast('Timeline graph exported as PNG', 'success');
      }, 'image/png');
    }

    function updateSceneTimingModeUI() {
      const custom = sceneTimingMode.value === 'custom';
      sceneCustomDurations.hidden = !custom;
      if (sceneTimingTemplates) sceneTimingTemplates.hidden = !custom;
      if (!custom) clearSceneTimingGraph();
      sceneDuration.max = custom ? '1800' : '180';
      saveInputsState();
      updateSceneDurationDisplay();
    }

    function updateSceneDurationDisplay() {
      const shots = clamp(Number(sceneShots.value || 8), 3, 24);
      const mode = sceneTimingMode.value || 'even';
      if (mode === 'custom') {
        const parsed = parseCustomDurationsInput(sceneCustomDurations.value, shots);
        if (!parsed.ok) {
          sceneDurationDisplay.textContent = 'Scene runtime: waiting for custom timings (' + parsed.reason + ')';
          return;
        }
        const totalCustom = parsed.values.reduce((sum, n) => sum + n, 0);
        const total = clamp(Number(totalCustom.toFixed(2)), 6, 1800);
        sceneDuration.value = String(total);
        sceneDurationDisplay.textContent = 'Scene runtime: ' + total.toFixed(1) + 's total (custom shot lengths)';
        return;
      }

      const total = clamp(Number(sceneDuration.value || 24), 6, 180);
      if (sceneDurationDisplay) {
        sceneDurationDisplay.textContent = 'Scene runtime: ' + total + 's total (' + (total / shots).toFixed(1) + 's per shot)';
      }
    }

    async function applyImagePreset() {
      const preset = IMAGE_PRESETS[imagePreset.value || ''];
      if (!preset) {
        showToast('Choose an image preset pack first', 'error');
        return;
      }
      imagePrompt.value = preset.prompt;
      imageStyle.value = preset.style;
      imageSize.value = preset.size;
      await generateImageWithQualityGuard(false);
      saveInputsState();
      showToast('Image preset applied', 'success');
    }

    function applyVideoPreset() {
      const preset = VIDEO_PRESETS[videoPreset.value || ''];
      if (!preset) {
        showToast('Choose a clip preset pack first', 'error');
        return;
      }
      videoPrompt.value = preset.prompt;
      videoMood.value = preset.mood;
      videoDuration.value = String(preset.duration);
      saveInputsState();
      showToast('Clip preset applied', 'success');
    }

    function applyScenePreset() {
      const preset = SCENE_PRESETS[scenePreset.value || ''];
      if (!preset) {
        showToast('Choose a scene preset pack first', 'error');
        return;
      }
      scenePrompt.value = preset.prompt;
      sceneShots.value = String(preset.shots);
      scenePacing.value = preset.pacing;
      sceneTimingMode.value = 'even';
      sceneCustomDurations.value = '';
      if (sceneDuration && !sceneDuration.value) sceneDuration.value = '24';
      updateSceneDurationDisplay();
      saveInputsState();
      showToast('Scene preset applied', 'success');
    }

    async function setCanvasSizeFromPreset(attemptTag) {
      const sizeValue = outpaintPadding > 0 && imageCanvas.width > 0 && imageCanvas.height > 0
        ? ((imageCanvas.width + outpaintPadding * 2) + 'x' + (imageCanvas.height + outpaintPadding * 2))
        : (imageSize.value === 'custom'
          ? ((aiCustomWidth?.value || '1280') + 'x' + (aiCustomHeight?.value || '720'))
          : (imageSize.value || '1280x720'));
      const dims = sizePresetToDimensions(sizeValue);
      const hdDims = ensureMinimumHdDimensions(dims.width, dims.height);
      const w = hdDims.width;
      const h = hdDims.height;
      const styleLock = pickStyleLock(imageStyle.value || 'anime');
      const renderProfile = getAutoHighQualityProfile();
      const transformStrength = clamp(Number(aiImageTransformStrength?.value || 0.55), 0.1, 1);
      const lockedSeed = aiSeedLock?.checked ? String(aiSeedValue?.value || '0') : '';
      const remixSuffix = remixMode ? '|remix:' + remixMode : '';
      const identityName = String(aiIdentityProfile?.value || '').trim();
      const identitySuffix = identityName ? (' | identity-lock:' + identityName) : '';
      const preparedImagePrompt = appendFineTunePrompt((imagePrompt.value || 'CAP Anime Studio') + identitySuffix);
      latestImagePromptPackage = buildPromptPackage(
        preparedImagePrompt,
        'image',
        imageStyle.value || 'anime',
        styleLock,
        w + 'x' + h + '|' + (attemptTag || 'a0') + remixSuffix + (lockedSeed ? '|seed:' + lockedSeed : '')
      );
      latestBaseImageDataUrl = latestImageDataUrl || latestBaseImageDataUrl;
      imageCanvas.width = w;
      imageCanvas.height = h;
      syncMaskCanvasSize();
      updateProgressBar(aiImageProgressiveBar, aiImageProgressiveStatus, 0.08, 'Preparing');

      const sourceBlendImage = latestSourceImage || (latestBaseImageDataUrl ? await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = latestBaseImageDataUrl;
      }) : null);

      let usedRemote = false;
      const remoteDataUrl = await generateRemoteImageDataUrl(
        latestImagePromptPackage,
        imageStyle.value || 'anime',
        w + 'x' + h,
        prefs
      );

      if (remoteDataUrl) {
        try {
          await drawDataUrlToCanvas(remoteDataUrl, imageCanvas);
          if (sourceBlendImage) {
            const remoteCtx = imageCanvas.getContext('2d');
            remoteCtx.save();
            remoteCtx.globalAlpha = clamp(1 - transformStrength, 0.15, 0.8);
            if (outpaintPadding > 0) {
              remoteCtx.drawImage(sourceBlendImage, outpaintPadding, outpaintPadding, w - outpaintPadding * 2, h - outpaintPadding * 2);
            } else {
              remoteCtx.drawImage(sourceBlendImage, 0, 0, w, h);
            }
            remoteCtx.restore();
          }
          const remoteCtx = imageCanvas.getContext('2d');
          for (let pass = 0; pass < (renderProfile.postPasses || 1); pass += 1) {
            enhanceImageData(remoteCtx, imageCanvas.width, imageCanvas.height, styleLock, renderProfile);
          }
          updateProgressBar(aiImageProgressiveBar, aiImageProgressiveStatus, 0.78, 'Refining');
          usedRemote = true;
        } catch (_) {
          usedRemote = false;
        }
      }

      if (!usedRemote) {
        if (prefs.backendProvider !== 'none') {
          showToast(
            `Provider fallback to local renderer: ${lastRemoteGenerateError || 'remote image generation unavailable'}`,
            'info'
          );
        }
        // Stage 1: lower-res structure generation.
        const baseCanvas = document.createElement('canvas');
        const baseScale = clamp(renderProfile.baseScale || 0.56, 0.5, 0.92);
        baseCanvas.width = Math.min(2048, Math.max(640, Math.round(w * baseScale)));
        baseCanvas.height = Math.min(2048, Math.max(640, Math.round(h * baseScale)));
        drawGeneratedImage(baseCanvas, latestImagePromptPackage.expandedPrompt, imageStyle.value || 'anime', Object.assign({}, latestImagePromptPackage, {
          renderProfile,
        }));

        if (sourceBlendImage) {
          const baseCtx = baseCanvas.getContext('2d');
          baseCtx.save();
          baseCtx.globalAlpha = clamp(1 - transformStrength, 0.15, 0.78);
          if (outpaintPadding > 0) {
            const scaledPadX = Math.round((outpaintPadding / w) * baseCanvas.width);
            const scaledPadY = Math.round((outpaintPadding / h) * baseCanvas.height);
            baseCtx.drawImage(sourceBlendImage, scaledPadX, scaledPadY, baseCanvas.width - scaledPadX * 2, baseCanvas.height - scaledPadY * 2);
          } else {
            baseCtx.drawImage(sourceBlendImage, 0, 0, baseCanvas.width, baseCanvas.height);
          }
          baseCtx.restore();
        }

        if (aiTileablePattern?.checked) {
          const baseCtx = baseCanvas.getContext('2d');
          const seam = Math.max(24, Math.round(Math.min(baseCanvas.width, baseCanvas.height) * 0.08));
          baseCtx.drawImage(baseCanvas, 0, 0, seam, baseCanvas.height, baseCanvas.width - seam, 0, seam, baseCanvas.height);
          baseCtx.drawImage(baseCanvas, 0, 0, baseCanvas.width, seam, 0, baseCanvas.height - seam, baseCanvas.width, seam);
        }

        const previewCtx = imageCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, w, h);
        previewCtx.drawImage(baseCanvas, 0, 0, w, h);
        updateProgressBar(aiImageProgressiveBar, aiImageProgressiveStatus, 0.42, 'Blocking');
        await nextFrame();

        // Stage 2: upscale + detail enhancement.
        const upscaled = upscaleAndEnhance(baseCanvas, w, h, styleLock, renderProfile);
        const finalCtx = imageCanvas.getContext('2d');
        finalCtx.drawImage(upscaled, 0, 0, w, h);
        updateProgressBar(aiImageProgressiveBar, aiImageProgressiveStatus, 0.84, 'Upscaling');
        await nextFrame();
      }

      if (isLikelyBlankCanvas(imageCanvas)) {
        // Ensure a non-empty visual result even when a provider returns an empty payload.
        drawGeneratedImage(imageCanvas, latestImagePromptPackage.expandedPrompt, imageStyle.value || 'anime', Object.assign({}, latestImagePromptPackage, {
          renderProfile,
        }));
      }

      const qualityScore = computeImageQualityScore(imageCanvas);
      if (hasMaskPixels()) {
        applyMaskedComposite();
      }
      latestImageDataUrl = imageCanvas.toDataURL('image/png');
      pulseCanvasPreview(imageCanvas);
      updateProgressBar(aiImageProgressiveBar, aiImageProgressiveStatus, 1, 'Ready');
      remixMode = '';
      outpaintPadding = 0;
      return { qualityScore, usedRemote };
    }

    async function generateImageWithQualityGuard(showStatusToast) {
      const maxAttempts = Math.max(1, (prefs.maxRegens || 0) + 1);
      let best = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = await setCanvasSizeFromPreset('img-' + attempt);
        if (!best || result.qualityScore > best.qualityScore) best = result;
        if (result.qualityScore >= prefs.qualityThreshold) {
          if (showStatusToast) {
            showToast(
              `Image generated (${result.usedRemote ? 'backend' : 'local'}) · Quality ${result.qualityScore}`,
              'success'
            );
          }
          return result;
        }
      }
      if (showStatusToast && best) {
        showToast(`Image generated below threshold (${best.qualityScore}/${prefs.qualityThreshold})`, 'info');
      }
      
      // Save to history and undo stack
      if (best && latestImageDataUrl) {
        pushCanvasUndo(imageCanvas);
        const historyEntry =addToHistory(imagePrompt.value, imageStyle.value || 'anime', latestImageDataUrl, {
          sampler: aiSamplingMethod?.value,
          steps: aiSteps?.value,
          guidance: aiGuidanceScale?.value,
          format: aiExportFormat?.value,
        });
        renderHistoryFiltered();
        btnUndoGeneration.disabled = false;
      }
      
      // Handle batch mode
      if (showStatusToast && aiBatchCount && parseInt(aiBatchCount.value) > 1) {
        for (let b = 1; b < parseInt(aiBatchCount.value); b += 1) {
          await setCanvasSizeFromPreset('img-batch-' + b);
          if (latestImageDataUrl) {
            pushCanvasUndo(imageCanvas);
            addToHistory(imagePrompt.value, imageStyle.value || 'anime', latestImageDataUrl, { batchIndex: b });
          }
        }
        showToast(`Batch generation complete (${aiBatchCount.value} images)`, 'success');
        renderHistoryFiltered();
      }

      return best || { qualityScore: 0, usedRemote: false };
    }

    imageSize.addEventListener('change', () => {
      generateImageWithQualityGuard(false).catch(() => {});
    });
    sceneShots.addEventListener('input', () => {
      updateSceneDurationDisplay();
      saveInputsState();
    });
    sceneDuration.addEventListener('input', () => {
      updateSceneDurationDisplay();
      saveInputsState();
    });
    sceneTimingMode.addEventListener('change', updateSceneTimingModeUI);
    sceneCustomDurations.addEventListener('input', () => {
      updateSceneDurationDisplay();
      saveInputsState();
    });
    btnSceneTimingFastCurve?.addEventListener('click', () => applySceneTimingTemplate('fast-curve'));
    btnSceneTimingDramaticRamp?.addEventListener('click', () => applySceneTimingTemplate('dramatic-ramp'));
    btnSceneTimingFinaleBurst?.addEventListener('click', () => applySceneTimingTemplate('finale-burst'));
    btnSceneTimingPreview?.addEventListener('click', previewSceneTimingGraph);
    $('btnSceneTimingExportPng')?.addEventListener('click', exportTimelineGraphAsPng);
    btnSceneTimingClear?.addEventListener('click', clearSceneCustomTiming);
    aiSettingsPanelBtn?.addEventListener('click', toggleAiSettingsPanel);
    toggleShortcutHelpBtn?.addEventListener('click', toggleShortcutHelp);
    toastDurationInput?.addEventListener('change', () => {
      setPrefs({ toastDuration: clamp(Number(toastDurationInput.value || 2600), 1200, 7000) });
      showToast('Toast duration updated', 'success');
    });
    autoOpenProductionInput?.addEventListener('change', () => {
      setPrefs({ autoOpenProduction: !!autoOpenProductionInput.checked });
      showToast('Auto-open setting saved', 'success');
    });
    renderQualityInput?.addEventListener('change', () => {
      const value = ['standard', 'high', 'ultra'].includes(String(renderQualityInput.value || '').toLowerCase())
        ? String(renderQualityInput.value).toLowerCase()
        : 'high';
      setPrefs({ renderQuality: value });
      showToast('Render quality updated', 'success');
    });
    backendProviderInput?.addEventListener('change', () => {
      setPrefs({ backendProvider: backendProviderInput.value || 'none' });
      showToast('Backend provider updated', 'success');
    });
    apiKeyInput?.addEventListener('change', () => {
      setPrefs({ apiKey: apiKeyInput.value || '' });
      showToast('API key saved locally', 'success');
    });
    customEndpointInput?.addEventListener('change', () => {
      setPrefs({ customEndpoint: customEndpointInput.value || '' });
      showToast('Custom endpoint saved', 'success');
    });
    qualityThresholdInput?.addEventListener('change', () => {
      setPrefs({ qualityThreshold: clamp(Number(qualityThresholdInput.value || 72), 20, 98) });
      showToast('Quality threshold updated', 'success');
    });
    maxRegensInput?.addEventListener('change', () => {
      setPrefs({ maxRegens: clamp(Number(maxRegensInput.value || 2), 0, 6) });
      showToast('Auto re-gen attempts updated', 'success');
    });
    modelAnimeInput?.addEventListener('change', persistStyleModelsFromInputs);
    modelCinematicInput?.addEventListener('change', persistStyleModelsFromInputs);
    modelMangaInput?.addEventListener('change', persistStyleModelsFromInputs);
    modelConceptInput?.addEventListener('change', persistStyleModelsFromInputs);
    aiModerationMode?.addEventListener('change', () => {
      setPrefs({ moderationMode: aiModerationMode.value || 'standard' });
      showToast('Moderation mode updated', 'success');
    });
    aiBlockedTerms?.addEventListener('change', () => {
      setPrefs({ blockedTerms: aiBlockedTerms.value || '' });
      showToast('Blocked terms updated', 'success');
    });
    aiLicenseProfile?.addEventListener('change', () => {
      setPrefs({ licenseProfile: aiLicenseProfile.value || 'commercial' });
      showToast('License profile updated', 'success');
    });
    aiWebhookUrl?.addEventListener('change', () => {
      setPrefs({ webhookUrl: aiWebhookUrl.value || '' });
      showToast('Webhook URL saved', 'success');
    });
    aiInterpolationFactor?.addEventListener('change', () => {
      setPrefs({ interpolationFactor: clamp(Number(aiInterpolationFactor.value || 1), 0, 3) });
    });
    aiSocialPreset?.addEventListener('change', () => {
      setPrefs({ socialPreset: aiSocialPreset.value || 'tiktok' });
    });
    aiTeamWorkspace?.addEventListener('change', () => {
      setPrefs({ teamWorkspace: aiTeamWorkspace.value || '' });
    });
    btnTestWebhook?.addEventListener('click', async () => {
      const targetUrl = String(aiWebhookUrl?.value || prefs.webhookUrl || '').trim();
      if (!targetUrl) {
        showToast('Add a webhook URL first', 'error');
        return;
      }
      const result = await postAiSuite('/api/ai-suite/webhook/test/', {
        url: targetUrl,
        event: 'test',
        payload: { message: 'CAP Anime Studio webhook test event' },
      });
      if (result.ok) {
        showToast('Webhook test sent via backend', 'success');
      } else {
        await emitWebhookEvent('test', { message: 'CAP Anime Studio webhook test event' });
        showToast('Webhook test sent with direct fallback', 'info');
      }
    });
    btnSaveIdentityProfile?.addEventListener('click', async () => {
      const name = String(aiIdentityProfile?.value || '').trim();
      const file = aiFaceReferenceUpload?.files && aiFaceReferenceUpload.files[0];
      if (!name || !file) {
        showToast('Provide profile name and reference image', 'error');
        return;
      }
      const dataUrl = await dataUrlFromBlob(file).catch(() => '');
      if (!dataUrl) {
        showToast('Could not read face reference image', 'error');
        return;
      }
      const identityProfiles = Object.assign({}, prefs.identityProfiles, {
        [name]: {
          dataUrl,
          createdAt: new Date().toISOString(),
        },
      });
      setPrefs({ identityProfiles });
      showToast('Identity lock profile saved', 'success');
    });
    btnSaveFineTunePreset?.addEventListener('click', () => {
      const name = String(aiFineTuneName?.value || '').trim();
      if (!name) {
        showToast('Enter an adapter name', 'error');
        return;
      }
      const strength = clamp(Number(aiFineTuneStrength?.value || 0.85), 0.1, 1.5);
      const fineTunePresets = Object.assign({}, prefs.fineTunePresets, {
        [name]: { strength, createdAt: new Date().toISOString() },
      });
      setPrefs({ fineTunePresets, activeFineTune: name });
      showToast('Fine-tune adapter saved and activated', 'success');
    });
    clearRecentBtn?.addEventListener('click', clearRecentOutputs);
    $('btnApplyImagePreset')?.addEventListener('click', () => {
      applyImagePreset().catch(() => {
        showToast('Failed to apply image preset', 'error');
      });
    });
    $('btnApplyVideoPreset')?.addEventListener('click', applyVideoPreset);
    $('btnApplyScenePreset')?.addEventListener('click', applyScenePreset);

    // Advanced controls handlers
    aiImageSize?.addEventListener('change', () => {
      if (aiImageSize.value === 'custom') {
        aiCustomAspectWrap.hidden = false;
      } else {
        aiCustomAspectWrap.hidden = true;
      }
    });

    aiCustomWidth?.addEventListener('input', saveDraftAuto);
    aiCustomHeight?.addEventListener('input', saveDraftAuto);

    aiSeedLock?.addEventListener('change', () => {
      aiSeedValue.disabled = !aiSeedLock.checked;
      if (!aiSeedLock.checked) aiSeedValue.value = '';
    });

    aiGuidanceScale?.addEventListener('input', () => {
      aiGuidanceValue.textContent = parseFloat(aiGuidanceScale.value).toFixed(1);
    });

    aiImageTransformStrength?.addEventListener('input', () => {
      aiImageTransformStrengthValue.textContent = parseFloat(aiImageTransformStrength.value).toFixed(2);
    });

    aiImageSourceUpload?.addEventListener('change', async () => {
      try {
        latestSourceImage = await loadImageFromFile(aiImageSourceUpload.files && aiImageSourceUpload.files[0]);
        showToast(latestSourceImage ? 'Reference image loaded' : 'Reference image cleared', 'success');
      } catch (_) {
        latestSourceImage = null;
        showToast('Failed to load reference image', 'error');
      }
    });

    aiSteps?.addEventListener('input', () => {
      aiStepsValue.textContent = aiSteps.value;
    });

    btnUndoGeneration?.addEventListener('click', () => {
      if (performUndo(imageCanvas)) {
        showToast('Undo complete', 'success');
      } else {
        showToast('Nothing to undo', 'info');
      }
    });

    btnRedoGeneration?.addEventListener('click', () => {
      if (performRedo(imageCanvas)) {
        showToast('Redo complete', 'success');
      } else {
        showToast('Nothing to redo', 'info');
      }
    });

    btnCancelGeneration?.addEventListener('click', () => {
      cancelGeneration();
      btnCancelGeneration.hidden = true;
      showToast('Generation cancelled', 'info');
    });

    aiMaskPaintMode?.addEventListener('change', () => {
      syncMaskCanvasSize();
      showToast(aiMaskPaintMode.checked ? 'Mask paint enabled' : 'Mask paint disabled', 'info');
    });

    aiMaskBrushSize?.addEventListener('input', () => {
      if (aiMaskBrushSizeValue) aiMaskBrushSizeValue.textContent = String(aiMaskBrushSize.value);
    });

    btnCanvasZoomIn?.addEventListener('click', () => {
      canvasView.scale = clamp(canvasView.scale + 0.15, 0.5, 4);
      applyCanvasView();
    });

    btnCanvasZoomOut?.addEventListener('click', () => {
      canvasView.scale = clamp(canvasView.scale - 0.15, 0.5, 4);
      applyCanvasView();
    });

    btnCanvasResetView?.addEventListener('click', () => {
      resetCanvasView();
    });

    aiCanvasGridToggle?.addEventListener('change', applyCanvasView);

    aiCanvasViewport?.addEventListener('wheel', (event) => {
      event.preventDefault();
      canvasView.scale = clamp(canvasView.scale + (event.deltaY < 0 ? 0.12 : -0.12), 0.5, 4);
      applyCanvasView();
    }, { passive: false });

    aiCanvasViewport?.addEventListener('pointerdown', (event) => {
      if (!aiCanvasPanMode?.checked) return;
      canvasPanning = true;
      canvasPanStart = { x: event.clientX - canvasView.x, y: event.clientY - canvasView.y };
    });

    aiCanvasViewport?.addEventListener('pointermove', (event) => {
      if (!canvasPanning || !canvasPanStart) return;
      canvasView.x = event.clientX - canvasPanStart.x;
      canvasView.y = event.clientY - canvasPanStart.y;
      applyCanvasView();
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => {
      aiCanvasViewport?.addEventListener(type, () => {
        canvasPanning = false;
        canvasPanStart = null;
      });
    });

    aiOutpaintDirection?.addEventListener('change', () => {
      outpaintDirection = aiOutpaintDirection.value || 'all';
    });

    aiMaskCanvas?.addEventListener('pointerdown', (event) => {
      if (!aiMaskPaintMode?.checked) return;
      maskPainting = true;
      if (aiMaskRectMode?.checked) {
        maskRectStart = getMaskPoint(event);
        const maskCtx = getMaskContext();
        maskRectSnapshot = maskCtx ? maskCtx.getImageData(0, 0, aiMaskCanvas.width, aiMaskCanvas.height) : null;
        return;
      }
      drawMaskStroke.lastX = undefined;
      drawMaskStroke.lastY = undefined;
      drawMaskStroke(event);
    });

    aiMaskCanvas?.addEventListener('pointermove', (event) => {
      if (!maskPainting) return;
      if (aiMaskRectMode?.checked) {
        const endPoint = getMaskPoint(event);
        if (maskRectStart && endPoint) previewMaskRectangle(maskRectStart, endPoint);
        return;
      }
      drawMaskStroke(event);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => {
      aiMaskCanvas?.addEventListener(type, (event) => {
        if (maskPainting && aiMaskRectMode?.checked && maskRectStart) {
          const endPoint = getMaskPoint(event);
          if (endPoint) drawMaskRectangle(maskRectStart, endPoint);
        }
        maskPainting = false;
        maskRectStart = null;
        maskRectSnapshot = null;
        drawMaskStroke.lastX = undefined;
        drawMaskStroke.lastY = undefined;
      });
    });

    btnClearMask?.addEventListener('click', () => {
      clearMaskCanvas();
      showToast('Mask cleared', 'success');
    });

    btnSaveMaskPreset?.addEventListener('click', () => {
      const presetName = String(aiMaskPresetName?.value || '').trim();
      const ok = saveMaskPreset(presetName);
      showToast(ok ? 'Mask preset saved' : 'Mask preset save failed', ok ? 'success' : 'error');
    });

    btnLoadMaskPreset?.addEventListener('click', async () => {
      const selectedName = String(aiMaskPresetSelect?.value || '').trim();
      const ok = await loadMaskPreset(selectedName);
      showToast(ok ? 'Mask preset loaded' : 'No saved mask preset found', ok ? 'success' : 'info');
    });

    btnDeleteMaskPreset?.addEventListener('click', () => {
      const selectedName = String(aiMaskPresetSelect?.value || '').trim();
      const ok = deleteMaskPreset(selectedName);
      showToast(ok ? 'Mask preset deleted' : 'No saved mask preset selected', ok ? 'success' : 'info');
    });

    btnFillBorderMask?.addEventListener('click', () => {
      fillBorderMask(outpaintDirection);
      showToast('Border mask applied (' + outpaintDirection + ')', 'success');
    });

    btnRemixSubtle?.addEventListener('click', async () => {
      if (!latestImageDataUrl) {
        showToast('Generate an image first', 'info');
        return;
      }
      remixMode = 'subtle';
      latestSourceImage = await loadImageFromUrl(latestImageDataUrl);
      await generateImageWithQualityGuard(true);
    });

    btnRemixWild?.addEventListener('click', async () => {
      if (!latestImageDataUrl) {
        showToast('Generate an image first', 'info');
        return;
      }
      remixMode = 'wild';
      latestSourceImage = await loadImageFromUrl(latestImageDataUrl);
      await generateImageWithQualityGuard(true);
    });

    btnOutpaintExpand?.addEventListener('click', async () => {
      if (!latestImageDataUrl) {
        showToast('Generate an image first', 'info');
        return;
      }
      outpaintPadding = Math.max(64, Math.round(Math.min(imageCanvas.width, imageCanvas.height) * 0.12));
      fillBorderMask(outpaintDirection);
      latestSourceImage = await loadImageFromUrl(latestImageDataUrl);
      await generateImageWithQualityGuard(true);
    });

    async function upscaleCurrentCanvas(multiplier) {
      if (!latestImageDataUrl) {
        showToast('Generate an image first', 'info');
        return;
      }
      const styleLock = pickStyleLock(imageStyle.value || 'anime');
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = imageCanvas.width;
      sourceCanvas.height = imageCanvas.height;
      sourceCanvas.getContext('2d').drawImage(imageCanvas, 0, 0);
      const nextWidth = clamp(imageCanvas.width * multiplier, 512, 4096);
      const nextHeight = clamp(imageCanvas.height * multiplier, 512, 4096);
      const upscaled = upscaleAndEnhance(sourceCanvas, nextWidth, nextHeight, styleLock, getAutoHighQualityProfile());
      imageCanvas.width = nextWidth;
      imageCanvas.height = nextHeight;
      imageCanvas.getContext('2d').drawImage(upscaled, 0, 0, nextWidth, nextHeight);
      latestImageDataUrl = imageCanvas.toDataURL('image/png');
      pulseCanvasPreview(imageCanvas);
      showToast('Upscaled to ' + nextWidth + 'x' + nextHeight, 'success');
    }

    btnUpscale4x?.addEventListener('click', () => {
      upscaleCurrentCanvas(4).catch(() => showToast('Upscale failed', 'error'));
    });

    btnUpscale8x?.addEventListener('click', () => {
      upscaleCurrentCanvas(8).catch(() => showToast('Upscale failed', 'error'));
    });

    btnAddToFavorites?.addEventListener('click', () => {
      if (!latestImageDataUrl) {
        showToast('No image to favorite', 'warning');
        return;
      }
      const entry = addToHistory(imagePrompt.value, imageStyle.value, latestImageDataUrl, { format: aiExportFormat.value });
      toggleFavorite(entry.id);
      showToast('Added to favorites', 'success');
      btnAddToFavorites.style.color = '#ec4899';
    });

    btnCompareMode?.addEventListener('click', () => {
      if (!latestImageDataUrl) {
        showToast('No image to compare', 'warning');
        return;
      }
      aiComparisonPanel.hidden = false;
      aiCompareCanvasA.width = imageCanvas.width / 2;
      aiCompareCanvasA.height = imageCanvas.height / 2;
      aiCompareCanvasB.width = imageCanvas.width / 2;
      aiCompareCanvasB.height = imageCanvas.height / 2;
      const ctxA = aiCompareCanvasA.getContext('2d');
      const ctxB = aiCompareCanvasB.getContext('2d');
      ctxA.drawImage(imageCanvas, 0, 0, aiCompareCanvasA.width, aiCompareCanvasA.height);
      ctxB.drawImage(imageCanvas, 0, 0, aiCompareCanvasB.width, aiCompareCanvasB.height);
    });

    btnExitComparison?.addEventListener('click', () => {
      aiComparisonPanel.hidden = true;
    });

    btnSwapComparison?.addEventListener('click', () => {
      const tempUrl = aiCompareCanvasA.toDataURL();
      const ctxA = aiCompareCanvasA.getContext('2d');
      const ctxB = aiCompareCanvasB.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctxA.drawImage(img, 0, 0);
      };
      img.src = aiCompareCanvasB.toDataURL();
      img.onload = () => {
        const img2 = new Image();
        img2.onload = () => {
          ctxB.drawImage(img2, 0, 0);
        };
        img2.src = tempUrl;
      };
    });

    aiHistorySearch?.addEventListener('input', renderHistoryFiltered);
    aiHistoryFilter?.addEventListener('change', renderHistoryFiltered);

    btnThemeToggle?.addEventListener('click', toggleTheme);

    aiClipScrubber?.addEventListener('input', () => {
      const frame = Number(aiClipScrubber.value || 0);
      aiClipScrubberLabel.textContent = frame + 'f';
      if (clipPreview && clipPreview.duration && !Number.isNaN(clipPreview.duration)) {
        clipPreview.currentTime = clamp(frame / 24, 0, clipPreview.duration);
      } else if (latestClipFrames.length) {
        const nearest = latestClipFrames.reduce((best, item) => {
          return Math.abs(item.frame - frame) < Math.abs(best.frame - frame) ? item : best;
        }, latestClipFrames[0]);
        if (nearest && nearest.dataUrl) {
          clipPreview.poster = nearest.dataUrl;
        }
      }
    });

    btnExportClipSidecar?.addEventListener('click', async () => {
      if (!latestClipBlob) {
        showToast('Generate a clip first', 'info');
        return;
      }
      const exportFps = clamp(Number(aiClipExportFps?.value || 24), 1, 30);
      const decodedFrames = await extractDecodedFramesFromVideoBlob(latestClipBlob, exportFps).catch(() => null);
      if (!decodedFrames) {
        showToast('Clip sidecar export failed', 'error');
        return;
      }
      const sidecar = buildClipSidecar(decodedFrames, exportFps);
      downloadTextFile(JSON.stringify(sidecar, null, 2), 'ai-clip-sidecar.json', 'application/json');
      showToast('Clip sidecar exported', 'success');
    });

    btnExportClipFrames?.addEventListener('click', async () => {
      if (!latestClipBlob) {
        showToast('Generate a clip first', 'info');
        return;
      }
      const exportFps = clamp(Number(aiClipExportFps?.value || 24), 1, 30);
      const decodedFrames = await extractDecodedFramesFromVideoBlob(latestClipBlob, exportFps).catch(() => null);
      if (!decodedFrames) {
        showToast('Frame export failed', 'error');
        return;
      }
      const sidecar = buildClipSidecar(decodedFrames, exportFps);
      const zipFiles = decodedFrames.map((frame, index) => ({
        name: 'frame-' + String(index).padStart(4, '0') + '.png',
        bytes: dataUrlToUint8Array(frame.dataUrl),
      }));
      zipFiles.push({
        name: 'ai-clip-sidecar.json',
        bytes: textToUint8Array(JSON.stringify(sidecar, null, 2)),
      });
      const zipBlob = createZipBlob(zipFiles);
      createDownload(zipBlob, 'ai-clip-frames-' + exportFps + 'fps.zip');
      showToast('PNG frame ZIP exported with sidecar (' + decodedFrames.length + ' frames at ' + exportFps + ' fps)', 'success');
    });

    btnAddClipToComposition?.addEventListener('click', () => {
      if (!latestClipBlob) {
        showToast('Generate a clip first', 'info');
        return;
      }
      compositionQueue.push({
        kind: 'Clip',
        title: videoPrompt?.value || 'AI Clip',
        duration: clamp(Number(videoDuration?.value || 6), 0.1, 120),
        blob: latestClipBlob,
      });
      renderCompositionList();
      showToast('Clip added to composition queue', 'success');
    });

    btnAddTrailerToComposition?.addEventListener('click', () => {
      if (!latestTrailerBlob) {
        showToast('Generate a trailer first', 'info');
        return;
      }
      compositionQueue.push({
        kind: 'Trailer',
        title: trailerTitle?.value || 'AI Trailer',
        duration: clamp(Number(trailerDuration?.value || 18), 0.1, 300),
        blob: latestTrailerBlob,
      });
      renderCompositionList();
      showToast('Trailer added to composition queue', 'success');
    });

    btnAddTitleLayer?.addEventListener('click', () => {
      const title = String(aiCompositionTitleText?.value || '').trim();
      const subtitle = String(aiCompositionSubtitleText?.value || '').trim();
      const duration = clamp(Number(aiCompositionTitleDuration?.value || 4), 1, 30);
      if (!title && !subtitle) {
        showToast('Enter a title or subtitle first', 'info');
        return;
      }
      compositionQueue.push({
        kind: 'Title Layer',
        title: title || 'Title Layer',
        subtitle,
        duration,
      });
      renderCompositionList();
      showToast('Title layer added to composition queue', 'success');
    });

    btnAddImageOverlay?.addEventListener('click', async () => {
      const start = clamp(Number(aiOverlayStart?.value || 0), 0, 3600);
      const duration = clamp(Number(aiOverlayDuration?.value || 2), 0.2, 300);
      const opacity = clamp(Number(aiOverlayOpacity?.value || 0.85), 0.1, 1);
      const x = clamp(Number(aiOverlayX?.value || 50), 0, 100);
      const y = clamp(Number(aiOverlayY?.value || 50), 0, 100);
      const scale = clamp(Number(aiOverlayScale?.value || 38), 10, 260);
      const fadeIn = clamp(Number(aiOverlayFadeIn?.value || 0), 0, 30);
      const fadeOut = clamp(Number(aiOverlayFadeOut?.value || 0), 0, 30);
      const blendMode = String(aiOverlayBlendMode?.value || 'source-over');
      const motionPath = String(aiOverlayMotionPath?.value || 'none');
      const motionStrength = clamp(Number(aiOverlayMotionStrength?.value || 28), 0, 120);
      const ease = String(aiOverlayEase?.value || 'ease-in-out');
      const pathInterp = String(aiOverlayPathInterp?.value || 'linear');
      const bezierTension = clamp(Number(aiOverlayBezierTension?.value || 0.55), 0, 1);
      let dataUrl = latestImageDataUrl || '';
      const file = aiOverlayImageUpload?.files && aiOverlayImageUpload.files[0];
      if (file) {
        dataUrl = await dataUrlFromBlob(file).catch(() => '');
      }
      if (!dataUrl) {
        showToast('Generate or upload an image for overlay first', 'info');
        return;
      }
      const keyframes = parseOverlayKeyframes(aiOverlayKeyframes?.value || '', {
        x,
        y,
        scale,
        opacity,
      });
      const segmentTensions = getOverlaySegmentTensions(keyframes, bezierTension);
      compositionOverlays.push({
        kind: 'Image Overlay',
        label: 'Image Overlay',
        dataUrl,
        start,
        duration,
        opacity,
        x,
        y,
        scale,
        fadeIn,
        fadeOut,
        blendMode,
        motionPath,
        motionStrength,
        ease,
        pathInterp,
        bezierTension,
        segmentTensions,
        keyframes,
      });
      renderOverlayList();
      showToast('Image overlay track added', 'success');
    });

    btnAddTextOverlay?.addEventListener('click', () => {
      const text = String(aiOverlayTitleText?.value || '').trim();
      if (!text) {
        showToast('Enter overlay text first', 'info');
        return;
      }
      const overlayX = clamp(Number(aiOverlayX?.value || 50), 0, 100);
      const overlayY = clamp(Number(aiOverlayY?.value || 50), 0, 100);
      const overlayScale = clamp(Number(aiOverlayScale?.value || 38), 10, 260);
      const overlayOpacity = clamp(Number(aiOverlayOpacity?.value || 0.85), 0.1, 1);
      const pathInterp = String(aiOverlayPathInterp?.value || 'linear');
      const bezierTension = clamp(Number(aiOverlayBezierTension?.value || 0.55), 0, 1);
      const keyframes = parseOverlayKeyframes(aiOverlayKeyframes?.value || '', {
        x: overlayX,
        y: overlayY,
        scale: overlayScale,
        opacity: overlayOpacity,
      });
      const segmentTensions = getOverlaySegmentTensions(keyframes, bezierTension);
      compositionOverlays.push({
        kind: 'Text Overlay',
        label: text.slice(0, 42),
        text,
        fontSize: clamp(Number(aiOverlayTitleSize?.value || 56), 16, 140),
        start: clamp(Number(aiOverlayStart?.value || 0), 0, 3600),
        duration: clamp(Number(aiOverlayDuration?.value || 2), 0.2, 300),
        opacity: overlayOpacity,
        x: overlayX,
        y: overlayY,
        scale: overlayScale,
        fadeIn: clamp(Number(aiOverlayFadeIn?.value || 0), 0, 30),
        fadeOut: clamp(Number(aiOverlayFadeOut?.value || 0), 0, 30),
        blendMode: String(aiOverlayBlendMode?.value || 'source-over'),
        motionPath: String(aiOverlayMotionPath?.value || 'none'),
        motionStrength: clamp(Number(aiOverlayMotionStrength?.value || 28), 0, 120),
        ease: String(aiOverlayEase?.value || 'ease-in-out'),
        pathInterp,
        bezierTension,
        segmentTensions,
        keyframes,
      });
      renderOverlayList();
      showToast('Text overlay track added', 'success');
    });

    aiOverlayKeyframes?.addEventListener('input', renderOverlayKeyframeEditor);
    aiOverlayPathInterp?.addEventListener('change', renderOverlayKeyframeEditor);
    aiOverlayBezierTension?.addEventListener('input', renderOverlayKeyframeEditor);
    aiOverlayBezierTension?.addEventListener('change', renderOverlayKeyframeEditor);
    aiOverlayX?.addEventListener('input', renderOverlayKeyframeEditor);
    aiOverlayY?.addEventListener('input', renderOverlayKeyframeEditor);
    aiOverlayScale?.addEventListener('input', renderOverlayKeyframeEditor);
    aiOverlayOpacity?.addEventListener('input', renderOverlayKeyframeEditor);

    btnOverlayPreviewPath?.addEventListener('click', () => {
      renderOverlayKeyframeEditor();
      showToast('Overlay keyframe path preview updated', 'success');
    });

    btnOverlayUndoKeyframes?.addEventListener('click', () => {
      if (undoOverlayKeyframeEdit()) {
        showToast('Keyframe edit undone', 'success');
      }
    });

    btnOverlayRedoKeyframes?.addEventListener('click', () => {
      if (redoOverlayKeyframeEdit()) {
        showToast('Keyframe edit restored', 'success');
      }
    });

    btnOverlayClearKeyframes?.addEventListener('click', () => {
      pushOverlayKeyframeHistory();
      if (aiOverlayKeyframes) aiOverlayKeyframes.value = '';
      overlaySegmentTensions = [];
      overlaySelectedKeyframeIndex = -1;
      renderOverlayKeyframeEditor();
      showToast('Overlay keyframes cleared', 'success');
    });

    aiOverlayPathCanvas?.addEventListener('click', (evt) => {
      if (overlayKeyframeDragMoved) {
        overlayKeyframeDragMoved = false;
        return;
      }
      updateOverlayKeyframeFromCanvasEvent(evt, false);
    });

    aiOverlayPathCanvas?.addEventListener('mousedown', (evt) => {
      beginOverlayKeyframeDrag(evt);
    });

    aiOverlayPathCanvas?.addEventListener('touchstart', (evt) => {
      const touch = evt.touches && evt.touches[0];
      if (!touch) return;
      overlayTouchTracking = beginOverlayKeyframeDrag({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => evt.preventDefault(),
      });
      evt.preventDefault();
    }, { passive: false });

    document.addEventListener('mousemove', (evt) => {
      updateOverlayKeyframeDrag(evt);
    });

    document.addEventListener('touchmove', (evt) => {
      if (!overlayTouchTracking) return;
      const touch = evt.touches && evt.touches[0];
      if (!touch) return;
      updateOverlayKeyframeDrag({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => evt.preventDefault(),
      });
      evt.preventDefault();
    }, { passive: false });

    document.addEventListener('mouseup', () => {
      endOverlayKeyframeDrag();
    });

    document.addEventListener('touchend', (evt) => {
      if (!overlayTouchTracking) return;
      const touch = evt.changedTouches && evt.changedTouches[0];
      if (touch && !overlayKeyframeDragMoved) {
        updateOverlayKeyframeFromCanvasEvent({
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => evt.preventDefault(),
        }, false);
      }
      overlayTouchTracking = false;
      endOverlayKeyframeDrag();
      evt.preventDefault();
    }, { passive: false });

    aiOverlayPathCanvas?.addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      updateOverlayKeyframeFromCanvasEvent(evt, true);
    });

    aiOverlayPathCanvas?.addEventListener('wheel', (evt) => {
      handleOverlayKeyframeWheel(evt);
    }, { passive: false });

    function syncCompositionFxInputs(shouldPersist) {
      compositionFx = normalizeCompositionFx();
      if (shouldPersist) {
        setPrefs({ compositionFxDefaults: compositionFx });
      }
    }

    [aiFxBrightness, aiFxContrast, aiFxSaturation, aiFxVignette, aiFxMonochrome].forEach((el) => {
      el?.addEventListener('input', () => syncCompositionFxInputs(false));
      el?.addEventListener('change', () => syncCompositionFxInputs(true));
    });

    btnResetCompositionFx?.addEventListener('click', () => {
      if (aiFxBrightness) aiFxBrightness.value = '1';
      if (aiFxContrast) aiFxContrast.value = '1';
      if (aiFxSaturation) aiFxSaturation.value = '1';
      if (aiFxVignette) aiFxVignette.value = '0';
      if (aiFxMonochrome) aiFxMonochrome.checked = false;
      syncCompositionFxInputs(true);
      showToast('Composition effects reset', 'success');
    });

    btnSaveCompositionFxPreset?.addEventListener('click', () => {
      const name = String(aiFxPresetName?.value || '').trim();
      if (!name) {
        showToast('Enter a preset name first', 'info');
        return;
      }
      syncCompositionFxInputs(false);
      const presets = normalizeCompositionFxPresetMap(prefs.compositionFxPresets);
      presets[name] = normalizeCompositionFxRecord(compositionFx);
      setPrefs({ compositionFxPresets: presets });
      renderCompositionFxPresetOptions(name);
      showToast('FX preset saved', 'success');
    });

    btnApplyCompositionFxPreset?.addEventListener('click', () => {
      const selected = String(aiFxPresetSelect?.value || '').trim();
      if (!selected) {
        showToast('Select an FX preset first', 'info');
        return;
      }
      const presets = normalizeCompositionFxPresetMap(prefs.compositionFxPresets);
      if (!presets[selected]) {
        showToast('Preset not found', 'error');
        return;
      }
      applyCompositionFxToInputs(presets[selected]);
      setPrefs({ compositionFxDefaults: normalizeCompositionFxRecord(compositionFx) });
      showToast('FX preset applied', 'success');
    });

    btnDeleteCompositionFxPreset?.addEventListener('click', () => {
      const selected = String(aiFxPresetSelect?.value || '').trim();
      if (!selected) {
        showToast('Select an FX preset first', 'info');
        return;
      }
      const presets = normalizeCompositionFxPresetMap(prefs.compositionFxPresets);
      if (!presets[selected]) {
        showToast('Preset not found', 'error');
        return;
      }
      delete presets[selected];
      setPrefs({ compositionFxPresets: presets });
      renderCompositionFxPresetOptions('');
      showToast('FX preset deleted', 'success');
    });

    btnApplyCompositionExportPack?.addEventListener('click', () => {
      const key = String(aiCompositionExportPack?.value || '');
      if (!key) {
        showToast('Select an export pack first', 'info');
        return;
      }
      const packs = {
        'cinematic-master': { preset: 'landscape-1080', fps: '24', transition: '0.5', transitionEase: 'ease-in-out', fx: 'Cinematic' },
        'social-reel': { preset: 'vertical-1080', fps: '30', transition: '0.2', transitionEase: 'ease-out', fx: 'Anime Punch' },
        'anime-trailer': { preset: 'landscape-1080', fps: '30', transition: '0.35', transitionEase: 'ease-in-out', fx: 'Anime Punch' },
        'noir-mood': { preset: 'square-1080', fps: '24', transition: '0.6', transitionEase: 'ease-in', fx: 'Noir' },
      };
      const pack = packs[key];
      if (!pack) {
        showToast('Pack not found', 'error');
        return;
      }
      if (aiCompositionPreset) aiCompositionPreset.value = pack.preset;
      if (aiCompositionFps) aiCompositionFps.value = pack.fps;
      if (aiCompositionTransition) aiCompositionTransition.value = pack.transition;
      if (aiCompositionTransitionEase) aiCompositionTransitionEase.value = pack.transitionEase;
      const presetMap = normalizeCompositionFxPresetMap(prefs.compositionFxPresets);
      if (presetMap[pack.fx]) {
        applyCompositionFxToInputs(presetMap[pack.fx]);
        setPrefs({ compositionFxDefaults: normalizeCompositionFxRecord(compositionFx) });
      }
      showToast('Export pack applied', 'success');
    });

    btnClearComposition?.addEventListener('click', () => {
      compositionQueue = [];
      compositionOverlays = [];
      renderCompositionList();
      renderOverlayList();
      showToast('Composition queue cleared', 'success');
    });

    btnExportComposition?.addEventListener('click', async () => {
      if (!compositionQueue.length) {
        showToast('Add clips or trailers to the composition queue first', 'info');
        return;
      }
      const preset = aiCompositionPreset?.value || 'original';
      const fps = clamp(Number(aiCompositionFps?.value || 24), 1, 30);
      const transitionSec = clamp(Number(aiCompositionTransition?.value || 0), 0, 3);
      const transitionEase = String(aiCompositionTransitionEase?.value || 'linear');
      const ducking = {
        enabled: !!aiCompositionDuckEnable?.checked,
        amount: clamp(Number(aiCompositionDuckAmount?.value || 0.35), 0, 0.85),
        attack: clamp(Number(aiCompositionDuckAttack?.value || 0.2), 0.05, 2),
        release: clamp(Number(aiCompositionDuckRelease?.value || 0.4), 0.05, 3),
      };
      syncCompositionFxInputs(false);
      const blob = await renderCompositionBlob(compositionQueue, preset, fps, compositionOverlays, compositionFx, {
        transitionSec,
        transitionEase,
        ducking,
      }).catch(() => null);
      if (!blob) {
        showToast('Composition export failed', 'error');
        return;
      }
      createDownload(blob.blob || blob, 'ai-composition-' + preset + '-' + fps + 'fps.webm');
      showToast('Composition exported', 'success');
    });

    btnAnalyzeAudio?.addEventListener('click', async () => {
      const file = aiAudioUpload?.files && aiAudioUpload.files[0];
      if (!file) {
        showToast('Upload an audio file first', 'info');
        return;
      }
      try {
        latestAudioAnalysis = await analyzeAudioFile(file);
        drawWaveform(latestAudioAnalysis);
        const durationBase = latestAudioAnalysis?.duration || Number(sceneDuration?.value || 24);
        latestDialogueCues = buildDialogueCues(aiDialogueLines?.value || '', durationBase);
        renderDialogueCues(latestDialogueCues);
        showToast('Audio waveform analyzed', 'success');
      } catch (_) {
        latestAudioAnalysis = null;
        showToast('Audio analysis failed', 'error');
      }
    });

    aiDialogueLines?.addEventListener('input', () => {
      const durationBase = latestAudioAnalysis?.duration || Number(sceneDuration?.value || 24);
      latestDialogueCues = buildDialogueCues(aiDialogueLines.value || '', durationBase);
      renderDialogueCues(latestDialogueCues);
    });

    btnApplyDialogueTiming?.addEventListener('click', () => {
      const durationBase = latestAudioAnalysis?.duration || Number(sceneDuration?.value || 24);
      latestDialogueCues = buildDialogueCues(aiDialogueLines?.value || '', durationBase);
      if (!latestDialogueCues.length) {
        showToast('Add dialogue lines first', 'info');
        return;
      }
      if (sceneTimingMode) sceneTimingMode.value = 'custom';
      if (sceneShots) sceneShots.value = String(clamp(latestDialogueCues.length, 3, 24));
      if (sceneDuration) sceneDuration.value = String(clamp(Number(durationBase.toFixed(1)), 6, 1800));
      if (sceneCustomDurations) {
        sceneCustomDurations.hidden = false;
        sceneCustomDurations.value = latestDialogueCues.map((cue) => cue.duration.toFixed(2)).join(', ');
      }
      updateSceneTimingModeUI();
      updateSceneDurationDisplay();
      previewSceneTimingGraph();
      showToast('Dialogue timing applied to scene editor', 'success');
    });

    // Auto-save drafts
    function saveDraftAuto() {
      saveDraft({
        imagePrompt: imagePrompt.value,
        imageStyle: imageStyle.value,
        imageSize: aiImageSize.value,
        customWidth: aiCustomWidth.value,
        customHeight: aiCustomHeight.value,
        seedLocked: aiSeedLock.checked,
        seedValue: aiSeedValue.value,
        guidance: aiGuidanceScale.value,
        sampling: aiSamplingMethod.value,
        steps: aiSteps.value,
        exportFormat: aiExportFormat.value,
        batchCount: aiBatchCount.value,
      });
    }

    imagePrompt?.addEventListener('input', saveDraftAuto);
    imageStyle?.addEventListener('change', saveDraftAuto);
    aiSamplingMethod?.addEventListener('change', saveDraftAuto);
    aiExportFormat?.addEventListener('change', saveDraftAuto);
    aiBatchCount?.addEventListener('input', saveDraftAuto);

    // Restore draft on load
    const draft = loadDraft();
    if (draft.imagePrompt) imagePrompt.value = draft.imagePrompt;
    if (draft.customWidth) aiCustomWidth.value = draft.customWidth;
    if (draft.customHeight) aiCustomHeight.value = draft.customHeight;
    if (draft.seedLocked) {
      aiSeedLock.checked = draft.seedLocked;
      aiSeedValue.disabled = false;
      aiSeedValue.value = draft.seedValue || '';
    }
    if (draft.guidance) aiGuidanceScale.value = draft.guidance;
    if (draft.sampling) aiSamplingMethod.value = draft.sampling;
    if (draft.steps) aiSteps.value = draft.steps;
    if (draft.exportFormat) aiExportFormat.value = draft.exportFormat;
    if (draft.batchCount) aiBatchCount.value = draft.batchCount;

    // Initialize sliders display
    aiGuidanceValue.textContent = parseFloat(aiGuidanceScale.value).toFixed(1);
    aiStepsValue.textContent = aiSteps.value;
    if (aiImageTransformStrengthValue && aiImageTransformStrength) {
      aiImageTransformStrengthValue.textContent = parseFloat(aiImageTransformStrength.value).toFixed(2);
    }
    if (aiMaskBrushSizeValue && aiMaskBrushSize) {
      aiMaskBrushSizeValue.textContent = String(aiMaskBrushSize.value);
    }
    outpaintDirection = aiOutpaintDirection?.value || 'all';
    renderMaskPresetOptions('');
    syncMaskCanvasSize();
    applyCanvasView();
    renderCompositionFxPresetOptions('');
    syncCompositionFxInputs(false);
    renderCompositionList();
    renderOverlayList();
    renderOverlayKeyframeEditor();
    drawWaveform(null);
    renderDialogueCues([]);

    // Initialize theme
    initializeTheme();

    $('btnGenerateImage')?.addEventListener('click', async () => {
      saveInputsState();
      saveDraftAuto();
      if (prefs.backendProvider === 'none') {
        showToast('Local renderer is active. For prompt-accurate AI images, switch Backend Provider to Pollinations or Hugging Face.', 'info');
      }
      if (!(await ensurePromptAllowed(imagePrompt.value || ''))) {
        showToast('Prompt blocked by moderation settings', 'error');
        return;
      }
      await generateImageWithQualityGuard(true);
      await emitWebhookEvent('image.generated', {
        prompt: String(imagePrompt.value || '').slice(0, 240),
        style: imageStyle?.value || 'anime',
      });
    });

    $('btnSaveImageDevice')?.addEventListener('click', async () => {
      if (!latestImageDataUrl) await generateImageWithQualityGuard(false);
      const a = document.createElement('a');
      a.download = 'ai-generated-image.png';
      a.href = latestImageDataUrl;
      a.click();
      showToast('Image downloaded to device', 'success');
    });

    $('btnSaveImagePlatform')?.addEventListener('click', async () => {
      if (!latestImageDataUrl) await generateImageWithQualityGuard(false);
      const store = ensureStore();
      store.visualAssets.push({
        id: 'AIIMG' + Date.now(),
        title: 'AI Image: ' + (imagePrompt.value || 'Untitled'),
        preview: latestImageDataUrl,
        meta: nowMeta('AI Image Generator · Prompt Expanded · Negatives Applied · License ' + (prefs.licenseProfile || 'commercial')),
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      showToast('Image saved to platform assets', 'success');
      addRecentOutput('Image', 'AI Image: ' + (imagePrompt.value || 'Untitled'));
    });

    async function addPosterToVisualAssets(prefix, title, blob, tag) {
      let preview = latestImageDataUrl;
      if (!preview) {
        try {
          preview = await createVideoPosterDataUrl(blob);
        } catch (_) {
          preview = '';
        }
      }
      if (!preview) return '';

      const store = ensureStore();
      store.visualAssets.push({
        id: prefix + Date.now(),
        title,
        preview,
        meta: nowMeta(tag),
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      return preview;
    }

    async function scoreVideoBlobQuality(blob) {
      try {
        const poster = await createVideoPosterDataUrl(blob);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = 640;
        tmpCanvas.height = 360;
        await drawDataUrlToCanvas(poster, tmpCanvas);
        return computeImageQualityScore(tmpCanvas);
      } catch (_) {
        return 0;
      }
    }

    async function generateClipBlob(prompt, durationSec, mood, promptPackage) {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      const styleLock = pickStyleLock((imageStyle && imageStyle.value) || 'cinematic');
      const seed = hashString((promptPackage?.seedText || prompt) + mood + '|clip-coherence');
      const rand = seededRandom(seed);
      const camera = (promptPackage && promptPackage.camera) || extractCameraDirectives(prompt);
      const motionPath = (aiVideoMotionPath && aiVideoMotionPath.value) || camera.motion || 'tracking';
      const particles = Array.from({ length: 80 }, () => ({
        x: rand() * canvas.width,
        y: rand() * canvas.height,
        vx: (rand() - 0.5) * 3,
        vy: (rand() - 0.5) * 3,
        r: 2 + rand() * 9,
      }));

      // Temporal coherence anchors (stable keyframe path).
      const anchors = Array.from({ length: 5 }, (_, i) => ({
        t: i / 4,
        x: canvas.width * (0.22 + rand() * 0.56),
        y: canvas.height * (0.32 + rand() * 0.42),
        s: 0.82 + rand() * 0.5,
      }));

      function sampleAnchor(t) {
        const seg = Math.min(3, Math.max(0, Math.floor(t * 4)));
        const a = anchors[seg];
        const b = anchors[seg + 1];
        const localT = clamp((t - a.t) / Math.max(0.0001, b.t - a.t), 0, 1);
        return {
          x: a.x + (b.x - a.x) * localT,
          y: a.y + (b.y - a.y) * localT,
          s: a.s + (b.s - a.s) * localT,
        };
      }

      latestClipFrames = [];
      return await recordCanvasAnimation(canvas, (t) => {
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        if (mood === 'horror') {
          g.addColorStop(0, '#020617'); g.addColorStop(1, '#3f0000');
        } else if (mood === 'mystic') {
          g.addColorStop(0, '#1e1b4b'); g.addColorStop(1, '#0f766e');
        } else if (mood === 'heroic') {
          g.addColorStop(0, '#082f49'); g.addColorStop(1, '#1d4ed8');
        } else {
          g.addColorStop(0, '#111827'); g.addColorStop(1, '#7c2d12');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          ctx.beginPath();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });

        const zoom = 1 + t * 0.18 + (motionPath === 'tracking' ? 0.06 : (motionPath === 'crane' ? 0.08 : 0));
        const jitterX = motionPath === 'handheld' ? Math.sin(t * 70) * 4.5 : 0;
        const jitterY = motionPath === 'handheld' ? Math.cos(t * 58) * 3.5 : 0;
        const orbitX = motionPath === 'orbit' ? Math.cos(t * Math.PI * 2) * 42 : 0;
        const orbitY = motionPath === 'orbit' ? Math.sin(t * Math.PI * 2) * 18 : 0;
        const craneLift = motionPath === 'crane' ? -t * 38 : 0;
        const anchor = sampleAnchor(t);
        ctx.save();
        ctx.translate(canvas.width / 2 + jitterX + orbitX, canvas.height / 2 + jitterY + orbitY + craneLift);
        ctx.scale(zoom, zoom);
        ctx.rotate((motionPath === 'orbit' ? Math.sin(t * Math.PI * 2) * 0.055 : Math.sin(t * Math.PI * 2) * 0.035));
        ctx.fillStyle = 'rgba(2, 6, 23, 0.32)';
        ctx.fillRect(-canvas.width / 2 + 120, -130, canvas.width - 240, 260);
        ctx.fillStyle = 'rgba(56,189,248,0.18)';
        ctx.beginPath();
        ctx.ellipse(anchor.x - canvas.width / 2, anchor.y - canvas.height / 2, 120 * anchor.s, 62 * anchor.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 56px Inter, sans-serif';
        ctx.fillText('CAP ANIME', -240, -10);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 34px Inter, sans-serif';
        ctx.fillText((promptPackage?.expandedPrompt || prompt || 'Generated Clip').slice(0, 34), -240, 48);
        ctx.restore();

        enhanceImageData(ctx, canvas.width, canvas.height, styleLock);
      }, durationSec, 24, {
        frameCollector: latestClipFrames,
        onProgress: (progress, frameIndex, totalFrames, currentCanvas) => {
          updateProgressBar(aiClipProgressiveBar, aiClipProgressiveStatus, progress, Math.round(progress * 100) + '%');
          if (clipPreview && !clipPreview.src) {
            clipPreview.poster = currentCanvas.toDataURL('image/png');
          }
          if (aiClipScrubber) {
            aiClipScrubber.max = String(Math.max(0, totalFrames - 1));
          }
        },
      });
    }

    $('btnGenerateClip')?.addEventListener('click', async () => {
      const generateBtn = $('btnGenerateClip');
      try {
        setBusy(generateBtn, true, 'Generating...');
        saveInputsState();
        if (!(await ensurePromptAllowed(videoPrompt.value || ''))) {
          showToast('Clip prompt blocked by moderation settings', 'error');
          return;
        }
        const identityName = String(aiIdentityProfile?.value || '').trim();
        const identitySuffix = identityName ? (' | identity-lock:' + identityName) : '';
        const prompt = appendFineTunePrompt((videoPrompt.value || 'CAP clip') + identitySuffix);
        const dur = clamp(Number(videoDuration.value || 6), 2, 20);
        const mood = videoMood.value || 'intense';
        latestClipPromptPackage = buildPromptPackage(prompt, 'clip', imageStyle?.value || 'cinematic', pickStyleLock(imageStyle?.value || 'cinematic'), mood);

        const remoteClip = await generateRemoteVideoClipAsset(prompt, dur, mood, latestClipPromptPackage).catch(() => null);
        if (remoteClip && remoteClip.blob) {
          latestClipBlob = remoteClip.blob;
          if (latestClipPreviewUrl) URL.revokeObjectURL(latestClipPreviewUrl);
          latestClipPreviewUrl = URL.createObjectURL(remoteClip.blob);
          clipPreview.src = latestClipPreviewUrl;
          if (remoteClip.thumbnailUrl) clipPreview.poster = remoteClip.thumbnailUrl;
          if (aiClipTrimStart) aiClipTrimStart.value = '0';
          if (aiClipTrimEnd) aiClipTrimEnd.value = String(dur);
          showToast('Clip generated via backend video provider', 'success');
          await emitWebhookEvent('clip.generated', {
            prompt: String(videoPrompt.value || '').slice(0, 240),
            duration: dur,
            mood,
            source: 'backend',
          });
          if (prefs.autoOpenProduction) {
            await addPosterToVisualAssets(
              'AICLIPAUTO',
              'AI Clip Production Plate: ' + (videoPrompt.value || 'Untitled Clip'),
              latestClipBlob,
              'AI Clip Auto-Open'
            );
            openProduction('AI clip auto-opened in production');
          }
          return;
        }

        const attempts = Math.max(1, (prefs.maxRegens || 0) + 1);
        let bestClip = null;
        let bestScore = -1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const clip = await generateClipBlob(
            prompt,
            dur,
            mood,
            Object.assign({}, latestClipPromptPackage, {
              seedText: latestClipPromptPackage.seedText + '|clip-' + attempt,
            })
          );
          const score = await scoreVideoBlobQuality(clip.blob);
          if (score > bestScore) {
            bestScore = score;
            bestClip = clip;
          }
          if (score >= prefs.qualityThreshold) break;
        }
        if (!bestClip) throw new Error('clip generation failed');
        latestClipBlob = bestClip.blob;
        if (latestClipPreviewUrl) URL.revokeObjectURL(latestClipPreviewUrl);
        latestClipPreviewUrl = URL.createObjectURL(bestClip.blob);
        clipPreview.src = latestClipPreviewUrl;
        if (aiClipTrimStart) aiClipTrimStart.value = '0';
        if (aiClipTrimEnd) aiClipTrimEnd.value = String(dur);
        showToast(`Clip generated with coherence + camera directives · Quality ${bestScore}`, 'success');
        await emitWebhookEvent('clip.generated', {
          prompt: String(videoPrompt.value || '').slice(0, 240),
          duration: dur,
          mood,
          source: 'local',
        });
        if (prefs.autoOpenProduction) {
          await addPosterToVisualAssets(
            'AICLIPAUTO',
            'AI Clip Production Plate: ' + (videoPrompt.value || 'Untitled Clip'),
            latestClipBlob,
            'AI Clip Auto-Open'
          );
          openProduction('AI clip auto-opened in production');
        }
      } catch (_) {
        latestClipBlob = null;
        showToast('Clip generation failed', 'error');
      } finally {
        setBusy(generateBtn, false);
      }
    });

    $('btnSaveClipDevice')?.addEventListener('click', () => {
      if (!latestClipBlob) return;
      const start = clamp(Number(aiClipTrimStart?.value || 0), 0, 3600);
      const end = clamp(Number(aiClipTrimEnd?.value || videoDuration?.value || 6), start + 0.04, 3600);
      const preset = aiClipExportPreset?.value || 'original';
      renderVideoExport(latestClipBlob, { start, end, preset, fps: 24 }).then((result) => {
        createDownload(result.blob || result, 'ai-generated-clip-' + preset + '.webm');
        showToast('Clip exported with trim and preset', 'success');
      }).catch(() => {
        showToast('Clip export failed', 'error');
      });
    });

    $('btnSaveClipPlatform')?.addEventListener('click', async () => {
      if (!latestClipBlob) return;
      const posterTitle = 'AI Clip Poster: ' + (videoPrompt.value || 'Untitled Clip');
      const preview = await addPosterToVisualAssets('AICLIPPREV', posterTitle, latestClipBlob, 'AI Video Poster');
      const store = ensureStore();
      store.exportQueue.push({
        id: 'AICLIP' + Date.now(),
        title: 'AI Clip: ' + (videoPrompt.value || 'Untitled Clip'),
        meta: nowMeta('AI Video Generator · License ' + (prefs.licenseProfile || 'commercial')),
        previewUrl: preview,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      showToast('Clip queued and saved to platform', 'success');
      addRecentOutput('Clip', 'AI Clip: ' + (videoPrompt.value || 'Untitled Clip'));
    });

    $('btnOpenClipProduction')?.addEventListener('click', async () => {
      if (!latestClipBlob) {
        showToast('Generate a clip first', 'error');
        return;
      }
      await addPosterToVisualAssets(
        'AICLIPOPEN',
        'AI Clip Production Plate: ' + (videoPrompt.value || 'Untitled Clip'),
        latestClipBlob,
        'AI Clip For Production'
      );
      openProduction('AI clip ready in platform assets');
      showToast('Opened Production workspace', 'success');
      addRecentOutput('Clip', 'AI Clip Production Plate');
    });

    async function generateTrailerBlob() {
      const store = ensureStore();
      const assets = store.visualAssets || [];
      const images = assets.slice(-12);
      if (!images.length && latestImageDataUrl) {
        images.push({ preview: latestImageDataUrl });
      }
      const dur = clamp(Number(trailerDuration.value || 18), 6, 60);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      const styleLock = pickStyleLock('cinematic');
      latestTrailerPromptPackage = buildPromptPackage(appendFineTunePrompt(trailerTitle.value || 'CAP Trailer'), 'trailer', 'cinematic', styleLock, String(dur));

      const framesPerImage = Math.max(8, Math.floor((dur * 24) / Math.max(1, images.length)));
      const loaded = [];
      for (const item of images) {
        if (!item.preview) continue;
        const img = await new Promise((resolve) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.src = item.preview;
        });
        loaded.push(img);
      }

      return await recordCanvasAnimation(canvas, (t, i) => {
        const idx = Math.min(loaded.length - 1, Math.floor(i / framesPerImage));
        const img = loaded[idx];
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (img) {
          const s = 1.03 + (i % framesPerImage) / framesPerImage * 0.08;
          const w = canvas.width * s;
          const h = canvas.height * s;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        }
        ctx.fillStyle = 'rgba(2,6,23,0.55)';
        ctx.fillRect(0, canvas.height - 140, canvas.width, 140);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 46px Inter, sans-serif';
        ctx.fillText((trailerTitle.value || 'CAP Trailer').slice(0, 38), 44, canvas.height - 70);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 22px Inter, sans-serif';
        ctx.fillText('Generated Trailer', 44, canvas.height - 34);
        enhanceImageData(ctx, canvas.width, canvas.height, styleLock);
      }, dur, 24);
    }

    $('btnGenerateTrailer')?.addEventListener('click', async () => {
      const generateBtn = $('btnGenerateTrailer');
      try {
        setBusy(generateBtn, true, 'Generating...');
        if (!(await ensurePromptAllowed(trailerTitle.value || ''))) {
          showToast('Trailer title blocked by moderation settings', 'error');
          return;
        }
        const attempts = Math.max(1, (prefs.maxRegens || 0) + 1);
        let bestTrailer = null;
        let bestScore = -1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const trailer = await generateTrailerBlob();
          const score = await scoreVideoBlobQuality(trailer.blob);
          if (score > bestScore) {
            bestScore = score;
            bestTrailer = trailer;
          }
          if (score >= prefs.qualityThreshold) break;
        }
        if (!bestTrailer) throw new Error('trailer generation failed');
        latestTrailerBlob = bestTrailer.blob;
        if (latestTrailerPreviewUrl) URL.revokeObjectURL(latestTrailerPreviewUrl);
        latestTrailerPreviewUrl = URL.createObjectURL(bestTrailer.blob);
        trailerPreview.src = latestTrailerPreviewUrl;
        showToast(`Trailer generated with style lock + enhancement pass · Quality ${bestScore}`, 'success');
        await emitWebhookEvent('trailer.generated', {
          title: String(trailerTitle.value || '').slice(0, 120),
          duration: clamp(Number(trailerDuration.value || 18), 6, 60),
        });
        if (prefs.autoOpenProduction) {
          await addPosterToVisualAssets(
            'AITRAILERAUTO',
            'AI Trailer Production Plate: ' + (trailerTitle.value || 'Untitled Trailer'),
            latestTrailerBlob,
            'AI Trailer Auto-Open'
          );
          openProduction('AI trailer auto-opened in production');
        }
      } catch (_) {
        latestTrailerBlob = null;
        showToast('Trailer generation failed', 'error');
      } finally {
        setBusy(generateBtn, false);
      }
    });

    $('btnSaveTrailerDevice')?.addEventListener('click', () => {
      if (!latestTrailerBlob) return;
      createDownload(latestTrailerBlob, 'ai-generated-trailer.webm');
      showToast('Trailer downloaded to device', 'success');
    });

    $('btnSaveTrailerPlatform')?.addEventListener('click', async () => {
      if (!latestTrailerBlob) return;
      const posterTitle = 'AI Trailer Poster: ' + (trailerTitle.value || 'Untitled Trailer');
      const preview = await addPosterToVisualAssets('AITRAILERPREV', posterTitle, latestTrailerBlob, 'AI Trailer Poster');
      const store = ensureStore();
      store.exportQueue.push({
        id: 'AITRAILER' + Date.now(),
        title: 'AI Trailer: ' + (trailerTitle.value || 'Untitled Trailer'),
        meta: nowMeta('AI Trailer Generator · License ' + (prefs.licenseProfile || 'commercial')),
        previewUrl: preview,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      showToast('Trailer queued and saved to platform', 'success');
      addRecentOutput('Trailer', 'AI Trailer: ' + (trailerTitle.value || 'Untitled Trailer'));
    });

    $('btnOpenTrailerProduction')?.addEventListener('click', async () => {
      if (!latestTrailerBlob) {
        showToast('Generate a trailer first', 'error');
        return;
      }
      await addPosterToVisualAssets(
        'AITRLROPEN',
        'AI Trailer Production Plate: ' + (trailerTitle.value || 'Untitled Trailer'),
        latestTrailerBlob,
        'AI Trailer For Production'
      );
      openProduction('AI trailer ready in platform assets');
      showToast('Opened Production workspace', 'success');
      addRecentOutput('Trailer', 'AI Trailer Production Plate');
    });

    function buildShotTimings(totalShots, timingMode, durationSeconds, customRaw) {
      if (timingMode === 'custom') {
        const parsed = parseCustomDurationsInput(customRaw, totalShots);
        if (!parsed.ok) return { ok: false, reason: parsed.reason, timings: [], totalSeconds: 0 };
        let start = 0;
        const timings = parsed.values.map((value) => {
          const s = Number(start.toFixed(2));
          start += value;
          const e = Number(start.toFixed(2));
          return { startSec: s, endSec: e, durationSec: Number(value.toFixed(2)) };
        });
        return { ok: true, timings, totalSeconds: Number(start.toFixed(2)) };
      }

      const perShot = durationSeconds / totalShots;
      const timings = Array.from({ length: totalShots }, (_, i) => ({
        startSec: Number((i * perShot).toFixed(2)),
        endSec: Number(((i + 1) * perShot).toFixed(2)),
        durationSec: Number(perShot.toFixed(2)),
      }));
      return { ok: true, timings, totalSeconds: Number(durationSeconds.toFixed(2)) };
    }

    function generateScenePlan(prompt, totalShots, pacing, timings, promptPackage, variant) {
      const v = variant || 0;
      const intensity = pacing === 'fast'
        ? ['Quick', 'Aggressive', 'Sharp', 'Kinetic']
        : (pacing === 'slow' ? ['Wide', 'Lingering', 'Quiet', 'Atmospheric'] : ['Balanced', 'Dynamic', 'Steady', 'Cinematic']);
      const beatsPool = [
        ['Establish', 'Build Tension', 'Conflict', 'Twist', 'Payoff', 'Aftermath'],
        ['Hook', 'Escalation', 'Crossfire', 'Reveal', 'Countermove', 'Resolve'],
        ['Intro', 'Pressure', 'Collision', 'Fallout', 'Rally', 'Finish']
      ];
      const beats = beatsPool[v % beatsPool.length];
      return Array.from({ length: totalShots }, (_, i) => ({
        shot: i + 1,
        startSec: timings[i].startSec,
        endSec: timings[i].endSec,
        durationSec: timings[i].durationSec,
        title: intensity[i % intensity.length] + ' Shot',
        detail: `${beats[i % beats.length]} · ${(promptPackage?.expandedPrompt || prompt || 'Scene prompt').slice(0, 92)}`,
      }));
    }

    function scoreScenePlanQuality(shots, promptPackage) {
      if (!shots || !shots.length) return 0;
      const durations = shots.map((s) => s.durationSec || 0);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / durations.length;
      const rhythm = clamp(100 - variance * 12, 0, 100);
      const promptDepth = clamp((String(promptPackage?.expandedPrompt || '').length / 6), 0, 100);
      const cameraDepth = clamp(((promptPackage?.camera?.found || []).length * 18), 0, 100);
      return Number(clamp((rhythm * 0.45) + (promptDepth * 0.35) + (cameraDepth * 0.2), 0, 100).toFixed(1));
    }

    function renderScenePlan(shots) {
      scenePlan.innerHTML = '';
      shots.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'ai-shot-card';
        card.innerHTML = `<div class="ai-shot-time">${s.startSec.toFixed(1)}s - ${s.endSec.toFixed(1)}s (${s.durationSec.toFixed(1)}s)</div><div class="ai-shot-title">Shot ${s.shot}: ${s.title}</div><div class="ai-shot-sub">${s.detail}</div>`;
        scenePlan.appendChild(card);
      });
    }

    $('btnGenerateScene')?.addEventListener('click', async () => {
      saveInputsState();
      if (!(await ensurePromptAllowed(scenePrompt.value || ''))) {
        showToast('Scene prompt blocked by moderation settings', 'error');
        return;
      }
      const shots = clamp(Number(sceneShots.value || 8), 3, 24);
      const timingMode = sceneTimingMode.value || 'even';
      const durationSeconds = clamp(Number(sceneDuration.value || 24), 6, 180);
      const timing = buildShotTimings(shots, timingMode, durationSeconds, sceneCustomDurations.value);
      if (!timing.ok) {
        showToast(timing.reason, 'error');
        return;
      }
      sceneDuration.value = String(timing.totalSeconds);
      latestScenePromptPackage = buildPromptPackage(appendFineTunePrompt(scenePrompt.value), 'scene', imageStyle?.value || 'cinematic', pickStyleLock(imageStyle?.value || 'cinematic'), scenePacing.value);
      const attempts = Math.max(1, (prefs.maxRegens || 0) + 1);
      let bestPlan = null;
      let bestScore = -1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const candidate = generateScenePlan(scenePrompt.value, shots, scenePacing.value, timing.timings, latestScenePromptPackage, attempt);
        const score = scoreScenePlanQuality(candidate, latestScenePromptPackage);
        if (score > bestScore) {
          bestScore = score;
          bestPlan = candidate;
        }
        if (score >= prefs.qualityThreshold) break;
      }
      latestScenePlan = bestPlan || [];
      renderScenePlan(latestScenePlan);
      showToast(`Scene pack generated with expanded directives · Quality ${bestScore}`, 'success');
      emitWebhookEvent('scene.generated', {
        prompt: String(scenePrompt.value || '').slice(0, 240),
        shots,
        duration: Number(sceneDuration.value || 24),
      });
      addRecentOutput('Scene Pack', (scenePrompt.value || 'Generated Scene').slice(0, 42));
      updateSceneDurationDisplay();
    });

    $('btnSaveScenePlan')?.addEventListener('click', () => {
      if (!latestScenePlan) return;
      const data = {
        title: scenePrompt.value || 'Generated Scene',
        pacing: scenePacing.value,
        timingMode: sceneTimingMode.value || 'even',
        durationSeconds: Number(sceneDuration.value || 24),
        customDurations: (sceneTimingMode.value === 'custom') ? sceneCustomDurations.value : '',
        shots: latestScenePlan,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      createDownload(blob, 'ai-scene-plan.json');
      showToast('Scene plan downloaded', 'success');
    });

    $('btnPushSceneToProduction')?.addEventListener('click', () => {
      if (!latestScenePlan) return;
      const store = ensureStore();
      const title = scenePrompt.value || 'AI Scene Pack';
      const durationSeconds = Number(sceneDuration.value || 24);
      store.episodeProjects.push({
        id: 'AISCENE' + Date.now(),
        title,
        preview: latestImageDataUrl || '',
        meta: nowMeta('AI Full Scene Generator'),
        project: {
          version: 1,
          title,
          savedAt: new Date().toISOString(),
          episodeTitle: title,
          shotTitle: 'Generated by AI Generator',
          shotDuration: durationSeconds,
          shotStatus: 'blocking',
          shotTimingMode: sceneTimingMode.value || 'even',
          scenes: latestScenePlan.map((s, i) => ({ id: String(i), name: 'Shot ' + s.shot + ' - ' + s.title })),
          audioRack: [],
          vectorPaths: [],
          studioState: null,
          scenePlan: latestScenePlan,
        },
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      showToast('Scene pack pushed to Production', 'success');
      addRecentOutput('Scene Pack', title);
    });

    btnApplyPromptEdit?.addEventListener('click', async () => {
      const instruction = String(aiPromptEditInstruction?.value || '').trim();
      if (!instruction) {
        showToast('Enter a prompt-to-edit instruction', 'error');
        return;
      }
      if (!(await ensurePromptAllowed(instruction))) {
        showToast('Edit instruction blocked by moderation settings', 'error');
        return;
      }
      if (!hasMaskPixels()) {
        showToast('Paint a mask area first for prompt edit', 'info');
        return;
      }
      latestBaseImageDataUrl = imageCanvas.toDataURL('image/png');
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = imageCanvas.width;
      tmpCanvas.height = imageCanvas.height;
      drawGeneratedImage(
        tmpCanvas,
        appendFineTunePrompt(instruction),
        imageStyle?.value || 'anime',
        Object.assign({}, latestImagePromptPackage || {}, { renderProfile: getAutoHighQualityProfile() })
      );
      const ctx = imageCanvas.getContext('2d');
      ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
      ctx.drawImage(tmpCanvas, 0, 0);
      applyMaskedComposite();
      latestImageDataUrl = imageCanvas.toDataURL('image/png');
      showToast('Prompt-to-edit applied using current mask', 'success');
      await emitWebhookEvent('image.prompt_edit', { instruction: instruction.slice(0, 200) });
    });

    btnGenerateTextToVideo?.addEventListener('click', async () => {
      if (!(await ensurePromptAllowed(videoPrompt?.value || ''))) {
        showToast('Text-to-video prompt blocked by moderation settings', 'error');
        return;
      }
      $('btnGenerateClip')?.click();
      showToast('Text-to-video started using clip pipeline', 'success');
    });

    btnAnimateImageToVideo?.addEventListener('click', async () => {
      if (!latestImageDataUrl) {
        showToast('Generate or load an image first', 'info');
        return;
      }
      const duration = clamp(Number(videoDuration?.value || 6), 2, 20);
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      const img = await loadImageFromUrl(latestImageDataUrl).catch(() => null);
      if (!img) {
        showToast('Could not load source image for animation', 'error');
        return;
      }
      const rendered = await recordCanvasAnimation(canvas, (t) => {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const zoom = 1.02 + (0.18 * t);
        const panX = Math.sin(t * Math.PI * 2) * 24;
        const panY = Math.cos(t * Math.PI * 2) * 16;
        const w = canvas.width * zoom;
        const h = canvas.height * zoom;
        ctx.drawImage(img, (canvas.width - w) / 2 + panX, (canvas.height - h) / 2 + panY, w, h);
      }, duration, 24);
      latestClipBlob = rendered.blob;
      if (latestClipPreviewUrl) URL.revokeObjectURL(latestClipPreviewUrl);
      latestClipPreviewUrl = URL.createObjectURL(rendered.blob);
      if (clipPreview) clipPreview.src = latestClipPreviewUrl;
      showToast('Image-to-video animation generated', 'success');
      await emitWebhookEvent('video.image_to_video', { duration });
    });

    btnInterpolateClip?.addEventListener('click', async () => {
      if (!latestClipBlob) {
        showToast('Generate a clip first', 'info');
        return;
      }
      const factor = clamp(Number(aiInterpolationFactor?.value || prefs.interpolationFactor || 1), 0, 3);
      if (factor < 1) {
        showToast('Interpolation factor is set to none', 'info');
        return;
      }
      const interpolated = await renderInterpolatedClip(latestClipBlob, factor, 24).catch(() => null);
      if (!interpolated || !interpolated.blob) {
        showToast('Interpolation failed', 'error');
        return;
      }
      latestClipBlob = interpolated.blob;
      if (latestClipPreviewUrl) URL.revokeObjectURL(latestClipPreviewUrl);
      latestClipPreviewUrl = URL.createObjectURL(interpolated.blob);
      if (clipPreview) clipPreview.src = latestClipPreviewUrl;
      showToast('Interpolated clip generated (' + (factor + 1) + 'x frames)', 'success');
      await emitWebhookEvent('video.interpolated', { factor: factor + 1 });
    });

    btnGenerateDub?.addEventListener('click', async () => {
      let script = String(aiDubScript?.value || '').trim();
      if (!script) {
        // Auto-generate script from current scene/character context via AI backend
        const sceneDesc = String(
          document.getElementById('charPrompt')?.value ||
          document.getElementById('scenePrompt')?.value ||
          latestClipPromptPackage?.fullPrompt ||
          latestClipPromptPackage?.prompt ||
          ''
        ).trim();
        if (sceneDesc) {
          setStatus('Auto-generating script via AI\u2026');
          try {
            const scriptRes = await fetch('/api/cap-anime/generate-script/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: sceneDesc,
                genre: document.getElementById('aiGenre')?.value || 'action',
                tone: 'dramatic',
                scenes: 2,
              }),
            });
            const scriptData = await scriptRes.json().catch(() => ({}));
            if (scriptData.ok && scriptData.script) {
              if (aiDubScript) aiDubScript.value = scriptData.script;
              script = scriptData.script;
              showToast(
                scriptData.source === 'llm' ? 'Script auto-generated by AI' : 'Script generated from template',
                'success'
              );
            }
          } catch (_) { /* fall through to error below */ }
          setStatus('');
        }
      }
      if (!script) {
        showToast('Enter dubbing script lines first', 'error');
        return;
      }
      const duration = latestAudioAnalysis?.duration || clamp(Number(sceneDuration?.value || 24), 6, 180);
      const remote = await postAiSuite('/api/ai-suite/dub-cues/', {
        script,
        language: aiDubLanguage?.value || 'en-US',
        duration,
      });
      const cues = (remote.ok && Array.isArray(remote.data?.cues))
        ? remote.data.cues
        : buildDialogueCues(script, duration);
      latestDialogueCues = cues;
      renderDialogueCues(cues);
      const srt = (remote.ok && typeof remote.data?.srt === 'string' && remote.data.srt.trim())
        ? remote.data.srt
        : cues.map((cue, idx) => {
        function toSrtTime(sec) {
          const s = Math.max(0, Number(sec || 0));
          const hh = String(Math.floor(s / 3600)).padStart(2, '0');
          const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
          const ss = String(Math.floor(s % 60)).padStart(2, '0');
          const ms = String(Math.floor((s % 1) * 1000)).padStart(3, '0');
          return hh + ':' + mm + ':' + ss + ',' + ms;
        }
        return String(idx + 1) + '\n' + toSrtTime(cue.start) + ' --> ' + toSrtTime(cue.end) + '\n' + cue.text + '\n';
      }).join('\n');
      downloadTextFile(srt, 'ai-dub-cues-' + (aiDubLanguage?.value || 'en-US') + '.srt', 'text/plain');
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(cues.map((c) => c.text).join('. '));
        utter.lang = aiDubLanguage?.value || 'en-US';
        utter.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
      showToast(remote.ok ? 'Dub cues generated via backend and SRT downloaded' : 'Dub cues generated locally and SRT downloaded', 'success');
      emitWebhookEvent('audio.dub_generated', { lines: cues.length, language: aiDubLanguage?.value || 'en-US' });
    });

    btnGenerateSoundtrack?.addEventListener('click', async () => {
      const mood = aiSoundtrackMood?.value || 'intense';
      const duration = clamp(Number(aiSoundtrackDuration?.value || sceneDuration?.value || 24), 4, 180);
      const remote = await postAiSuite('/api/ai-suite/soundtrack/', { mood, duration });
      let downloaded = false;
      if (remote.ok && typeof remote.data?.audioDataUrl === 'string' && remote.data.audioDataUrl.startsWith('data:audio/')) {
        latestGeneratedAudioBlob = dataUrlToBlob(remote.data.audioDataUrl);
        createDownload(latestGeneratedAudioBlob, 'ai-soundtrack-' + mood + '-' + duration + 's.wav');
        downloaded = true;
      } else if (remote.ok && typeof remote.data?.audioBase64 === 'string') {
        latestGeneratedAudioBlob = dataUrlToBlob('data:audio/wav;base64,' + remote.data.audioBase64);
        createDownload(latestGeneratedAudioBlob, 'ai-soundtrack-' + mood + '-' + duration + 's.wav');
        downloaded = true;
      }
      if (!downloaded) {
        latestGeneratedAudioBlob = createProceduralSoundtrackBlob(mood, duration);
        createDownload(latestGeneratedAudioBlob, 'ai-soundtrack-' + mood + '-' + duration + 's.wav');
      }
      showToast(downloaded ? 'Soundtrack generated via backend' : 'Procedural soundtrack generated locally', 'success');
      emitWebhookEvent('audio.soundtrack_generated', { mood, duration });
    });

    btnSubmitForReview?.addEventListener('click', async () => {
      const workspace = String(aiTeamWorkspace?.value || prefs.teamWorkspace || 'default');
      const notes = String(aiReviewNotes?.value || '').slice(0, 800);
      const remote = await postAiSuite('/api/ai-suite/review/submit/', {
        workspace,
        notes,
        license: prefs.licenseProfile || 'commercial',
      });
      if (remote.ok && remote.data?.review) {
        showToast('Output submitted for backend review queue', 'success');
        emitWebhookEvent('review.submitted', remote.data.review);
        return;
      }
      const reviews = loadReviews();
      const item = {
        id: 'RVW' + Date.now(),
        workspace,
        notes,
        license: prefs.licenseProfile || 'commercial',
        approved: false,
        createdAt: new Date().toISOString(),
      };
      reviews.push(item);
      saveReviews(reviews);
      showToast('Output submitted for local team review', 'info');
      emitWebhookEvent('review.submitted', item);
    });

    btnApproveReview?.addEventListener('click', async () => {
      const remote = await postAiSuite('/api/ai-suite/review/approve/', {});
      if (remote.ok && remote.data?.review) {
        showToast('Latest backend review marked approved', 'success');
        emitWebhookEvent('review.approved', remote.data.review);
        return;
      }
      const reviews = loadReviews();
      if (!reviews.length) {
        showToast('No submitted reviews yet', 'info');
        return;
      }
      const last = reviews[reviews.length - 1];
      last.approved = true;
      last.approvedAt = new Date().toISOString();
      reviews[reviews.length - 1] = last;
      saveReviews(reviews);
      showToast('Latest local review marked approved', 'info');
      emitWebhookEvent('review.approved', last);
    });

    btnExportSocialPreset?.addEventListener('click', async () => {
      const presetMap = {
        tiktok: 'vertical-1080',
        'instagram-reel': 'vertical-1080',
        'youtube-short': 'vertical-1080',
        'youtube-thumb': 'landscape-1080',
      };
      const selected = aiSocialPreset?.value || prefs.socialPreset || 'tiktok';
      const mapped = presetMap[selected] || 'vertical-1080';
      if (latestClipBlob) {
        const rendered = await renderVideoExport(latestClipBlob, {
          start: 0,
          end: clamp(Number(videoDuration?.value || 6), 2, 20),
          preset: mapped,
          fps: 24,
        }).catch(() => null);
        if (!rendered) {
          showToast('Social export failed', 'error');
          return;
        }
        createDownload(rendered.blob || rendered, 'ai-social-' + selected + '.webm');
        showToast('Social preset export completed', 'success');
      } else if (latestImageDataUrl) {
        const img = await loadImageFromUrl(latestImageDataUrl).catch(() => null);
        if (!img) {
          showToast('Social export failed', 'error');
          return;
        }
        const dims = getVideoExportDimensions(mapped, img.naturalWidth || 1280, img.naturalHeight || 720);
        const c = document.createElement('canvas');
        c.width = dims.width;
        c.height = dims.height;
        const x = c.getContext('2d');
        x.fillStyle = '#020617';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        createDownload(dataUrlToBlob(c.toDataURL('image/png')), 'ai-social-' + selected + '.png');
        showToast('Social image export completed', 'success');
      } else {
        showToast('Generate an image or clip first', 'info');
      }
      emitWebhookEvent('export.social', { preset: selected });
    });

    function isAISectionActive() {
      return !!section.classList.contains('active');
    }

    document.addEventListener('keydown', (event) => {
      if (!isAISectionActive()) return;
      if (!(event.altKey && event.shiftKey)) return;
      if (event.metaKey || event.ctrlKey) return;

      if (event.code === 'Digit1') {
        event.preventDefault();
        $('btnGenerateImage')?.click();
      } else if (event.code === 'Digit2') {
        event.preventDefault();
        $('btnGenerateClip')?.click();
      } else if (event.code === 'Digit3') {
        event.preventDefault();
        $('btnGenerateTrailer')?.click();
      } else if (event.code === 'Digit4') {
        event.preventDefault();
        $('btnGenerateScene')?.click();
      }
    });

    renderRecentOutputs(Array.isArray(cached.recentOutputs) ? cached.recentOutputs : []);
    updateSceneTimingModeUI();
    updateSceneDurationDisplay();

    generateImageWithQualityGuard(false).catch(() => {
      // Keep initialization resilient if remote provider fails.
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
