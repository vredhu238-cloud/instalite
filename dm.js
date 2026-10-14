/* Direct Messages: search, photos/videos, voice, emoji, realtime (dm.js) */
document.head.insertAdjacentHTML('beforeend', '<style>@media(max-width:899px){body:has(#dmi) nav,body:has(#dmi) header{display:none!important}#app:has(#dmi){padding-bottom:0;min-height:0;height:100vh;height:100dvh;display:flex;flex-direction:column}#app:has(#dmi) #msgs{flex:1;height:auto!important;min-height:0}}.cbar button{display:flex;color:inherit;padding:6px}.cbar svg,.dmh svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}#emo{display:none;grid-template-columns:repeat(8,1fr);gap:2px;max-height:170px;overflow-y:auto;padding:6px 0 8px}#emo button{font-size:24px;padding:4px}</style>');
const DI = {
  phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
  video: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  cam: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  mic: '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'
};
const dsvg = k => `<svg viewBox="0 0 24 24">${DI[k]}</svg>`;
const EMO = '😀 😁 😂 🤣 😊 😍 😘 😎 🤩 🥳 😇 🙂 😉 😋 🤔 😴 😢 😭 😡 🤯 😱 🙄 😬 🤗 👍 👎 👏 🙏 💪 🙌 👌 ✌️ 🤞 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 🔥 ✨ 🎉 🎂 🎁 💯 ✅ ❌ ⭐ 🌹 🌈 ☀️ 🌙 ☕ 🍕 🍔 🎵 📸 🏏 ⚽ 🚗 🏍️ 🇮🇳'.split(' ');

let cp = null, dmCh = null, dmFor = null, inboxCache = { conv: '', others: '' }, msT = null;
const peers = {};
const dmNames = async ids => { const need = ids.filter(i => !peers[i]); if (!need.length) return; const { data } = await sb.from('profiles').select('id,username').in('id', need); (data || []).forEach(p => peers[p.id] = p.username); };
const prevOf = m => m.media_type === 'image' ? 'Photo' : m.media_type === 'video' ? 'Video' : m.media_type === 'audio' ? 'Voice message' : (m.body || '').slice(0, 40);

const bub = m => {
  const mine = m.sender_id === me.id;
  let inner, pad = 'padding:8px 12px', bg = mine ? 'background:var(--blue);color:#fff;' : 'background:var(--card);border:1px solid var(--line);';
  if (m.media_type === 'image') { inner = `<img src="${m.media_url}" data-a="dmimg" data-src="${m.media_url}" alt="Photo" style="display:block;max-width:240px;width:100%;border-radius:14px">`; pad = 'padding:0'; bg = ''; }
  else if (m.media_type === 'video') { inner = `<video src="${m.media_url}" controls playsinline preload="metadata" style="display:block;max-width:240px;width:100%;border-radius:14px"></video>`; pad = 'padding:0'; bg = ''; }
  else if (m.media_type === 'audio') inner = `<audio src="${m.media_url}" controls preload="none" style="max-width:220px;height:36px"></audio>`;
  else inner = esc(m.body || '');
  return `<div data-mid="${m.id}" style="max-width:78%;${pad};border-radius:18px;word-break:break-word;align-self:${mine ? 'flex-end' : 'flex-start'};${bg}">${inner}</div>`;
};
function addBub(m) { const b = $('#msgs'); if (!b || b.querySelector(`[data-mid="${m.id}"]`)) return; const e = b.querySelector('.empty'); if (e) e.remove(); b.insertAdjacentHTML('beforeend', bub(m)); b.scrollTop = b.scrollHeight; }

function listen() {
  if (!me || (dmCh && dmFor === me.id)) return;
  if (dmCh) sb.removeChannel(dmCh);
  dmFor = me.id;
  dmCh = sb.channel('dm-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` }, p => {
    const m = p.new;
    if (view === 'chat' && cp && m.sender_id === cp.id) { addBub(m); sb.from('messages').update({ read: true }).eq('id', m.id).then(() => {}); }
    else if (view === 'inbox') render();
    else toast('New message');
  }).subscribe();
}

