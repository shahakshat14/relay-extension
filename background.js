'use strict';

// ─────────────────────────────────────────────────────────────────────
// Session store — persists across popup open/close within a browser session.
// Clears when the browser closes (unlike chrome.storage.local which is permanent).
// We store username + password here so users don't have to re-enter every time.
// The service worker stays alive as long as the browser is open.
// ─────────────────────────────────────────────────────────────────────
const session = { u: null, p: null };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'SESSION_SET':
      session.u = msg.u;
      session.p = msg.p;
      sendResponse({ ok: true });
      break;
    case 'SESSION_GET':
      sendResponse({ u: session.u, p: session.p });
      break;
    case 'SESSION_CLEAR':
      session.u = null;
      session.p = null;
      sendResponse({ ok: true });
      break;
  }
  return true; // keep message channel open for async
});

// Badge dot when bookmarks change and auto-sync is on
async function markPending() {
  const { autoSync } = await chrome.storage.local.get('autoSync');
  if (autoSync) {
    chrome.action.setBadgeText({ text: '·' });
    chrome.action.setBadgeBackgroundColor({ color: '#4361ee' });
  }
}

chrome.bookmarks.onCreated.addListener(markPending);
chrome.bookmarks.onRemoved.addListener(markPending);
chrome.bookmarks.onChanged.addListener(markPending);
chrome.bookmarks.onMoved.addListener(markPending);

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') console.log('Relay installed.');
});
