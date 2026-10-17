/* Story music: your own royalty-free library + your own song (music.js) */
let comp = null, mAud = null, pvAud = null, mTracks = [], mSel = null, mGenre = '', mT = null;
const GEN = [['All', ''], ['Pop', 'pop'], ['Hip hop', 'hiphop'], ['Chill', 'chill'], ['Rock', 'rock'], ['Electronic', 'electronic'], ['Folk', 'folk']];
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
const isAdmin = () => !!(me && window.CONFIG && window.CONFIG.ADMIN_ID === me.id);

/* "Add story" dabane par photo ke baad taiyaari screen khulti hai */
document.addEventListener('change', e => {
  if (e.target.id === 'sfile' && e.target.files[0]) { e.stopImmediatePropagation(); const f = e.target.files[0]; e.target.value = ''; openComposer(f); }
  else if (e.target.id === 'mfile' && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; pickFile(f); }
}, true);

async function openComposer(file) {
  toast('Preparing photo...');
  const blob = await shrink(file);
  comp = { blob, music: null };
  const o = document.createElement('div'); o.className = 'scomp';
  o.style.cssText = 'position:fixed;inset:0;z-index:72;background:#000;color:#fff;display:flex;flex-direction:column';
  o.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 8px"><button data-a="scancel" aria-label="Back" style="font-size:26px;color:#fff">&larr;</button><b>New story</b></div>
  <img src="${URL.createObjectURL(blob)}" alt="Story preview" style="flex:1;min-height:0;width:100%;object-fit:contain">
  <div style="padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;gap:10px;background:#111">
    <div id="minfo"></div>
    <button class="btn g" data-a="mopen" id="maddb">&#9835; Add music</button>
    <button class="btn" data-a="sshare">Share to story</button></div>`;
  document.body.appendChild(o);
}
function closeComposer() { stopPreview(); comp = null; document.querySelectorAll('.scomp,.mpick').forEach(x => x.remove()); }
function renderMusicInfo() {
  const el = $('#minfo'), add = $('#maddb'); if (!el || !comp) return;
  const m = comp.music; if (add) add.style.display = m ? 'none' : 'block';
  el.innerHTML = m ? `<div style="display:flex;align-items:center;gap:10px">${m.cover ? `<img src="${m.cover}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover">` : ''}<b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">&#9835; ${esc(m.title)}</b><button data-a="mopen" style="color:#7db7ff">Change</button><button data-a="mremove" style="color:#ff6b81">Remove</button></div>` : '';
}

