/* Audio/video calls: WebRTC, signaling through Supabase (call.js) */
let call = null, incoming = null, sigCh = null, sigFor = null, ringCtx = null, ringTimer = null;
const iceServers = () => [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, ...((window.CONFIG && window.CONFIG.ICE) || [])];
const sendSig = (to, call_id, kind, payload, video) => sb.from('call_signals').insert({ call_id, from_id: me.id, to_id: to, kind, video: !!video, payload: payload || null });
const cs = p => `<svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round">${p}</svg>`;
const cbtn = 'width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff';
const cmark = (a, on) => { const b = document.querySelector(`[data-a="${a}"]`); if (b) { b.style.background = on ? '#fff' : 'rgba(255,255,255,.2)'; b.style.color = on ? '#111' : '#fff'; } };
const endIcon = () => `<span style="display:flex;transform:rotate(135deg)">${cs(DI.phone)}</span>`;

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
    incoming = { id: s.call_id, from: s.from_id, name: null, video: s.video, offer: null, to: null };
    const p = await sb.from('profiles').select('username').eq('id', s.from_id).maybeSingle();
    if (incoming && incoming.id === s.call_id) { incoming.name = (p.data && p.data.username) || 'Someone'; showIncoming(); }
  } else if (s.kind === 'offer') { if (incoming && incoming.id === s.call_id) incoming.offer = s.payload; }
  else if (s.kind === 'answer') { if (call && call.id === s.call_id) onAnswer(s.payload); }
  else if (s.kind === 'decline') { if (call && call.id === s.call_id) { toast('Call declined'); endCall(false); } }
  else if (s.kind === 'end') {
    if (call && call.id === s.call_id) { toast('Call ended'); endCall(false); }
    else if (incoming && incoming.id === s.call_id) { toast('Missed call from ' + (incoming.name || 'someone')); dismissIncoming(); }
  }
}

function makePc() {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  pc.ontrack = e => { call.remote = e.streams[0]; const v = $('#rv'); if (v) { v.srcObject = e.streams[0]; v.play().catch(() => {}); } };
  pc.onconnectionstatechange = () => {
    if (!call) return;
    if (pc.connectionState === 'connected') callConnected();
    else if (pc.connectionState === 'failed') { toast('Call failed. The network may be blocking it.'); endCall(true); }
    else if (pc.connectionState === 'disconnected') setStatus('Reconnecting...');
  };
  call.pc = pc; return pc;
}
const gathered = pc => new Promise(res => {
  if (pc.iceGatheringState === 'complete') return res();
  const t = setTimeout(res, 3500);
  pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
});
const connTimeout = () => { call.cto = setTimeout(() => { if (call && !call.t0) { toast('Could not connect the call. The network may be blocking it.'); endCall(true); } }, 25000); };

async function startCall(peer, video) {
  if (!peer) return;
  if (call || incoming) return toast('You are already in a call');
  if (!window.RTCPeerConnection || !navigator.mediaDevices) return toast('Calls are not supported on this browser');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }); }
  catch (e) { return toast(video ? 'Camera and microphone permission is needed' : 'Microphone permission is needed'); }
  call = { id: crypto.randomUUID(), peer, video, role: 'caller', local: stream, remote: null, pc: null, face: 'user', muted: false, camOff: false, t0: 0, tick: null, to: null, cto: null };
  showCallUI('Calling...');
  const pc = makePc(); stream.getTracks().forEach(t => pc.addTrack(t, stream));
  const me1 = call.id;
  await sendSig(peer.id, call.id, 'ring', null, video);
  await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
  if (!call || call.id !== me1) return;
  await sendSig(peer.id, call.id, 'offer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, video);
  call.to = setTimeout(() => { if (call && !call.t0 && !call.answered) { toast('No answer'); endCall(true); } }, 45000);
}
async function onAnswer(p) {
  if (!call || call.answered) return;
  call.answered = true; clearTimeout(call.to); setStatus('Connecting...');
  try { await call.pc.setRemoteDescription(p); } catch (e) { toast('Could not connect the call'); return endCall(true); }
  connTimeout();
}
async function acceptCall() {
  const inc = incoming; if (!inc) return;
  stopRing(); clearTimeout(inc.to);
  for (let i = 0; i < 40 && !inc.offer; i++) await new Promise(r => setTimeout(r, 200));
  if (!inc.offer) { toast('Could not connect the call'); return dismissIncoming(); }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: inc.video ? { facingMode: 'user' } : false }); }
  catch (e) { toast('Camera or microphone permission is needed'); await sendSig(inc.from, inc.id, 'decline'); return dismissIncoming(); }
  document.querySelectorAll('.callui.inc').forEach(x => x.remove()); incoming = null;
  call = { id: inc.id, peer: { id: inc.from, username: inc.name }, video: inc.video, role: 'callee', local: stream, remote: null, pc: null, face: 'user', muted: false, camOff: false, t0: 0, tick: null, to: null, cto: null, answered: true };
  showCallUI('Connecting...');
  const pc = makePc(); stream.getTracks().forEach(t => pc.addTrack(t, stream));
  try {
    await pc.setRemoteDescription(inc.offer);
    await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
    await sendSig(call.peer.id, call.id, 'answer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, call.video);
  } catch (e) { toast('Could not connect the call'); return endCall(true); }
  connTimeout();
}
function declineCall() {
  const i = incoming; if (!i) return;
  sendSig(i.from, i.id, 'decline'); dismissIncoming();
  sb.from('call_signals').delete().eq('call_id', i.id).then(() => {});
}
function dismissIncoming() { stopRing(); if (incoming) clearTimeout(incoming.to); incoming = null; document.querySelectorAll('.callui.inc').forEach(x => x.remove()); }

