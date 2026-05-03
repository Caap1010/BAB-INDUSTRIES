(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const RECENT_KEY = 'cap_ai_dash_recent_v1';

  function showToast(message, kind) {
    const region = $('aiToastRegion');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = 'ai-toast ' + (kind || 'info');
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        toast.remove();
      }, 180);
    }, 2600);
  }

  function setStatus(message) {
    const el = $('dashStatus');
    if (el) el.textContent = message;
  }

  function parseParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      mode: String(params.get('mode') || 'image'),
      prompt: String(params.get('prompt') || ''),
      model: String(params.get('model') || 'dall-e-3'),
      priority: String(params.get('priority') || 'balanced'),
      aspect: String(params.get('aspect') || '16:9'),
      quantity: Number(params.get('quantity') || 1),
    };
  }

  function toProviderModel(model) {
    const normalized = String(model || '').toLowerCase();
    if (normalized === 'flux-pro') return 'flux';
    if (normalized === 'sdxl') return 'sdxl';
    return 'flux';
  }

  function buildProviderPrompt(prompt, priority) {
    const base = String(prompt || 'character concept').replace(/\s+/g, ' ').trim().slice(0, 420);
    const styleHint = priority === 'quality'
      ? 'high detail, coherent composition, accurate prompt adherence, realistic lighting'
      : priority === 'fast'
        ? 'simple composition, clear subject'
        : 'balanced detail, clean composition, prompt adherence';

    return 'Create an image that matches this description exactly: '
      + base
      + '. Style constraints: '
      + styleHint
      + '. Do not add unrelated subjects or text overlays.';
  }

  function aspectToDims(aspect) {
    if (aspect === '1:1') return { width: 1024, height: 1024 };
    if (aspect === '9:16') return { width: 720, height: 1280 };
    return { width: 1280, height: 720 };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function uniqueNonEmpty(values) {
    const seen = new Set();
    return values.filter(function (value) {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) return false;
      seen.add(text);
      return true;
    });
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

  function getBackendCandidates() {
    const current = window.location;
    return uniqueNonEmpty([
      window.BAB_API_BASE,
      guessBackendBase(),
      current.origin,
      current.protocol + '//' + current.hostname + ':8000',
      'http://127.0.0.1:8000',
      'http://localhost:8000',
    ]);
  }

  function toAbsoluteBackendUrl(base, value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:') || text.startsWith('blob:')) {
      return text;
    }
    const root = String(base || '').replace(/\/$/, '');
    const suffix = text.startsWith('/') ? text : ('/' + text);
    return root + suffix;
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function generateImage(prompt, aspect, seed, model, priority) {
    const dims = aspectToDims(aspect);
    const normalizedPrompt = buildProviderPrompt(prompt, priority);
    const rawPrompt = String(prompt || 'character concept').replace(/\s+/g, ' ').trim().slice(0, 420);
    const providerModel = toProviderModel(model);
    const seedBase = Number.isFinite(seed)
      ? Math.abs(Math.floor(seed)) % 9999999
      : Math.floor(Math.random() * 9999999);
    let lastError = null;

    const backends = getBackendCandidates();
    for (let i = 0; i < backends.length; i += 1) {
      const base = backends[i].replace(/\/$/, '');
      try {
        const res = await fetch(base + '/api/cap-anime/generate-image/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: rawPrompt,
            aspect: aspect,
            model: providerModel,
            seed: seedBase,
          }),
        });

        if (!res.ok) {
          lastError = new Error('Backend generator HTTP ' + res.status);
          continue;
        }

        const payload = await res.json();
        if (payload && payload.ok && payload.image) {
          return {
            image: payload.image,
            imageUrl: toAbsoluteBackendUrl(base, payload.imageUrl || ''),
            source: payload.source || 'backend',
          };
        }

        lastError = new Error(payload && payload.error ? payload.error : 'Backend generation failed');
      } catch (err) {
        lastError = err;
      }
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const currentSeed = ((seedBase + attempt) % 9999999) || 1;
      const endpointVariants = [
        'https://image.pollinations.ai/prompt/' + encodeURIComponent(normalizedPrompt)
          + '?width=' + dims.width
          + '&height=' + dims.height
          + '&seed=' + currentSeed
          + '&model=' + encodeURIComponent(providerModel)
          + '&enhance=true'
          + '&nologo=true',
        'https://image.pollinations.ai/prompt/' + encodeURIComponent(rawPrompt)
          + '?width=' + dims.width
          + '&height=' + dims.height
          + '&seed=' + currentSeed
          + '&model=' + encodeURIComponent(providerModel)
          + '&nologo=true',
        'https://image.pollinations.ai/prompt/' + encodeURIComponent(rawPrompt)
          + '?width=' + dims.width
          + '&height=' + dims.height
          + '&seed=' + currentSeed
          + '&nologo=true',
      ];

      for (let i = 0; i < endpointVariants.length; i += 1) {
        try {
          const res = await fetch(endpointVariants[i], { method: 'GET' });
          if (!res.ok) {
            lastError = new Error('Provider error HTTP ' + res.status);
            continue;
          }
          const blob = await res.blob();
          if (!blob || !blob.type.startsWith('image/')) {
            lastError = new Error('Provider returned non-image response');
            continue;
          }
          return {
            image: await blobToDataUrl(blob),
            imageUrl: '',
            source: 'provider',
          };
        } catch (err) {
          lastError = err;
        }
      }
    }

    throw lastError || new Error('Image provider unavailable');
  }

  async function generateVideoViaBackend(prompt, aspect, durationSec, seed, model) {
    const backends = getBackendCandidates();
    let lastError = null;
    for (let i = 0; i < backends.length; i += 1) {
      const base = backends[i].replace(/\/$/, '');
      try {
        const res = await fetch(base + '/api/cap-anime/generate-video/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: String(prompt || '').slice(0, 420),
            aspect: aspect,
            duration: clamp(Number(durationSec || 8), 2, 120),
            seed: seed,
            model: toProviderModel(model),
          }),
        });
        const payload = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          lastError = new Error((payload && payload.error) || ('Backend video HTTP ' + res.status));
          continue;
        }
        if (payload && payload.ok && payload.videoUrl) {
          return {
            videoUrl: toAbsoluteBackendUrl(base, payload.videoUrl),
            thumbnailUrl: toAbsoluteBackendUrl(base, payload.thumbnailUrl || ''),
            image: payload.image || '',
            source: payload.source || 'backend',
          };
        }
        lastError = new Error('Backend video response missing URL');
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Backend video unavailable');
  }

  async function renderVideoFromImage(imageDataUrl, prompt, durationSec, aspect) {
    const baseImage = await loadImage(imageDataUrl);
    const dims = aspectToDims(aspect);
    const width = dims.width;
    const height = dims.height;
    const fps = 24;
    const frames = Math.max(1, Math.round(durationSec * fps));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mimeType });
    const chunks = [];

    recorder.ondataavailable = function (event) {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    recorder.start();
    for (let i = 0; i < frames; i += 1) {
      const t = i / frames;
      const zoom = 1.02 + t * 0.18;
      const shiftX = Math.sin(t * Math.PI * 2) * 20;
      const drawW = width * zoom;
      const drawH = height * zoom;
      const drawX = (width - drawW) / 2 + shiftX;
      const drawY = (height - drawH) / 2;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(baseImage, drawX, drawY, drawW, drawH);

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillText(String(prompt || '').slice(0, 72), 28, height - 24);

      await new Promise(function (resolve) {
        setTimeout(resolve, Math.round(1000 / fps));
      });
    }

    await new Promise(function (resolve) {
      recorder.onstop = resolve;
      recorder.stop();
    });

    return new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  }

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveRecent(items) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 20)));
  }

  function renderRecent(items, selectedId, onPick) {
    const wrap = $('dashRecent');
    if (!wrap) return;
    wrap.innerHTML = '';
    items.forEach(function (item) {
      const card = document.createElement('div');
      card.className = 'ai-dash-recent-card' + (item.id === selectedId ? ' active' : '');
      const img = document.createElement('img');
      img.className = 'ai-dash-thumb';
      img.src = item.thumb || item.url || '';
      img.alt = item.prompt || 'recent';

      const meta = document.createElement('div');
      meta.className = 'ai-dash-thumb-meta';
      const type = document.createElement('span');
      type.className = 'ai-dash-thumb-type ' + (item.type === 'video' ? 'video' : 'image');
      type.textContent = item.type;
      const time = document.createElement('span');
      time.className = 'ai-dash-thumb-time';
      time.textContent = new Date(item.createdAt || Date.now()).toLocaleTimeString();
      meta.append(type, time);

      card.append(img, meta);
      card.addEventListener('click', function () {
        onPick(item);
      });
      wrap.appendChild(card);
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function init() {
    const params = parseParams();
    const promptInput = $('dashPrompt');
    const prioritySelect = $('dashPriority');
    const durationInput = $('dashDuration');
    const modeBadge = $('dashModeBadge');
    const aspectGroup = $('dashAspectGroup');
    const canvas = $('dashImageCanvas');
    const video = $('dashVideoPreview');

    const ctx = canvas.getContext('2d');
    let activeAspect = params.aspect || '16:9';
    let activeMode = params.mode === 'video' ? 'video' : 'image';
    let activeModel = params.model || 'dall-e-3';
    let activeRecentId = '';
    let currentImageUrl = '';
    let currentVideoBlob = null;
    let currentVideoUrl = '';
    let recents = loadRecent();

    if (promptInput) promptInput.value = params.prompt;
    if (prioritySelect) prioritySelect.value = params.priority || 'balanced';
    if (modeBadge) modeBadge.textContent = 'Mode: ' + activeMode;
    if (durationInput) durationInput.value = activeMode === 'video' ? '8' : '6';

    function syncAspectChips() {
      aspectGroup?.querySelectorAll('.ai-dash-chip').forEach(function (chip) {
        chip.classList.toggle('active', chip.dataset.aspect === activeAspect);
      });
    }

    aspectGroup?.querySelectorAll('.ai-dash-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeAspect = chip.dataset.aspect || '16:9';
        syncAspectChips();
      });
    });

    syncAspectChips();

    async function handleRecentPick(item) {
      activeRecentId = item.id;
      if (item.type === 'video') {
        const playableUrl = item.url || item.sessionUrl;
        if (!playableUrl) {
          setStatus('This video thumbnail is from previous sessions. Regenerate to play it again.');
          showToast('Stored video preview is not replayable. Regenerate to play.', 'info');
          renderRecent(recents, activeRecentId, handleRecentPick);
          return;
        }
        currentVideoBlob = null;
        currentVideoUrl = playableUrl;
        canvas.hidden = true;
        video.hidden = false;
        video.src = playableUrl;
        video.play().catch(function () {});
      } else {
        currentImageUrl = item.url;
        currentVideoBlob = null;
        currentVideoUrl = '';
        await drawImageOnCanvas(item.url);
      }
      renderRecent(recents, activeRecentId, handleRecentPick);
    }

    function drawImageOnCanvas(dataUrl) {
      return loadImage(dataUrl).then(function (img) {
        canvas.hidden = false;
        video.hidden = true;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      });
    }

    async function handleGenerate() {
      const prompt = String(promptInput?.value || '').trim();
      if (!prompt) {
        showToast('Enter a prompt first', 'error');
        return;
      }

      try {
        if (activeMode === 'image') {
          setStatus('Generating image...');
          const quantity = Math.max(1, Math.min(4, Number(params.quantity || 1)));
          const generated = [];
          for (let i = 0; i < quantity; i += 1) {
            try {
              const url = await generateImage(
                prompt,
                activeAspect,
                Math.floor(Math.random() * 9999999) + i,
                activeModel,
                prioritySelect?.value || 'balanced'
              );
              generated.push(url);
            } catch (_) {
              // Keep successful generations even when one provider call fails.
            }
          }

          if (!generated.length) {
            throw new Error('All provider attempts failed. Please try again in a few seconds.');
          }

          currentImageUrl = generated[0].image;
          await drawImageOnCanvas(currentImageUrl);
          currentVideoBlob = null;
          currentVideoUrl = '';

          generated.forEach(function (result) {
            recents.unshift({
              id: 'R' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
              type: 'image',
              prompt: prompt,
              url: result.imageUrl || result.image,
              thumb: result.image,
              createdAt: new Date().toISOString(),
            });
          });
          activeRecentId = recents[0].id;
          saveRecent(recents);
          renderRecent(recents, activeRecentId, handleRecentPick);

          if (generated.length < quantity) {
            setStatus('Image generated with partial results (' + generated.length + '/' + quantity + ').');
            showToast('Generated ' + generated.length + ' of ' + quantity + ' images', 'info');
          } else {
            setStatus('Image generated.');
            showToast('Image generation complete', 'success');
          }
        } else {
          setStatus('Generating video...');
          const duration = clamp(Number(durationInput?.value || 8), 2, 120);
          let videoResult = null;
          try {
            videoResult = await generateVideoViaBackend(
              prompt,
              activeAspect,
              duration,
              Math.floor(Math.random() * 9999999),
              activeModel
            );
          } catch (_) {
            videoResult = null;
          }

          if (videoResult && videoResult.videoUrl) {
            currentVideoBlob = null;
            currentVideoUrl = videoResult.videoUrl;
            if (videoResult.image) {
              currentImageUrl = videoResult.image;
            } else if (videoResult.thumbnailUrl) {
              currentImageUrl = videoResult.thumbnailUrl;
            }
            canvas.hidden = true;
            video.hidden = false;
            video.src = currentVideoUrl;
            video.play().catch(function () {});

            recents.unshift({
              id: 'R' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
              type: 'video',
              prompt: prompt,
              url: currentVideoUrl,
              thumb: videoResult.thumbnailUrl || videoResult.image || currentImageUrl,
              createdAt: new Date().toISOString(),
            });
          } else {
            setStatus('Backend video unavailable; rendering local fallback...');
            const base = await generateImage(
              prompt,
              activeAspect,
              Math.floor(Math.random() * 9999999),
              activeModel,
              prioritySelect?.value || 'balanced'
            );
            currentImageUrl = base.image;
            await drawImageOnCanvas(base.image);

            const blob = await renderVideoFromImage(
              base.image,
              prompt,
              duration,
              activeAspect
            );
            currentVideoBlob = blob;
            currentVideoUrl = URL.createObjectURL(blob);
            canvas.hidden = true;
            video.hidden = false;
            video.src = currentVideoUrl;
            video.play().catch(function () {});

            recents.unshift({
              id: 'R' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
              type: 'video',
              prompt: prompt,
              url: '',
              sessionUrl: currentVideoUrl,
              thumb: base.image,
              createdAt: new Date().toISOString(),
            });
          }

          activeRecentId = recents[0].id;
          saveRecent(recents);
          renderRecent(recents, activeRecentId, handleRecentPick);

          setStatus('Video generated.');
          showToast('Video generation complete', 'success');
        }
      } catch (err) {
        setStatus('Generation failed.');
        showToast(err && err.message ? err.message : 'Generation failed', 'error');
      }
    }

    $('dashGenerate')?.addEventListener('click', handleGenerate);

    $('dashDownload')?.addEventListener('click', function () {
      if (activeMode === 'video' && currentVideoBlob) {
        downloadBlob(currentVideoBlob, 'generated-video.webm');
        return;
      }
      if (activeMode === 'video' && currentVideoUrl) {
        const link = document.createElement('a');
        link.href = currentVideoUrl;
        link.download = 'generated-video.webm';
        link.click();
        return;
      }
      if (currentImageUrl) {
        const link = document.createElement('a');
        link.href = currentImageUrl;
        link.download = 'generated-image.png';
        link.click();
        return;
      }
      showToast('Nothing to download yet', 'error');
    });

    renderRecent(recents, activeRecentId, handleRecentPick);

    // Keep prompt prefilled from composer; generate starts when user clicks Generate.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
