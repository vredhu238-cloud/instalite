/* In-app chat camera: photo, collage layout, gallery, front/back flip (camera.js) */
let cam = { stream: null, face: 'user', layout: 1, shots: [] };
const CI = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  flip: '<path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/>'
};
const csvg = (k, s = 28) => `<svg viewBox="0 0 24 24" style="width:${s}px;height:${s}px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round">${CI[k]}</svg>`;
const sideBtn = 'width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';

function openCam() {
  cam.shots = []; cam.layout = 1;
  const o = document.createElement('div'); o.className = 'ov cam'; o.style.cssText = 'z-index:50;background:#000;color:#fff;overflow:hidden';
  o.innerHTML = `<video id="cv" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>
  <button data-a="camclose" aria-label="Close" style="position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:14px;font-size:36px;color:#fff;z-index:3">&times;</button>
  <div id="cshots" style="position:absolute;top:calc(20px + env(safe-area-inset-top,0px));left:60px;right:60px;display:flex;gap:6px;justify-content:center;z-index:3"></div>
  <button data-a="camlayout" aria-label="Layout" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;font-size:12px;background:rgba(0,0,0,.45);padding:10px;border-radius:14px">${csvg('grid', 26)}<span id="clab">Layout</span></button>
  <div style="position:absolute;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:space-around;z-index:3">
    <button data-a="camgal" aria-label="Gallery" style="${sideBtn}">${csvg('img')}</button>
    <button data-a="camshot" aria-label="Capture" style="width:78px;height:78px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.25)"></button>
    <button data-a="camflip" aria-label="Switch camera" style="${sideBtn}">${csvg('flip')}</button>
  </div>`;
  document.body.appendChild(o); drawThumbs(); startCam();
}
async function startCam() {
  stopCam();
  try { cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam.face, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false }); }
  catch (e) { toast('Camera permission is needed'); return camClose(); }
  const v = $('#cv'); if (!v) return stopCam();
  v.srcObject = cam.stream; v.style.transform = cam.face === 'user' ? 'scaleX(-1)' : 'none';
}
const stopCam = () => { if (cam.stream) cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; };
function camClose() { stopCam(); document.querySelectorAll('.ov.cam,.ov.cpv').forEach(x => x.remove()); }

function drawThumbs() {
  const t = $('#cshots'), l = $('#clab'); if (!t) return;
  t.innerHTML = cam.layout > 1 ? Array.from({ length: cam.layout }, (_, i) => `<span style="width:28px;height:28px;border-radius:6px;border:2px solid #fff;background:${i < cam.shots.length ? '#fff' : 'transparent'}"></span>`).join('') : '';
  l.textContent = cam.layout === 1 ? 'Layout' : `${cam.shots.length}/${cam.layout}`;
}
function camLayout() { cam.layout = cam.layout === 1 ? 2 : cam.layout === 2 ? 4 : 1; cam.shots = []; drawThumbs(); toast(cam.layout === 1 ? 'Single photo' : `Collage: ${cam.layout} photos`); }
function grab() {
  const v = $('#cv'), w = v.videoWidth, h = v.videoHeight; if (!w) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (cam.face === 'user') { x.translate(w, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0, w, h); return c;
}
function coverDraw(x, c, dx, dy, dw, dh) { const s = Math.max(dw / c.width, dh / c.height), sw = dw / s, sh = dh / s; x.drawImage(c, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh, dx, dy, dw, dh); }
function camShot() {
  const c = grab(); if (!c) return toast('Camera is not ready yet');
  cam.shots.push(c); drawThumbs();
  if (cam.shots.length >= cam.layout) finishShots();
}
function finishShots() {
  const n = cam.layout, S = 1080, out = document.createElement('canvas');
  if (n === 1) { const c = cam.shots[0], k = Math.min(1, S / Math.max(c.width, c.height)); out.width = c.width * k; out.height = c.height * k; out.getContext('2d').drawImage(c, 0, 0, out.width, out.height); }
  else {
    out.width = out.height = S; const x = out.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const h = S / 2, cells = n === 2 ? [[0, 0, h, S], [h, 0, h, S]] : [[0, 0, h, h], [h, 0, h, h], [0, h, h, h], [h, h, h, h]];
    cam.shots.forEach((c, i) => coverDraw(x, c, ...cells[i]));
  }
  out.toBlob(b => showPreview(b), 'image/jpeg', .85);
}
function showPreview(b) {
  stopCam();
  const o = document.createElement('div'); o.className = 'ov cpv'; o._blob = b; o.style.cssText = 'z-index:60;background:#000;color:#fff;display:flex;flex-direction:column';
  o.innerHTML = `<img src="${URL.createObjectURL(b)}" alt="Preview" style="flex:1;min-height:0;width:100%;object-fit:contain"><div style="display:flex;gap:12px;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px))"><button class="btn g" data-a="camretake" style="flex:1">Retake</button><button class="btn" data-a="camsend" style="flex:1">Send</button></div>`;
  document.body.appendChild(o);
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'dmcam') openCam();
  else if (a === 'camclose') camClose();
  else if (a === 'camlayout') camLayout();
  else if (a === 'camshot') camShot();
  else if (a === 'camflip') { cam.face = cam.face === 'user' ? 'environment' : 'user'; startCam(); }
  else if (a === 'camgal') { camClose(); const f = $('#dmfile'); if (f) f.click(); }
  else if (a === 'camretake') { document.querySelectorAll('.ov.cpv').forEach(x => x.remove()); cam.shots = []; drawThumbs(); startCam(); }
  else if (a === 'camsend') { const o = document.querySelector('.ov.cpv'); if (!o) return; const blob = o._blob; camClose(); await sendMedia(blob, 'image'); }
});