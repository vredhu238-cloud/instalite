/* Calls: audio/video, speaker, mute, add person, audio<->video switch (call.js) */
let call = null, incoming = null, sigCh = null, sigFor = null, ringCtx = null, ringTimer = null, cpT = null;
const iceServers = () => [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }, ...((window.CONFIG && window.CONFIG.ICE) || [])];
const sendSig = (to, call_id, kind, payload, video) => sb.from('call_signals').insert({ call_id, from_id: me.id, to_id: to, kind, video: !!video, payload: payload || null });
const cs = p => `<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round">${p}</svg>`;
const CP = { spk: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14"/>', add: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6"/>' };
const cbtn = 'width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff;flex:none';
const cmark = (a, on) => { const b = document.querySelector(`[data-a="${a}"]`); if (b) { b.style.background = on ? '#fff' : 'rgba(255,255,255,.2)'; b.style.color = on ? '#111' : '#fff'; } };
const endIcon = () => `<span style="display:flex;transform:rotate(135deg)">${cs(DI.phone)}</span>`;
const nameOf = async id => { if (peers[id]) return peers[id]; const r = await sb.from('profiles').select('username').eq('id', id).maybeSingle(); peers[id] = r.data ? r.data.username : 'User'; return peers[id]; };
const setStatus = t => { const e = $('#cst'); if (e) e.textContent = t; };
const keys = o => Object.keys(o);

function listenCalls() {
  if (!me || sigFor === me.id) return;
  if (sigCh) sb.removeChannel(sigCh);
  sigFor = me.id;
  sb.from('call_signals').delete().lt('created_at', new Date(Date.now() - 864e5).toISOString()).then(() => {});
  sigCh = sb.channel('call-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `to_id=eq.${me.id}` }, p => onSig(p.new)).subscribe();
}
setInterval(() => { if (typeof me !== 'undefined' && me) listenCalls(); }, 1500);

async function onSig(s) {
  if (s.kind === 'ring') {
    if (call || incoming) return sendSig(s.from_id, s.call_id, 'decline');
    incoming = { id: s.call_id, from: s.from_id, name: null, video: s.video, members: (s.payload && s.payload.members) || [s.from_id], to: null };
    const name = await nameOf(s.from_id);
    if (incoming && incoming.id === s.call_id) { incoming.name = name; showIncoming(); }
    return;
  }
  if (!call) { if (s.kind === 'end' && incoming && incoming.id === s.call_id) { toast('Missed call from ' + (incoming.name || 'someone')); dismissIncoming(); } return; }
  if (call.id !== s.call_id) return;
  if (s.kind === 'offer') handleOffer(s);
  else if (s.kind === 'answer') onAnswer(s);
  else if (s.kind === 'decline') onDecline(s);
  else if (s.kind === 'end') dropPeer(s.from_id, false);
  else if (s.kind === 'mode') { const p = call.peers[s.from_id]; if (p) { p.video = !!(s.payload && s.payload.video); renderTiles(); } }
}

const gathered = pc => new Promise(res => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 2500);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
const descOf = pc => ({ type: pc.localDescription.type, sdp: pc.localDescription.sdp });

function newPeer(uid, name, asAnswerer) {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const peer = { id: uid, name, pc, stream: new MediaStream(), video: false, up: false, answered: false, cto: null };
  call.peers[uid] = peer;
  pc.ontrack = e => {
    peer.stream.addTrack(e.track);
    const v = document.querySelector(`#t-${uid} video`);
    if (v && v.srcObject !== peer.stream) { v.srcObject = peer.stream; v.volume = call.speaker ? 1 : .3; v.play().catch(() => {}); }
  };
  pc.oniceconnectionstatechange = () => { const d = $('#cdbg'); if (d) d.textContent = 'network: ' + pc.iceConnectionState; };
  pc.onconnectionstatechange = () => {
    if (!call || call.peers[uid] !== peer) return;
    if (pc.connectionState === 'connected') { peer.up = true; clearTimeout(peer.cto); callConnected(); }
    else if (pc.connectionState === 'failed') { toast(`Connection with ${peer.name} failed. The network may be blocking calls.`); dropPeer(uid, true); }
    else if (pc.connectionState === 'disconnected') setStatus('Reconnecting...');
  };
  if (!asAnswerer) {
    call.local.getAudioTracks().forEach(t => pc.addTrack(t, call.local));
    const vt = call.local.getVideoTracks()[0];
    if (vt) pc.addTrack(vt, call.local); else pc.addTransceiver('video', { direction: 'sendrecv' });
  }
  peer.cto = setTimeout(() => { if (call && call.peers[uid] === peer && !peer.up) { toast('Could not connect the call. The network may be blocking it.'); dropPeer(uid, true); } }, 30000);
  return peer;
}
function fixSenders(peer) {
  const at = call.local.getAudioTracks()[0] || null, vt = call.local.getVideoTracks()[0] || null;
  peer.pc.getTransceivers().forEach(t => {
    const k = t.receiver && t.receiver.track && t.receiver.track.kind;
    if (k === 'audio') { t.direction = 'sendrecv'; t.sender.replaceTrack(at).catch(() => {}); }
    else if (k === 'video') { t.direction = 'sendrecv'; t.sender.replaceTrack(vt).catch(() => {}); }
  });
}
const setAllVideoTrack = t => Object.values(call.peers).forEach(p => p.pc.getTransceivers().forEach(x => { if (x.receiver && x.receiver.track && x.receiver.track.kind === 'video') x.sender.replaceTrack(t).catch(() => {}); }));
const broadcast = (kind, payload) => keys(call.peers).forEach(uid => sendSig(uid, call.id, kind, payload, call.video));

async function offerTo(uid, name) {
  const peer = newPeer(uid, name, false); renderTiles();
  try {
    await peer.pc.setLocalDescription(await peer.pc.createOffer()); await gathered(peer.pc);
    await sendSig(uid, call.id, 'offer', descOf(peer.pc), call.video);
  } catch (e) { toast('Could not connect the call'); dropPeer(uid, true); }
}
async function handleOffer(s) {
  const uid = s.from_id, old = call.peers[uid];
  if (old) { clearTimeout(old.cto); try { old.pc.close(); } catch (e) {} delete call.peers[uid]; }
  const pd = call.pending[uid]; if (pd) { clearTimeout(pd.to); delete call.pending[uid]; }
  const name = await nameOf(uid); if (!call) return;
  const peer = newPeer(uid, name, true);
  peer.video = !!s.video; renderTiles(); setStatus('Connecting...');
  try {
    await peer.pc.setRemoteDescription(s.payload); fixSenders(peer);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer()); await gathered(peer.pc);
    await sendSig(uid, call.id, 'answer', descOf(peer.pc), call.video);
    peer.answered = true;
  } catch (e) { toast('Could not connect the call'); dropPeer(uid, true); }
}
async function onAnswer(s) {
  const peer = call.peers[s.from_id]; if (!peer || peer.answered) return;
  peer.answered = true; peer.video = !!s.video; setStatus('Connecting...');
  try { await peer.pc.setRemoteDescription(s.payload); } catch (e) { toast('Could not connect the call'); return dropPeer(s.from_id, true); }
  renderTiles();
}
function onDecline(s) {
  const pd = call.pending[s.from_id];
  if (pd) { clearTimeout(pd.to); delete call.pending[s.from_id]; toast(`${pd.name} declined`); }
  if (!keys(call.peers).length && !keys(call.pending).length) return endCall(false);
  renderTiles();
}
function addPending(uid, name) {
  call.pending[uid] = { id: uid, name, to: setTimeout(() => {
    if (!call || !call.pending[uid]) return;
    toast('No answer from ' + name); delete call.pending[uid]; sendSig(uid, call.id, 'end');
    if (!keys(call.peers).length && !keys(call.pending).length) return endCall(false);
    renderTiles();
  }, 45000) };
  renderTiles();
}
function dropPeer(uid, notify) {
  if (!call) return;
  const p = call.peers[uid], pd = call.pending[uid];
  if (!p && !pd) return;
  if (pd) { clearTimeout(pd.to); delete call.pending[uid]; }
  if (p) { clearTimeout(p.cto); try { p.pc.close(); } catch (e) {} delete call.peers[uid]; toast(p.name + ' left the call'); }
  if (notify) sendSig(uid, call.id, 'end');
  if (!keys(call.peers).length && !keys(call.pending).length) return endCall(false);
  renderTiles();
}

async function startCall(peer, video) {
  if (!peer) return;
  if (call || incoming) return toast('You are already in a call');
  if (!window.RTCPeerConnection || !navigator.mediaDevices) return toast('Calls are not supported on this browser');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }); }
  catch (e) { return toast(video ? 'Camera and microphone permission is needed' : 'Microphone permission is needed'); }
  call = { id: crypto.randomUUID(), local: stream, video: !!video, face: 'user', muted: false, speaker: true, peers: {}, pending: {}, t0: 0, tick: null };
  showCallUI('Calling...');
  addPending(peer.id, peer.username);
  await sendSig(peer.id, call.id, 'ring', { members: [me.id] }, video);
}
async function acceptCall() {
  const inc = incoming; if (!inc) return;
  stopRing(); clearTimeout(inc.to);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: inc.video ? { facingMode: 'user' } : false }); }
  catch (e) { toast('Camera or microphone permission is needed'); await sendSig(inc.from, inc.id, 'decline'); return dismissIncoming(); }
  document.querySelectorAll('.callui.inc').forEach(x => x.remove()); incoming = null;
  call = { id: inc.id, local: stream, video: !!inc.video, face: 'user', muted: false, speaker: true, peers: {}, pending: {}, t0: 0, tick: null };
  showCallUI('Connecting...');
  for (const uid of inc.members) await offerTo(uid, await nameOf(uid));
}
function declineCall() {
  const i = incoming; if (!i) return;
  sendSig(i.from, i.id, 'decline'); dismissIncoming();
  sb.from('call_signals').delete().eq('call_id', i.id).then(() => {});
}
function dismissIncoming() { stopRing(); if (incoming) clearTimeout(incoming.to); incoming = null; document.querySelectorAll('.callui.inc').forEach(x => x.remove()); }

