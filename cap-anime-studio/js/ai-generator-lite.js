(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

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

  function buildComposerUi(section) {
    section.innerHTML = [
      '<div class="ai-compose-wrap">',
      '  <div class="ai-compose-mode">',
      '    <button id="composeModeImage" class="ai-compose-tab active" type="button">Image</button>',
      '    <button id="composeModeVideo" class="ai-compose-tab" type="button">Video</button>',
      '  </div>',
      '  <h2 class="ai-compose-title">Transform Ideas into Reality with <span>AI Creations</span></h2>',
      '  <div class="ai-compose-card">',
      '    <textarea id="composePrompt" class="ai-compose-prompt" rows="4" placeholder="Describe the image or video you want to create"></textarea>',
      '    <div class="ai-compose-controls">',
      '      <select id="composeModel" class="ai-compose-select">',
      '        <option value="dall-e-3">Model: DALL-E 3</option>',
      '        <option value="flux-pro">Model: FLUX Pro</option>',
      '        <option value="sdxl">Model: SDXL</option>',
      '      </select>',
      '      <select id="composeAspect" class="ai-compose-select">',
      '        <option value="1:1">Aspect ratio: 1:1</option>',
      '        <option value="16:9">Aspect ratio: 16:9</option>',
      '        <option value="9:16">Aspect ratio: 9:16</option>',
      '      </select>',
      '      <select id="composeQuantity" class="ai-compose-select">',
      '        <option value="1" selected>Image quantity: 1</option>',
      '        <option value="2">Image quantity: 2</option>',
      '        <option value="4">Image quantity: 4</option>',
      '      </select>',
      '      <button id="composeSurprise" class="ai-compose-btn-outline" type="button">Surprise Me</button>',
      '      <button id="composeCreate" class="ai-compose-btn-primary" type="button">Create</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function initComposer() {
    const section = $('ai-generator');
    if (!section) return;

    buildComposerUi(section);

    const modeImage = $('composeModeImage');
    const modeVideo = $('composeModeVideo');
    const promptInput = $('composePrompt');
    const modelInput = $('composeModel');
    const aspectInput = $('composeAspect');
    const quantityInput = $('composeQuantity');
    const surpriseBtn = $('composeSurprise');
    const createBtn = $('composeCreate');

    let mode = 'image';

    const surprisePrompts = {
      image: [
        'Character concept sheet: cyber samurai with glowing blue armor, full body, studio lighting',
        'Industrial township at sunrise, wet streets, workers heading in, cinematic realism',
        'Fantasy market district, hanging lanterns, rich color palette, high detail environment',
      ],
      video: [
        'Worker walking through a steel factory floor, dramatic side light, safety awareness scene',
        'Camera push through a futuristic city district at dusk with moving traffic and neon signs',
        'Wide shot of a coastal town with ocean wind, soft cinematic movement, realistic tone',
      ],
    };

    function syncModeUi() {
      modeImage.classList.toggle('active', mode === 'image');
      modeVideo.classList.toggle('active', mode === 'video');
      quantityInput.disabled = mode !== 'image';
      quantityInput.style.opacity = mode === 'image' ? '1' : '0.5';
      promptInput.placeholder = mode === 'image'
        ? 'Describe the image you want created'
        : 'Describe the video scene you want created';
    }

    modeImage.addEventListener('click', function () {
      mode = 'image';
      syncModeUi();
    });

    modeVideo.addEventListener('click', function () {
      mode = 'video';
      syncModeUi();
    });

    surpriseBtn.addEventListener('click', function () {
      const list = surprisePrompts[mode] || surprisePrompts.image;
      promptInput.value = list[Math.floor(Math.random() * list.length)];
    });

    createBtn.addEventListener('click', function () {
      const prompt = String(promptInput.value || '').trim();
      if (!prompt) {
        showToast('Enter a prompt before creating', 'error');
        return;
      }

      const params = new URLSearchParams({
        mode: mode,
        prompt: prompt,
        model: modelInput.value || 'dall-e-3',
        aspect: aspectInput.value || '1:1',
        quantity: quantityInput.value || '1',
      });

      window.location.href = 'ai-generation-dashboard.html?' + params.toString();
    });

    syncModeUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComposer);
  } else {
    initComposer();
  }
})();
