const C = window.CONFIG, sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const G = [['#f09433','#bc1888'],['#43cea2','#185a9d'],['#667eea','#764ba2'],['#f6d365','#fda085'],['#30cfd0','#330867']];
const hash = s => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7);
const av = (u, s = 32) => { const g = G[hash(u) % G.length]; return `<span class="av" style="--s:${s}px;background:linear-gradient(135deg,${g[0]},${g[1]})">${esc(u[0].toUpperCase())}</span>`; };
const FIL = {Normal:'', Clarendon:'contrast(1.2) saturate(1.35)', Moon:'grayscale(1) contrast(1.1) brightness(1.1)', Juno:'sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)', Noir:'grayscale(1) contrast(1.5) brightness(.9)'};
const ICO = {home:'<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>', search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>', plus:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>', heart:'<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', cm:'<path d="M21 12a8 8 0 01-11.7 7L3 21l2-6A8 8 0 1121 12z"/>', send:'<path d="M22 3L2 10.5l7.5 3L12.5 21z"/><path d="M22 3L9.5 13.5"/>',reel:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M10 8.5l5 3.5-5 3.5z"/>'};
const ic = (n, cls, a, l) => `<button class="ic ${cls}" ${a} aria-label="${l}"><svg viewBox="0 0 24 24">${ICO[n]}</svg></button>`;
const ago = t => { const m = (Date.now() - new Date(t)) / 6e4; return m < 1 ? 'abhi' : m < 60 ? (m | 0) + ' min' : m < 1440 ? (m / 60 | 0) + ' ghante' : (m / 1440 | 0) + ' din'; };
const Q = '*,profiles!posts_user_id_fkey(username),likes(user_id),comments(id,body,created_at,profiles(username))';
let me = null, view = 'home', pu = null, cache = [], fol = new Set(), file = null, q = '';

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }
const closeOv = () => document.querySelectorAll('.ov').forEach(o => o.remove());

/* ---------- AUTH ---------- */
async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return authUI();
  const r = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!r.data) return authUI();
  me = r.data;
  const f = await sb.from('follows').select('following_id').eq('follower_id', me.id);
  fol = new Set((f.data || []).map(x => x.following_id));
  go('home');
}
function authUI(m = 'login') {
  document.body.classList.add('au');
  $('#app').innerHTML = `<form class="auth" id="af"><div class="logo"><i class="lg"></i>InstaLite</div>
    ${m === 'up' ? '<input class="s" id="un" placeholder="Username (a-z, 0-9, _ .)" required pattern="[a-zA-Z0-9_.]{3,20}">' : ''}
    <input class="s" id="em" type="email" placeholder="Email" required>
    <input class="s" id="pw" type="password" placeholder="Password (6+ characters)" minlength="6" required>
    <button class="btn">${m === 'up' ? 'Sign up' : 'Log in'}</button>
    <a href="#" id="sw">${m === 'up' ? 'Account hai? Log in karo' : 'Naya account banao'}</a></form>`;
  $('#sw').onclick = e => { e.preventDefault(); authUI(m === 'up' ? 'login' : 'up'); };
  $('#af').onsubmit = async e => {
    e.preventDefault();
    const em = $('#em').value, pw = $('#pw').value;
    const r = m === 'up'
      ? await sb.auth.signUp({ email: em, password: pw, options: { data: { username: $('#un').value.toLowerCase() } } })
      : await sb.auth.signInWithPassword({ email: em, password: pw });
    if (r.error) return toast(r.error.message);
    if (r.data.session) start(); else toast('Email check karo aur confirm karo, phir login karo');
  };
}

