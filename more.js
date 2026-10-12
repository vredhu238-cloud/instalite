/* More: comment delete, caption edit, hashtags/mentions, multi-photo carousel (more.js) */
let curTag = '', fileList = [];

const fmt = s => esc(s)
  .replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, (m, a, t) => `${a}<a data-a="tag" data-t="${t.toLowerCase()}" style="color:var(--blue);cursor:pointer">#${t}</a>`)
  .replace(/(^|\s)@([a-zA-Z0-9_.]{3,20})/g, (m, a, u) => `${a}<a data-a="prof" data-u="${u.toLowerCase()}" style="color:var(--blue);cursor:pointer">@${u}</a>`);

const feed = p => {
  const a = p.image_urls;
  if (!a || a.length < 2) return imgTag(p);
  return `<div class="car" data-n="${a.length}">${a.map(s => `<img src="${s}" alt="${esc(p.caption || '')}" style="filter:${FIL[p.filter] || 'none'}">`).join('')}</div><span class="cnt">1/${a.length}</span><div class="dots">${a.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
};

async function tagPage() {
  const r = await sb.from('posts').select(Q).ilike('caption', '%#' + curTag + '%').order('created_at', { ascending: false }).limit(60);
  if (r.error) toast(r.error.message);
  cache = r.data || [];
  return `<div class="row" style="border-bottom:1px solid var(--line)"><button data-a="nav" data-v="explore" aria-label="Back" style="font-size:22px">&larr;</button><b>#${esc(curTag)}</b><span class="sp"></span><small style="color:var(--mut)">${cache.length} posts</small></div>` + tiles(cache);
}

async function editCap(id) {
  const p = cache.find(x => x.id == id); if (!p) return;
  const v = prompt('Caption badlo', p.caption || ''); if (v === null) return;
  const r = await sb.from('posts').update({ caption: v.slice(0, 300) }).eq('id', id);
  if (r.error) return toast(r.error.message);
  p.caption = v.slice(0, 300); swap(p); toast('Caption badal gaya');
}

async function delCm(id) {
  if (!confirm('Ye comment delete karein?')) return;
  const r = await sb.from('comments').delete().eq('id', id);
  if (r.error) return toast(r.error.message);
  cache.forEach(p => { const i = p.comments.findIndex(c => c.id == id); if (i >= 0) { p.comments.splice(i, 1); swap(p); } });
}

async function share2() {
  const fl = file && fileList.length ? fileList : [];
  if (!fl.length) return toast('Pehle photo chuno');
  toast('Upload ho raha hai...');
  const urls = [];
  for (const f of fl) {
    const path = `${me.id}/${Date.now()}-${urls.length}.jpg`;
    const up = await sb.storage.from('posts').upload(path, f, { contentType: 'image/jpeg' });
    if (up.error) return toast(up.error.message);
    urls.push(sb.storage.from('posts').getPublicUrl(path).data.publicUrl);
  }
  const r = await sb.from('posts').insert({ user_id: me.id, image_url: urls[0], image_urls: urls.length > 1 ? urls : null, caption: $('#cap').value.trim(), filter: $('#flt').value });
  if (r.error) return toast(r.error.message);
  fileList = []; toast('Post share ho gayi!'); go('home');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === 'delcm') delCm(id);
  else if (a === 'editcap') editCap(id);
  else if (a === 'tag') { curTag = b.dataset.t; go('tag'); }
  else if (a === 'share2') share2();
});

document.addEventListener('change', async e => {
  if (e.target.id !== 'files' || !e.target.files.length) return;
  const fs = [...e.target.files].slice(0, 5);
  toast('Photos taiyaar ho rahi hain...');
  fileList = await Promise.all(fs.map(shrink)); file = fileList[0];
  $('#pv').innerHTML = `<img src="${URL.createObjectURL(fileList[0])}" alt="Preview" style="filter:${FIL[$('#flt').value] || 'none'}">${fileList.length > 1 ? `<span class="cnt">${fileList.length} photos</span>` : ''}`;
});

document.addEventListener('scroll', e => {
  const c = e.target; if (!c.classList || !c.classList.contains('car')) return;
  const i = Math.round(c.scrollLeft / c.clientWidth), m = c.parentNode;
  m.querySelector('.cnt').textContent = `${i + 1}/${c.dataset.n}`;
  m.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === i));
}, true);