/* ---------- music picker ---------- */
const genHtml = () => GEN.map(([l, t]) => `<button data-a="mgen" data-t="${t}" style="flex:none;padding:6px 14px;border-radius:16px;background:${t === mGenre ? '#fff' : '#262626'};color:${t === mGenre ? '#111' : '#fff'}">${l}</button>`).join('');
function openMusicPicker() {
  mSel = null; document.querySelectorAll('.mpick').forEach(x => x.remove());
  const o = document.createElement('div'); o.className = 'mpick';
  o.style.cssText = 'position:fixed;inset:0;z-index:80;background:#111;color:#fff;display:flex;flex-direction:column';
  o.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 8px"><button data-a="mpclose" aria-label="Back" style="font-size:26px;color:#fff">&larr;</button><b style="font-size:18px">Music</b></div>
  <div style="padding:4px 14px"><input id="mq" placeholder="Search music" autocomplete="off" style="width:100%;background:#262626;border:0;border-radius:10px;padding:10px 12px;color:#fff;font:inherit;outline:none"></div>
  <div id="mgen" style="display:flex;gap:8px;overflow-x:auto;padding:10px 14px;scrollbar-width:none">${genHtml()}</div>
  <label style="display:block;padding:12px 14px;border-top:1px solid #262626;border-bottom:1px solid #262626;cursor:pointer;color:#7db7ff">Use a song from my phone<input type="file" id="mfile" accept="audio/*" hidden></label>
  ${isAdmin() ? '<button data-a="madd" style="display:block;width:100%;text-align:left;padding:12px 14px;border-bottom:1px solid #262626;color:#7bd88f">+ Add song to library (admin)</button>' : ''}
  <div id="mlst2" style="flex:1;overflow-y:auto"></div>
  <div id="mclip" style="display:none;padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));background:#1b1b1b"></div>`;
  document.body.appendChild(o); loadTracks();
}
async function loadTracks() {
  const box = $('#mlst2'); if (!box) return;
  const qe = $('#mq'), q = (qe ? qe.value.trim() : '').replace(/[,()%*]/g, ' ').trim();
  box.innerHTML = '<div style="padding:30px;text-align:center;opacity:.7">Loading...</div>';
  let rq = sb.from('tracks').select('*').order('created_at', { ascending: false }).limit(50);
  if (mGenre) rq = rq.eq('genre', mGenre);
  if (q) rq = rq.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
  const { data, error } = await rq;
  if (error) { box.innerHTML = `<div style="padding:24px;text-align:center;opacity:.85">Could not load music.<br><small>${esc(error.message)}</small></div>`; return; }
  mTracks = data || [];
  box.innerHTML = mTracks.length ? mTracks.map((t, i) => `<button data-a="mtrack" data-i="${i}" style="width:100%;display:flex;align-items:center;gap:12px;padding:10px 14px;text-align:left;color:#fff"><img src="${t.cover_url || ''}" alt="" style="width:52px;height:52px;border-radius:8px;object-fit:cover;background:#333"><span style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}</b><span style="opacity:.7;font-size:13px">${esc(t.artist)} &middot; ${fmtT(t.duration || 0)}</span></span><span style="font-size:18px">&#9654;</span></button>`).join('') : `<div style="padding:30px;text-align:center;opacity:.7">${q || mGenre ? 'No songs found' : 'The library is empty.<br>' + (isAdmin() ? 'Tap "+ Add song to library" above.' : 'Use a song from your phone.')}</div>`;
}
function stopPreview() { if (pvAud) { pvAud.pause(); pvAud = null; } }
function playPreview(url, start) {
  stopPreview();
  const a = new Audio(url); a.preload = 'auto'; pvAud = a;
  a.addEventListener('loadedmetadata', () => { try { a.currentTime = start || 0; } catch (e) {} a.play().catch(() => toast('Tap the song again to play')); });
}
function showClip() {
  const t = mSel, p = $('#mclip'); if (!p || !t) return;
  p.style.display = 'block';
  p.innerHTML = `<div style="display:flex;align-items:center;gap:10px">${t.image ? `<img src="${t.image}" alt="" style="width:44px;height:44px;border-radius:8px;object-fit:cover">` : ''}<div style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name)}</b><span style="opacity:.7;font-size:13px">${esc(t.artist_name)}</span></div></div>
  <label style="display:grid;gap:4px;font-size:13px;opacity:.9;margin:10px 0">Start the song at <span id="cst2">${fmtT(t.start)}</span><input type="range" id="mrange" min="0" max="${Math.max(0, Math.floor(t.duration - 10))}" value="${t.start}"></label>
  <button class="btn" data-a="muse" style="width:100%">Use this song</button>${isAdmin() && t.id ? '<button data-a="mdel" style="display:block;width:100%;margin-top:10px;color:#ff6b81">Delete from library</button>' : ''}`;
}
function pickFile(f) {
  if (!(f.type || '').startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|opus)$/i.test(f.name)) return toast('Choose an audio file');
  if (f.size > 10 * 1024 * 1024) return toast('Choose a song under 10 MB');
  const url = URL.createObjectURL(f), a = new Audio(url);
  a.addEventListener('loadedmetadata', () => {
    mSel = { name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), artist_name: 'My song', duration: a.duration || 60, image: '', audio: url, file: f, start: 0 };
    showClip(); playPreview(url, 0);
  });
}
document.addEventListener('input', e => {
  if (e.target.id === 'mq') { clearTimeout(mT); mT = setTimeout(loadTracks, 450); }
  else if (e.target.id === 'mrange' && mSel) { const v = +e.target.value; mSel.start = v; $('#cst2').textContent = fmtT(v); if (pvAud) pvAud.currentTime = v; }
});