async function invite(uid, name) {
  if (!call) return;
  if (keys(call.peers).length + keys(call.pending).length + 1 >= 4) return toast('A call can have up to 4 people');
  if (call.peers[uid] || call.pending[uid]) return toast('Already in the call');
  document.querySelectorAll('.callui.pick').forEach(x => x.remove());
  await sendSig(uid, call.id, 'ring', { members: [me.id, ...keys(call.peers)] }, call.video);
  addPending(uid, name); toast('Calling ' + name + '...');
}
function callConnected() {
  if (!call || call.t0) return;
  call.t0 = Date.now();
  call.tick = setInterval(() => { const s = ((Date.now() - call.t0) / 1000) | 0; setStatus(`${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`); }, 500);
}
function endCall(notify) {
  if (!call) return;
  const c = call; call = null;
  clearInterval(c.tick);
  [...keys(c.peers), ...keys(c.pending)].forEach(uid => { if (notify) sendSig(uid, c.id, 'end'); });
  Object.values(c.peers).forEach(p => { clearTimeout(p.cto); try { p.pc.close(); } catch (e) {} });
  Object.values(c.pending).forEach(p => clearTimeout(p.to));
  if (c.local) c.local.getTracks().forEach(t => t.stop());
  document.querySelectorAll('.callui').forEach(x => x.remove());
  sb.from('call_signals').delete().eq('call_id', c.id).then(() => {});
}

