/* Stories: 24-hour photo stories (stories.js) */
let SG = {}, sSeen = new Set(), sNames = {}, sv = null;

async function storiesBar() {
  const { data, error } = await sb.from('stories').select('id,user_id,image_url,created_at').in('user_id', [...fol, me.id]).gt('expires_at', new Date().toISOString()).order('created_at');
  if (error) { toast(error.message); return ''; }
  SG = {}; (data || []).forEach(s => (SG[s.user_id] = SG[s.user_id] || []).push(s));
  const uids = Object.keys(SG);
  if (uids.length) {
    const [n, v] = await Promise.all([sb.from('profiles').select('id,username').in('id', uids), sb.from('story_views').select('story_id').eq('viewer_id', me.id)]);
    (n.data || []).forEach(p => sNames[p.id] = p.username);
    sSeen = new Set((v.data || []).map(x => x.story_id));
  }
  const tile = u => {
    const all = SG[u].every(s => s.user_id === me.id || sSeen.has(s.id)), nm = u === me.id ? 'Your story' : (sNames[u] || '...');
    return `<button class="st" data-a="sview" data-id="${u}"><span class="ring ${all ? 'seen' : ''}">${av(nm, 56)}</span><span>${esc(nm)}</span></button>`;
  };
  const add = `<label class="st" style="cursor:pointer"><span class="ring seen" style="position:relative">${av(me.username, 56)}<b style="position:absolute;right:-2px;bottom:-2px;background:var(--blue);color:#fff;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px">+</b></span><span>Add story</span><input type="file" id="sfile" accept="image/*" hidden></label>`;
  return `<div class="stories">${add}${SG[me.id] ? tile(me.id) : ''}${uids.filter(u => u !== me.id).map(tile).join('')}</div>`;
}

function openStory(uid) { if (!SG[uid]) return; sv = { list: SG[uid], i: 0, t: null }; showStory(); }
function showStory() {
  const s = sv.list[sv.i], mine = s.user_id === me.id, nm = mine ? me.username : (sNames[s.user_id] || '');
  const o = document.createElement('div'); o.className = 'ov sv'; o.dataset.a = 'snext';
  o.innerHTML = `<div style="position:absolute;top:calc(10px + env(safe-area-inset-top,0px));left:10px;right:10px;display:flex;gap:4px;z-index:2">${sv.list.map((_, k) => `<div style="flex:1;height:3px;background:rgba(255,255,255,.3)">${k < sv.i ? '<i style="display:block;height:100%;background:#fff"></i>' : k === sv.i ? '<i style="display:block;height:100%;background:#fff;animation:fill 5s linear forwards"></i>' : ''}</div>`).join('')}</div>
  <div class="who" style="z-index:2">${av(nm, 34)}${esc(nm)} <small style="opacity:.7">${ago(s.created_at)}</small></div>
  <button data-a="sclose" aria-label="Close" style="position:absolute;top:calc(20px + env(safe-area-inset-top,0px));right:14px;color:#fff;font-size:30px;z-index:3">&times;</button>
  <img src="${s.image_url}" alt="Story" style="max-width:100%;max-height:100%;object-fit:contain">
  ${mine ? '<div class="cap" style="font-size:14px;bottom:24px;z-index:3"><span id="sviews"></span><button data-a="sdel" style="color:#fff;margin-left:18px;text-decoration:underline">Delete</button></div>' : ''}`;
  document.querySelectorAll('.ov.sv').forEach(x => x.remove()); document.body.appendChild(o);
  clearTimeout(sv.t); sv.t = setTimeout(nextStory, 5000);
  if (mine) sb.from('story_views').select('*', { count: 'exact', head: true }).eq('story_id', s.id).then(r => { const e = $('#sviews'); if (e) e.textContent = (r.count || 0) + ' views'; });
  else { sSeen.add(s.id); sb.from('story_views').upsert({ story_id: s.id, viewer_id: me.id }, { ignoreDuplicates: true }).then(() => {}); }
}
function nextStory() { if (!sv) return; if (sv.i < sv.list.length - 1) { sv.i++; showStory(); } else closeStory(); }
function prevStory() { if (!sv) return; if (sv.i > 0) sv.i--; showStory(); }
function closeStory() { if (sv) clearTimeout(sv.t); sv = null; document.querySelectorAll('.ov.sv').forEach(x => x.remove()); if (view === 'home') render(); }
async function delStory() {
  if (!sv || !confirm('Delete this story?')) return;
  await sb.from('stories').delete().eq('id', sv.list[sv.i].id); toast('Story deleted'); closeStory();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'sview') openStory(b.dataset.id);
  else if (a === 'snext') (e.clientX < innerWidth / 3 ? prevStory : nextStory)();
  else if (a === 'sclose') closeStory();
  else if (a === 'sdel') delStory();
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'sfile' || !e.target.files[0]) return;
  toast('Uploading story...');
  const blob = await shrink(e.target.files[0]), path = `${me.id}/s-${Date.now()}.jpg`;
  const up = await sb.storage.from('posts').upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) return toast(up.error.message);
  const r = await sb.from('stories').insert({ user_id: me.id, image_url: sb.storage.from('posts').getPublicUrl(path).data.publicUrl });
  if (r.error) return toast(r.error.message);
  toast('Story posted!'); render();
});