/* Extras: Message button, unread badges, saved posts, notifications (extras.js) */
let mySaves = new Set(), svFor = null, xCh = null, xFor = null;
document.head.insertAdjacentHTML('beforeend', '<style>.bdg{position:absolute;top:0;left:18px;background:var(--red);color:#fff;font:700 10px/16px sans-serif;min-width:16px;height:16px;border-radius:8px;text-align:center;padding:0 4px;font-style:normal}@media(min-width:900px){.bdg{top:8px;left:30px}}</style>');

async function ensureSaves() {
  ICO.mark = '<path d="M6 3h12v18l-6-4-6 4z"/>';
  if (svFor === me.id) return;
  svFor = me.id;
  const { data } = await sb.from('saves').select('post_id').eq('user_id', me.id);
  mySaves = new Set((data || []).map(x => x.post_id));
}

const setBdg = (v, c) => document.querySelectorAll(`[data-a="nav"][data-v="${v}"]`).forEach(b => {
  b.style.position = 'relative';
  const d = b.querySelector('.bdg'); if (d) d.remove();
  if (c > 0) b.insertAdjacentHTML('beforeend', `<i class="bdg">${c > 9 ? '9+' : c}</i>`);
});
async function badges() {
  if (!me) return;
  const c1 = (t, col) => sb.from(t).select('*', { count: 'exact', head: true }).eq(col, me.id).eq('read', false);
  const [m, n] = await Promise.all([c1('messages', 'receiver_id'), c1('notifications', 'user_id')]);
  setBdg('inbox', m.count || 0); setBdg('activity', n.count || 0);
  if (xCh && xFor === me.id) return;
  if (xCh) sb.removeChannel(xCh);
  xFor = me.id;
  xCh = sb.channel('x-' + me.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` }, () => { toast('Nayi notification'); badges(); if (view === 'activity') render(); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` }, () => badges())
    .subscribe();
}

async function toggleSave(id) {
  id = +id;
  if (mySaves.has(id)) { mySaves.delete(id); await sb.from('saves').delete().match({ user_id: me.id, post_id: id }); toast('Saved se hata diya'); }
  else { mySaves.add(id); await sb.from('saves').insert({ user_id: me.id, post_id: id }); toast('Post save ho gayi'); }
  const p = cache.find(x => x.id == id); if (p) swap(p);
}
async function saved() {
  const { data: s } = await sb.from('saves').select('post_id').eq('user_id', me.id).order('created_at', { ascending: false });
  const ids = (s || []).map(x => x.post_id); let posts = [];
  if (ids.length) { const r = await sb.from('posts').select(Q).in('id', ids); if (r.error) toast(r.error.message); posts = r.data || []; }
  cache = posts;
  return '<div class="row" style="border-bottom:1px solid var(--line)"><button data-a="nav" data-v="profile" aria-label="Back" style="font-size:22px">&larr;</button><b>Saved posts</b></div>' + tiles(posts);
}

async function notifs() {
  const { data, error } = await sb.from('notifications').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50);
  if (error) toast(error.message);
  const list = data || [], ids = [...new Set(list.map(n => n.actor_id))], nm = {};
  if (ids.length) ((await sb.from('profiles').select('id,username').in('id', ids)).data || []).forEach(p => nm[p.id] = p.username);
  sb.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false).then(() => setBdg('activity', 0));
  const T = { like: 'ne aapki post like ki', comment: 'ne comment kiya', follow: 'ne aapko follow kiya' };
  return '<div style="padding:14px"><b style="font-size:18px">Notifications</b></div>' + (list.length ? list.map(n => {
    const u = nm[n.actor_id] || 'user';
    return `<div class="row"${n.read ? '' : ' style="background:var(--card)"'}>${av(u, 40)}<span><b data-a="prof" data-u="${esc(u)}" style="cursor:pointer">${esc(u)}</b> ${T[n.type] || ''}${n.body ? ': ' + esc(n.body) : ''} <small style="color:var(--mut)">${ago(n.created_at)}</small></span></div>`;
  }).join('') : '<div class="empty">Abhi koi notification nahi</div>');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'save') toggleSave(b.dataset.id);
  else if (a === 'gosaved') go('saved');
  else if (a === 'dmuser') { peers[b.dataset.id] = b.dataset.u; cp = { id: b.dataset.id, username: b.dataset.u }; go('chat'); }
});