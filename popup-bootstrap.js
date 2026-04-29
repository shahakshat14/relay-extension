'use strict';

async function mountRelayPopup() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const res = await fetch(chrome.runtime.getURL('popup-app.html'), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load popup app: ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  document.head.querySelectorAll('style[data-relay-app]').forEach((node) => node.remove());
  doc.head.querySelectorAll('style').forEach((style) => {
    const clone = document.createElement('style');
    clone.dataset.relayApp = 'true';
    clone.textContent = style.textContent;
    document.head.appendChild(clone);
  });

  doc.body.querySelectorAll('script').forEach((script) => script.remove());
  document.body.replaceChildren(...Array.from(doc.body.children).map((node) => document.importNode(node, true)));

  const script = document.createElement('script');
  script.src = 'popup.js';
  script.onload = () => document.getElementById('instantShell')?.remove();
  document.body.appendChild(script);
}

mountRelayPopup().catch(() => {
  const shell = document.getElementById('instantShell');
  if (!shell) return;
  const p = shell.querySelector('p');
  if (p) p.textContent = 'Relay had trouble opening. Close this popup and try again.';
});
