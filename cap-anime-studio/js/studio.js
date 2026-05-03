/* ============================================================
   CAP ANIME STUDIO — ANIMATION ENGINE (studio.js)
   Canvas drawing, layers, keyframes, playback, timeline
   ============================================================ */

(function () {
  'use strict';

  // ─── Wait for the production section to become active ───
  function initStudio() {
    const section = document.getElementById('production');
    if (!section) return;

    // ─── Canvas references ───────────────────────────────────
    const mainCanvas    = document.getElementById('mainCanvas');
    const onionCanvas   = document.getElementById('onionCanvas');
    const gridCanvas    = document.getElementById('gridCanvas');
    const overlayCanvas = document.getElementById('overlayCanvas');
    if (!mainCanvas) return;

    const ctx     = mainCanvas.getContext('2d');
    const onionCtx = onionCanvas.getContext('2d');
    const gridCtx  = gridCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');

    const W = mainCanvas.width;
    const H = mainCanvas.height;

    // ─── State ───────────────────────────────────────────────
    const state = {
      tool: 'pen',
      strokeColor: '#38bdf8',
      fillColor: '#0f172a',
      brushSize: 4,
      opacity: 1,
      zoom: 1,
      showGrid: false,
      showOnion: false,
      isDrawing: false,
      lastX: 0,
      lastY: 0,
      startX: 0,
      startY: 0,
      currentFrame: 0,
      totalFrames: 24,
      fps: 24,
      playing: false,
      playInterval: null,
      recording: false,
      activeLayer: 0,
      history: [],       // undo stack
      redoStack: [],
      blendMode: 'source-over',
    };

    // ─── Layer / Frame data model ─────────────────────────────
    // layers[i].frames[f] = ImageData | null
    // layers[i].keyframes = Set of frame indices
    const layers = [
      makeLayer('Background', '#22c55e', true),
      makeLayer('Characters', '#38bdf8', true),
      makeLayer('FX',         '#f97316', true),
    ];

    function makeLayer(name, color, visible) {
      return {
        name,
        color,
        visible,
        locked: false,
        opacity: 1,
        blendMode: 'source-over',
        frames: Array.from({ length: 300 }, () => null),
        keyframes: new Set([0]),
      };
    }

    // ─── Render layer list ────────────────────────────────────
    const layerListEl = document.getElementById('layerList');

    function renderLayers() {
      if (!layerListEl) return;
      layerListEl.innerHTML = '';
      [...layers].reverse().forEach((layer, rIdx) => {
        const idx = layers.length - 1 - rIdx;
        const item = document.createElement('div');
        item.className = 'layer-item' + (idx === state.activeLayer ? ' active' : '');
        item.innerHTML = `
          <button class="layer-vis ${layer.visible ? '' : 'hidden'}" data-idx="${idx}" title="Toggle Visibility">
            ${layer.visible ? '👁' : '◌'}
          </button>
          <button class="layer-lock ${layer.locked ? 'locked' : ''}" data-idx="${idx}" title="Toggle Lock">
            ${layer.locked ? '🔒' : '🔓'}
          </button>
          <div class="layer-name-wrap">
            <div class="layer-dot" style="background:${layer.color}"></div>
            <span class="layer-name">${layer.name}</span>
          </div>
        `;
        item.addEventListener('click', (e) => {
          if (e.target.closest('.layer-vis') || e.target.closest('.layer-lock')) return;
          state.activeLayer = idx;
          renderLayers();
        });
        item.querySelector('.layer-vis').addEventListener('click', (e) => {
          e.stopPropagation();
          layer.visible = !layer.visible;
          renderLayers();
          compositeFrame();
        });
        item.querySelector('.layer-lock').addEventListener('click', (e) => {
          e.stopPropagation();
          layer.locked = !layer.locked;
          renderLayers();
        });
        layerListEl.appendChild(item);
      });
      renderTimelineTracks();
    }

    // ─── Timeline ────────────────────────────────────────────
    const tlRuler      = document.getElementById('tlRuler');
    const tlTracks     = document.getElementById('tlTracks');
    const tlLayerLabels = document.getElementById('tlLayerLabels');

    function renderTimeline() {
      if (!tlRuler) return;
      tlRuler.innerHTML = '';
      for (let f = 0; f < state.totalFrames; f++) {
        const mark = document.createElement('div');
        mark.className = 'tl-ruler-mark' + (f === state.currentFrame ? ' current-mark' : '');
        mark.textContent = (f + 1) % 5 === 0 || f === 0 ? f + 1 : '';
        mark.dataset.frame = f;
        mark.addEventListener('click', () => goToFrame(f));
        tlRuler.appendChild(mark);
      }
      renderTimelineTracks();
    }

    function renderTimelineTracks() {
      if (!tlTracks || !tlLayerLabels) return;
      tlTracks.innerHTML = '';
      tlLayerLabels.innerHTML = '';
      layers.forEach((layer, lIdx) => {
        // label
        const lbl = document.createElement('div');
        lbl.className = 'tl-layer-label-item';
        lbl.style.color = lIdx === state.activeLayer ? layer.color : '';
        lbl.textContent = layer.name;
        tlLayerLabels.appendChild(lbl);

        // track row
        const row = document.createElement('div');
        row.className = 'tl-track-row';
        for (let f = 0; f < state.totalFrames; f++) {
          const cell = document.createElement('div');
          cell.className = 'tl-frame-cell' + (f === state.currentFrame ? ' current-col' : '');
          cell.dataset.frame = f;
          cell.dataset.layer = lIdx;

          if (layer.keyframes.has(f)) {
            const kf = document.createElement('div');
            kf.className = 'tl-keyframe ' + (layer.frames[f] ? 'filled' : 'empty');
            cell.appendChild(kf);
          } else if (hasInbetween(layer, f)) {
            const ib = document.createElement('div');
            ib.className = 'tl-inbetween';
            cell.appendChild(ib);
          }

          cell.addEventListener('click', () => goToFrame(f));
          row.appendChild(cell);
        }
        tlTracks.appendChild(row);
      });
    }

    function hasInbetween(layer, f) {
      const kfs = [...layer.keyframes].sort((a, b) => a - b);
      for (let i = 0; i < kfs.length - 1; i++) {
        if (f > kfs[i] && f < kfs[i + 1]) return true;
      }
      return false;
    }

    // ─── Frame navigation ────────────────────────────────────
    function goToFrame(f) {
      saveCurrentFrame();
      state.currentFrame = Math.max(0, Math.min(f, state.totalFrames - 1));
      updateFrameDisplay();
      loadCurrentFrame();
      renderTimeline();
      if (state.showOnion) renderOnionSkin();
    }

    function saveCurrentFrame() {
      const layer = layers[state.activeLayer];
      if (!layer) return;
      layer.frames[state.currentFrame] = ctx.getImageData(0, 0, W, H);
      if (state.recording) layer.keyframes.add(state.currentFrame);
    }

    function loadCurrentFrame() {
      ctx.clearRect(0, 0, W, H);
      // Load active layer's frame
      const layer = layers[state.activeLayer];
      if (layer && layer.frames[state.currentFrame]) {
        ctx.putImageData(layer.frames[state.currentFrame], 0, 0);
      }
      compositeFrame();
    }

    function compositeFrame() {
      // Recomposite all visible layers for display
      // We draw them on main canvas
      ctx.clearRect(0, 0, W, H);
      layers.forEach((layer) => {
        if (!layer.visible) return;
        const fd = layer.frames[state.currentFrame];
        if (fd) {
          ctx.globalCompositeOperation = layer.blendMode || 'source-over';
          ctx.globalAlpha = layer.opacity;
          ctx.putImageData(fd, 0, 0);
        }
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    function updateFrameDisplay() {
      const cf = document.getElementById('currentFrameDisp');
      if (cf) cf.textContent = state.currentFrame + 1;
    }

    // ─── Onion skin ──────────────────────────────────────────
    function renderOnionSkin() {
      onionCtx.clearRect(0, 0, W, H);
      if (!state.showOnion) return;
      const layer = layers[state.activeLayer];
      if (!layer) return;
      const prev = state.currentFrame - 1;
      const next = state.currentFrame + 1;
      if (prev >= 0 && layer.frames[prev]) {
        onionCtx.globalAlpha = 0.35;
        onionCtx.putImageData(layer.frames[prev], 0, 0);
      }
      if (next < state.totalFrames && layer.frames[next]) {
        onionCtx.globalAlpha = 0.2;
        onionCtx.putImageData(layer.frames[next], 0, 0);
      }
      onionCtx.globalAlpha = 1;
    }

    // ─── Grid ────────────────────────────────────────────────
    function renderGrid() {
      gridCtx.clearRect(0, 0, W, H);
      if (!state.showGrid) return;
      gridCtx.strokeStyle = 'rgba(56,189,248,0.08)';
      gridCtx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x <= W; x += step) {
        gridCtx.beginPath(); gridCtx.moveTo(x, 0); gridCtx.lineTo(x, H); gridCtx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        gridCtx.beginPath(); gridCtx.moveTo(0, y); gridCtx.lineTo(W, y); gridCtx.stroke();
      }
      // Safe-area thirds
      gridCtx.strokeStyle = 'rgba(56,189,248,0.15)';
      gridCtx.setLineDash([4, 4]);
      [W / 3, W * 2 / 3].forEach(x => { gridCtx.beginPath(); gridCtx.moveTo(x, 0); gridCtx.lineTo(x, H); gridCtx.stroke(); });
      [H / 3, H * 2 / 3].forEach(y => { gridCtx.beginPath(); gridCtx.moveTo(0, y); gridCtx.lineTo(W, y); gridCtx.stroke(); });
      gridCtx.setLineDash([]);
    }

    // ─── Drawing ─────────────────────────────────────────────
    function getPos(e) {
      const rect = mainCanvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY,
      };
    }

    function setCursorStyle() {
      const cursors = { pen: 'crosshair', brush: 'crosshair', eraser: 'cell', fill: 'copy', select: 'default', move: 'move', zoom: 'zoom-in', rect: 'crosshair', circle: 'crosshair', line: 'crosshair' };
      mainCanvas.style.cursor = cursors[state.tool] || 'crosshair';
    }

    function pushHistory() {
      const snap = ctx.getImageData(0, 0, W, H);
      state.history.push(snap);
      if (state.history.length > 50) state.history.shift();
      state.redoStack = [];
    }

    mainCanvas.addEventListener('mousedown', onPointerDown);
    mainCanvas.addEventListener('mousemove', onPointerMove);
    mainCanvas.addEventListener('mouseup',   onPointerUp);
    mainCanvas.addEventListener('mouseleave', onPointerUp);
    mainCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
    mainCanvas.addEventListener('touchmove',  onPointerMove, { passive: false });
    mainCanvas.addEventListener('touchend',   onPointerUp);

    function activeLayerLocked() {
      return layers[state.activeLayer] && layers[state.activeLayer].locked;
    }

    function onPointerDown(e) {
      e.preventDefault();
      if (activeLayerLocked()) { setStatus('Layer is locked'); return; }
      pushHistory();
      const { x, y } = getPos(e);
      state.isDrawing = true;
      state.startX = x; state.startY = y;
      state.lastX  = x; state.lastY  = y;

      ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = state.opacity;
      ctx.strokeStyle = state.strokeColor;
      ctx.fillStyle   = state.fillColor;
      ctx.lineWidth   = state.brushSize;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      if (state.tool === 'pen' || state.tool === 'brush') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, state.brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.tool === 'fill') {
        floodFill(Math.round(x), Math.round(y), state.strokeColor);
        finaliseStroke();
      }
    }

    function onPointerMove(e) {
      e.preventDefault();
      const { x, y } = getPos(e);
      // Update coord display
      const coords = document.getElementById('canvasCoords');
      if (coords) coords.textContent = `x:${Math.round(x)} y:${Math.round(y)}`;

      if (!state.isDrawing) return;

      ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha  = state.opacity;
      ctx.strokeStyle  = state.strokeColor;
      ctx.fillStyle    = state.fillColor;
      ctx.lineWidth    = state.brushSize;
      ctx.lineCap      = 'round';
      ctx.lineJoin     = 'round';

      if (state.tool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (state.tool === 'brush') {
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.quadraticCurveTo(state.lastX, state.lastY, x, y);
        ctx.lineWidth = state.brushSize * 1.8;
        ctx.stroke();
      } else if (state.tool === 'eraser') {
        ctx.beginPath();
        ctx.arc(x, y, state.brushSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (['rect', 'circle', 'line'].includes(state.tool)) {
        // Preview on overlay
        overlayCtx.clearRect(0, 0, W, H);
        overlayCtx.globalAlpha  = state.opacity;
        overlayCtx.strokeStyle  = state.strokeColor;
        overlayCtx.fillStyle    = state.fillColor + '33';
        overlayCtx.lineWidth    = state.brushSize;
        overlayCtx.lineCap      = 'round';
        if (state.tool === 'rect') {
          overlayCtx.beginPath();
          overlayCtx.strokeRect(state.startX, state.startY, x - state.startX, y - state.startY);
          overlayCtx.fillRect(state.startX, state.startY, x - state.startX, y - state.startY);
        } else if (state.tool === 'circle') {
          const rx = Math.abs(x - state.startX) / 2;
          const ry = Math.abs(y - state.startY) / 2;
          const cx = state.startX + (x - state.startX) / 2;
          const cy = state.startY + (y - state.startY) / 2;
          overlayCtx.beginPath();
          overlayCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          overlayCtx.stroke();
          overlayCtx.fill();
        } else if (state.tool === 'line') {
          overlayCtx.beginPath();
          overlayCtx.moveTo(state.startX, state.startY);
          overlayCtx.lineTo(x, y);
          overlayCtx.stroke();
        }
      }
      state.lastX = x; state.lastY = y;
    }

    function onPointerUp(e) {
      if (!state.isDrawing) return;
      state.isDrawing = false;
      const { x, y } = e.changedTouches
        ? (() => { const r = mainCanvas.getBoundingClientRect(); return { x: (e.changedTouches[0].clientX - r.left) * W / r.width, y: (e.changedTouches[0].clientY - r.top) * H / r.height }; })()
        : getPos(e);

      ctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha  = state.opacity;
      ctx.strokeStyle  = state.strokeColor;
      ctx.fillStyle    = state.fillColor;
      ctx.lineWidth    = state.brushSize;

      if (state.tool === 'rect') {
        ctx.beginPath();
        ctx.strokeRect(state.startX, state.startY, x - state.startX, y - state.startY);
        ctx.fillRect(state.startX, state.startY, x - state.startX, y - state.startY);
      } else if (state.tool === 'circle') {
        const rx = Math.abs(x - state.startX) / 2;
        const ry = Math.abs(y - state.startY) / 2;
        const cx = state.startX + (x - state.startX) / 2;
        const cy = state.startY + (y - state.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      } else if (state.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(state.startX, state.startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      overlayCtx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      finaliseStroke();
    }

    function finaliseStroke() {
      const layer = layers[state.activeLayer];
      if (layer) {
        layer.frames[state.currentFrame] = ctx.getImageData(0, 0, W, H);
        if (!layer.keyframes.has(state.currentFrame)) {
          // Auto-add keyframe on first draw
          layer.keyframes.add(state.currentFrame);
        }
      }
      renderTimelineTracks();
    }

    // ─── Flood Fill ─────────────────────────────────────────
    function hexToRgba(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, 255];
    }

    function floodFill(startX, startY, color) {
      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;
      const targetColor = getPixel(data, startX, startY);
      const fillColor = hexToRgba(color);
      if (colorsMatch(targetColor, fillColor)) return;
      const stack = [[startX, startY]];
      while (stack.length) {
        const [px, py] = stack.pop();
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        if (!colorsMatch(getPixel(data, px, py), targetColor)) continue;
        setPixel(data, px, py, fillColor);
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function getPixel(data, x, y) {
      const i = (y * W + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }

    function setPixel(data, x, y, color) {
      const i = (y * W + x) * 4;
      [data[i], data[i + 1], data[i + 2], data[i + 3]] = color;
    }

    function colorsMatch(a, b) {
      return Math.abs(a[0] - b[0]) < 30 && Math.abs(a[1] - b[1]) < 30 &&
             Math.abs(a[2] - b[2]) < 30 && Math.abs(a[3] - b[3]) < 30;
    }

    // ─── Playback ────────────────────────────────────────────
    function startPlay() {
      if (state.playing) return;
      state.playing = true;
      const playBtn = document.getElementById('btnPlay');
      if (playBtn) { playBtn.textContent = '⏸'; playBtn.classList.add('playing'); }
      state.playInterval = setInterval(() => {
        const next = (state.currentFrame + 1) % state.totalFrames;
        goToFrame(next);
      }, 1000 / state.fps);
    }

    function stopPlay() {
      state.playing = false;
      clearInterval(state.playInterval);
      const playBtn = document.getElementById('btnPlay');
      if (playBtn) { playBtn.textContent = '▶'; playBtn.classList.remove('playing'); }
    }

    // ─── Zoom ────────────────────────────────────────────────
    function applyZoom() {
      const scale = state.zoom;
      [mainCanvas, onionCanvas, gridCanvas, overlayCanvas].forEach(c => {
        c.style.width  = (W * scale) + 'px';
        c.style.height = (H * scale) + 'px';
      });
      const zl = document.getElementById('zoomLabel');
      if (zl) zl.textContent = Math.round(scale * 100) + '%';
    }

    // ─── Status ──────────────────────────────────────────────
    function setStatus(msg) {
      const el = document.getElementById('statusMsg');
      if (el) { el.textContent = msg; setTimeout(() => { el.textContent = 'Ready'; }, 2000); }
    }

    // ─── Undo / Redo ─────────────────────────────────────────
    function undo() {
      if (!state.history.length) return;
      state.redoStack.push(ctx.getImageData(0, 0, W, H));
      const snap = state.history.pop();
      ctx.putImageData(snap, 0, 0);
      finaliseStroke();
      setStatus('Undo');
    }

    function redo() {
      if (!state.redoStack.length) return;
      state.history.push(ctx.getImageData(0, 0, W, H));
      const snap = state.redoStack.pop();
      ctx.putImageData(snap, 0, 0);
      finaliseStroke();
      setStatus('Redo');
    }

    // ─── Wire up controls ────────────────────────────────────

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tool = btn.dataset.tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setCursorStyle();
      });
    });

    // Color inputs
    const strokeColorInput = document.getElementById('strokeColor');
    const fillColorInput   = document.getElementById('fillColor');
    const strokeSwatch     = document.getElementById('strokeSwatch');
    const fillSwatch       = document.getElementById('fillSwatch');

    function syncSwatches() {
      if (strokeSwatch) strokeSwatch.style.background = state.strokeColor;
      if (fillSwatch)   fillSwatch.style.background   = state.fillColor;
    }

    if (strokeColorInput) strokeColorInput.addEventListener('input', () => {
      state.strokeColor = strokeColorInput.value;
      syncSwatches();
    });
    if (fillColorInput) fillColorInput.addEventListener('input', () => {
      state.fillColor = fillColorInput.value;
      syncSwatches();
    });

    // Palette swatches
    document.querySelectorAll('.pal').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const c = swatch.dataset.color;
        if (e.shiftKey) { state.fillColor = c; if (fillColorInput) fillColorInput.value = c; }
        else { state.strokeColor = c; if (strokeColorInput) strokeColorInput.value = c; }
        syncSwatches();
      });
      swatch.title = 'Click: stroke · Shift+Click: fill';
    });

    // Brush size
    const brushSizeInput = document.getElementById('brushSize');
    const sizeValEl      = document.getElementById('sizeVal');
    if (brushSizeInput) brushSizeInput.addEventListener('input', () => {
      state.brushSize = +brushSizeInput.value;
      if (sizeValEl) sizeValEl.textContent = state.brushSize;
    });

    // Opacity
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValEl  = document.getElementById('opacityVal');
    if (opacitySlider) opacitySlider.addEventListener('input', () => {
      state.opacity = +opacitySlider.value / 100;
      if (opacityValEl) opacityValEl.textContent = opacitySlider.value;
    });

    // Playback
    document.getElementById('btnPlay')?.addEventListener('click', () => state.playing ? stopPlay() : startPlay());
    document.getElementById('btnRewind')?.addEventListener('click', () => { stopPlay(); goToFrame(0); });
    document.getElementById('btnToEnd')?.addEventListener('click', () => { stopPlay(); goToFrame(state.totalFrames - 1); });
    document.getElementById('btnPrevFrame')?.addEventListener('click', () => { stopPlay(); goToFrame(state.currentFrame - 1); });
    document.getElementById('btnNextFrame')?.addEventListener('click', () => { stopPlay(); goToFrame(state.currentFrame + 1); });

    // FPS
    document.getElementById('fpsSelect')?.addEventListener('change', (e) => {
      state.fps = +e.target.value;
      const fpsDisp = document.getElementById('fpsDisplay');
      if (fpsDisp) fpsDisp.textContent = state.fps;
      if (state.playing) { stopPlay(); startPlay(); }
    });

    // Total frames
    document.getElementById('totalFramesInput')?.addEventListener('change', (e) => {
      state.totalFrames = Math.max(1, Math.min(300, +e.target.value));
      const tf = document.getElementById('totalFrameDisp');
      if (tf) tf.textContent = state.totalFrames;
      renderTimeline();
    });

    function insertFrameAfterCurrent() {
      if (state.totalFrames >= 300) {
        setStatus('Frame limit reached');
        return;
      }
      saveCurrentFrame();
      layers.forEach((layer) => {
        for (let index = state.totalFrames; index > state.currentFrame + 1; index -= 1) {
          layer.frames[index] = layer.frames[index - 1];
        }
        layer.frames[state.currentFrame + 1] = null;
        const shifted = new Set();
        [...layer.keyframes].forEach((frameIndex) => {
          if (frameIndex > state.currentFrame) shifted.add(frameIndex + 1);
          else shifted.add(frameIndex);
        });
        layer.keyframes = shifted;
      });
      state.totalFrames += 1;
      const tf = document.getElementById('totalFrameDisp');
      const tfi = document.getElementById('totalFramesInput');
      if (tf) tf.textContent = state.totalFrames;
      if (tfi) tfi.value = String(state.totalFrames);
      goToFrame(state.currentFrame + 1);
      setStatus('New frame added at ' + (state.currentFrame + 1));
    }

    // Keyframes
    document.getElementById('btnAddKeyframe')?.addEventListener('click', () => {
      layers[state.activeLayer]?.keyframes.add(state.currentFrame);
      finaliseStroke();
      setStatus('Keyframe added at frame ' + (state.currentFrame + 1));
    });

    document.getElementById('btnDelKeyframe')?.addEventListener('click', () => {
      layers[state.activeLayer]?.keyframes.delete(state.currentFrame);
      renderTimelineTracks();
      setStatus('Keyframe removed');
    });
    document.getElementById('btnAddFrame')?.addEventListener('click', insertFrameAfterCurrent);
    document.getElementById('btnAddFrameTop')?.addEventListener('click', insertFrameAfterCurrent);

    // Onion skin
    document.getElementById('onionCheck')?.addEventListener('change', (e) => {
      state.showOnion = e.target.checked;
      renderOnionSkin();
    });
    document.getElementById('btnOnionV')?.addEventListener('click', () => {
      state.showOnion = !state.showOnion;
      document.getElementById('btnOnionV')?.classList.toggle('active', state.showOnion);
      const oc = document.getElementById('onionCheck');
      if (oc) oc.checked = state.showOnion;
      renderOnionSkin();
    });

    // Grid
    document.getElementById('btnToggleGridV')?.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      document.getElementById('btnToggleGridV')?.classList.toggle('active', state.showGrid);
      renderGrid();
    });
    document.getElementById('btnToggleGrid')?.addEventListener('click', () => {
      state.showGrid = !state.showGrid;
      renderGrid();
    });

    // Zoom
    document.getElementById('btnZoomInV')?.addEventListener('click', () => {
      state.zoom = Math.min(4, state.zoom + 0.25);
      applyZoom();
    });
    document.getElementById('btnZoomOutV')?.addEventListener('click', () => {
      state.zoom = Math.max(0.25, state.zoom - 0.25);
      applyZoom();
    });
    document.getElementById('btnZoomIn')?.addEventListener('click', () => {
      state.zoom = Math.min(4, state.zoom + 0.25);
      applyZoom();
    });
    document.getElementById('btnZoomOut')?.addEventListener('click', () => {
      state.zoom = Math.max(0.25, state.zoom - 0.25);
      applyZoom();
    });
    document.getElementById('btnZoomReset')?.addEventListener('click', () => {
      state.zoom = 1; applyZoom();
    });

    // Scroll-to-zoom on canvas
    document.getElementById('canvasContainer')?.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoom = Math.max(0.25, Math.min(4, state.zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
      applyZoom();
    }, { passive: false });

    // File menu
    document.getElementById('btnClearCanvas')?.addEventListener('click', () => {
      if (!confirm('Clear current frame? This cannot be undone.')) return;
      pushHistory();
      ctx.clearRect(0, 0, W, H);
      finaliseStroke();
      setStatus('Frame cleared');
    });

    document.getElementById('btnNewScene')?.addEventListener('click', () => {
      const name = prompt('Scene name:', 'Ep01_Shot00' + (document.querySelectorAll('.scene-item').length + 1));
      if (!name) return;
      addScene(name);
    });

    document.getElementById('btnExportPng')?.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `CAP_frame_${state.currentFrame + 1}.png`;
      link.href = mainCanvas.toDataURL('image/png');
      link.click();
      setStatus('Frame exported as PNG');
    });

    document.getElementById('btnExportGif')?.addEventListener('click', () => {
      setStatus('GIF export — coming soon');
    });

    // Edit menu
    document.getElementById('btnUndo')?.addEventListener('click', undo);
    document.getElementById('btnUndoTop')?.addEventListener('click', undo);
    document.getElementById('btnRedo')?.addEventListener('click', redo);
    document.getElementById('btnDuplFrame')?.addEventListener('click', () => {
      const layer = layers[state.activeLayer];
      if (!layer) return;
      const next = state.currentFrame + 1;
      if (next >= state.totalFrames) return;
      layer.frames[next] = layer.frames[state.currentFrame] ? new ImageData(
        new Uint8ClampedArray(layer.frames[state.currentFrame].data),
        W, H
      ) : null;
      layer.keyframes.add(next);
      goToFrame(next);
      setStatus('Frame duplicated to frame ' + (next + 1));
    });

    // Layer controls
    document.getElementById('btnAddLayer')?.addEventListener('click', () => {
      const colors = ['#a855f7', '#ec4899', '#06b6d4', '#84cc16', '#f59e0b'];
      const c = colors[layers.length % colors.length];
      layers.push(makeLayer('Layer ' + (layers.length + 1), c, true));
      state.activeLayer = layers.length - 1;
      renderLayers();
      renderTimeline();
    });

    document.getElementById('btnDelLayer')?.addEventListener('click', () => {
      if (layers.length <= 1) { setStatus('Cannot delete last layer'); return; }
      if (!confirm('Delete "' + layers[state.activeLayer].name + '"?')) return;
      layers.splice(state.activeLayer, 1);
      state.activeLayer = Math.min(state.activeLayer, layers.length - 1);
      renderLayers();
      renderTimeline();
    });

    document.getElementById('btnDupLayer')?.addEventListener('click', () => {
      const orig = layers[state.activeLayer];
      const dup  = makeLayer(orig.name + ' copy', orig.color, orig.visible);
      dup.frames = orig.frames.map(f => f ? new ImageData(new Uint8ClampedArray(f.data), W, H) : null);
      dup.keyframes = new Set(orig.keyframes);
      layers.splice(state.activeLayer + 1, 0, dup);
      state.activeLayer = state.activeLayer + 1;
      renderLayers();
      renderTimeline();
    });

    // Record button
    document.getElementById('btnRecord')?.addEventListener('click', () => {
      state.recording = !state.recording;
      document.getElementById('btnRecord')?.classList.toggle('active', state.recording);
      setStatus(state.recording ? '⏺ Recording — draw to auto-set keyframes' : 'Recording stopped');
    });

    // Blend mode
    document.getElementById('propBlend')?.addEventListener('change', (e) => {
      const layer = layers[state.activeLayer];
      if (layer) layer.blendMode = e.target.value;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('production')?.classList.contains('active')) return;
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const map = { p: 'pen', b: 'brush', e: 'eraser', f: 'fill', r: 'rect', c: 'circle', l: 'line', s: 'select', m: 'move', z: 'zoom' };
      const toolKey = e.key.toLowerCase();
      if (map[toolKey]) {
        state.tool = map[toolKey];
        document.querySelectorAll('.tool-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tool === state.tool);
        });
        setCursorStyle();
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === ' ') { e.preventDefault(); state.playing ? stopPlay() : startPlay(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); goToFrame(state.currentFrame + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stopPlay(); goToFrame(state.currentFrame - 1); }
    });

    // Dropdown menus
    document.querySelectorAll('.smenu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuId = 'menu' + btn.dataset.menu.charAt(0).toUpperCase() + btn.dataset.menu.slice(1);
        const dropdown = document.getElementById(menuId);
        if (!dropdown) return;
        const isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.smenu-dropdown').forEach(d => d.classList.remove('open'));
        if (!isOpen) dropdown.classList.add('open');
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.smenu-dropdown').forEach(d => d.classList.remove('open'));
    });

    // Scene management
    function addScene(name) {
      const sceneList = document.getElementById('sceneList');
      if (!sceneList) return;
      const idx = sceneList.querySelectorAll('.scene-item').length;
      const item = document.createElement('div');
      item.className = 'scene-item';
      item.dataset.scene = idx;
      item.innerHTML = `<span class="scene-thumb dim">S${idx + 1}</span><span>${name}</span>`;
      item.addEventListener('click', () => {
        document.querySelectorAll('.scene-item').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const sn = document.getElementById('sceneName');
        if (sn) sn.textContent = name;
      });
      sceneList.appendChild(item);
    }

    document.getElementById('btnAddScene')?.addEventListener('click', () => {
      const n = document.querySelectorAll('.scene-item').length + 1;
      const name = prompt('Scene name:', `Ep01_Shot00${n}`);
      if (name) addScene(name);
    });

    document.querySelectorAll('.scene-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.scene-item').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
      });
    });

    function imageDataToDataUrl(imageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);
      return tempCanvas.toDataURL('image/png');
    }

    function dataUrlToImageData(dataUrl) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = W;
          tempCanvas.height = H;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.fillStyle = '#ffffff';
          tempCtx.fillRect(0, 0, W, H);
          tempCtx.drawImage(img, 0, 0, W, H);
          resolve(tempCtx.getImageData(0, 0, W, H));
        };
        img.src = dataUrl;
      });
    }

    function getFrameCompositeDataUrl(frameIndex) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, W, H);
      layers.forEach((layer) => {
        if (!layer.visible) return;
        const frameData = layer.frames[frameIndex];
        if (!frameData) return;
        tempCtx.globalAlpha = layer.opacity;
        tempCtx.putImageData(frameData, 0, 0);
      });
      tempCtx.globalAlpha = 1;
      return tempCanvas.toDataURL('image/png');
    }

    function getSerializedState() {
      saveCurrentFrame();
      return {
        width: W,
        height: H,
        totalFrames: state.totalFrames,
        currentFrame: state.currentFrame,
        fps: state.fps,
        activeLayer: state.activeLayer,
        layers: layers.map((layer) => {
          const frames = {};
          for (let index = 0; index < state.totalFrames; index += 1) {
            if (layer.frames[index]) {
              frames[index] = imageDataToDataUrl(layer.frames[index]);
            }
          }
          return {
            name: layer.name,
            color: layer.color,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            keyframes: [...layer.keyframes],
            frames,
          };
        }),
      };
    }

    async function restoreSerializedState(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.layers)) return;
      state.totalFrames = Math.max(1, Math.min(300, snapshot.totalFrames || 24));
      state.currentFrame = Math.max(0, Math.min(snapshot.currentFrame || 0, state.totalFrames - 1));
      state.fps = snapshot.fps || 24;
      state.activeLayer = Math.max(0, Math.min(snapshot.activeLayer || 0, snapshot.layers.length - 1));
      layers.splice(0, layers.length);
      for (const layer of snapshot.layers) {
        const restored = makeLayer(layer.name, layer.color, layer.visible !== false);
        restored.locked = !!layer.locked;
        restored.opacity = layer.opacity ?? 1;
        restored.blendMode = layer.blendMode || 'source-over';
        restored.keyframes = new Set(layer.keyframes || [0]);
        for (const [frameIndex, dataUrl] of Object.entries(layer.frames || {})) {
          restored.frames[Number(frameIndex)] = await dataUrlToImageData(dataUrl);
        }
        layers.push(restored);
      }
      const fpsDisp = document.getElementById('fpsDisplay');
      const fpsSelect = document.getElementById('fpsSelect');
      const totalDisp = document.getElementById('totalFrameDisp');
      const totalInput = document.getElementById('totalFramesInput');
      if (fpsDisp) fpsDisp.textContent = state.fps;
      if (fpsSelect) fpsSelect.value = String(state.fps);
      if (totalDisp) totalDisp.textContent = state.totalFrames;
      if (totalInput) totalInput.value = String(state.totalFrames);
      renderLayers();
      renderTimeline();
      loadCurrentFrame();
    }

    window.__capStudioCore = {
      getSerializedState,
      restoreSerializedState,
      getFrameCompositeDataUrl,
      insertFrameAfterCurrent,
      goToFrame,
      undo,
      redo,
      getCurrentFrameIndex: () => state.currentFrame,
      getTotalFrames: () => state.totalFrames,
      setStatus,
    };

    // ─── Init ────────────────────────────────────────────────
    syncSwatches();
    setCursorStyle();
    renderLayers();
    renderTimeline();
    renderGrid();
    applyZoom();
    setStatus('Studio ready — P:pen B:brush E:eraser F:fill SPACE:play');
  }

  // Hook into section activation
  const origActivate = window._capActivateSection;

  function patchActivation() {
    // Called whenever the production section is shown
    const prod = document.getElementById('production');
    if (!prod) return;
    const observer = new MutationObserver(() => {
      if (prod.classList.contains('active')) {
        observer.disconnect();
        initStudio();
      }
    });
    observer.observe(prod, { attributes: true, attributeFilter: ['class'] });
    // Also init if already active on load
    if (prod.classList.contains('active')) initStudio();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchActivation);
  } else {
    patchActivation();
  }

  // Enhancement layer for global asset hub, additional tools, and audio pipeline.
  function initStudioEnhancements() {
    if (window.__capStudioEnhancerInitialized) return;
    const production = document.getElementById('production');
    const canvas = document.getElementById('mainCanvas');
    if (!production || !canvas) return;
    window.__capStudioEnhancerInitialized = true;

    const assetStoreKey = 'cap_studio_assets_v1';
    const autosaveKey = 'cap_studio_episode_autosave_v1';
    const audioRack = [];
    const sfxCategories = {
      'Animals': [
        ['Dog Bark', 'click'], ['Cat Meow', 'chime'], ['Wolf Howl', 'roar'], ['Lion Roar', 'roar'], ['Tiger Growl', 'roar'],
        ['Horse Neigh', 'whoosh-low'], ['Cow Moo', 'drone'], ['Sheep Bleat', 'confirm'], ['Bird Chirp', 'chime'], ['Eagle Cry', 'rise'],
        ['Owl Hoot', 'drone'], ['Snake Hiss', 'wind'], ['Frog Croak', 'pop'], ['Elephant Trumpet', 'thunder'], ['Monkey Chatter', 'glitch'],
      ],
      'Creatures & Monsters': [
        ['Monster Roar', 'roar'], ['Creature Snarl', 'roar'], ['Beast Charge', 'impact'], ['Dragon Growl', 'thunder'], ['Dragon Fire', 'fire'],
        ['Demon Scream', 'error'], ['Undead Moan', 'drone'], ['Kraken Call', 'boom'], ['Mutant Shriek', 'glitch'], ['Ghost Whisper', 'wind'],
      ],
      'Horror & Scary': [
        ['Heartbeat Tension', 'heart'], ['Dark Drone', 'drone'], ['Jump Scare Hit', 'boom'], ['Whispered Breath', 'wind'], ['Chain Drag', 'chain'],
        ['Door Creak', 'sheath'], ['Glass Scratch', 'error'], ['Reverse Swell', 'rise'], ['Distant Scream', 'roar'], ['Static Glitch', 'glitch'],
      ],
      'Explosions & Destruction': [
        ['Explosion Big', 'boom'], ['Explosion Medium', 'impact'], ['Explosion Distant', 'thunder'], ['Debris Fall', 'slam'], ['Building Crack', 'impact'],
        ['Stone Break', 'impact'], ['Metal Crash', 'slam'], ['Shockwave', 'whoosh-low'],
      ],
      'Powering Up & Energy': [
        ['Power Up Aura', 'charge'], ['Energy Surge', 'zap'], ['Super Mode Rise', 'rise'], ['Beam Charge', 'charge'], ['Beam Fire', 'zap'],
        ['Electric Arc', 'zap'], ['Energy Pulse', 'chime'], ['Core Overload', 'thunder'],
      ],
      'Magic & Fantasy': [
        ['Magic Cast', 'chime'], ['Rune Activate', 'portal'], ['Teleport Pop', 'pop'], ['Portal Open', 'portal'], ['Healing Glow', 'confirm'],
        ['Dark Spell', 'drone'], ['Summon Burst', 'boom'], ['Aura Pulse', 'chime'],
      ],
      'Weapons & Combat': [
        ['Sword Clash', 'clash'], ['Blade Unsheathe', 'sheath'], ['Arrow Release', 'whoosh'], ['Shield Block', 'impact'], ['Punch Hit', 'hit'],
        ['Kick Impact', 'impact'], ['Body Fall', 'slam'], ['Gun Shot Stylized', 'zap'],
      ],
      'Environment & Atmos': [
        ['Wind Atmos', 'wind'], ['Rain Loop', 'rain'], ['Thunder Strike', 'thunder'], ['Cave Drip', 'rain'], ['Forest Atmos', 'murmur'],
        ['Temple Ambience', 'wind'], ['Battlefield Ambience', 'murmur'], ['Crowd Murmur', 'murmur'], ['Water Splash', 'splash'],
      ],
      'UI & System': [
        ['UI Click', 'click'], ['UI Confirm', 'confirm'], ['System Alert', 'error'], ['Error Beep', 'error'], ['Notification Ping', 'chime'],
      ],
    };
    const defaultSfxPresets = Object.entries(sfxCategories).flatMap(([category, items]) =>
      items.map(([name, type]) => ({ name, type, category }))
    );

    const shapeCategories = {
      'Basic Geometric': ['rectangle', 'circle', 'ellipse', 'triangle', 'diamond', 'line'],
      'Polygons': ['pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon'],
      'Stars & Bursts': ['star', 'star-4', 'star-6', 'star-8', 'burst', 'sunburst'],
      'Arrows': ['arrow', 'double-arrow', 'curved-arrow', 'chevron', 'arrow-up', 'arrow-down'],
      'Callouts': ['speech', 'thought', 'label-tag', 'banner', 'ribbon'],
      'Nature': ['cloud', 'leaf', 'drop', 'wave', 'moon'],
      'Symbols': ['heart', 'lightning', 'cross', 'plus', 'infinity'],
      'Tech': ['chip', 'gear', 'hex-grid', 'target', 'reticle'],
    };

    const assets = loadAssets();

    function syncAssetsFromStore() {
      const latest = loadAssets();
      Object.keys(latest).forEach((key) => {
        assets[key] = latest[key];
      });
      refreshCounts();
      renderHubLists();
    }

    window.addEventListener('cap:assets-updated', syncAssetsFromStore);
    window.addEventListener('storage', (event) => {
      if (event.key === assetStoreKey) syncAssetsFromStore();
    });

    // Ensure default board visual state is white.
    const fillInput = document.getElementById('fillColor');
    if (fillInput) {
      fillInput.value = '#ffffff';
      fillInput.dispatchEvent(new Event('input'));
    }

    function loadAssets() {
      try {
        const parsed = JSON.parse(localStorage.getItem(assetStoreKey) || '{}');
        return {
          characters: parsed.characters || [],
          places: parsed.places || [],
          props: parsed.props || [],
          visualAssets: parsed.visualAssets || [],
          episodeProjects: parsed.episodeProjects || [],
          voices: parsed.voices || [],
          sfx: parsed.sfx || [],
          music: parsed.music || [],
          rigging: parsed.rigging || [],
          motion: parsed.motion || [],
          camera: parsed.camera || [],
          lipsync: parsed.lipsync || [],
          pipeline: parsed.pipeline || [],
          collab: parsed.collab || [],
          exportQueue: parsed.exportQueue || [],
          shapes: parsed.shapes || [],
        };
      } catch (_) {
        return {
          characters: [],
          places: [],
          props: [],
          visualAssets: [],
          episodeProjects: [],
          voices: [],
          sfx: [],
          music: [],
          rigging: [],
          motion: [],
          camera: [],
          lipsync: [],
          pipeline: [],
          collab: [],
          exportQueue: [],
          shapes: [],
        };
      }
    }

    function saveAssets() {
      localStorage.setItem(assetStoreKey, JSON.stringify(assets));
      refreshCounts();
    }

    function refreshCounts() {
      const assetCount =
        assets.characters.length + assets.places.length + assets.props.length +
        assets.rigging.length + assets.motion.length + assets.camera.length + assets.lipsync.length + assets.shapes.length + assets.visualAssets.length + assets.episodeProjects.length;
      const audioCount = assets.voices.length + assets.sfx.length + assets.music.length + audioRack.length;
      const a = document.getElementById('assetCountDisplay');
      const b = document.getElementById('audioCountDisplay');
      if (a) a.value = String(assetCount);
      if (b) b.value = String(audioCount);
    }

    // Asset hub drawer toggles.
    const fab = document.getElementById('assetHubFab');
    const drawer = document.getElementById('assetHubDrawer');
    const closeBtn = document.getElementById('assetHubClose');
    const openBtn = document.getElementById('btnOpenAssetHub');

    function toggleDrawer(forceOpen) {
      if (!drawer) return;
      const open = forceOpen !== undefined ? forceOpen : !drawer.classList.contains('open');
      drawer.classList.toggle('open', open);
    }

    fab?.addEventListener('click', () => toggleDrawer());
    closeBtn?.addEventListener('click', () => toggleDrawer(false));
    openBtn?.addEventListener('click', () => toggleDrawer(true));

    // Hub tabs.
    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.hubTab;
        document.querySelectorAll('.hub-tab').forEach((el) => el.classList.remove('active'));
        document.querySelectorAll('.hub-panel').forEach((panel) => panel.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('hubPanel-' + tab);
        if (panel) panel.classList.add('active');
      });
    });

    function addAsset(type, title, extra) {
      if (!title) return;
      assets[type].push({
        id: 'A' + Date.now() + Math.floor(Math.random() * 1000),
        title,
        meta: extra || 'Created in CAP Studio',
        status: 'pending',
        version: 1,
        createdAt: new Date().toISOString(),
      });
      saveAssets();
      renderHubLists();
    }

    function removeAsset(type, id) {
      assets[type] = assets[type].filter((it) => it.id !== id);
      saveAssets();
      renderHubLists();
    }

    function currentSceneName() {
      const sn = document.getElementById('sceneName');
      return sn ? sn.textContent : 'Current Scene';
    }

    function bindSceneItem(item, name) {
      item.addEventListener('click', () => {
        document.querySelectorAll('.scene-item').forEach((s) => s.classList.remove('active'));
        item.classList.add('active');
        const sn = document.getElementById('sceneName');
        if (sn) sn.textContent = name;
      });
    }

    function collectSceneMeta() {
      return [...document.querySelectorAll('#sceneList .scene-item')].map((item, index) => ({
        id: item.dataset.scene || String(index),
        name: item.textContent.trim().replace(/^S\d+/, '').trim(),
      }));
    }

    function renderSceneMeta(scenes) {
      const list = document.getElementById('sceneList');
      if (!list) return;
      list.innerHTML = '';
      scenes.forEach((scene, index) => {
        const item = document.createElement('div');
        item.className = 'scene-item' + (index === 0 ? ' active' : '');
        item.dataset.scene = scene.id || String(index);
        item.innerHTML = `<span class="scene-thumb ${index === 0 ? '' : 'dim'}">S${index + 1}</span><span>${scene.name}</span>`;
        bindSceneItem(item, scene.name);
        list.appendChild(item);
      });
      const sn = document.getElementById('sceneName');
      if (sn && scenes[0]) sn.textContent = scenes[0].name;
    }

    function addToAudioRack(label, category) {
      audioRack.push({ label, category });
      renderAudioRack();
      refreshCounts();
    }

    function renderAudioRack() {
      const rack = document.getElementById('audioRackList');
      if (!rack) return;
      rack.innerHTML = '';
      audioRack.forEach((it, idx) => {
        const chip = document.createElement('div');
        chip.className = 'audio-pill';
        chip.innerHTML = `<span>${it.category}: ${it.label}</span><button title="Remove">×</button>`;
        chip.querySelector('button').addEventListener('click', () => {
          audioRack.splice(idx, 1);
          renderAudioRack();
          refreshCounts();
        });
        rack.appendChild(chip);
      });
    }

    function renderSavedVisualAssets() {
      const grid = document.getElementById('savedVisualAssetsGrid');
      const count = document.getElementById('savedAssetsCount');
      if (!grid || !count) return;
      grid.innerHTML = '';
      count.textContent = `${assets.visualAssets.length} item${assets.visualAssets.length === 1 ? '' : 's'}`;
      if (!assets.visualAssets.length) {
        const empty = document.createElement('div');
        empty.className = 'asset-placeholder';
        empty.innerHTML = '<span>🖼️</span><p>No saved production assets yet</p>';
        grid.appendChild(empty);
        return;
      }
      assets.visualAssets.slice().reverse().forEach((item) => {
        const card = document.createElement('div');
        card.className = 'saved-asset-card';
        card.innerHTML = `
          <img class="saved-asset-thumb" src="${item.preview}" alt="${item.title}">
          <div class="saved-asset-body">
            <div class="saved-asset-title">${item.title}</div>
            <div class="saved-asset-sub">${item.meta}</div>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    function openProductionForEditing(payload) {
      const navItem = document.querySelector('.nav-item[data-section="production"]');
      if (navItem) navItem.click();
      restoreEpisodeProjectPayload(payload);
    }

    function renderSavedEpisodes() {
      const grid = document.getElementById('savedEpisodesGrid');
      const count = document.getElementById('savedEpisodesCount');
      if (!grid || !count) return;
      grid.innerHTML = '';
      count.textContent = `${assets.episodeProjects.length} episode${assets.episodeProjects.length === 1 ? '' : 's'}`;
      if (!assets.episodeProjects.length) {
        const empty = document.createElement('div');
        empty.className = 'asset-placeholder';
        empty.innerHTML = '<span>🎬</span><p>No saved editable episodes yet</p>';
        grid.appendChild(empty);
        return;
      }
      assets.episodeProjects.slice().reverse().forEach((item) => {
        const card = document.createElement('div');
        card.className = 'saved-asset-card';
        card.innerHTML = `
          <img class="saved-asset-thumb" src="${item.preview}" alt="${item.title}">
          <div class="saved-asset-body">
            <div class="saved-asset-title">${item.title}</div>
            <div class="saved-asset-sub">${item.meta}</div>
            <div class="saved-asset-actions">
              <button class="hub-mini-btn" data-action="edit">Edit</button>
              <button class="hub-mini-btn" data-action="delete">Delete</button>
            </div>
          </div>
        `;
        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
          openProductionForEditing(item.project);
        });
        card.querySelector('[data-action="delete"]').addEventListener('click', () => {
          assets.episodeProjects = assets.episodeProjects.filter((ep) => ep.id !== item.id);
          saveAssets();
          renderHubLists();
        });
        grid.appendChild(card);
      });
    }

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function loadImage(url) {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
      });
    }

    async function exportEpisodeVideo(payload, onProgress) {
      const snap = payload && payload.studioState;
      if (!snap || !window.MediaRecorder) {
        return null;
      }

      const fps = Math.max(8, Math.min(60, snap.fps || 24));
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = snap.width || 960;
      renderCanvas.height = snap.height || 540;
      const rctx = renderCanvas.getContext('2d');
      const stream = renderCanvas.captureStream(fps);

      const preferred = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      const frameImageCache = new Map();
      async function getFrameImage(url) {
        if (!url) return null;
        if (frameImageCache.has(url)) return frameImageCache.get(url);
        const img = await loadImage(url);
        frameImageCache.set(url, img);
        return img;
      }

      recorder.start();
      if (onProgress) onProgress(5, 'Starting frame render...');
      for (let frame = 0; frame < snap.totalFrames; frame += 1) {
        rctx.fillStyle = '#ffffff';
        rctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
        for (const layer of snap.layers) {
          if (layer.visible === false) continue;
          const source = layer.frames && (layer.frames[frame] || layer.frames[String(frame)]);
          if (!source) continue;
          const img = await getFrameImage(source);
          rctx.globalAlpha = layer.opacity ?? 1;
          rctx.drawImage(img, 0, 0, renderCanvas.width, renderCanvas.height);
        }
        rctx.globalAlpha = 1;
        if (onProgress) {
          const pct = 5 + Math.round(((frame + 1) / snap.totalFrames) * 75);
          onProgress(pct, `Rendering frame ${frame + 1} of ${snap.totalFrames}`);
        }
        await wait(1000 / fps);
      }

      const stopped = new Promise((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await stopped;

      const finalType = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: finalType });
      if (onProgress) onProgress(82, 'Render complete, preparing export...');
      return {
        blob,
        mimeType: finalType,
        extension: finalType.includes('mp4') ? 'mp4' : 'webm',
      };
    }

    function downloadBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }

    let ffmpegTranscoder = null;
    async function transcodeToMp4InBrowser(inputBlob, onProgress) {
      try {
        if (onProgress) onProgress(84, 'Loading MP4 transcoder...');
        setAutosaveStatus('Loading MP4 transcoder...');
        const ffmpegPkg = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
        const utilPkg = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
        const FFmpegCtor = ffmpegPkg.FFmpeg;
        const fetchFile = utilPkg.fetchFile;

        if (!ffmpegTranscoder) {
          ffmpegTranscoder = new FFmpegCtor();
          await ffmpegTranscoder.load({
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
          });
        }

        const inputName = 'episode-input.webm';
        const outputName = 'episode-output.mp4';
        if (onProgress) onProgress(88, 'Preparing transcode input...');
        await ffmpegTranscoder.writeFile(inputName, await fetchFile(inputBlob));
        if (onProgress) onProgress(92, 'Transcoding WEBM to MP4...');
        setAutosaveStatus('Transcoding to MP4...');
        await ffmpegTranscoder.exec([
          '-i', inputName,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-movflags', 'faststart',
          outputName,
        ]);
        const outputData = await ffmpegTranscoder.readFile(outputName);
        await ffmpegTranscoder.deleteFile(inputName);
        await ffmpegTranscoder.deleteFile(outputName);
        if (onProgress) onProgress(98, 'Finalizing MP4 file...');
        return new Blob([outputData], { type: 'video/mp4' });
      } catch (_) {
        return null;
      }
    }

    function buildEpisodeProjectPayload(titleOverride) {
      const core = window.__capStudioCore;
      const episodeTitle = document.getElementById('episodeTitle')?.value || 'Untitled Episode';
      return {
        version: 1,
        title: titleOverride || episodeTitle,
        savedAt: new Date().toISOString(),
        episodeTitle,
        shotTitle: document.getElementById('shotTitle')?.value || '',
        shotDuration: Number(document.getElementById('shotDuration')?.value || 24),
        shotStatus: document.getElementById('shotStatus')?.value || 'animating',
        scenes: collectSceneMeta(),
        audioRack: [...audioRack],
        vectorPaths: toolState.vectorPaths,
        studioState: core ? core.getSerializedState() : null,
      };
    }

    async function restoreEpisodeProjectPayload(payload) {
      if (!payload) return;
      const core = window.__capStudioCore;
      if (!core || !payload.studioState) return;
      if (document.getElementById('episodeTitle')) document.getElementById('episodeTitle').value = payload.episodeTitle || payload.title || 'Untitled Episode';
      if (document.getElementById('shotTitle')) document.getElementById('shotTitle').value = payload.shotTitle || 'Opening Sequence';
      if (document.getElementById('shotDuration')) document.getElementById('shotDuration').value = String(payload.shotDuration || 24);
      if (document.getElementById('shotStatus')) document.getElementById('shotStatus').value = payload.shotStatus || 'animating';
      renderSceneMeta(payload.scenes && payload.scenes.length ? payload.scenes : [{ id: '0', name: 'Ep01_Shot001' }]);
      audioRack.splice(0, audioRack.length, ...(payload.audioRack || []));
      toolState.vectorPaths = payload.vectorPaths || [];
      await core.restoreSerializedState(payload.studioState);
      redrawVector(false);
      renderAudioRack();
      renderFrameThumbStrip();
      setAutosaveStatus('Recovered episode project');
    }

    function setAutosaveStatus(message) {
      const el = document.getElementById('autosaveStatus');
      if (el) el.textContent = message;
    }

    let autosaveTimer = null;
    function runAutoSave() {
      try {
        const payload = buildEpisodeProjectPayload();
        localStorage.setItem(autosaveKey, JSON.stringify(payload));
        setAutosaveStatus('Autosaved ' + new Date().toLocaleTimeString());
      } catch (_) {
        setAutosaveStatus('Autosave failed');
      }
    }

    function scheduleAutoSave() {
      clearTimeout(autosaveTimer);
      setAutosaveStatus('Autosave pending...');
      autosaveTimer = setTimeout(runAutoSave, 1500);
    }

    function renderFrameThumbStrip() {
      const strip = document.getElementById('frameThumbStrip');
      const core = window.__capStudioCore;
      if (!strip || !core) return;
      strip.innerHTML = '';
      const total = core.getTotalFrames();
      const current = core.getCurrentFrameIndex();
      for (let frame = 0; frame < total; frame += 1) {
        const thumb = document.createElement('button');
        thumb.className = 'frame-thumb' + (frame === current ? ' active' : '');
        thumb.type = 'button';
        thumb.innerHTML = `<img src="${core.getFrameCompositeDataUrl(frame)}" alt="Frame ${frame + 1}"><span class="frame-thumb-label">${frame + 1}</span>`;
        thumb.addEventListener('click', () => {
          core.goToFrame(frame);
          renderFrameThumbStrip();
        });
        strip.appendChild(thumb);
      }
    }

    function renderList(type, targetId, canPreview) {
      const wrap = document.getElementById(targetId);
      if (!wrap) return;
      wrap.innerHTML = '';
      if (!assets[type].length) {
        const empty = document.createElement('div');
        empty.className = 'hub-item';
        empty.innerHTML = '<div><div class="hub-item-title">No items yet</div><div class="hub-item-sub">Use the + button to add</div></div>';
        wrap.appendChild(empty);
        return;
      }
      assets[type].forEach((item) => {
        const row = document.createElement('div');
        row.className = 'hub-item';
        row.innerHTML = `
          <div>
            <div class="hub-item-title">${item.title}</div>
            <div class="hub-item-sub">${item.meta}</div>
          </div>
          <div class="hub-item-actions">
            <button class="hub-mini-btn" data-action="link">Link</button>
            ${canPreview ? '<button class="hub-mini-btn" data-action="play">Play</button>' : ''}
            <button class="hub-mini-btn" data-action="del">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="link"]').addEventListener('click', () => {
          addToAudioRack(item.title, type.toUpperCase());
        });
        if (canPreview) {
          row.querySelector('[data-action="play"]').addEventListener('click', () => {
            if (type === 'voices') {
              speakPreview(item.title);
            } else {
              playSfxByName(item.title);
            }
          });
        }
        row.querySelector('[data-action="del"]').addEventListener('click', () => removeAsset(type, item.id));
        wrap.appendChild(row);
      });
    }

    function renderAdvancedList(type, targetId, options) {
      const wrap = document.getElementById(targetId);
      if (!wrap) return;
      wrap.innerHTML = '';
      const items = assets[type] || [];
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'hub-item';
        empty.innerHTML = '<div><div class="hub-item-title">No items yet</div><div class="hub-item-sub">Use actions above to add setup data</div></div>';
        wrap.appendChild(empty);
        return;
      }

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'hub-item';
        const status = item.status || 'pending';
        const badgeClass = status === 'approved' ? 'approved' : status === 'review' ? 'review' : 'pending';
        row.innerHTML = `
          <div>
            <div class="hub-item-title">${item.title} <span class="hub-badge ${badgeClass}">${status}</span></div>
            <div class="hub-item-sub">${item.meta || ''} · v${item.version || 1}</div>
          </div>
          <div class="hub-item-actions">
            ${options.review ? '<button class="hub-mini-btn" data-action="review">Review</button>' : ''}
            ${options.approve ? '<button class="hub-mini-btn" data-action="approve">Approve</button>' : ''}
            ${options.bump ? '<button class="hub-mini-btn" data-action="bump">+Ver</button>' : ''}
            ${options.link ? '<button class="hub-mini-btn" data-action="link">Link</button>' : ''}
            <button class="hub-mini-btn" data-action="del">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="del"]').addEventListener('click', () => {
          removeAsset(type, item.id);
        });
        if (options.link && row.querySelector('[data-action="link"]')) {
          row.querySelector('[data-action="link"]').addEventListener('click', () => {
            addToAudioRack(item.title, type.toUpperCase());
          });
        }
        if (options.bump && row.querySelector('[data-action="bump"]')) {
          row.querySelector('[data-action="bump"]').addEventListener('click', () => {
            item.version = (item.version || 1) + 1;
            saveAssets();
            renderHubLists();
          });
        }
        if (options.review && row.querySelector('[data-action="review"]')) {
          row.querySelector('[data-action="review"]').addEventListener('click', () => {
            item.status = 'review';
            saveAssets();
            renderHubLists();
          });
        }
        if (options.approve && row.querySelector('[data-action="approve"]')) {
          row.querySelector('[data-action="approve"]').addEventListener('click', () => {
            item.status = 'approved';
            saveAssets();
            renderHubLists();
          });
        }
        wrap.appendChild(row);
      });
    }

    function renderSfxPresets() {
      const wrap = document.getElementById('sfxPresetList');
      if (!wrap) return;
      wrap.innerHTML = '';
      Object.entries(sfxCategories).forEach(([category, items]) => {
        const cat = document.createElement('div');
        cat.className = 'hub-category-item';
        cat.innerHTML = `<span class="hub-category-name">${category}</span><span class="hub-category-count">${items.length} sounds</span>`;
        wrap.appendChild(cat);
        items.forEach(([name, type]) => {
          const row = document.createElement('div');
          row.className = 'hub-item';
          row.innerHTML = `
            <div>
              <div class="hub-item-title">${name}</div>
              <div class="hub-item-sub">${category} · ${type}</div>
            </div>
            <div class="hub-item-actions">
              <button class="hub-mini-btn" data-action="play">Play</button>
              <button class="hub-mini-btn" data-action="add">Add</button>
            </div>
          `;
          row.querySelector('[data-action="play"]').addEventListener('click', () => {
            playSynthSfx(type);
          });
          row.querySelector('[data-action="add"]').addEventListener('click', () => {
            addAsset('sfx', name, category + ' preset');
            addToAudioRack(name, category);
          });
          wrap.appendChild(row);
        });
      });
    }

    function renderShapeCategories() {
      const wrap = document.getElementById('shapeCategoryList');
      if (!wrap) return;
      wrap.innerHTML = '';
      Object.entries(shapeCategories).forEach(([category, shapes]) => {
        const row = document.createElement('div');
        row.className = 'hub-category-item';
        row.innerHTML = `<span class="hub-category-name">${category}</span><span class="hub-category-count">${shapes.length} shapes</span>`;
        wrap.appendChild(row);
      });
    }

    function renderHubLists() {
      renderList('characters', 'hubList-characters', false);
      renderList('places', 'hubList-places', false);
      renderList('props', 'hubList-props', false);
      renderList('voices', 'hubList-voices', true);
      renderList('sfx', 'hubList-sfx', true);
      renderList('music', 'hubList-music', false);
      renderAdvancedList('rigging', 'hubList-rigging', { bump: true, link: false, review: true, approve: true });
      renderAdvancedList('motion', 'hubList-motion', { bump: true, link: false, review: false, approve: false });
      renderAdvancedList('camera', 'hubList-camera', { bump: true, link: false, review: false, approve: false });
      renderAdvancedList('lipsync', 'hubList-lipsync', { bump: true, link: true, review: true, approve: true });
      renderAdvancedList('pipeline', 'hubList-pipeline', { bump: true, link: false, review: true, approve: true });
      renderAdvancedList('collab', 'hubList-collab', { bump: false, link: false, review: true, approve: true });
      renderAdvancedList('exportQueue', 'hubList-export', { bump: false, link: false, review: false, approve: false });
      renderAdvancedList('shapes', 'hubList-shapes', { bump: true, link: false, review: false, approve: false });
      renderSavedVisualAssets();
      renderSavedEpisodes();
    }

    function promptAsset(type, label) {
      const title = prompt('Add ' + label + ' name:');
      if (!title) return;
      const meta = prompt(label + ' notes (optional):', 'Linked to ' + currentSceneName());
      addAsset(type, title, meta || 'Linked to ' + currentSceneName());
    }

    document.getElementById('btnAddCharacter')?.addEventListener('click', () => promptAsset('characters', 'character'));
    document.getElementById('btnAddPlace')?.addEventListener('click', () => promptAsset('places', 'place'));
    document.getElementById('btnAddProp')?.addEventListener('click', () => promptAsset('props', 'prop'));
    document.getElementById('btnAddVoice')?.addEventListener('click', () => promptAsset('voices', 'voice over'));
    document.getElementById('btnAddSfx')?.addEventListener('click', () => promptAsset('sfx', 'sound effect'));
    document.getElementById('btnAddMusic')?.addEventListener('click', () => promptAsset('music', 'music track'));
    document.getElementById('btnQuickAddChar')?.addEventListener('click', () => promptAsset('characters', 'character'));
    document.getElementById('btnQuickAddPlace')?.addEventListener('click', () => promptAsset('places', 'place'));
    document.getElementById('btnAddShapePreset')?.addEventListener('click', () => promptAsset('shapes', 'shape preset'));

    // Advanced systems wiring.
    document.getElementById('btnAddBoneChain')?.addEventListener('click', () => {
      promptAsset('rigging', 'bone chain');
    });
    document.getElementById('btnAddIKTarget')?.addEventListener('click', () => {
      promptAsset('rigging', 'IK target');
    });
    document.getElementById('btnSavePose')?.addEventListener('click', () => {
      promptAsset('rigging', 'pose library set');
    });

    document.getElementById('btnAddTween')?.addEventListener('click', () => {
      promptAsset('motion', 'tween');
    });
    document.getElementById('btnAddCurve')?.addEventListener('click', () => {
      promptAsset('motion', 'graph curve');
    });
    document.getElementById('btnAddMotionPreset')?.addEventListener('click', () => {
      promptAsset('motion', 'motion preset');
    });

    document.getElementById('btnAddCamera')?.addEventListener('click', () => {
      promptAsset('camera', 'camera setup');
    });
    document.getElementById('btnAddCamKey')?.addEventListener('click', () => {
      promptAsset('camera', 'camera keyframe');
    });
    document.getElementById('btnAddShake')?.addEventListener('click', () => {
      promptAsset('camera', 'camera shake preset');
    });

    document.getElementById('btnAddDialogueLane')?.addEventListener('click', () => {
      promptAsset('lipsync', 'dialogue lane');
    });
    document.getElementById('btnAutoPhoneme')?.addEventListener('click', () => {
      addAsset('lipsync', 'Auto Phoneme Map', 'Generated for ' + currentSceneName());
    });
    document.getElementById('btnAddMouthSet')?.addEventListener('click', () => {
      promptAsset('lipsync', 'mouth shape set');
    });

    document.getElementById('btnAddTag')?.addEventListener('click', () => {
      const tag = prompt('Add pipeline tag (ex: character, realm, episode-1):');
      if (!tag) return;
      addAsset('pipeline', 'Tag: ' + tag, 'Indexed under pipeline');
    });
    document.getElementById('btnCreateVersion')?.addEventListener('click', () => {
      const target = prompt('Version target name:');
      if (!target) return;
      addAsset('pipeline', 'Version for ' + target, 'Snapshot from ' + currentSceneName());
    });
    document.getElementById('btnCreateDependency')?.addEventListener('click', () => {
      const dep = prompt('Dependency relation (ex: Scene A uses Character K):');
      if (!dep) return;
      addAsset('pipeline', 'Dependency', dep);
    });

    document.getElementById('btnAddCommentPin')?.addEventListener('click', () => {
      const text = prompt('Comment pin text:');
      if (!text) return;
      addAsset('collab', 'Comment Pin', text + ' @ frame ' + (document.getElementById('currentFrameDisp')?.textContent || '1'));
    });
    document.getElementById('btnRequestReview')?.addEventListener('click', () => {
      const reviewer = prompt('Request review from role/person:', 'Director');
      if (!reviewer) return;
      addAsset('collab', 'Review Requested', 'Assigned to ' + reviewer);
    });
    document.getElementById('btnApproveShot')?.addEventListener('click', () => {
      addAsset('collab', 'Shot Approved', 'Approved on ' + new Date().toLocaleString());
    });

    function queueExport(kind, details) {
      addAsset('exportQueue', kind, details);
    }

    document.getElementById('btnQueueMP4')?.addEventListener('click', () => {
      queueExport('MP4 Render', 'H.264 1080p queued from ' + currentSceneName());
    });
    document.getElementById('btnQueueSprite')?.addEventListener('click', () => {
      queueExport('Sprite Sheet', 'PNG atlas queued from frame range 1-' + (document.getElementById('totalFrameDisp')?.textContent || '24'));
    });
    document.getElementById('btnQueueEDL')?.addEventListener('click', () => {
      queueExport('EDL/XML', 'Editorial export queued for timeline handoff');
    });
    document.getElementById('btnDownloadProject')?.addEventListener('click', () => {
      const payload = {
        scene: currentSceneName(),
        exportedAt: new Date().toISOString(),
        assets,
        audioRack,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cap-studio-project.json';
      link.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnCreateTrailerCut')?.addEventListener('click', () => {
      const episodeTitle = document.getElementById('episodeTitle')?.value || 'Untitled Episode';
      addAsset('exportQueue', 'Trailer Cut', `${episodeTitle} trailer package queued from saved visual assets`);
    });

    const saveModal = document.getElementById('saveModal');
    const saveInput = document.getElementById('saveAssetName');
    const saveScope = document.getElementById('saveScope');
    const episodeFileInput = document.getElementById('episodeFileInput');
    const renderProgressWrap = document.getElementById('renderProgressWrap');
    const renderProgressLabel = document.getElementById('renderProgressLabel');
    const renderProgressPct = document.getElementById('renderProgressPct');
    const renderProgressBar = document.getElementById('renderProgressBar');

    function setRenderProgress(percent, label) {
      const pct = Math.max(0, Math.min(100, Math.round(percent)));
      if (renderProgressWrap) renderProgressWrap.classList.add('active');
      if (renderProgressBar) renderProgressBar.style.width = `${pct}%`;
      if (renderProgressPct) renderProgressPct.textContent = `${pct}%`;
      if (renderProgressLabel) renderProgressLabel.textContent = label || 'Rendering...';
    }

    function hideRenderProgress() {
      if (renderProgressWrap) renderProgressWrap.classList.remove('active');
      if (renderProgressBar) renderProgressBar.style.width = '0%';
      if (renderProgressPct) renderProgressPct.textContent = '0%';
      if (renderProgressLabel) renderProgressLabel.textContent = 'Preparing render...';
    }

    function openSaveModal() {
      if (!saveModal) return;
      if (saveInput) saveInput.value = document.getElementById('episodeTitle')?.value || `${currentSceneName()} Episode Save`;
      if (saveScope) saveScope.value = 'episode';
      hideRenderProgress();
      saveModal.classList.add('open');
      saveModal.setAttribute('aria-hidden', 'false');
    }
    function closeSaveModal() {
      if (!saveModal) return;
      saveModal.classList.remove('open');
      saveModal.setAttribute('aria-hidden', 'true');
    }

    function getCompositePreview() {
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;
      const pctx = previewCanvas.getContext('2d');
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      pctx.drawImage(canvas, 0, 0);
      const vectorLayer = document.querySelector('.vector-canvas');
      if (vectorLayer) pctx.drawImage(vectorLayer, 0, 0);
      return previewCanvas;
    }

    function saveToDevice() {
      const title = (saveInput?.value || 'Production Save').trim();
      if ((saveScope?.value || 'episode') === 'episode') {
        const payload = buildEpisodeProjectPayload(title);
        setAutosaveStatus('Rendering episode video...');
        setRenderProgress(2, 'Preparing episode render...');
        exportEpisodeVideo(payload, setRenderProgress).then(async (video) => {
          if (!video) {
            const fallbackBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            downloadBlob(fallbackBlob, `${title.replace(/\s+/g, '-').toLowerCase() || 'episode'}.json`);
            setAutosaveStatus('Video export unavailable; JSON saved');
            setRenderProgress(100, 'Saved JSON fallback');
            setTimeout(closeSaveModal, 800);
            return;
          }

          if (video.extension === 'mp4') {
            downloadBlob(video.blob, `${title.replace(/\s+/g, '-').toLowerCase() || 'episode'}.mp4`);
            setAutosaveStatus('Episode video exported as MP4');
            setRenderProgress(100, 'MP4 export complete');
            setTimeout(closeSaveModal, 800);
            return;
          }

          const transcodedMp4 = await transcodeToMp4InBrowser(video.blob, setRenderProgress);
          if (transcodedMp4) {
            downloadBlob(transcodedMp4, `${title.replace(/\s+/g, '-').toLowerCase() || 'episode'}.mp4`);
            setAutosaveStatus('Episode video exported as MP4');
            setRenderProgress(100, 'MP4 export complete');
            setTimeout(closeSaveModal, 800);
            return;
          }

          downloadBlob(video.blob, `${title.replace(/\s+/g, '-').toLowerCase() || 'episode'}.webm`);
          setAutosaveStatus('MP4 transcode unavailable; exported as WEBM');
          setRenderProgress(100, 'WEBM export complete');
          setTimeout(closeSaveModal, 900);
        }).catch(() => {
          setAutosaveStatus('Render failed');
          setRenderProgress(100, 'Render failed');
        });
      } else {
        const previewCanvas = getCompositePreview();
        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'production-frame'}.png`;
        link.href = previewCanvas.toDataURL('image/png');
        link.click();
        setRenderProgress(100, 'Frame export complete');
        setTimeout(closeSaveModal, 450);
      }
    }

    function saveToPlatform() {
      const title = (saveInput?.value || 'Production Save').trim();
      const previewCanvas = getCompositePreview();
      if ((saveScope?.value || 'episode') === 'episode') {
        const payload = buildEpisodeProjectPayload(title);
        assets.episodeProjects.push({
          id: 'EP' + Date.now(),
          title,
          preview: previewCanvas.toDataURL('image/png'),
          meta: `${payload.episodeTitle} · ${payload.scenes.length} scenes · ${payload.studioState ? payload.studioState.totalFrames : 0} frames`,
          project: payload,
          createdAt: new Date().toISOString(),
        });
        assets.visualAssets.push({
          id: 'VA' + Date.now(),
          title: `${title} Master Preview`,
          preview: previewCanvas.toDataURL('image/png'),
          meta: `${payload.episodeTitle} · Episode package saved from Production`,
          createdAt: new Date().toISOString(),
        });
        addAsset('exportQueue', 'Platform Episode Save', `${title} saved to platform for mastering, trailers, and seasons`);
        setAutosaveStatus('Episode saved to platform (editable)');
      } else {
        assets.visualAssets.push({
          id: 'VA' + Date.now(),
          title,
          preview: previewCanvas.toDataURL('image/png'),
          meta: `${currentSceneName()} · Frame ${document.getElementById('currentFrameDisp')?.textContent || '1'} · Saved from Production`,
          createdAt: new Date().toISOString(),
        });
        addAsset('exportQueue', 'Platform Save', `${title} saved to Visual Assets for mastering/trailers`);
      }
      saveAssets();
      renderHubLists();
      closeSaveModal();
    }

    document.getElementById('btnSaveTop')?.addEventListener('click', openSaveModal);
    document.getElementById('btnSaveTimeline')?.addEventListener('click', openSaveModal);
    document.getElementById('btnSaveEpisodeNow')?.addEventListener('click', openSaveModal);
    document.getElementById('btnCloseSaveModal')?.addEventListener('click', closeSaveModal);
    document.getElementById('btnSaveDevice')?.addEventListener('click', saveToDevice);
    document.getElementById('btnSavePlatform')?.addEventListener('click', saveToPlatform);
    saveModal?.addEventListener('click', (event) => {
      if (event.target === saveModal) closeSaveModal();
    });
    document.getElementById('btnRecoverAutosave')?.addEventListener('click', async () => {
      const raw = localStorage.getItem(autosaveKey);
      if (!raw) {
        setAutosaveStatus('No autosave found');
        return;
      }
      await restoreEpisodeProjectPayload(JSON.parse(raw));
    });
    document.getElementById('btnDownloadEpisode')?.addEventListener('click', () => {
      const payload = buildEpisodeProjectPayload(document.getElementById('episodeTitle')?.value || 'Untitled Episode');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${(payload.title || 'episode').replace(/\s+/g, '-').toLowerCase()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
    document.getElementById('btnLoadEpisode')?.addEventListener('click', () => {
      episodeFileInput?.click();
    });
    episodeFileInput?.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const text = await file.text();
      await restoreEpisodeProjectPayload(JSON.parse(text));
      event.target.value = '';
    });

    ['episodeTitle', 'shotTitle', 'shotDuration', 'shotStatus'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', scheduleAutoSave);
    });
    document.getElementById('btnAddScene')?.addEventListener('click', scheduleAutoSave);
    document.getElementById('btnAddFrame')?.addEventListener('click', () => { scheduleAutoSave(); renderFrameThumbStrip(); });
    document.getElementById('btnAddFrameTop')?.addEventListener('click', () => { scheduleAutoSave(); renderFrameThumbStrip(); });
    document.getElementById('btnUndo')?.addEventListener('click', () => { scheduleAutoSave(); renderFrameThumbStrip(); });
    document.getElementById('btnUndoTop')?.addEventListener('click', () => { scheduleAutoSave(); renderFrameThumbStrip(); });
    document.getElementById('btnRedo')?.addEventListener('click', () => { scheduleAutoSave(); renderFrameThumbStrip(); });
    canvas.addEventListener('mouseup', () => { scheduleAutoSave(); renderFrameThumbStrip(); }, true);
    canvas.addEventListener('touchend', () => { scheduleAutoSave(); renderFrameThumbStrip(); }, true);
    new MutationObserver(() => renderFrameThumbStrip()).observe(document.getElementById('currentFrameDisp'), { childList: true, subtree: true, characterData: true });
    new MutationObserver(() => renderFrameThumbStrip()).observe(document.getElementById('totalFrameDisp'), { childList: true, subtree: true, characterData: true });

    const initialAutosave = localStorage.getItem(autosaveKey);
    if (initialAutosave) {
      setAutosaveStatus('Autosave available');
    }

    // Additional tools: text and eyedropper.
    document.addEventListener('keydown', (e) => {
      if (!production.classList.contains('active')) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      const map = { t: 'text', i: 'eyedropper', o: 'lasso', k: 'path', n: 'node', g: 'shape' };
      if (!map[key]) return;
      const wanted = map[key];
      document.querySelectorAll('.tool-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tool === wanted);
      });
    });

    const overlay = document.getElementById('overlayCanvas');
    const overlayCtx = overlay ? overlay.getContext('2d') : null;
    const shapePicker = document.getElementById('shapePicker');
    const toolState = {
      selectedShape: shapePicker ? shapePicker.value : 'rectangle',
      lassoPoints: [],
      lassoDrawing: false,
      lassoSelection: null,
      lassoDragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      vectorPaths: [],
      pathDrawing: false,
      activePathIndex: -1,
      activeNodeIndex: -1,
      nodeDragging: false,
    };

    const vectorCanvas = document.createElement('canvas');
    vectorCanvas.width = canvas.width;
    vectorCanvas.height = canvas.height;
    vectorCanvas.className = 'vector-canvas';
    overlay?.parentElement?.insertBefore(vectorCanvas, overlay);
    const vectorCtx = vectorCanvas.getContext('2d');

    shapePicker?.addEventListener('change', () => {
      toolState.selectedShape = shapePicker.value;
    });

    function pos(evt) {
      const rect = canvas.getBoundingClientRect();
      const cx = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const cy = evt.touches ? evt.touches[0].clientY : evt.clientY;
      return { x: (cx - rect.left) * canvas.width / rect.width, y: (cy - rect.top) * canvas.height / rect.height };
    }

    function pointInPolygon(px, py, points) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;
        const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-6) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function drawShape(ctx2d, name, x, y, size, stroke, fill) {
      const r = Math.max(12, size * 3.2);
      ctx2d.save();
      ctx2d.strokeStyle = stroke;
      ctx2d.fillStyle = fill;
      ctx2d.lineWidth = Math.max(1, size / 1.5);
      ctx2d.beginPath();
      if (name === 'rectangle') {
        ctx2d.rect(x - r, y - r * 0.7, r * 2, r * 1.4);
      } else if (name === 'circle') {
        ctx2d.arc(x, y, r, 0, Math.PI * 2);
      } else if (name === 'ellipse') {
        ctx2d.ellipse(x, y, r * 1.2, r * 0.75, 0, 0, Math.PI * 2);
      } else if (name === 'triangle') {
        ctx2d.moveTo(x, y - r); ctx2d.lineTo(x + r, y + r); ctx2d.lineTo(x - r, y + r); ctx2d.closePath();
      } else if (name === 'diamond') {
        ctx2d.moveTo(x, y - r); ctx2d.lineTo(x + r, y); ctx2d.lineTo(x, y + r); ctx2d.lineTo(x - r, y); ctx2d.closePath();
      } else if (name === 'star' || name === 'star-4' || name === 'star-6' || name === 'star-8' || name === 'burst' || name === 'sunburst') {
        const spikes = name === 'star-4' ? 4 : name === 'star-6' ? 6 : name === 'star-8' ? 8 : name === 'sunburst' ? 20 : name === 'burst' ? 14 : 5;
        const inner = name === 'sunburst' ? r * 0.25 : r * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const rr = i % 2 ? inner : r;
          const a = i * Math.PI / spikes - Math.PI / 2;
          const px = x + Math.cos(a) * rr;
          const py = y + Math.sin(a) * rr;
          if (i === 0) ctx2d.moveTo(px, py); else ctx2d.lineTo(px, py);
        }
        ctx2d.closePath();
      } else if (name === 'heart') {
        ctx2d.moveTo(x, y + r * 0.7);
        ctx2d.bezierCurveTo(x - r * 1.2, y, x - r, y - r, x, y - r * 0.2);
        ctx2d.bezierCurveTo(x + r, y - r, x + r * 1.2, y, x, y + r * 0.7);
      } else if (name === 'cloud') {
        ctx2d.arc(x - r * 0.45, y, r * 0.42, Math.PI * 0.5, Math.PI * 1.5);
        ctx2d.arc(x, y - r * 0.2, r * 0.55, Math.PI, 0);
        ctx2d.arc(x + r * 0.55, y, r * 0.42, Math.PI * 1.5, Math.PI * 0.5);
        ctx2d.closePath();
      } else if (name === 'arrow' || name === 'double-arrow' || name === 'curved-arrow' || name === 'arrow-up' || name === 'arrow-down' || name === 'chevron') {
        if (name === 'arrow-up') {
          ctx2d.moveTo(x, y - r); ctx2d.lineTo(x + r * 0.55, y + r * 0.2); ctx2d.lineTo(x + r * 0.2, y + r * 0.2); ctx2d.lineTo(x + r * 0.2, y + r); ctx2d.lineTo(x - r * 0.2, y + r); ctx2d.lineTo(x - r * 0.2, y + r * 0.2); ctx2d.lineTo(x - r * 0.55, y + r * 0.2); ctx2d.closePath();
        } else if (name === 'arrow-down') {
          ctx2d.moveTo(x, y + r); ctx2d.lineTo(x + r * 0.55, y - r * 0.2); ctx2d.lineTo(x + r * 0.2, y - r * 0.2); ctx2d.lineTo(x + r * 0.2, y - r); ctx2d.lineTo(x - r * 0.2, y - r); ctx2d.lineTo(x - r * 0.2, y - r * 0.2); ctx2d.lineTo(x - r * 0.55, y - r * 0.2); ctx2d.closePath();
        } else if (name === 'double-arrow') {
          ctx2d.moveTo(x - r, y); ctx2d.lineTo(x - r * 0.45, y - r * 0.45); ctx2d.lineTo(x - r * 0.45, y - r * 0.2); ctx2d.lineTo(x + r * 0.45, y - r * 0.2); ctx2d.lineTo(x + r * 0.45, y - r * 0.45); ctx2d.lineTo(x + r, y); ctx2d.lineTo(x + r * 0.45, y + r * 0.45); ctx2d.lineTo(x + r * 0.45, y + r * 0.2); ctx2d.lineTo(x - r * 0.45, y + r * 0.2); ctx2d.lineTo(x - r * 0.45, y + r * 0.45); ctx2d.closePath();
        } else if (name === 'chevron') {
          ctx2d.moveTo(x - r * 0.8, y - r * 0.8); ctx2d.lineTo(x + r * 0.1, y); ctx2d.lineTo(x - r * 0.8, y + r * 0.8); ctx2d.lineTo(x - r * 0.4, y + r * 0.8); ctx2d.lineTo(x + r * 0.5, y); ctx2d.lineTo(x - r * 0.4, y - r * 0.8); ctx2d.closePath();
        } else {
          ctx2d.moveTo(x - r, y - r * 0.25); ctx2d.lineTo(x + r * 0.25, y - r * 0.25); ctx2d.lineTo(x + r * 0.25, y - r * 0.55); ctx2d.lineTo(x + r, y); ctx2d.lineTo(x + r * 0.25, y + r * 0.55); ctx2d.lineTo(x + r * 0.25, y + r * 0.25); ctx2d.lineTo(x - r, y + r * 0.25); ctx2d.closePath();
        }
      } else if (name === 'speech' || name === 'thought') {
        const rx = x - r * 1.1;
        const ry = y - r * 0.7;
        const rw = r * 2.2;
        const rh = r * 1.4;
        const cr = 12;
        ctx2d.moveTo(rx + cr, ry);
        ctx2d.lineTo(rx + rw - cr, ry);
        ctx2d.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr);
        ctx2d.lineTo(rx + rw, ry + rh - cr);
        ctx2d.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh);
        ctx2d.lineTo(rx + cr, ry + rh);
        ctx2d.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr);
        ctx2d.lineTo(rx, ry + cr);
        ctx2d.quadraticCurveTo(rx, ry, rx + cr, ry);
        if (name === 'speech') {
          ctx2d.moveTo(x - r * 0.1, y + r * 0.7); ctx2d.lineTo(x + r * 0.15, y + r * 1.05); ctx2d.lineTo(x + r * 0.35, y + r * 0.7);
        } else {
          ctx2d.moveTo(x + r * 0.55, y + r * 0.7); ctx2d.arc(x + r * 0.75, y + r * 0.92, r * 0.12, 0, Math.PI * 2);
          ctx2d.moveTo(x + r * 0.95, y + r * 1.14); ctx2d.arc(x + r * 1.05, y + r * 1.2, r * 0.08, 0, Math.PI * 2);
        }
      } else {
        const sides = { pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }[name] || 6;
        for (let i = 0; i < sides; i++) {
          const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (i === 0) ctx2d.moveTo(px, py); else ctx2d.lineTo(px, py);
        }
        ctx2d.closePath();
      }
      ctx2d.fill();
      ctx2d.stroke();
      ctx2d.restore();
    }

    function drawOverlayLasso(points) {
      if (!overlayCtx) return;
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
      if (!points.length) return;
      overlayCtx.save();
      overlayCtx.setLineDash([8, 4]);
      overlayCtx.strokeStyle = '#38bdf8';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.beginPath();
      overlayCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) overlayCtx.lineTo(points[i].x, points[i].y);
      overlayCtx.stroke();
      overlayCtx.restore();
    }

    function redrawVector(showNodes) {
      if (!vectorCtx) return;
      vectorCtx.clearRect(0, 0, vectorCanvas.width, vectorCanvas.height);
      toolState.vectorPaths.forEach((path, idx) => {
        if (path.points.length < 2) return;
        vectorCtx.save();
        vectorCtx.strokeStyle = path.color;
        vectorCtx.lineWidth = path.size;
        vectorCtx.lineCap = 'round';
        vectorCtx.lineJoin = 'round';
        vectorCtx.beginPath();
        vectorCtx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) vectorCtx.lineTo(path.points[i].x, path.points[i].y);
        vectorCtx.stroke();
        if (showNodes && idx === toolState.activePathIndex) {
          vectorCtx.fillStyle = '#38bdf8';
          path.points.forEach((p) => {
            vectorCtx.beginPath();
            vectorCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            vectorCtx.fill();
          });
        }
        vectorCtx.restore();
      });
    }

    function nearestNode(x, y) {
      let best = null;
      toolState.vectorPaths.forEach((path, pi) => {
        path.points.forEach((pt, ni) => {
          const d = Math.hypot(pt.x - x, pt.y - y);
          if (d < 12 && (!best || d < best.d)) best = { pi, ni, d };
        });
      });
      return best;
    }

    canvas.addEventListener('mousedown', (e) => {
      const activeTool = document.querySelector('.tool-btn.active')?.dataset.tool;
      if (!['text', 'eyedropper', 'shape', 'lasso', 'path', 'node'].includes(activeTool)) return;
      e.preventDefault();
      e.stopImmediatePropagation();

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      const c2d = canvas.getContext('2d');

      if (activeTool === 'eyedropper') {
        const px = c2d.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        const color = '#' + [px[0], px[1], px[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
        const stroke = document.getElementById('strokeColor');
        if (stroke) {
          stroke.value = color;
          stroke.dispatchEvent(new Event('input'));
        }
      }

      if (activeTool === 'text') {
        const text = prompt('Enter text for this frame:');
        if (!text) return;
        const color = document.getElementById('strokeColor')?.value || '#111111';
        const size = Number(document.getElementById('brushSize')?.value || 16);
        c2d.fillStyle = color;
        c2d.font = `${Math.max(12, size * 3)}px Inter, sans-serif`;
        c2d.fillText(text, x, y);
      }

      if (activeTool === 'shape') {
        const stroke = document.getElementById('strokeColor')?.value || '#38bdf8';
        const fill = document.getElementById('fillColor')?.value || '#ffffff';
        const size = Number(document.getElementById('brushSize')?.value || 6);
        drawShape(c2d, toolState.selectedShape, x, y, size, stroke, fill + 'cc');
      }

      if (activeTool === 'lasso') {
        if (toolState.lassoSelection) {
          const s = toolState.lassoSelection;
          if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
            toolState.lassoDragging = true;
            toolState.dragOffsetX = x - s.x;
            toolState.dragOffsetY = y - s.y;
            return;
          }
        }
        toolState.lassoDrawing = true;
        toolState.lassoPoints = [{ x, y }];
        drawOverlayLasso(toolState.lassoPoints);
      }

      if (activeTool === 'path') {
        const stroke = document.getElementById('strokeColor')?.value || '#38bdf8';
        const size = Number(document.getElementById('brushSize')?.value || 3);
        toolState.pathDrawing = true;
        toolState.vectorPaths.push({ color: stroke, size, points: [{ x, y }] });
        toolState.activePathIndex = toolState.vectorPaths.length - 1;
        redrawVector(false);
      }

      if (activeTool === 'node') {
        const hit = nearestNode(x, y);
        if (hit) {
          toolState.activePathIndex = hit.pi;
          toolState.activeNodeIndex = hit.ni;
          toolState.nodeDragging = true;
          redrawVector(true);
        }
      }
    }, true);

    canvas.addEventListener('mousemove', (e) => {
      const activeTool = document.querySelector('.tool-btn.active')?.dataset.tool;
      if (!['lasso', 'path', 'node'].includes(activeTool)) return;
      const p = pos(e);

      if (activeTool === 'lasso' && toolState.lassoDrawing) {
        toolState.lassoPoints.push(p);
        drawOverlayLasso(toolState.lassoPoints);
      }

      if (activeTool === 'lasso' && toolState.lassoDragging && toolState.lassoSelection) {
        const s = toolState.lassoSelection;
        s.x = p.x - toolState.dragOffsetX;
        s.y = p.y - toolState.dragOffsetY;
        canvas.getContext('2d').putImageData(s.base, 0, 0);
        canvas.getContext('2d').putImageData(s.cut, Math.round(s.x), Math.round(s.y));
        if (overlayCtx && s.path.length) {
          const dx = s.x - s.ox;
          const dy = s.y - s.oy;
          drawOverlayLasso(s.path.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })));
        }
      }

      if (activeTool === 'path' && toolState.pathDrawing && toolState.activePathIndex >= 0) {
        const path = toolState.vectorPaths[toolState.activePathIndex];
        const last = path.points[path.points.length - 1];
        if (Math.hypot(last.x - p.x, last.y - p.y) > 4) {
          path.points.push(p);
          redrawVector(false);
        }
      }

      if (activeTool === 'node' && toolState.nodeDragging && toolState.activePathIndex >= 0 && toolState.activeNodeIndex >= 0) {
        const path = toolState.vectorPaths[toolState.activePathIndex];
        path.points[toolState.activeNodeIndex] = p;
        redrawVector(true);
      }
    }, true);

    canvas.addEventListener('mouseup', (e) => {
      const activeTool = document.querySelector('.tool-btn.active')?.dataset.tool;
      if (!['lasso', 'path', 'node'].includes(activeTool)) return;
      const p = pos(e);

      if (activeTool === 'lasso' && toolState.lassoDrawing && toolState.lassoPoints.length > 2) {
        toolState.lassoDrawing = false;
        toolState.lassoPoints.push(toolState.lassoPoints[0]);
        const xs = toolState.lassoPoints.map((pt) => pt.x);
        const ys = toolState.lassoPoints.map((pt) => pt.y);
        const minX = Math.max(0, Math.floor(Math.min(...xs)));
        const minY = Math.max(0, Math.floor(Math.min(...ys)));
        const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
        const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
        const w = Math.max(1, maxX - minX);
        const h = Math.max(1, maxY - minY);
        const c2d = canvas.getContext('2d');
        const full = c2d.getImageData(0, 0, canvas.width, canvas.height);
        const cut = c2d.getImageData(minX, minY, w, h);
        const base = c2d.getImageData(0, 0, canvas.width, canvas.height);
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const gx = minX + xx;
            const gy = minY + yy;
            const srcI = (yy * w + xx) * 4;
            const dstI = (gy * canvas.width + gx) * 4;
            if (!pointInPolygon(gx, gy, toolState.lassoPoints)) {
              cut.data[srcI + 3] = 0;
            } else {
              base.data[dstI] = 255;
              base.data[dstI + 1] = 255;
              base.data[dstI + 2] = 255;
              base.data[dstI + 3] = 255;
            }
          }
        }
        c2d.putImageData(base, 0, 0);
        c2d.putImageData(cut, minX, minY);
        toolState.lassoSelection = { x: minX, y: minY, w, h, ox: minX, oy: minY, cut, base, path: toolState.lassoPoints.slice() };
        drawOverlayLasso(toolState.lassoPoints);
      }

      if (activeTool === 'lasso' && toolState.lassoDragging) {
        toolState.lassoDragging = false;
      }

      if (activeTool === 'path' && toolState.pathDrawing) {
        toolState.pathDrawing = false;
        redrawVector(false);
      }

      if (activeTool === 'node' && toolState.nodeDragging) {
        toolState.nodeDragging = false;
        redrawVector(true);
      }
    }, true);

    // Extra menu items and toggles not previously wired.
    document.getElementById('btnToggleOnion')?.addEventListener('click', () => {
      const check = document.getElementById('onionCheck');
      if (!check) return;
      check.checked = !check.checked;
      check.dispatchEvent(new Event('change'));
    });

    document.getElementById('btnSelectAll')?.addEventListener('click', () => {
      const overlay = document.getElementById('overlayCanvas');
      if (!overlay) return;
      const o2d = overlay.getContext('2d');
      o2d.save();
      o2d.clearRect(0, 0, overlay.width, overlay.height);
      o2d.strokeStyle = '#38bdf8';
      o2d.setLineDash([8, 5]);
      o2d.strokeRect(1, 1, overlay.width - 2, overlay.height - 2);
      o2d.restore();
      setTimeout(() => {
        o2d.clearRect(0, 0, overlay.width, overlay.height);
      }, 220);
    });

    // Fullscreen viewport helper.
    document.getElementById('btnFullscreen')?.addEventListener('click', () => {
      const wrap = document.getElementById('canvasContainer');
      if (!wrap) return;
      if (!document.fullscreenElement) {
        wrap.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    function playSfxByName(name) {
      const preset = defaultSfxPresets.find((p) => p.name === name);
      if (preset) {
        playSynthSfx(preset.type);
      } else {
        playSynthSfx('click');
      }
    }

    function speakPreview(text) {
      if (!window.speechSynthesis) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1;
      utter.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }

    function playSynthSfx(type) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ac = new AudioCtx();
      const out = ac.createGain();
      out.gain.value = 0.2;
      out.connect(ac.destination);

      if (['rain', 'murmur', 'wind'].includes(type)) {
        const buffer = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const noise = ac.createBufferSource();
        const filter = ac.createBiquadFilter();
        filter.type = type === 'rain' ? 'highpass' : 'lowpass';
        filter.frequency.value = type === 'rain' ? 1400 : 700;
        noise.buffer = buffer;
        noise.connect(filter);
        filter.connect(out);
        noise.start();
        noise.stop(ac.currentTime + 0.5);
        return;
      }

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(out);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.001, ac.currentTime);

      const end = ac.currentTime + 0.35;
      const profiles = {
        whoosh: [1200, 200],
        'whoosh-low': [600, 110],
        clash: [950, 300],
        sheath: [250, 800],
        hit: [220, 80],
        impact: [180, 65],
        boom: [140, 40],
        fire: [700, 220],
        zap: [1800, 280],
        thunder: [300, 55],
        charge: [260, 1300],
        chime: [500, 1200],
        portal: [300, 1600],
        pop: [1400, 900],
        step: [210, 130],
        'step-metal': [300, 250],
        slam: [260, 70],
        click: [1200, 700],
        confirm: [840, 1200],
        error: [600, 300],
        heart: [90, 90],
        drone: [110, 130],
        rise: [220, 1900],
        glitch: [1500, 350],
        roar: [95, 55],
        chain: [500, 200],
        splash: [650, 180],
      };
      const [startF, endF] = profiles[type] || [500, 200];
      osc.frequency.setValueAtTime(startF, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endF), end);
      gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.start();
      osc.stop(end);
    }

    renderHubLists();
    renderSfxPresets();
    renderShapeCategories();
    renderAudioRack();
    renderFrameThumbStrip();
    refreshCounts();
    scheduleAutoSave();
  }

  function initEnhancementsWhenReady() {
    const prod = document.getElementById('production');
    if (!prod) return;
    const ob = new MutationObserver(() => {
      if (prod.classList.contains('active')) {
        initStudioEnhancements();
      }
    });
    ob.observe(prod, { attributes: true, attributeFilter: ['class'] });
    if (prod.classList.contains('active')) initStudioEnhancements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancementsWhenReady);
  } else {
    initEnhancementsWhenReady();
  }

})();
