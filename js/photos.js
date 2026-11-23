// Photos: shrink on the phone (max 1280px JPEG) before storing, so storage stays small.
import { db } from './db.js';
import { uid, esc } from './util.js';

export async function compress(file, max = 1280, quality = 0.75) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w, h, src = bmp;
  if (!bmp) { // older Safari fallback
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  w = src.width; h = src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export async function savePhotoFile(file) {
  const data = await compress(file);
  const p = { id: 'ph_' + uid(), data, createdAt: Date.now() };
  await db.putPhoto(p);
  return p.id;
}

export function thumbHtml(id, removable = false) {
  return `<span class="thumb" data-pid="${esc(id)}"><img data-photo="${esc(id)}" alt="Photo" data-act="viewPhoto" data-id="${esc(id)}">${removable ? `<button type="button" class="thumb-x" data-act="rmPhoto" aria-label="Remove photo">✕</button>` : ''}</span>`;
}

// Fill every <img data-photo> with the stored picture (or a Drive link after a restore)
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]:not([data-done])').forEach(async img => {
    img.dataset.done = '1';
    const p = await db.getPhoto(img.dataset.photo);
    if (p?.data) img.src = p.data;
    else if (p?.driveUrl) {
      const a = document.createElement('a');
      a.href = p.driveUrl; a.target = '_blank'; a.rel = 'noopener'; a.className = 'thumb-cloud'; a.textContent = '☁️ Photo in Drive';
      img.replaceWith(a);
    } else img.alt = 'Photo not on this phone';
  });
}

export function watchPhotos() {
  new MutationObserver(() => hydratePhotos()).observe(document.body, { childList: true, subtree: true });
}
