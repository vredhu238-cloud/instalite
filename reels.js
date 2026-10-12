/* Reels: video upload + vertical autoplay feed (reels.js) */
async function reels() {
    const { data, error } = await sb.from('reels').select('*,profiles(username)').order('created_at', { ascending: false }).limit(20);
    if (error) toast(error.message);
    const list = data || [];
    setTimeout(watchReels, 150);
    return '<div class="row" style="border-bottom:1px solid var(--line)"><b class="sp" style="font-size:18px">Reels</b><label class="btn" style="cursor:pointer">Reel lagao<input type="file" id="rfile" accept="video/*" hidden></label></div>' +
      `<div id="rl" style="height:calc(100vh - 150px);overflow-y:scroll;scroll-snap-type:y mandatory;background:#000">${list.length ? list.map(r => `<div style="height:100%;scroll-snap-align:start;position:relative;display:flex;align-items:center;justify-content:center"><video src="${r.video_url}" loop muted playsinline preload="metadata" data-a="vtog" style="max-width:100%;max-height:100%"></video><div style="position:absolute;left:14px;right:14px;bottom:16px;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none"><b>${esc(r.profiles.username)}</b> ${fmt(r.caption || '')}${r.user_id === me.id ? ' <button data-a="delreel" data-id="' + r.id + '" style="color:#fff;text-decoration:underline;margin-left:10px;pointer-events:auto">Delete</button>' : ''}</div></div>`).join('') : '<div class="empty" style="color:#fff;padding:60px">Abhi koi reel nahi. Pehli reel lagao!</div>'}</div>`;
  }
  function watchReels() {
    const root = $('#rl'); if (!root) return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { root, threshold: .6 });
    root.querySelectorAll('video').forEach(v => io.observe(v));
  }
  async function delReel(id) {
    if (!confirm('Ye reel delete karein?')) return;
    const r = await sb.from('reels').delete().eq('id', id);
    if (r.error) return toast(r.error.message);
    toast('Reel delete ho gayi'); render();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'vtog') { b.muted = !b.muted; toast(b.muted ? 'Awaaz band' : 'Awaaz on'); }
    else if (a === 'delreel') delReel(b.dataset.id);
  });
  document.addEventListener('change', async e => {
    if (e.target.id !== 'rfile' || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.size > 25 * 1024 * 1024) return toast('Video 25 MB se chhota chuno');
    const cap = prompt('Reel ka caption (optional)', '') || '';
    toast('Reel upload ho rahi hai, thoda ruko...');
    const ext = ((f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)) || 'mp4';
    const path = `${me.id}/r-${Date.now()}.${ext}`;
    const up = await sb.storage.from('posts').upload(path, f, { contentType: f.type || 'video/mp4' });
    if (up.error) return toast(up.error.message);
    const r = await sb.from('reels').insert({ user_id: me.id, video_url: sb.storage.from('posts').getPublicUrl(path).data.publicUrl, caption: cap.slice(0, 200) });
    if (r.error) return toast(r.error.message);
    toast('Reel lag gayi!'); render();
  });