/* ---------- admin: add / delete songs in the library ---------- */
function openAdminAdd() {
  const o = document.createElement('div'); o.className = 'mpick madm';
  o.style.cssText = 'position:fixed;inset:0;z-index:85;background:#111;color:#fff;overflow:auto';
  const I = 'width:100%;background:#262626;border:0;border-radius:10px;padding:10px 12px;color:#fff;font:inherit;outline:none';
  o.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 8px"><button data-a="madmx" aria-label="Back" style="font-size:26px;color:#fff">&larr;</button><b style="font-size:18px">Add song to library</b></div>
  <div style="padding:10px 14px;display:grid;gap:12px">
    <label style="display:grid;gap:4px;font-size:13px;opacity:.85">Song file (mp3 or m4a, under 15 MB)<input type="file" id="ad-file" accept="audio/*" style="color:#fff"></label>
    <input id="ad-title" placeholder="Title" maxlength="60" style="${I}">
    <input id="ad-artist" placeholder="Artist and credit (e.g. Kevin MacLeod - incompetech.com)" maxlength="60" style="${I}">
    <select id="ad-genre" style="${I}">${GEN.filter(g => g[1]).map(g => `<option value="${g[1]}">${g[0]}</option>`).join('')}</select>
    <label style="display:grid;gap:4px;font-size:13px;opacity:.85">Cover image (optional)<input type="file" id="ad-cover" accept="image/*" style="color:#fff"></label>
    <button class="btn" data-a="madmsave">Save song</button></div>`;
  document.body.appendChild(o);
}
async function saveTrack() {
  const f = $('#ad-file').files[0], title = $('#ad-title').value.trim(), artist = $('#ad-artist').value.trim(), genre = $('#ad-genre').value, cf = $('#ad-cover').files[0];
  if (!f) return toast('Choose a song file');
  if (f.size > 15 * 1024 * 1024) return toast('Song must be under 15 MB');
  if (!title || !artist) return toast('Enter a title and an artist');
  const btn = document.querySelector('[data-a="madmsave"]'); btn.disabled = true; toast('Uploading song...');
  const dur = await new Promise(res => { const a = new Audio(URL.createObjectURL(f)); a.addEventListener('loadedmetadata', () => res(Math.round(a.duration) || 60)); a.addEventListener('error', () => res(60)); });
  const ts = Date.now(), ext = ((f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)) || 'mp3', ap = `${me.id}/lib-${ts}.${ext}`;
  const up = await sb.storage.from('posts').upload(ap, f, { contentType: f.type || 'audio/mpeg' });
  if (up.error) { btn.disabled = false; return toast(up.error.message); }
  let cover = null;
  if (cf) { const cb = await shrink(cf), cpth = `${me.id}/libc-${ts}.jpg`, cu = await sb.storage.from('posts').upload(cpth, cb, { contentType: 'image/jpeg' }); if (!cu.error) cover = sb.storage.from('posts').getPublicUrl(cpth).data.publicUrl; }
  const r = await sb.from('tracks').insert({ title, artist, genre, audio_url: sb.storage.from('posts').getPublicUrl(ap).data.publicUrl, cover_url: cover, duration: dur });
  if (r.error) { btn.disabled = false; return toast(r.error.message); }
  document.querySelectorAll('.madm').forEach(x => x.remove()); toast('Song added'); loadTracks();
}
async function delTrack() {
  const t = mSel; if (!t || !t.id || !confirm('Delete this song from the library?')) return;
  const r = await sb.from('tracks').delete().eq('id', t.id);
  if (r.error) return toast(r.error.message);
  const path = decodeURIComponent((t.audio.split('/object/public/posts/')[1] || '').split('?')[0]);
  if (path) sb.storage.from('posts').remove([path]);
  stopPreview(); mSel = null; const p = $('#mclip'); if (p) p.style.display = 'none'; toast('Song deleted'); loadTracks();
}

async function shareStory() {
  const c = comp; if (!c) return;
  const btn = document.querySelector('[data-a="sshare"]'); if (btn) btn.disabled = true;
  const fail = m => { if (btn) btn.disabled = false; toast(m); };
  toast('Posting story...');
  const ts = Date.now(), ip = `${me.id}/s-${ts}.jpg`;
  const up = await sb.storage.from('posts').upload(ip, c.blob, { contentType: 'image/jpeg' });
  if (up.error) return fail(up.error.message);
  const row = { user_id: me.id, image_url: sb.storage.from('posts').getPublicUrl(ip).data.publicUrl };
  if (c.music) {
    let url = c.music.url;
    if (c.music.file) {
      const f = c.music.file, ext = ((f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)) || 'mp3', mp = `${me.id}/mu-${ts}.${ext}`;
      const mu = await sb.storage.from('posts').upload(mp, f, { contentType: f.type || 'audio/mpeg' });
      if (mu.error) return fail(mu.error.message);
      url = sb.storage.from('posts').getPublicUrl(mp).data.publicUrl;
    }
    row.music_url = url; row.music_title = c.music.title; row.music_cover = c.music.cover || null; row.music_start = c.music.start || 0;
  }
  const r = await sb.from('stories').insert(row);
  if (r.error) return fail(r.error.message);
  closeComposer(); toast('Story posted!'); render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'scancel') closeComposer();
  else if (a === 'mopen') openMusicPicker();
  else if (a === 'mpclose') { stopPreview(); document.querySelectorAll('.mpick').forEach(x => x.remove()); }
  else if (a === 'mgen') { mGenre = b.dataset.t; $('#mgen').innerHTML = genHtml(); loadTracks(); }
  else if (a === 'mtrack') { const t = mTracks[+b.dataset.i]; mSel = { id: t.id, name: t.title, artist_name: t.artist, image: t.cover_url || '', audio: t.audio_url, duration: t.duration || 60, start: 0 }; playPreview(mSel.audio, 0); showClip(); }
  else if (a === 'madd') openAdminAdd();
  else if (a === 'madmx') document.querySelectorAll('.madm').forEach(x => x.remove());
  else if (a === 'madmsave') saveTrack();
  else if (a === 'mdel') delTrack();
  else if (a === 'muse') {
    if (!mSel || !comp) return;
    comp.music = { url: mSel.audio, file: mSel.file || null, title: mSel.artist_name === 'My song' ? mSel.name : `${mSel.name} - ${mSel.artist_name}`, cover: mSel.image || '', start: mSel.start || 0 };
    stopPreview(); document.querySelectorAll('.mpick').forEach(x => x.remove()); renderMusicInfo();
  }
  else if (a === 'mremove') { if (comp) comp.music = null; renderMusicInfo(); }
  else if (a === 'sshare') shareStory();
});

/* Story dekhte waqt gaana chalao */
function stopMusic() { if (mAud) { mAud.pause(); mAud = null; } document.querySelectorAll('.mchip').forEach(x => x.remove()); }
async function playStoryMusic(o, s) {
  const r = await sb.from('stories').select('music_url,music_title,music_cover,music_start').eq('id', s.id).maybeSingle();
  const m = r.data; if (!m || !m.music_url || !o.isConnected) return;
  const a = new Audio(m.music_url); a.preload = 'auto'; a.loop = true; mAud = a;
  a.addEventListener('loadedmetadata', () => { try { a.currentTime = m.music_start || 0; } catch (e) {} a.play().catch(() => {}); });
  o.insertAdjacentHTML('beforeend', `<div class="mchip" style="position:absolute;top:calc(56px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.5);padding:5px 14px 5px 6px;border-radius:20px;font-size:13px;z-index:3;max-width:86%">${m.music_cover ? `<img src="${m.music_cover}" alt="" style="width:26px;height:26px;border-radius:6px;object-fit:cover">` : '&#9835;'}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.music_title || 'Music')}</span></div>`);
}
new MutationObserver(() => {
  const o = document.querySelector('.ov.sv[data-a="snext"]');
  if (!o || typeof sv === 'undefined' || !sv) { if (mAud) stopMusic(); return; }
  const s = sv.list[sv.i]; if (!s || o.dataset.mus === String(s.id)) return;
  o.dataset.mus = s.id; stopMusic(); playStoryMusic(o, s);
}).observe(document.body, { childList: true, subtree: true });