function renderTiles() {
  const box = $('#tiles'); if (!box || !call) return;
  const list = [...Object.values(call.peers).map(p => ({ id: p.id, name: p.name, video: p.video, stream: p.stream, wait: false })), ...Object.values(call.pending).map(p => ({ id: p.id, name: p.name, video: false, stream: null, wait: true }))];
  box.style.gridTemplateColumns = `repeat(${list.length <= 2 ? 1 : 2},1fr)`;
  box.innerHTML = list.map(t => `<div id="t-${t.id}" style="position:relative;background:#1b1b1b;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px solid #000"><video autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;visibility:${t.video ? 'visible' : 'hidden'}"></video>${t.video ? `<div style="position:absolute;left:12px;bottom:${list.length > 1 ? 10 : 130}px;text-shadow:0 1px 3px #000"><b>${esc(t.name)}</b></div>` : `${av(t.name, list.length > 2 ? 72 : 120)}<b style="font-size:18px;z-index:1">${esc(t.name)}</b>${t.wait ? '<span style="opacity:.8">Calling...</span>' : ''}`}</div>`).join('');
  list.forEach(t => { if (t.stream) { const v = document.querySelector(`#t-${t.id} video`); if (v) { v.srcObject = t.stream; v.volume = call.speaker ? 1 : .3; v.play().catch(() => {}); } } });
}
function refreshUI() {
  if (!call) return;
  const lv = $('#lv'); if (lv) { lv.style.display = call.video ? 'block' : 'none'; if (call.video) { lv.srcObject = call.local; lv.style.transform = call.face === 'user' ? 'scaleX(-1)' : 'none'; } }
  const fl = $('#cfl'); if (fl) fl.style.display = call.video ? 'flex' : 'none';
  cmark('cspk', call.speaker); cmark('cmute', call.muted); cmark('cvid', call.video);
}
function showCallUI(status) {
  const o = document.createElement('div'); o.className = 'callui';
  o.style.cssText = 'position:fixed;inset:0;z-index:70;background:#111;color:#fff;overflow:hidden';
  o.innerHTML = `<div id="tiles" style="position:absolute;inset:0;display:grid;grid-auto-rows:1fr"></div>
  <video id="lv" autoplay muted playsinline style="position:absolute;top:calc(56px + env(safe-area-inset-top,0px));right:12px;width:92px;height:134px;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.35);z-index:3;display:none"></video>
  <div style="position:absolute;top:calc(16px + env(safe-area-inset-top,0px));left:0;right:0;text-align:center;z-index:3;text-shadow:0 1px 3px #000"><div id="cst" style="font-size:18px;font-weight:600">${status}</div></div>
  <div id="cdbg" style="position:absolute;left:0;right:0;bottom:calc(92px + env(safe-area-inset-bottom,0px));text-align:center;font-size:11px;opacity:.5;z-index:3"></div>
  <div style="position:absolute;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:8px;z-index:3;padding:0 6px">
    <button data-a="cspk" aria-label="Speaker" style="${cbtn}">${cs(CP.spk)}</button>
    <button data-a="cmute" aria-label="Mute" style="${cbtn}">${cs(DI.mic)}</button>
    <button data-a="cvid" aria-label="Video on/off" style="${cbtn}">${cs(DI.video)}</button>
    <button data-a="cflip" id="cfl" aria-label="Switch camera" style="${cbtn};display:none">${cs(CI.flip)}</button>
    <button data-a="cadd" aria-label="Add person" style="${cbtn}">${cs(CP.add)}</button>
    <button data-a="cend" aria-label="End call" style="${cbtn};background:#e0245e">${endIcon()}</button>
  </div>`;
  document.body.appendChild(o); renderTiles(); refreshUI();
}
function showIncoming() {
  const i = incoming, o = document.createElement('div'); o.className = 'callui inc';
  o.style.cssText = 'position:fixed;inset:0;z-index:75;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px';
  o.innerHTML = `${av(i.name, 120)}<b style="font-size:24px">${esc(i.name)}</b><div style="opacity:.8">${i.members.length > 1 ? 'Group call' : i.video ? 'Incoming video call' : 'Incoming audio call'}</div>
  <div style="display:flex;gap:70px;margin-top:50px"><button data-a="cdec" aria-label="Decline" style="${cbtn};width:62px;height:62px;background:#e0245e">${endIcon()}</button><button data-a="cacc" aria-label="Accept" style="${cbtn};width:62px;height:62px;background:#2ecc71">${cs(i.video ? DI.video : DI.phone)}</button></div>`;
  document.body.appendChild(o); startRing();
  i.to = setTimeout(() => { if (incoming === i) { toast('Missed call from ' + i.name); sendSig(i.from, i.id, 'decline'); dismissIncoming(); } }, 45000);
}