/* ---------- ROUTER ---------- */
function go(v, u = null) { view = v; pu = u; closeOv(); render(); scrollTo(0, 0); }
async function render() {
  document.body.classList.remove('au');
  nav(); side();
  if (typeof listen === 'function') listen(); await ensureSaves(); await ensureB(); badges(); const V = { home, explore, create, profile, activity: notifs, inbox, chat, saved, tag: tagPage, requests, reels };
  $('#app').innerHTML = '<div class="empty">Load ho raha hai...</div>';
  $('#app').innerHTML = (view === 'home' && typeof storiesBar === 'function' ? await storiesBar() : '') + await V[view]();
}
function nav() {
  const L = [['home','home','Home'],['search','explore','Search'],['plus','create','Create'],['heart','activity','Activity'],['reel','reels','Reels'],['send','inbox','Messages'],['user','profile','Profile']];
  $('#nav').innerHTML = '<div class="slogo"><span class="logo"><i class="lg"></i>InstaLite</span></div>' +
    L.map(([i, v, l]) => `<button class="ic nv ${view === v && !pu ? 'on' : ''}" data-a="nav" data-v="${v}" aria-label="${l}"><svg viewBox="0 0 24 24">${ICO[i]}</svg><span class="lb">${l}</span></button>`).join('') +
    '<button class="ic nv th" data-a="theme" aria-label="Theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg><span class="lb">Theme</span></button>';
}
async function side() {
  const { data } = await sb.from('profiles').select('id,username').neq('id', me.id).limit(5);
  $('#side').innerHTML = `<div class="row" style="padding:0 0 16px">${av(me.username, 56)}<div class="sp"><b>${esc(me.username)}</b><div style="color:var(--mut)">${esc(me.bio || '')}</div></div></div><div class="row" style="padding:0 0 8px;color:var(--mut)"><b>Suggestions</b></div>` +
    (data || []).map(u => `<div class="row" style="padding:6px 0">${av(u.username, 36)}<b class="sp" data-a="prof" data-u="${u.username}" style="cursor:pointer">${esc(u.username)}</b>${fbtn(u.id)}</div>`).join('');
}

/* ---------- POSTS ---------- */
const imgTag = p => `<img src="${p.image_url}" alt="${esc(p.caption || '')}" style="filter:${FIL[p.filter] || 'none'}">`;
const postH = p => {
  const u = p.profiles.username, liked = p.likes.some(l => l.user_id === me.id);
  const cm = [...p.comments].sort((a, b) => a.id - b.id);
  return `<article class="post" data-id="${p.id}"><div class="ph">${av(u)}<b data-a="prof" data-u="${u}">${esc(u)}</b><small>&bull; ${ago(p.created_at)}</small><span class="sp"></span>${p.user_id === me.id ? `<button data-a="editcap" data-id="${p.id}" style="margin-right:12px">Edit</button><button data-a="del" data-id="${p.id}" aria-label="Delete">&#128465;</button>` : ''}</div>
  <div class="media" data-a="dbl" data-id="${p.id}">${feed(p)}</div>
  <div class="acts">${ic('heart', liked ? 'liked' : '', `data-a="like" data-id="${p.id}"`, 'Like')}${ic('cm', '', `data-a="focus" data-id="${p.id}"`, 'Comment')}${ic('send', '', 'data-a="shr"', 'Share')}<span class="r">${ic('mark', mySaves.has(p.id) ? 'saved' : '', `data-a="save" data-id="${p.id}"`, 'Save')}</span></div>
  <div class="pad"><b>${p.likes.length} likes</b><div><b>${esc(u)}</b> ${fmt(p.caption || '')}</div>${cm.map(c => `<div><b>${esc(c.profiles.username)}</b> ${fmt(c.body)}${c.profiles.username === me.username ? ' <button data-a="delcm" data-id="' + c.id + '" aria-label="Comment delete" style="color:var(--mut)">&times;</button>' : ''}</div>`).join('')}</div>
  <div class="cin"><input placeholder="Comment likho..." maxlength="200" data-c="${p.id}"><button data-a="cmt" data-id="${p.id}">Post</button></div></article>`;
};
const swap = p => document.querySelectorAll(`article[data-id="${p.id}"]`).forEach(el => { const d = document.createElement('div'); d.innerHTML = postH(p); el.replaceWith(d.firstElementChild); });
const tiles = a => a.length ? `<div class="grid">${a.map(p => `<div class="tile" data-a="open" data-id="${p.id}">${imgTag(p)}</div>`).join('')}</div>` : '<div class="empty">Yahan abhi kuch nahi hai</div>';

async function home() {
  const { data, error } = await sb.from('posts').select(Q).in('user_id', [...fol, me.id]).order('created_at', { ascending: false }).limit(40);
  if (error) toast(error.message);
  cache = data || [];
  return cache.length ? cache.map(postH).join('') : '<div class="empty">Feed khaali hai. Search se log follow karo!</div>';
}
async function like(id, force) {
  const p = cache.find(x => x.id == id); if (!p) return;
  const i = p.likes.findIndex(l => l.user_id === me.id);
  if (i < 0) { p.likes.push({ user_id: me.id }); swap(p); await sb.from('likes').insert({ post_id: p.id, user_id: me.id }); }
  else if (!force) { p.likes.splice(i, 1); swap(p); await sb.from('likes').delete().match({ post_id: p.id, user_id: me.id }); }
}
async function comment(id) {
  const i = document.querySelector(`[data-c="${id}"]`), t = i.value.trim(); if (!t) return;
  const r = await sb.from('comments').insert({ post_id: id, user_id: me.id, body: t }).select('id,body,created_at,profiles(username)').single();
  if (r.error) return toast(r.error.message);
  const p = cache.find(x => x.id == id); p.comments.push(r.data); swap(p);
}
async function del(id) { if (!confirm('Ye post delete karein?')) return; await sb.from('posts').delete().eq('id', id); closeOv(); render(); toast('Post delete ho gayi'); }
function openPost(id) {
  const p = cache.find(x => x.id == id), o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="in"><div class="row"><button data-a="close" aria-label="Back" style="font-size:22px">&larr;</button><b>Post</b></div>${postH(p)}</div>`;
  document.body.appendChild(o);
}

