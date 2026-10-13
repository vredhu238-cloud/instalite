/* Instagram-style profile: Edit profile, Share profile, Highlights, 4 tabs, Settings (profile.js) */
let ptab = 'posts', ptFor = null, HL = [];
document.head.insertAdjacentHTML('beforeend', '<style>.prow{display:flex;gap:8px;margin-top:4px}.prow .btn{flex:1;padding:8px 0;text-align:center;font-size:14px}.hl{display:flex;gap:14px;overflow-x:auto;padding:12px 14px;scrollbar-width:none}.hl .it{display:block;width:72px;flex:none;text-align:center;font-size:12px;color:inherit;cursor:pointer}.hl .c{width:66px;height:66px;border-radius:50%;border:1px solid var(--line);margin:0 auto 4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--card);font-size:30px;font-weight:300}.hl .c img{width:100%;height:100%;object-fit:cover}.hl .t{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ptabs{display:flex;border-bottom:1px solid var(--line)}.ptabs button{flex:1;padding:12px 0;color:var(--mut);border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;justify-content:center}.ptabs button.on{color:var(--fg);border-bottom-color:var(--fg)}.ptabs svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}</style>');

const PT = [
  ['posts', 'Posts', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'],
  ['reels', 'Reels', '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M10 8.5l5 3.5-5 3.5z"/>'],
  ['repost', 'Reposts', '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>'],
  ['tagged', 'Tagged', '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4"/>']
];

async function profile2() {
  const { data: pr } = await sb.from('profiles').select('*').eq('username', pu || me.username).maybeSingle();
  if (!pr) return '<div class="empty">User not found</div>';
  const mine = pr.id === me.id;
  if (ptFor !== pr.id) { ptab = 'posts'; ptFor = pr.id; }
  const locked = pr.is_private && !mine && (!fol.has(pr.id) || pend.has(pr.id));
  const [po, fr, fg, hl] = await Promise.all([
    sb.from('posts').select(Q).eq('user_id', pr.id).order('created_at', { ascending: false }),
    cnt('following_id', pr.id), cnt('follower_id', pr.id),
    sb.from('highlights').select('*').eq('user_id', pr.id).order('created_at')]);
  if (po.error) toast(po.error.message);
  const posts = po.data || []; HL = hl.data || [];
  let body = '';
  if (locked) body = '<div class="empty">This account is private. Send a follow request to see their posts.</div>';
  else if (ptab === 'posts') { cache = posts; body = tiles(posts); }
  else if (ptab === 'reels') {
    const l = (await sb.from('reels').select('id,video_url').eq('user_id', pr.id).order('created_at', { ascending: false })).data || [];
    body = l.length ? `<div class="grid">${l.map(x => `<div class="tile" data-a="nav" data-v="reels"><video src="${x.video_url}#t=0.1" preload="metadata" muted playsinline style="width:100%;height:100%;object-fit:cover"></video></div>`).join('')}</div>` : '<div class="empty">No reels yet</div>';
  } else if (ptab === 'tagged') {
    const r = await sb.from('posts').select(Q).ilike('caption', '%@' + pr.username + '%').order('created_at', { ascending: false }).limit(60);
    cache = r.data || []; body = tiles(cache);
  } else body = '<div class="empty">No reposts yet</div>';

  const top = mine
    ? `<div class="row" style="padding:12px 14px 0"><b class="sp" style="font-size:20px">${esc(pr.username)}</b><button data-a="menu" aria-label="Menu"><svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>`
    : `<div class="row" style="padding:12px 14px 0"><button data-a="nav" data-v="explore" aria-label="Back" style="font-size:22px">&larr;</button><b class="sp" style="font-size:20px">${esc(pr.username)}</b></div>`;
  const btns = mine
    ? '<button class="btn g" data-a="editprof">Edit profile</button><button class="btn g" data-a="shareprof">Share profile</button><button class="btn g" data-a="nav" data-v="explore" aria-label="Find people" style="flex:0 0 46px"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6"/></svg></button>'
    : fbtn(pr.id) + `<button class="btn g" data-a="dmuser" data-id="${pr.id}" data-u="${esc(pr.username)}">Message</button>` + (typeof toggleBlock === 'function' ? `<button class="btn g" data-a="blk" data-id="${pr.id}" data-u="${esc(pr.username)}" style="flex:0 0 auto;padding:8px 14px">Block</button>` : '');
  const hlRow = !locked && (mine || HL.length)
    ? `<div class="hl">${mine ? '<button class="it" data-a="hlnew"><span class="c">+</span><span class="t">New</span></button>' : ''}${HL.map(h => `<button class="it" data-a="hlopen" data-id="${h.id}"><span class="c"><img src="${h.image_url}" alt=""></span><span class="t">${esc(h.title)}</span></button>`).join('')}</div>` : '';
  const tabs = `<div class="ptabs">${PT.map(([k, l, p]) => `<button data-a="ptab" data-t="${k}" aria-label="${l}" class="${ptab === k ? 'on' : ''}"><svg viewBox="0 0 24 24">${p}</svg></button>`).join('')}</div>`;
  return top + `<div class="pro" style="padding-top:8px"><div class="top">${av(pr.username, 86)}<div class="stat"><div><b>${posts.length}</b>posts</div><div><b>${fr}</b>followers</div><div><b>${fg}</b>following</div></div></div>
  <div style="margin:10px 0"><b>${esc(pr.full_name || pr.username)}</b><div style="white-space:pre-wrap">${esc(pr.bio || '')}</div></div><div class="prow">${btns}</div></div>` + hlRow + tabs + body;
}

function openMenu() {
  const o = document.createElement('div'); o.className = 'ov mn';
  const row = (a, t, x = '') => `<button class="row" data-a="${a}" style="width:100%;text-align:left;padding:16px 14px;border-bottom:1px solid var(--line);${x}">${t}</button>`;
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="close" aria-label="Back" style="font-size:22px">&larr;</button><b>Settings</b></div>${row('gosaved', 'Saved posts')}${row('gorequests', 'Follow requests')}${row('togpriv', 'Private account: ' + (me.is_private ? 'ON' : 'OFF'))}${row('out', 'Log out', 'color:var(--red)')}</div>`;
  document.body.appendChild(o);
}

function openEdit() {
  const o = document.createElement('div'); o.className = 'ov';
  const L = 'display:grid;gap:4px;font-size:13px;color:var(--mut)';
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="close" aria-label="Back" style="font-size:22px">&larr;</button><b class="sp">Edit profile</b><button data-a="saveprof" style="color:var(--blue);font-weight:700">Done</button></div>
  <div style="padding:16px 14px;display:grid;gap:14px"><div style="text-align:center">${av(me.username, 90)}</div>
  <label style="${L}">Name<input class="s" id="ep-name" maxlength="40" value="${esc(me.full_name || '')}" placeholder="Name"></label>
  <label style="${L}">Username<input class="s" id="ep-user" maxlength="20" value="${esc(me.username)}" placeholder="Username"></label>
  <label style="${L}">Bio<textarea id="ep-bio" rows="3" maxlength="150" placeholder="Bio">${esc(me.bio || '')}</textarea></label>
  <label style="${L}">Gender<select class="s" id="ep-gender">${['', 'Male', 'Female', 'Other', 'Prefer not to say'].map(g => `<option value="${g}"${me.gender === g ? ' selected' : ''}>${g || 'Select'}</option>`).join('')}</select></label>
  <button class="btn" data-a="saveprof">Save</button></div></div>`;
  document.body.appendChild(o);
}

async function saveProf() {
  const full_name = $('#ep-name').value.trim().slice(0, 40), username = $('#ep-user').value.trim().toLowerCase(), bio = $('#ep-bio').value.trim().slice(0, 150), gender = $('#ep-gender').value;
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) return toast('Username: 3-20 letters, numbers, _ or .');
  const r = await sb.from('profiles').update({ full_name, username, bio, gender }).eq('id', me.id);
  if (r.error) return toast(r.error.code === '23505' ? 'That username is already taken' : r.error.message);
  Object.assign(me, { full_name, username, bio, gender });
  closeOv(); pu = null; toast('Profile updated'); render();
}

