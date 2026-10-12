/* Direct Messages: realtime chat (dm.js) */
let cp = null, dmCh = null, dmFor = null;
const peers = {};
const dmNames = async ids => { const need = ids.filter(i => !peers[i]); if (!need.length) return; const { data } = await sb.from('profiles').select('id,username').in('id', need); (data || []).forEach(p => peers[p.id] = p.username); };
const bub = m => { const mine = m.sender_id === me.id; return `<div data-mid="${m.id}" style="max-width:75%;padding:8px 12px;border-radius:18px;word-break:break-word;align-self:${mine ? 'flex-end' : 'flex-start'};background:${mine ? 'var(--blue)' : 'var(--card)'};color:${mine ? '#fff' : 'inherit'};border:${mine ? '0' : '1px solid var(--line)'}">${esc(m.body)}</div>`; };
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
  return '<div style="padding:14px"><b style="font-size:18px">Messages</b></div>' +
    (ids.length ? ids.map(o => `<div class="row" data-a="dmopen" data-id="${o}" style="cursor:pointer">${av(peers[o], 48)}<div class="sp"><b>${esc(peers[o])}</b><div style="color:var(--mut)">${last[o].sender_id === me.id ? 'You: ' : ''}${esc(last[o].body.slice(0, 40))}</div></div>${unread[o] ? `<span class="cnt" style="position:static;background:var(--blue)">${unread[o]}</span>` : ''}</div>`).join('') : '<div class="empty" style="padding:24px">No chats yet</div>') +
    '<div style="padding:14px 14px 4px;color:var(--mut)"><b>Start a new message</b></div>' +
    others.filter(p => !last[p.id]).map(p => `<div class="row" data-a="dmopen" data-id="${p.id}" style="cursor:pointer">${av(p.username, 40)}<b>${esc(p.username)}</b></div>`).join('');
}

async function chat() {
  if (!cp) return inbox();
  const { data, error } = await sb.from('messages').select('*').or(`and(sender_id.eq.${me.id},receiver_id.eq.${cp.id}),and(sender_id.eq.${cp.id},receiver_id.eq.${me.id})`).order('created_at').limit(200);
  if (error) toast(error.message);
  await sb.from('messages').update({ read: true }).eq('receiver_id', me.id).eq('sender_id', cp.id).eq('read', false);
  setTimeout(() => { const b = $('#msgs'); if (b) b.scrollTop = b.scrollHeight; const i = $('#dmi'); if (i) i.focus(); }, 80);
  return `<div class="row" style="border-bottom:1px solid var(--line)"><button data-a="dmback" aria-label="Back" style="font-size:22px">&larr;</button>${av(cp.username, 32)}<b data-a="prof" data-u="${esc(cp.username)}" style="cursor:pointer">${esc(cp.username)}</b></div>
  <div id="msgs" style="padding:12px;height:calc(100vh - 230px);overflow-y:auto;display:flex;flex-direction:column;gap:6px">${(data || []).map(bub).join('') || '<div class="empty">Send the first message</div>'}</div>
  <div class="cin" style="padding:8px 12px"><input id="dmi" placeholder="Message..." maxlength="500"><button data-a="dmsend">Send</button></div>`;
}

async function dmSend() {
  const i = $('#dmi'), t = i.value.trim(); if (!t || !cp) return; i.value = '';
  const r = await sb.from('messages').insert({ sender_id: me.id, receiver_id: cp.id, body: t }).select().single();
  if (r.error) return toast(r.error.message);
  addBub(r.data);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'dmopen') { cp = { id: b.dataset.id, username: peers[b.dataset.id] }; go('chat'); }
  else if (a === 'dmback') go('inbox');
  else if (a === 'dmsend') dmSend();
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'dmi') dmSend(); });