async function inbox() {
  const { data, error } = await sb.from('messages').select('*').or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(200);
  if (error) toast(error.message);
  const last = {}, unread = {};
  (data || []).forEach(m => { const o = m.sender_id === me.id ? m.receiver_id : m.sender_id; if (!last[o]) last[o] = m; if (m.receiver_id === me.id && !m.read) unread[o] = (unread[o] || 0) + 1; });
  const ids = Object.keys(last); await dmNames(ids);
  const others = (await sb.from('profiles').select('id,username').neq('id', me.id).limit(20)).data || [];
  others.forEach(p => peers[p.id] = p.username);
  inboxCache.conv = ids.length ? ids.map(o => `<div class="row" data-a="dmopen" data-id="${o}" style="cursor:pointer">${av(peers[o], 48)}<div class="sp"><b>${esc(peers[o])}</b><div style="color:var(--mut)">${last[o].sender_id === me.id ? 'You: ' : ''}${esc(prevOf(last[o]))}</div></div>${unread[o] ? `<span class="cnt" style="position:static;background:var(--blue)">${unread[o]}</span>` : ''}</div>`).join('') : '<div class="empty" style="padding:24px">No chats yet</div>';
  inboxCache.others = '<div style="padding:14px 14px 4px;color:var(--mut)"><b>Start a new message</b></div>' + others.filter(p => !last[p.id]).map(p => `<div class="row" data-a="dmopen" data-id="${p.id}" style="cursor:pointer">${av(p.username, 40)}<b>${esc(p.username)}</b></div>`).join('');
  return `<div style="padding:14px 14px 4px"><b style="font-size:20px">Messages</b></div><div style="padding:8px 14px"><input class="s" id="ms" placeholder="Search" autocomplete="off"></div><div id="mlist">${inboxCache.conv}${inboxCache.others}</div>`;
}
async function searchInbox(v) {
  const box = $('#mlist'); if (!box) return;
  if (!v) { box.innerHTML = inboxCache.conv + inboxCache.others; return; }
  const r = await sb.from('profiles').select('id,username').ilike('username', `%${v}%`).neq('id', me.id).limit(20);
  const l = r.data || []; l.forEach(p => peers[p.id] = p.username);
  box.innerHTML = l.length ? l.map(p => `<div class="row" data-a="dmopen" data-id="${p.id}" style="cursor:pointer">${av(p.username, 44)}<b>${esc(p.username)}</b></div>`).join('') : '<div class="empty">No users found</div>';
}

async function chat() {
  if (!cp) return inbox();
  if (rec && rec.state === 'recording') stopRec(false);
  const { data, error } = await sb.from('messages').select('*').or(`and(sender_id.eq.${me.id},receiver_id.eq.${cp.id}),and(sender_id.eq.${cp.id},receiver_id.eq.${me.id})`).order('created_at').limit(200);
  if (error) toast(error.message);
  await sb.from('messages').update({ read: true }).eq('receiver_id', me.id).eq('sender_id', cp.id).eq('read', false);
  setTimeout(() => { const b = $('#msgs'); if (b) b.scrollTop = b.scrollHeight; const i = $('#dmi'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); }, 80);
  return `<div class="row dmh" style="border-bottom:1px solid var(--line)"><button data-a="dmback" aria-label="Back" style="font-size:22px">&larr;</button>${av(cp.username, 32)}<b class="sp" data-a="prof" data-u="${esc(cp.username)}" style="cursor:pointer">${esc(cp.username)}</b><button data-a="callaudio" aria-label="Audio call" style="display:flex;padding:6px">${dsvg('phone')}</button><button data-a="callvideo" aria-label="Video call" style="display:flex;padding:6px">${dsvg('video')}</button></div>
  <div id="msgs" style="padding:12px;height:calc(100vh - 230px);overflow-y:auto;display:flex;flex-direction:column;gap:6px">${(data || []).map(bub).join('') || '<div class="empty">Send the first message</div>'}</div>
  <div id="cmp" style="padding:6px 10px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line)">
    <div id="emo">${EMO.map(x => `<button data-a="dmemoji" data-e="${x}">${x}</button>`).join('')}</div>
    <div class="cbar" style="display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:28px;padding:4px 8px 4px 4px">
      <button data-a="dmcam" aria-label="Camera" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#f09433,#dc2743,#bc1888);color:#fff;align-items:center;justify-content:center;padding:0">${dsvg('cam')}</button>
      <input id="dmi" placeholder="Message..." maxlength="500" autocomplete="off" style="flex:1;min-width:0;border:0;background:none;color:inherit;font:inherit;padding:10px 4px;outline:none">
      <span id="cr" style="display:flex;align-items:center"><button data-a="dmrec" aria-label="Voice message">${dsvg('mic')}</button><button data-a="dmpick" aria-label="Photo or video">${dsvg('img')}</button><button data-a="dmemo" aria-label="Emoji">${dsvg('smile')}</button></span>
      <button data-a="dmsend" id="dmsendb" style="display:none;color:var(--blue);font-weight:700;padding:6px 10px">Send</button>
    </div>
    <div id="rbar" style="display:none;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:28px;padding:10px 16px"><span style="width:10px;height:10px;border-radius:50%;background:var(--red)"></span><b id="rt" class="sp">0:00</b><button data-a="dmrcancel" style="color:var(--mut)">Cancel</button><button data-a="dmrsend" style="color:var(--blue);font-weight:700">Send</button></div>
    <input type="file" id="dmfile" accept="image/*,video/*" multiple hidden>
  </div>`;
}

