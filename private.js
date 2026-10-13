/* Private account + follow requests (private.js) */
let pend = new Set();
async function ensureB() {
  const { data } = await sb.from('follows').select('following_id').eq('follower_id', me.id).eq('status', 'pending');
  pend = new Set((data || []).map(x => x.following_id));
}
async function requests() {
  const { data, error } = await sb.from('follows').select('follower_id,created_at').eq('following_id', me.id).eq('status', 'pending').order('created_at', { ascending: false });
  if (error) toast(error.message);
  const list = data || [], nm = {};
  if (list.length) ((await sb.from('profiles').select('id,username').in('id', list.map(x => x.follower_id))).data || []).forEach(p => nm[p.id] = p.username);
  return '<div class="row" style="border-bottom:1px solid var(--line)"><button data-a="nav" data-v="profile" aria-label="Back" style="font-size:22px">&larr;</button><b>Follow requests</b></div>' +
    (list.length ? list.map(x => { const u = nm[x.follower_id] || 'user'; return `<div class="row">${av(u, 44)}<b class="sp" data-a="prof" data-u="${esc(u)}" style="cursor:pointer">${esc(u)}</b><button class="btn" data-a="acc" data-id="${x.follower_id}">Accept</button><button class="btn g" data-a="rej" data-id="${x.follower_id}">Decline</button></div>`; }).join('') : '<div class="empty">No pending requests</div>');
}
async function answerReq(id, ok) {
  const t = sb.from('follows');
  const r = ok ? await t.update({ status: 'accepted' }).match({ follower_id: id, following_id: me.id }) : await t.delete().match({ follower_id: id, following_id: me.id });
  if (r.error) return toast(r.error.message);
  toast(ok ? 'Request accepted' : 'Request declined'); render();
}
async function togPriv() {
  const v = !me.is_private;
  const r = await sb.from('profiles').update({ is_private: v }).eq('id', me.id);
  if (r.error) return toast(r.error.message);
  me.is_private = v; toast(v ? 'Account is now Private' : 'Account is now Public'); render();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'gorequests') go('requests');
  else if (a === 'acc') answerReq(b.dataset.id, true);
  else if (a === 'rej') answerReq(b.dataset.id, false);
  else if (a === 'togpriv') togPriv();
});