async function shareProf() {
  const url = location.origin + location.pathname + '?u=' + encodeURIComponent(me.username);
  if (navigator.share) { try { await navigator.share({ title: 'InstaLite', text: `Follow ${me.username} on InstaLite`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); } catch (e) {}
  toast('Profile link copied');
}

let hv = null, selUrls = [], hcList = [];

function openHl(id) {
  const h = HL.find(x => x.id == id); if (!h) return;
  hv = { h, list: h.images && h.images.length ? h.images : [h.image_url], i: 0, t: null };
  showHl();
}
function showHl() {
  const { h, list, i } = hv;
  const o = document.createElement('div'); o.className = 'ov sv'; o.dataset.a = 'hnext';
  o.innerHTML = `<div style="position:absolute;top:calc(10px + env(safe-area-inset-top,0px));left:10px;right:10px;display:flex;gap:4px;z-index:2">${list.map((_, k) => `<div style="flex:1;height:3px;background:rgba(255,255,255,.3)">${k < i ? '<i style="display:block;height:100%;background:#fff"></i>' : k === i ? '<i style="display:block;height:100%;background:#fff;animation:fill 5s linear forwards"></i>' : ''}</div>`).join('')}</div>
  <div class="who" style="z-index:2">${esc(h.title)}</div>
  <button data-a="hclose" aria-label="Close" style="position:absolute;top:calc(20px + env(safe-area-inset-top,0px));right:14px;color:#fff;font-size:30px;z-index:3">&times;</button>
  <img src="${list[i]}" alt="${esc(h.title)}" style="max-width:100%;max-height:100%;object-fit:contain">
  ${h.user_id === me.id ? `<div class="cap" style="font-size:14px;bottom:24px;z-index:3"><button data-a="hldel" data-id="${h.id}" style="color:#fff;text-decoration:underline">Delete highlight</button></div>` : ''}`;
  document.querySelectorAll('.ov.sv').forEach(x => x.remove()); document.body.appendChild(o);
  clearTimeout(hv.t); hv.t = setTimeout(hlNext, 5000);
}
function hlNext() { if (!hv) return; if (hv.i < hv.list.length - 1) { hv.i++; showHl(); } else hlClose(); }
function hlPrev() { if (!hv) return; if (hv.i > 0) hv.i--; showHl(); }
function hlClose() { if (hv) clearTimeout(hv.t); hv = null; document.querySelectorAll('.ov.sv').forEach(x => x.remove()); }
async function delHl(id) {
  if (!confirm('Delete this highlight?')) return;
  const r = await sb.from('highlights').delete().eq('id', id);
  if (r.error) return toast(r.error.message);
  hlClose(); closeOv(); toast('Highlight deleted'); render();
}

async function openArchive() {
  const r = await sb.from('stories').select('id,image_url,created_at').eq('user_id', me.id).order('created_at', { ascending: false }).limit(60);
  if (r.error) return toast(r.error.message);
  const list = r.data || []; selUrls = [];
  const o = document.createElement('div'); o.className = 'ov ar';
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="close" aria-label="Back" style="font-size:22px">&larr;</button><b class="sp">Select stories</b><button data-a="arnext" style="color:var(--blue);font-weight:700">Next</button></div>
  ${list.length ? `<div class="grid">${list.map(s => `<div class="tile" data-a="arsel" data-u="${s.image_url}" style="position:relative"><img src="${s.image_url}" alt=""><span class="ck" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.25)"></span></div>`).join('')}</div>` : '<div class="empty">No stories yet. Post a story first, then add it to a highlight.</div>'}</div>`;
  document.body.appendChild(o);
}
async function saveHl(urls, title) {
  const r = await sb.from('highlights').insert({ user_id: me.id, title, image_url: urls[0], images: urls });
  if (r.error) { toast(r.error.message); return false; }
  return true;
}
async function pickName() {
  if (!selUrls.length) return toast('Select at least one story');
  const title = (prompt('Highlight name (max 20 characters)', 'Highlights') || '').trim().slice(0, 20);
  if (!title) return;
  if (await saveHl(selUrls, title)) { closeOv(); toast('Highlight added'); render(); }
}

async function hlChooser() {
  if (!sv) return; clearTimeout(sv.t);
  const url = sv.list[sv.i].image_url;
  hcList = (await sb.from('highlights').select('*').eq('user_id', me.id).order('created_at')).data || [];
  const o = document.createElement('div'); o.className = 'ov hc'; o.style.zIndex = 40; o.dataset.url = url;
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="hcclose" aria-label="Back" style="font-size:22px">&larr;</button><b>Add to highlight</b></div>${hcList.map(h => `<button class="row" data-a="hcadd" data-id="${h.id}" style="width:100%;text-align:left;padding:14px;border-bottom:1px solid var(--line)">${esc(h.title)} <small style="color:var(--mut)">(${(h.images && h.images.length) || 1})</small></button>`).join('')}<button class="row" data-a="hcnew" style="width:100%;text-align:left;padding:14px;color:var(--blue);font-weight:600">+ New highlight</button></div>`;
  document.body.appendChild(o);
}
function hcDone(msg) { document.querySelectorAll('.ov.hc').forEach(x => x.remove()); if (msg) toast(msg); if (sv) showStory(); }
async function hcAdd(id) {
  const url = document.querySelector('.ov.hc').dataset.url, h = hcList.find(x => x.id == id), imgs = h.images && h.images.length ? h.images : [h.image_url];
  if (imgs.includes(url)) return hcDone('Already in this highlight');
  const r = await sb.from('highlights').update({ images: [...imgs, url] }).eq('id', id);
  hcDone(r.error ? r.error.message : 'Added to highlight');
}
async function hcNew() {
  const url = document.querySelector('.ov.hc').dataset.url;
  const title = (prompt('Highlight name (max 20 characters)', 'Highlights') || '').trim().slice(0, 20);
  if (!title) return;
  hcDone((await saveHl([url], title)) ? 'Highlight added' : '');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (b.closest('.ov.mn') && a !== 'close') closeOv();
  if (a === 'menu') openMenu();
  else if (a === 'editprof') openEdit();
  else if (a === 'saveprof') saveProf();
  else if (a === 'shareprof') shareProf();
  else if (a === 'ptab') { ptab = b.dataset.t; render(); }
  else if (a === 'hlopen') openHl(b.dataset.id);
  else if (a === 'hnext') (e.clientX < innerWidth / 3 ? hlPrev : hlNext)();
  else if (a === 'hclose') hlClose();
  else if (a === 'hldel') delHl(b.dataset.id);
  else if (a === 'hlnew') openArchive();
  else if (a === 'arsel') {
    const u = b.dataset.u, i = selUrls.indexOf(u);
    if (i < 0) selUrls.push(u); else selUrls.splice(i, 1);
    b.querySelector('.ck').style.background = i < 0 ? 'var(--blue)' : 'rgba(0,0,0,.25)';
    const nx = document.querySelector('.ov.ar [data-a="arnext"]'); if (nx) nx.textContent = selUrls.length ? `Next (${selUrls.length})` : 'Next';
  }
  else if (a === 'arnext') pickName();
  else if (a === 'tohl') hlChooser();
  else if (a === 'hcclose') hcDone('');
  else if (a === 'hcadd') hcAdd(b.dataset.id);
  else if (a === 'hcnew') hcNew();
});

/* Apni story kholne par "Highlight" button apne aap judta hai (stories.js ko chhedna nahi padta) */
new MutationObserver(() => {
  const v = document.getElementById('sviews');
  if (v && !document.querySelector('[data-a="tohl"]'))
    v.insertAdjacentHTML('afterend', '<button data-a="tohl" style="color:#fff;margin-left:18px;text-decoration:underline">Highlight</button>');
}).observe(document.body, { childList: true, subtree: true });