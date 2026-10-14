/* Reels: full-screen video feed, sound on, upload (reels.js) */
let reelMuted = false;
document.head.insertAdjacentHTML('beforeend', '<style>#rw{position:fixed;left:0;right:0;top:0;bottom:var(--navh,60px);background:#000;z-index:5}#rl{height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;background:#000}#rl::-webkit-scrollbar{display:none}.rp{height:100%;scroll-snap-align:start;scroll-snap-stop:always;position:relative}.rp video{width:100%;height:100%;object-fit:cover;background:#000}.rcap{position:absolute;left:14px;right:70px;bottom:18px;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}.rcap button{pointer-events:auto}.rtop{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:0 14px;color:#fff;z-index:6;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.6)}.rtop>*{pointer-events:auto}.rtop span{display:flex;align-items:center;gap:14px}.rtop svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}@media(min-width:900px){#rw{position:relative;left:auto;right:auto;top:auto;bottom:auto;height:100vh}}</style>');

const SPK_ON = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>';
const SPK_OFF = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>';
const syncMute = () => { const m = document.querySelector('.rmute'); if (m) m.innerHTML = reelMuted ? SPK_OFF : SPK_ON; };

async function reels() {
  const { data, error } = await sb.from('reels').select('*,profiles(username)').order('created_at', { ascending: false }).limit(20);
  if (error) toast(error.message);
  const list = data || [];
  setTimeout(watchReels, 150);
  return `<div id="rw"><div id="rl">${list.length ? list.map(r => `<section class="rp"><video src="${r.video_url}" loop playsinline preload="auto" data-a="rtap"></video><div class="rcap"><b>${esc(r.profiles.username)}</b> ${fmt(r.caption || '')}${r.user_id === me.id ? ' <button data-a="delreel" data-id="' + r.id + '" style="color:#fff;text-decoration:underline;margin-left:10px">Delete</button>' : ''}</div></section>`).join('') : '<div class="empty" style="color:#fff;padding:120px 20px">No reels yet. Post the first one!</div>'}</div>
  <div class="rtop"><b style="font-size:22px">Reels</b><span><button class="rmute" data-a="rmute" aria-label="Sound">${reelMuted ? SPK_OFF : SPK_ON}</button><label class="btn" style="cursor:pointer">Add reel<input type="file" id="rfile" accept="video/*" hidden></label></span></div></div>`;
}

function watchReels() {
  const nav = document.querySelector('nav');
  if (nav) document.documentElement.style.setProperty('--navh', nav.offsetHeight + 'px');
  const root = $('#rl'); if (!root) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      v.muted = reelMuted;
      v.play().catch(() => { v.muted = true; reelMuted = true; syncMute(); v.play().catch(() => {}); toast('Tap the speaker icon to turn sound on'); });
    } else v.pause();
  }), { root, threshold: .65 });
  root.querySelectorAll('video').forEach(v => io.observe(v));
}

async function delReel(id) {
  if (!confirm('Delete this reel?')) return;
  const r = await sb.from('reels').delete().eq('id', id);
  if (r.error) return toast(r.error.message);
  toast('Reel deleted'); render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'rtap') { if (b.paused) b.play().catch(() => {}); else b.pause(); }
  else if (a === 'rmute') {
    reelMuted = !reelMuted; syncMute();
    document.querySelectorAll('#rl video').forEach(v => { v.muted = reelMuted; if (!reelMuted && v.paused && v.getBoundingClientRect().top >= 0 && v.getBoundingClientRect().top < innerHeight / 2) v.play().catch(() => {}); });
    toast(reelMuted ? 'Sound off' : 'Sound on');
  }
  else if (a === 'delreel') delReel(b.dataset.id);
});

document.addEventListener('change', async e => {
  if (e.target.id !== 'rfile' || !e.target.files[0]) return;
  const f = e.target.files[0];
  if (f.size > 25 * 1024 * 1024) return toast('Choose a video under 25 MB');
  const cap = prompt('Reel caption (optional)', '') || '';
  toast('Uploading reel, please wait...');
  const ext = ((f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)) || 'mp4';
  const path = `${me.id}/r-${Date.now()}.${ext}`;
  const up = await sb.storage.from('posts').upload(path, f, { contentType: f.type || 'video/mp4' });
  if (up.error) return toast(up.error.message);
  const r = await sb.from('reels').insert({ user_id: me.id, video_url: sb.storage.from('posts').getPublicUrl(path).data.publicUrl, caption: cap.slice(0, 200) });
  if (r.error) return toast(r.error.message);
  toast('Reel posted!'); render();
});