function callConnected() {
  if (!call || call.t0) return;
  call.t0 = Date.now(); clearTimeout(call.cto); clearTimeout(call.to);
  call.tick = setInterval(() => { const s = ((Date.now() - call.t0) / 1000) | 0; setStatus(`${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`); }, 500);
}
const setStatus = t => { const e = $('#cst'); if (e) e.textContent = t; };
function endCall(notify) {
  if (!call) return;
  const c = call; call = null;
  clearTimeout(c.to); clearTimeout(c.cto); clearInterval(c.tick);
  if (notify) sendSig(c.peer.id, c.id, 'end');
  try { if (c.pc) c.pc.close(); } catch (e) {}
  if (c.local) c.local.getTracks().forEach(t => t.stop());
  document.querySelectorAll('.callui').forEach(x => x.remove());
  sb.from('call_signals').delete().eq('call_id', c.id).then(() => {});
}

function showCallUI(status) {
  const c = call, o = document.createElement('div'); o.className = 'callui';
  o.style.cssText = 'position:fixed;inset:0;z-index:70;background:#111;color:#fff;overflow:hidden';
  o.innerHTML = `<video id="rv" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${c.video ? '' : 'visibility:hidden'}"></video>
  ${c.video ? '' : `<div style="position:absolute;top:24%;left:0;right:0;display:flex;justify-content:center">${av(c.peer.username, 120)}</div>`}
  <video id="lv" autoplay muted playsinline style="position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:14px;width:96px;height:140px;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.3);z-index:2;display:${c.video ? 'block' : 'none'};transform:scaleX(-1)"></video>
  <div style="position:absolute;top:calc(20px + env(safe-area-inset-top,0px));left:16px;right:130px;z-index:2"><b style="font-size:20px;text-shadow:0 1px 3px #000">${esc(c.peer.username)}</b><div id="cst" style="opacity:.9;text-shadow:0 1px 3px #000">${status}</div></div>
  <div style="position:absolute;left:0;right:0;bottom:calc(34px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:16px;z-index:2">
    <button data-a="cmute" aria-label="Mute" style="${cbtn}">${cs(DI.mic)}</button>
    ${c.video ? `<button data-a="ccam" aria-label="Camera on/off" style="${cbtn}">${cs(DI.video)}</button><button data-a="cflip" aria-label="Switch camera" style="${cbtn}">${cs(CI.flip)}</button>` : ''}
    <button data-a="cend" aria-label="End call" style="${cbtn};background:#e0245e">${endIcon()}</button>
  </div>`;
  document.body.appendChild(o);
  const lv = $('#lv'); if (lv && c.video) lv.srcObject = c.local;
}
function showIncoming() {
  const i = incoming, o = document.createElement('div'); o.className = 'callui inc';
  o.style.cssText = 'position:fixed;inset:0;z-index:75;background:#111;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px';
  o.innerHTML = `${av(i.name, 120)}<b style="font-size:24px">${esc(i.name)}</b><div style="opacity:.8">${i.video ? 'Incoming video call' : 'Incoming audio call'}</div>
  <div style="display:flex;gap:70px;margin-top:50px"><button data-a="cdec" aria-label="Decline" style="${cbtn};background:#e0245e">${endIcon()}</button><button data-a="cacc" aria-label="Accept" style="${cbtn};background:#2ecc71">${cs(i.video ? DI.video : DI.phone)}</button></div>`;
  document.body.appendChild(o); startRing();
  i.to = setTimeout(() => { if (incoming === i) { toast('Missed call from ' + i.name); sendSig(i.from, i.id, 'decline'); dismissIncoming(); } }, 45000);
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

function toggleMute() { if (!call) return; call.muted = !call.muted; call.local.getAudioTracks().forEach(t => t.enabled = !call.muted); cmark('cmute', call.muted); }
function toggleCam() { if (!call) return; call.camOff = !call.camOff; call.local.getVideoTracks().forEach(t => t.enabled = !call.camOff); cmark('ccam', call.camOff); }
async function flipCall() {
  if (!call || !call.video) return;
  const nf = call.face === 'user' ? 'environment' : 'user';
  call.local.getVideoTracks().forEach(t => { t.stop(); call.local.removeTrack(t); });
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nf }, audio: false }), nt = ns.getVideoTracks()[0];
    const sender = call.pc.getSenders().find(x => x.track === null || (x.track && x.track.kind === 'video'));
    if (sender) await sender.replaceTrack(nt);
    nt.enabled = !call.camOff; call.local.addTrack(nt); call.face = nf;
    const lv = $('#lv'); if (lv) { lv.srcObject = call.local; lv.style.transform = nf === 'user' ? 'scaleX(-1)' : 'none'; }
  } catch (e) { toast('Could not switch the camera'); }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'cacc') acceptCall();
  else if (a === 'cdec') declineCall();
  else if (a === 'cend') endCall(true);
  else if (a === 'cmute') toggleMute();
  else if (a === 'ccam') toggleCam();
  else if (a === 'cflip') flipCall();
});