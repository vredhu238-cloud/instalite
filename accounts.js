/* Multiple accounts on one device: switch accounts, add account (accounts.js) */
const AK = 'il_accounts';
const getAccs = () => { try { return JSON.parse(localStorage.getItem(AK)) || []; } catch (e) { return []; } };
const setAccs = a => { try { localStorage.setItem(AK, JSON.stringify(a)); } catch (e) {} };

function saveAcc(session) {
  if (!session || !session.user) return;
  const u = session.user, list = getAccs().filter(x => x.id !== u.id);
  const nm = (me && me.id === u.id) ? me.username : ((u.user_metadata && u.user_metadata.username) || (u.email || 'account').split('@')[0]);
  list.unshift({ id: u.id, username: nm, access_token: session.access_token, refresh_token: session.refresh_token });
  setAccs(list);
}
sb.auth.onAuthStateChange((ev, session) => { if (session && ev !== 'SIGNED_OUT') saveAcc(session); });

function resetState() {
  closeOv(); me = null; fol = new Set(); cache = []; mySaves = new Set(); svFor = null; pend = new Set(); view = 'home'; pu = null;
}

async function switchAcc(id) {
  if (me && id === me.id) return closeOv();
  const a = getAccs().find(x => x.id === id); if (!a) return;
  toast('Switching account...');
  const r = await sb.auth.setSession({ access_token: a.access_token, refresh_token: a.refresh_token });
  if (r.error || !r.data.session) { setAccs(getAccs().filter(x => x.id !== id)); return toast('Session expired. Please log in again.'); }
  saveAcc(r.data.session); resetState(); start();
}

async function openAccounts() {
  const { data } = await sb.auth.getSession(); saveAcc(data.session);
  let list = getAccs();
  if (!list.some(a => a.id === me.id)) list = [{ id: me.id, username: me.username }, ...list];
  const o = document.createElement('div'); o.className = 'ov ac';
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="close" aria-label="Back" style="font-size:22px">&larr;</button><b>Accounts</b></div>
  ${list.map(a => `<button class="row" data-a="swacc" data-id="${a.id}" style="width:100%;text-align:left;padding:12px 14px">${av(a.username, 48)}<b class="sp">${esc(a.username)}</b>${a.id === me.id ? '<span style="color:var(--blue);font-weight:700;font-size:20px">&#10003;</span>' : ''}</button>`).join('')}
  <button class="row" data-a="addacc" style="width:100%;text-align:left;padding:16px 14px;color:var(--blue);font-weight:600">+ Add InstaLite account</button></div>`;
  document.body.appendChild(o);
}

function openAddAcc() {
  document.querySelectorAll('.ov.ac').forEach(x => x.remove());
  const o = document.createElement('div'); o.className = 'ov ac';
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="accback" aria-label="Back" style="font-size:22px">&larr;</button><b>Add account</b></div>
  <div style="padding:20px 14px;display:grid;gap:12px"><button class="btn" data-a="loginacc" style="padding:12px">Log into existing account</button><button class="btn g" data-a="signupacc" style="padding:12px">Create new account</button></div></div>`;
  document.body.appendChild(o);
}

function accForm(mode) {
  document.querySelectorAll('.ov.ac').forEach(x => x.remove());
  const o = document.createElement('div'); o.className = 'ov ac';
  o.innerHTML = `<div class="in"><div class="row" style="border-bottom:1px solid var(--line)"><button data-a="addacc" aria-label="Back" style="font-size:22px">&larr;</button><b>${mode === 'up' ? 'Create new account' : 'Log into existing account'}</b></div>
  <div style="padding:20px 14px;display:grid;gap:12px">${mode === 'up' ? '<input class="s" id="ac-un" placeholder="Username (a-z, 0-9, _ .)" maxlength="20">' : ''}
  <input class="s" id="ac-em" type="email" placeholder="Email">
  <input class="s" id="ac-pw" type="password" placeholder="Password (6+ characters)">
  <button class="btn" data-a="accgo" data-m="${mode}" style="padding:12px">${mode === 'up' ? 'Sign up' : 'Log in'}</button></div></div>`;
  document.body.appendChild(o);
}

async function accGo(m) {
  const em = $('#ac-em').value.trim(), pw = $('#ac-pw').value;
  if (!em || pw.length < 6) return toast('Enter your email and a password (6+ characters)');
  let r;
  if (m === 'up') {
    const un = ($('#ac-un').value || '').trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(un)) return toast('Username: 3-20 letters, numbers, _ or .');
    r = await sb.auth.signUp({ email: em, password: pw, options: { data: { username: un } } });
  } else r = await sb.auth.signInWithPassword({ email: em, password: pw });
  if (r.error) return toast(r.error.message);
  if (!r.data.session) return toast('Check your email to confirm, then log in');
  saveAcc(r.data.session); resetState(); start();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'accts') openAccounts();
  else if (a === 'swacc') switchAcc(b.dataset.id);
  else if (a === 'addacc') openAddAcc();
  else if (a === 'accback') openAccounts();
  else if (a === 'loginacc') accForm('in');
  else if (a === 'signupacc') accForm('up');
  else if (a === 'accgo') accGo(b.dataset.m);
  else if (a === 'out' && me) setAccs(getAccs().filter(x => x.id !== me.id));
});

/* Profile ke username ko dabane layak banao, aur login screen par "Continue as" dikhao */
new MutationObserver(() => {
  const menu = document.querySelector('[data-a="menu"]'), nm = menu && menu.previousElementSibling;
  if (nm && nm.tagName === 'B' && !nm.dataset.a) {
    nm.dataset.a = 'accts'; nm.style.cursor = 'pointer';
    nm.insertAdjacentHTML('beforeend', ' <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle"><path d="M6 9l6 6 6-6"/></svg>');
  }
  const f = document.getElementById('af');
  if (f && !document.getElementById('savedacc')) {
    const list = getAccs(), lg = f.querySelector('.logo');
    if (list.length && lg) lg.insertAdjacentHTML('afterend', `<div id="savedacc" style="display:grid;gap:8px"><small style="color:var(--mut)">Continue as</small>${list.map(a => `<button type="button" class="btn g" data-a="swacc" data-id="${a.id}">${esc(a.username)}</button>`).join('')}</div>`);
  }
}).observe(document.body, { childList: true, subtree: true });