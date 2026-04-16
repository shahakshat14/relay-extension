'use strict';

// ─────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────
const SESSION_KEY = 'relay_session_pass'; // sessionStorage — clears when browser closes

function getSessionPass()       { return sessionStorage.getItem(SESSION_KEY); }
function setSessionPass(p)      { sessionStorage.setItem(SESSION_KEY, p); }
function clearSessionPass()     { sessionStorage.removeItem(SESSION_KEY); }

// ─────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────
const q = id => document.getElementById(id);

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  q(id).classList.add('active');
}

function setOrb(id, state, ico) {
  q(id).className = 'orb' + (state ? ` ${state}` : '');
  if (ico !== undefined) {
    const icoEl = q(id).querySelector('.orb-ico');
    if (icoEl) icoEl.textContent = ico;
  }
}

function st(tId, sId, title, sub) {
  q(tId).textContent = title;
  q(sId).textContent = sub || '';
}

function clrToast(id) { q(id).className = 'toast'; }
function toast(id, msg, type) { const e = q(id); e.textContent = msg; e.className = `toast ${type}`; }

function age(iso) {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 120)  return '1 min ago';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function eyeToggle(inputId, btnId) {
  const inp = q(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  q(btnId).textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ─────────────────────────────────────────────────────────────────────
// Sync flow
// ─────────────────────────────────────────────────────────────────────
async function runSync(passphrase, orbId, titleId, subId, btnId, toastId) {
  const btn = q(btnId);
  btn.disabled = true;
  btn.innerHTML = '<span class="sp"></span> Syncing…';
  clrToast(toastId);
  setOrb(orbId, 'syncing', '⇄');
  st(titleId, subId, 'Syncing…', 'Encrypting your bookmarks…');

  try {
    const { pulled, count } = await doSync(passphrase);

    await chrome.storage.local.set({ lastSync: new Date().toISOString() });
    chrome.action.setBadgeText({ text: '' }).catch(() => {});

    setOrb(orbId, 'success', '✓');
    btn.innerHTML = '✓ Synced';
    btn.classList.add('done');

    if (pulled > 0)
      st(titleId, subId, `${pulled} bookmark${pulled === 1 ? '' : 's'} added`, `${count} total · encrypted`);
    else
      st(titleId, subId, 'All synced', `${count} bookmarks · encrypted`);

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'Sync Now';
      btn.classList.remove('done');
      setOrb(orbId, '', '⇄');
    }, 2800);

  } catch (err) {
    setOrb(orbId, 'error', '!');
    btn.disabled = false;
    btn.innerHTML = 'Try Again';
    btn.classList.remove('done');
    st(titleId, subId, 'Sync failed', '');
    toast(toastId, err.message, 'err');
    if (err.message.includes('passphrase')) clearSessionPass();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Events: Onboarding
// ─────────────────────────────────────────────────────────────────────
q('btnStart').addEventListener('click', () => {
  const pass = getSessionPass();
  if (pass) {
    // Already set up — go straight to main
    show('vMain');
    loadMainMeta();
  } else {
    const { seenOnboard } = chrome.storage.local.get('seenOnboard');
    show('vSetup');
  }
});

q('btnBackOnboard').addEventListener('click', () => show('vOnboard'));

// ─────────────────────────────────────────────────────────────────────
// Events: Setup
// ─────────────────────────────────────────────────────────────────────
q('passEye').addEventListener('click', () => eyeToggle('passInput', 'passEye'));

q('btnSetup').addEventListener('click', async () => {
  const pass = q('passInput').value.trim();
  if (pass.length < 8) {
    toast('toastSetup', 'Passphrase must be at least 8 characters.', 'err');
    return;
  }
  setSessionPass(pass);
  await chrome.storage.local.set({ hasVault: true, seenOnboard: true });
  show('vMain');
  await loadMainMeta();
  setTimeout(() => runSync(pass, 'mainOrb', 'mTitle', 'mSub', 'btnSync', 'toastMain'), 300);
});

// ─────────────────────────────────────────────────────────────────────
// Events: Main
// ─────────────────────────────────────────────────────────────────────
async function loadMainMeta() {
  const { lastSync, autoSync } = await chrome.storage.local.get(['lastSync', 'autoSync']);
  q('chkAuto').checked = !!autoSync;
  if (lastSync) st('mTitle', 'mSub', 'Synced', age(lastSync));
  else          st('mTitle', 'mSub', 'Ready', 'Tap to sync your bookmarks');
}

q('btnSync').addEventListener('click', () => {
  const pass = getSessionPass();
  if (!pass) { show('vUnlock'); return; }
  runSync(pass, 'mainOrb', 'mTitle', 'mSub', 'btnSync', 'toastMain');
});

q('btnLock').addEventListener('click', () => {
  clearSessionPass();
  show('vUnlock');
});

q('chkAuto').addEventListener('change', e => {
  chrome.storage.local.set({ autoSync: e.target.checked });
});

// ─────────────────────────────────────────────────────────────────────
// Events: Unlock
// ─────────────────────────────────────────────────────────────────────
q('unlockEye').addEventListener('click', () => eyeToggle('unlockInput', 'unlockEye'));

q('btnUnlock').addEventListener('click', async () => {
  const pass = q('unlockInput').value.trim();
  if (!pass) return;
  setSessionPass(pass);
  q('unlockInput').value = '';
  show('vMain');
  await loadMainMeta();
  setTimeout(() => runSync(pass, 'mainOrb', 'mTitle', 'mSub', 'btnSync', 'toastMain'), 300);
});

q('unlockInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') q('btnUnlock').click();
});

q('passInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') q('btnSetup').click();
});

// ─────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────
async function init() {
  const { hasVault, autoSync, lastSync, seenOnboard } =
    await chrome.storage.local.get(['hasVault', 'autoSync', 'lastSync', 'seenOnboard']);

  if (!hasVault) {
    show(seenOnboard ? 'vSetup' : 'vOnboard');
    return;
  }

  const pass = getSessionPass();

  if (!pass) {
    show('vUnlock');
    return;
  }

  // Has vault + session passphrase = go straight to main
  show('vMain');
  q('chkAuto').checked = !!autoSync;
  if (lastSync) st('mTitle', 'mSub', 'Synced', age(lastSync));
  else          st('mTitle', 'mSub', 'Ready', 'Tap to sync');

  // Auto-sync if enabled and stale
  const stale = !lastSync || (Date.now() - new Date(lastSync)) > 30_000;
  if (autoSync && stale) {
    setTimeout(() => runSync(pass, 'mainOrb', 'mTitle', 'mSub', 'btnSync', 'toastMain'), 320);
  }
}

init();