async function dmSend() {
  const i = $('#dmi'), t = i.value.trim(); if (!t || !cp) return;
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
  const r = await sb.from('messages').insert({ sender_id: me.id, receiver_id: cp.id, body: t }).select().single();
  if (r.error) return toast(r.error.message);
  addBub(r.data);
}
async function sendMedia(blob, type) {
  if (!cp) return;
  const mt = (blob.type || '').split(';')[0];
  const ext = type === 'image' ? 'jpg' : type === 'audio' ? (mt.includes('mp4') ? 'm4a' : 'webm') : (((blob.name || '').split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || 'mp4');
  const path = `${me.id}/m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  toast('Sending...');
  const up = await sb.storage.from('posts').upload(path, blob, { contentType: mt || (type === 'image' ? 'image/jpeg' : type === 'audio' ? 'audio/webm' : 'video/mp4') });
  if (up.error) return toast(up.error.message);
  const r = await sb.from('messages').insert({ sender_id: me.id, receiver_id: cp.id, media_url: sb.storage.from('posts').getPublicUrl(path).data.publicUrl, media_type: type }).select().single();
  if (r.error) return toast(r.error.message);
  addBub(r.data);
}

function addEmoji(em) {
  const i = $('#dmi'), s = i.selectionStart ?? i.value.length, e = i.selectionEnd ?? s;
  i.value = i.value.slice(0, s) + em + i.value.slice(e); i.focus();
  i.setSelectionRange(s + em.length, s + em.length); i.dispatchEvent(new Event('input', { bubbles: true }));
}
function showImg(src) {
  const o = document.createElement('div'); o.className = 'ov sv im'; o.dataset.a = 'dmimgx';
  o.innerHTML = `<button data-a="dmimgx" aria-label="Close" style="position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:14px;color:#fff;font-size:30px;z-index:3">&times;</button><img src="${src}" alt="Photo" style="max-width:100%;max-height:100%;object-fit:contain">`;
  document.body.appendChild(o);
}

let rec = null, recStream = null, recChunks = [], recTimer = null, recT0 = 0, recSendFlag = false;
async function startRec() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice messages are not supported on this browser');
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Microphone permission is needed'); }
  const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
  recChunks = []; rec = new MediaRecorder(recStream, mt ? { mimeType: mt } : undefined);
  rec.ondataavailable = ev => { if (ev.data && ev.data.size) recChunks.push(ev.data); };
  rec.onstop = async () => {
    recStream.getTracks().forEach(t => t.stop()); clearInterval(recTimer);
    const bar = $('.cbar'), rb = $('#rbar'); if (bar) bar.style.display = 'flex'; if (rb) rb.style.display = 'none';
    if (recSendFlag && recChunks.length) {
      if (Date.now() - recT0 < 800) return toast('Voice message is too short');
      await sendMedia(new Blob(recChunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] }), 'audio');
    }
  };
  rec.start(); recT0 = Date.now();
  $('.cbar').style.display = 'none'; $('#rbar').style.display = 'flex';
  recTimer = setInterval(() => { const s = ((Date.now() - recT0) / 1000) | 0, t = $('#rt'); if (t) t.textContent = `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`; if (s >= 300) stopRec(true); }, 500);
}
function stopRec(send) { recSendFlag = send; if (rec && rec.state !== 'inactive') rec.stop(); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'dmopen') { cp = { id: b.dataset.id, username: peers[b.dataset.id] }; go('chat'); }
  else if (a === 'dmback') go('inbox');
  else if (a === 'dmsend') dmSend();
  else if (a === 'dmpick') $('#dmfile').click();
  else if (a === 'dmemo') { const p = $('#emo'); p.style.display = p.style.display === 'grid' ? 'none' : 'grid'; }
  else if (a === 'dmemoji') addEmoji(b.dataset.e);
  else if (a === 'dmrec') startRec();
  else if (a === 'dmrcancel') stopRec(false);
  else if (a === 'dmrsend') stopRec(true);
  else if (a === 'dmimg') showImg(b.dataset.src);
  else if (a === 'dmimgx') document.querySelectorAll('.ov.im').forEach(x => x.remove());
  else if (a === 'callaudio' || a === 'callvideo') { if (typeof startCall === 'function') startCall(cp, a === 'callvideo'); else toast('Calling will be enabled in the next step'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'dmi') dmSend(); });
document.addEventListener('input', e => {
  if (e.target.id === 'dmi') { const has = e.target.value.trim().length > 0; $('#cr').style.display = has ? 'none' : 'flex'; $('#dmsendb').style.display = has ? 'flex' : 'none'; }
  else if (e.target.id === 'ms') { clearTimeout(msT); const v = e.target.value.trim().toLowerCase(); msT = setTimeout(() => searchInbox(v), 250); }
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'dmfile' || !e.target.files.length) return;
  const files = [...e.target.files].slice(0, 5); e.target.value = '';
  for (const f of files) {
    if (f.type.startsWith('image/')) await sendMedia(await shrink(f), 'image');
    else if (f.type.startsWith('video/')) { if (f.size > 25 * 1024 * 1024) { toast('Video must be under 25 MB'); continue; } await sendMedia(f, 'video'); }
  }
});