/* ---------- EXPLORE / CREATE / PROFILE / ACTIVITY ---------- */
async function explore() {
  const r = await sb.from('posts').select(Q).order('created_at', { ascending: false }).limit(60);
  if (r.error) toast(r.error.message);
  cache = r.data || []; let us = [];
  if (q) us = (await sb.from('profiles').select('id,username').ilike('username', `%${q}%`).limit(8)).data || [];
  return `<div style="padding:10px 14px"><input class="s" id="q" placeholder="User search karo, Enter dabao" value="${esc(q)}"></div>` +
    us.map(u => `<div class="row">${av(u.username, 44)}<b data-a="prof" data-u="${u.username}" style="cursor:pointer">${esc(u.username)}</b><span class="sp"></span>${u.id === me.id ? '' : fbtn(u.id)}</div>`).join('') + tiles(cache);
}
const shrink = f => new Promise(ok => { const im = new Image(); im.onload = () => { const s = Math.min(1, 1080 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(ok, 'image/jpeg', .82); }; im.src = URL.createObjectURL(f); });
function create() {
  file = null;
  return `<div style="padding:16px 14px;display:grid;gap:12px"><b style="font-size:18px">Nayi post</b>
  <label class="btn g" style="text-align:center;cursor:pointer">&#128247; Photo chuno<input type="file" id="files" accept="image/*" multiple hidden></label>
  <div class="media" id="pv" style="aspect-ratio:1"></div>
  <select id="flt">${Object.keys(FIL).map(n => `<option>${n}</option>`).join('')}</select>
  <textarea id="cap" rows="3" maxlength="300" placeholder="Caption likho..."></textarea>
  <button class="btn" data-a="share2">Share karo</button></div>`;
}
async function share() {
  if (!file) return toast('Pehle photo chuno');
  const path = `${me.id}/${Date.now()}.jpg`;
  const up = await sb.storage.from('posts').upload(path, file, { contentType: 'image/jpeg' });
  if (up.error) return toast(up.error.message);
  const url = sb.storage.from('posts').getPublicUrl(path).data.publicUrl;
  const r = await sb.from('posts').insert({ user_id: me.id, image_url: url, caption: $('#cap').value.trim(), filter: $('#flt').value });
  if (r.error) return toast(r.error.message);
  toast('Post share ho gayi!'); go('home');
}
const cnt = async (col, id) => (await sb.from('follows').select('*', { count: 'exact', head: true }).eq(col, id)).count || 0;
const fbtn = id => `<button class="btn ${fol.has(id) ? 'g' : ''}" data-a="follow" data-id="${id}">${fol.has(id) ? (pend.has(id) ? 'Requested' : 'Following') : 'Follow'}</button>`;
async function profile() {
  const { data: pr } = await sb.from('profiles').select('*').eq('username', pu || me.username).maybeSingle();
  if (!pr) return '<div class="empty">User nahi mila</div>';
  const [po, fr, fg] = await Promise.all([sb.from('posts').select(Q).eq('user_id', pr.id).order('created_at', { ascending: false }), cnt('following_id', pr.id), cnt('follower_id', pr.id)]);
  if (po.error) toast(po.error.message);
  cache = po.data || []; const mine = pr.id === me.id;
  return `<div class="pro"><div class="top">${av(pr.username, 80)}<div class="stat"><div><b>${cache.length}</b>posts</div><div><b>${fr}</b>followers</div><div><b>${fg}</b>following</div></div></div>
  <div style="margin:10px 0"><b>${esc(pr.username)}</b><div>${esc(pr.bio || '')}</div></div>
  ${mine ? '<button class="btn g" data-a="bio" style="width:100%">Bio badlo</button><button class="btn g" data-a="gosaved" style="width:100%;margin-top:8px">Saved posts</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="gorequests" style="width:100%;margin-top:8px">Follow requests</button><button class="btn g" data-a="togpriv" style="width:100%;margin-top:8px">Private account on/off</button><button class="btn g" data-a="out" style="width:100%;margin-top:8px">Logout</button>' : fbtn(pr.id).replace('class="btn', 'style="width:100%" class="btn') + '<button class="btn g" data-a="dmuser" data-id="' + pr.id + '" data-u="' + esc(pr.username) + '" style="width:100%;margin-top:8px">Message</button>'}</div>` + (pr.is_private && !mine && (!fol.has(pr.id) || pend.has(pr.id)) ? '<div class="empty">Ye account private hai. Posts dekhne ke liye follow request bhejo.</div>' : tiles(cache));
}
async function follow(id) {
  if (fol.has(id)) { fol.delete(id); await sb.from('follows').delete().match({ follower_id: me.id, following_id: id }); }
  else { fol.add(id); await sb.from('follows').insert({ follower_id: me.id, following_id: id }); }
  render();
}
async function bio() {
  const v = prompt('Apni bio likho', me.bio || ''); if (v === null) return;
  me.bio = v.slice(0, 120); await sb.from('profiles').update({ bio: me.bio }).eq('id', me.id); render();
}
async function activity() {
  const { data } = await sb.from('posts').select('likes(created_at,profiles(username)),comments(body,created_at,profiles(username))').eq('user_id', me.id);
  const ev = [];
  (data || []).forEach(p => { p.likes.forEach(l => ev.push([l.created_at, l.profiles.username, 'ne aapki post like ki'])); p.comments.forEach(c => ev.push([c.created_at, c.profiles.username, 'comment: ' + c.body])); });
  ev.sort((a, b) => a[0] < b[0] ? 1 : -1);
  return '<div style="padding:14px"><b style="font-size:18px">Activity</b></div>' + (ev.length ? ev.map(e => `<div class="row">${av(e[1], 40)}<span><b>${esc(e[1])}</b> ${esc(e[2])} <small style="color:var(--mut)">${ago(e[0])}</small></span></div>`).join('') : '<div class="empty">Abhi koi activity nahi.</div>');
}

/* ---------- EVENTS ---------- */
const theme = () => { const d = document.documentElement, dark = getComputedStyle(d).getPropertyValue('--bg').trim() === '#000'; d.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('theme', d.dataset.theme); } catch (e) {} };
try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id, u = b.dataset.u;
  if (a === 'nav') go(b.dataset.v);
  else if (a === 'like') like(id);
  else if (a === 'cmt') comment(id);
  else if (a === 'focus') document.querySelector(`[data-c="${id}"]`).focus();
  else if (a === 'prof') go('profile', u === me.username ? null : u);
  else if (a === 'follow') follow(id);
  else if (a === 'del') del(id);
  else if (a === 'share') share();
  else if (a === 'open') openPost(id);
  else if (a === 'close') closeOv();
  else if (a === 'bio') bio();
  else if (a === 'out') sb.auth.signOut().then(() => { me = null; fol = new Set(); closeOv(); authUI(); });
  else if (a === 'theme') theme();
  else if (a === 'shr') { try { navigator.clipboard.writeText(location.href); } catch (e) {} toast('Link copy ho gaya'); }
});
document.addEventListener('dblclick', e => { const m = e.target.closest('[data-a="dbl"]'); if (m) like(m.dataset.id, true); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.dataset.c) comment(e.target.dataset.c);
  else if (e.target.id === 'q') { q = e.target.value.trim(); render(); }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'file' && e.target.files[0]) { file = await shrink(e.target.files[0]); $('#pv').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Preview" style="filter:${FIL[$('#flt').value] || 'none'}">`; }
  else if (e.target.id === 'flt') { const i = $('#pv img'); if (i) i.style.filter = FIL[e.target.value] || 'none'; }
});
start();