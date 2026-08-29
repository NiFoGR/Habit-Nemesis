// Progress photo: shoot against a ghost of last month's, then align.
// The transform is baked into the saved image, so compare needs no extra state.

import { icon } from '../icons.js';
import { escapeHtml, toast } from '../ui.js';

const OUT_MAX = 1600;

/** `ghostBlob` is the previous photo, or null on the first shot. */
export function captureWithGhost(mount, ghostBlob, onDone, onCancel) {
  const ghostUrl = ghostBlob ? URL.createObjectURL(ghostBlob) : null;
  let stream = null;
  let opacity = 0.45;
  // getUserMedia can resolve long after the user has moved on, so anything
  // touching the DOM after an await checks it is still the screen on the page.
  let generation = 0;

  const cleanup = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };
  const finish = (fn) => {
    cleanup();
    if (ghostUrl) URL.revokeObjectURL(ghostUrl);
    fn();
  };

  async function live() {
    const mine = ++generation;
    mount.innerHTML = `
      <div class="screen cam-screen">
        <header class="screen-head">
          <button class="icon-btn" data-back id="cancel" aria-label="Back">${icon('back')}</button>
          <h1>Progress photo</h1>
          <span class="icon-btn ghost"></span>
        </header>

        <div class="cam-stage">
          <video id="vid" playsinline muted autoplay></video>
          ${ghostUrl ? `<img id="ghost" class="cam-ghost" src="${ghostUrl}" alt="" style="opacity:${opacity}">` : ''}
          <div class="cam-guides"><i></i><i></i></div>
        </div>

        ${ghostUrl ? `<label class="slider-row"><span>Ghost of last month</span><b id="opOut">${Math.round(opacity * 100)}%</b></label>
        <input type="range" id="op" min="0" max="80" step="5" value="${opacity * 100}">` : ''}

        <p class="small muted centre">${ghostUrl ? 'Line yourself up with the faint image, then shoot.' : 'Same distance and angle every month. The next shot will overlay this one.'}</p>

        <button class="btn primary big" id="shoot">${icon('camera', 18)}<span>Capture</span></button>
        <button class="btn ghost" id="pick">Choose a file instead</button>
        <input type="file" id="file" accept="image/*" hidden>
      </div>`;

    mount.querySelector('#cancel').addEventListener('click', () => finish(onCancel));
    const file = mount.querySelector('#file');
    mount.querySelector('#pick').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f) finish(() => align(f));
    });

    const op = mount.querySelector('#op');
    op?.addEventListener('input', () => {
      opacity = Number(op.value) / 100;
      mount.querySelector('#ghost').style.opacity = String(opacity);
      mount.querySelector('#opOut').textContent = `${op.value}%`;
    });

    const vid = mount.querySelector('#vid');
    mount.querySelector('#shoot').addEventListener('click', () => {
      if (!stream) return toast('No camera. Choose a file instead.');
      const c = document.createElement('canvas');
      c.width = vid.videoWidth;
      c.height = vid.videoHeight;
      c.getContext('2d').drawImage(vid, 0, 0);
      c.toBlob((blob) => finish(() => align(blob)), 'image/jpeg', 0.92);
    });

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
        audio: false,
      });
      if (mine !== generation) {
        s.getTracks().forEach((t) => t.stop()); // we already left this screen
        return;
      }
      stream = s;
      vid.srcObject = s;
    } catch {
      // No camera: the file picker still works.
      if (mine !== generation) return;
      const stage = mount.querySelector('.cam-stage');
      if (stage) stage.innerHTML = '<div class="cam-fallback">Camera unavailable. Choose a file instead.</div>';
    }
  }

  /* ---------------- alignment ---------------- */

  /** Pan and zoom against the ghost. */
  function align(sourceBlob) {
    generation++; // any in-flight camera callback now belongs to a dead screen
    const srcUrl = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.onload = () => draw();
    img.src = srcUrl;

    let zoom = 1;
    let tx = 0;
    let ty = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let ghostOp = ghostUrl ? 0.45 : 0;

    function draw() {
      mount.innerHTML = `
        <div class="screen">
          <header class="screen-head">
            <button class="icon-btn" data-back id="back" aria-label="Back">${icon('back')}</button>
            <h1>Align</h1>
            <span class="icon-btn ghost"></span>
          </header>

          <div class="align-stage" id="stage">
            <img id="shot" src="${srcUrl}" alt="">
            ${ghostUrl ? `<img id="gh" class="cam-ghost" src="${ghostUrl}" alt="" style="opacity:${ghostOp}">` : ''}
          </div>

          <label class="slider-row"><span>Zoom</span><b id="zOut">${zoom.toFixed(2)}×</b></label>
          <input type="range" id="zoom" min="50" max="200" step="1" value="${zoom * 100}">

          ${ghostUrl ? `<label class="slider-row"><span>Ghost</span><b id="gOut">${Math.round(ghostOp * 100)}%</b></label>
          <input type="range" id="gop" min="0" max="80" step="5" value="${ghostOp * 100}">` : ''}

          <p class="small muted centre">${ghostUrl ? 'Drag the photo until it sits over the ghost.' : 'Drag and zoom to frame it.'}</p>

          <button class="btn primary big" id="use">Use this photo</button>
          <button class="btn ghost" id="retake">Retake</button>
        </div>`;

      const shot = mount.querySelector('#shot');
      const apply = () => {
        shot.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
      };
      apply();

      const stage = mount.querySelector('#stage');
      stage.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        tx += e.clientX - lastX;
        ty += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        apply();
      });
      const stop = () => (dragging = false);
      stage.addEventListener('pointerup', stop);
      stage.addEventListener('pointercancel', stop);

      const z = mount.querySelector('#zoom');
      z.addEventListener('input', () => {
        zoom = Number(z.value) / 100;
        mount.querySelector('#zOut').textContent = `${zoom.toFixed(2)}×`;
        apply();
      });
      const g = mount.querySelector('#gop');
      g?.addEventListener('input', () => {
        ghostOp = Number(g.value) / 100;
        mount.querySelector('#gh').style.opacity = String(ghostOp);
        mount.querySelector('#gOut').textContent = `${g.value}%`;
      });

      mount.querySelector('#back').addEventListener('click', () => {
        URL.revokeObjectURL(srcUrl);
        finish(onCancel);
      });
      mount.querySelector('#retake').addEventListener('click', () => {
        URL.revokeObjectURL(srcUrl);
        live();
      });
      mount.querySelector('#use').addEventListener('click', () => {
        const rect = stage.getBoundingClientRect();
        bake(rect.width, rect.height).then((out) => {
          URL.revokeObjectURL(srcUrl);
          finish(() => onDone(out));
        });
      });
    }

    /** Renders what the stage shows, so what you aligned is what is stored. */
    async function bake(stageW, stageH) {
      const scale = Math.min(OUT_MAX / stageW, OUT_MAX / stageH, 3);
      const w = Math.round(stageW * scale);
      const h = Math.round(stageH * scale);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // object-fit: cover, then the transform, in that order.
      const cover = Math.max(stageW / img.width, stageH / img.height);
      const dw = img.width * cover * zoom * scale;
      const dh = img.height * cover * zoom * scale;
      const dx = (w - dw) / 2 + tx * scale;
      const dy = (h - dh) / 2 + ty * scale;
      ctx.drawImage(img, dx, dy, dw, dh);

      const full = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
      const tc = document.createElement('canvas');
      const ts = Math.min(1, 320 / Math.max(w, h));
      tc.width = Math.round(w * ts);
      tc.height = Math.round(h * ts);
      tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
      const thumb = await new Promise((res) => tc.toBlob(res, 'image/jpeg', 0.7));
      return { full, thumb, width: w, height: h };
    }
  }

  live();
}