async function openPicker() {
  if (!call) return;
  const o = document.createElement('div'); o.className = 'callui pick';
  o.style.cssText = 'position:fixed;inset:0;z-index:80;background:var(--bg);color:var(--fg);overflow:auto';
  o.innerHTML = `<div style="max-width:470px;margin:0 auto"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="cpclose" aria-label="Back" style="font-size:22px">&larr;</button><b>Add to call</b></div><div style="padding:10px 14px"><input class="s" id="cps" placeholder="Search people" autocomplete="off"></div><div id="cpl"></div></div>`;
  document.body.appendChild(o); fillPicker('');
}
async function fillPicker(v) {
  let rq = sb.from('profiles').select('id,username').neq('id', me.id).limit(30);
  if (v) rq = rq.ilike('username', `%${v}%`);
  const l = ((await rq).data || []).filter(p => call && !call.peers[p.id] && !call.pending[p.id]);
  const box = $('#cpl'); if (box) box.innerHTML = l.length ? l.map(p => `<button class="row" data-a="cinv" data-id="${p.id}" data-u="${esc(p.username)}" style="width:100%;text-align:left">${av(p.username, 44)}<b>${esc(p.username)}</b></button>`).join('') : '<div class="empty">No users found</div>';
}

function startRing() {
  stopRing();
  const beep = () => {
    try { ringCtx = ringCtx || new (window.AudioContext || window.webkitAudioContext)(); const o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.frequency.value = 440; o.connect(g); g.connect(ringCtx.destination); g.gain.setValueAtTime(.15, ringCtx.currentTime); o.start(); o.stop(ringCtx.currentTime + .8); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([500, 250, 500]);
  };
  beep(); ringTimer = setInterval(beep, 2500);
}
function stopRing() { clearInterval(ringTimer); ringTimer = null; if (navigator.vibrate) navigator.vibrate(0); }

function toggleMute() { if (!call) return; call.muted = !call.muted; call.local.getAudioTracks().forEach(t => t.enabled = !call.muted); refreshUI(); toast(call.muted ? 'Microphone muted' : 'Microphone on'); }
async function toggleSpeaker() {
  if (!call) return;
  call.speaker = !call.speaker; refreshUI();
  const els = [...document.querySelectorAll('#tiles video')]; els.forEach(v => v.volume = call.speaker ? 1 : .3);
  try {
    if (HTMLMediaElement.prototype.setSinkId && navigator.mediaDevices.enumerateDevices) {
      const outs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
      const want = call.speaker ? (outs.find(d => /speaker/i.test(d.label)) || outs.find(d => d.deviceId === 'default')) : outs.find(d => /earpiece|receiver|headset|headphone/i.test(d.label));
      if (want) els.forEach(v => v.setSinkId(want.deviceId).catch(() => {}));
    }
  } catch (e) {}
  toast(call.speaker ? 'Speaker on' : 'Speaker off (lower volume)');
}
async function toggleVideo() {
  if (!call) return;
  if (call.video) {
    call.local.getVideoTracks().forEach(t => { t.stop(); call.local.removeTrack(t); });
    setAllVideoTrack(null); call.video = false; toast('Switched to audio call');
  } else {
    let ns; try { ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: call.face }, audio: false }); } catch (e) { return toast('Camera permission is needed'); }
    const nt = ns.getVideoTracks()[0]; call.local.addTrack(nt); setAllVideoTrack(nt); call.video = true; toast('Video is on');
  }
  broadcast('mode', { video: call.video }); refreshUI();
}
async function flipCall() {
  if (!call || !call.video) return;
  const nf = call.face === 'user' ? 'environment' : 'user';
  call.local.getVideoTracks().forEach(t => { t.stop(); call.local.removeTrack(t); });
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nf }, audio: false }), nt = ns.getVideoTracks()[0];
    call.local.addTrack(nt); call.face = nf; setAllVideoTrack(nt);
  } catch (e) { toast('Could not switch the camera'); call.video = false; setAllVideoTrack(null); broadcast('mode', { video: false }); }
  refreshUI();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'cacc') acceptCall();
  else if (a === 'cdec') declineCall();
  else if (a === 'cend') endCall(true);
  else if (a === 'cmute') toggleMute();
  else if (a === 'cspk') toggleSpeaker();
  else if (a === 'cvid') toggleVideo();
  else if (a === 'cflip') flipCall();
  else if (a === 'cadd') openPicker();
  else if (a === 'cpclose') document.querySelectorAll('.callui.pick').forEach(x => x.remove());
  else if (a === 'cinv') invite(b.dataset.id, b.dataset.u);
});
document.addEventListener('input', e => { if (e.target.id === 'cps') { clearTimeout(cpT); const v = e.target.value.trim(); cpT = setTimeout(() => fillPicker(v), 250); } });