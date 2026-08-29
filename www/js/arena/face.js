// The Nemesis has your face.
//
// Your Nemesis is the best week you have ever had, so the honest picture of him
// is you, taken on the week you set it. Offered on the week that becomes your
// best, kept until a better week replaces it.
//
// A 256px JPEG in the store rather than a blob in IndexedDB: it is one small
// image, and this way it rides along in a backup like everything else.

import * as store from '../store.js';
import { icon } from '../icons.js';
import { toast, haptic } from '../ui.js';

const SIZE = 256;
const QUALITY = 0.72;

export const face = () => store.get().arena.face;

/** The week the face was taken on, or ''. */
export const faceWeek = () => face()?.week || '';

export function clearFace() {
  store.update((st) => {
    st.arena.face = null;
  });
}

/* ---------------- capture ---------------- */

/** Centre-crops to a square and downscales. A phone photo is 4MB and 3000px;
 *  what the app needs is 256px, which is about 12KB of JPEG. */
function squareJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const g = canvas.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

/** Opens the camera on a phone, the picker everywhere else. Resolves true when
 *  a face was stored. */
export function captureFace(week = '') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // The front camera, where the platform honours it. Ignored on desktop.
    input.capture = 'user';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(false);
      try {
        const src = await squareJpeg(file);
        if (src.length > 300000) {
          toast('That photo is too big to keep');
          return resolve(false);
        }
        store.update((st) => {
          st.arena.face = { src, week, at: Date.now() };
        });
        haptic('done');
        resolve(true);
      } catch {
        toast('Could not read that image');
        resolve(false);
      }
    });
    // Cancelling a file picker fires nothing on most platforms, so the promise
    // is left to the change event and the input is removed with the screen.
    input.click();
  });
}

/* ---------------- on screen ---------------- */

/** The Nemesis, as a face where there is one and the crest silhouette where
 *  there is not. Decorative: his name is always beside it. */
export function faceAvatar(size = 44) {
  const f = face();
  const px = `width:${size}px;height:${size}px`;
  if (!f) {
    return `<span class="nem-face empty" style="${px}" aria-hidden="true">${icon('shield', Math.round(size * 0.5))}</span>`;
  }
  return `<span class="nem-face" style="${px}" aria-hidden="true"><img src="${f.src}" alt="" draggable="false"></span>`;
}
