const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const storeDir = path.join(root, 'store-assets');
const screenshotDir = path.join(storeDir, 'screenshots');
const promoDir = path.join(storeDir, 'promotional');
const googleDir = path.join(storeDir, 'google-submission');
const tmpDir = path.join(storeDir, '.tmp');

for (const dir of [storeDir, screenshotDir, promoDir, googleDir, tmpDir, path.join(root, 'icons')]) {
  fs.mkdirSync(dir, { recursive: true });
}

const chrome = findChrome();
const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="96" y1="48" x2="432" y2="464" gradientUnits="userSpaceOnUse">
      <stop stop-color="#18A7A0"/>
      <stop offset="0.58" stop-color="#0C6E6E"/>
      <stop offset="1" stop-color="#083F44"/>
    </linearGradient>
    <filter id="shadow" x="24" y="24" width="464" height="464" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#0C6E6E" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="56" y="56" width="400" height="400" rx="104" fill="url(#bg)" filter="url(#shadow)"/>
  <path d="M128 178H294L252 136H322L404 218L322 300H252L294 258H128V178Z" fill="#FFFDF8"/>
  <path d="M384 334H218L260 376H190L108 294L190 212H260L218 254H384V334Z" fill="#FFFDF8" fill-opacity="0.62"/>
</svg>
`;

fs.writeFileSync(path.join(root, 'icons', 'icon_source.svg'), logoSvg);
fs.writeFileSync(path.join(storeDir, 'relay-logo.svg'), logoSvg);

for (const size of [16, 48, 128]) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(root, 'icons', `icon${size}.png`), png);
}

const screenshots = [
  ['01-sync-command-center', screenshotSync()],
  ['02-private-sign-in', screenshotSignIn()],
  ['03-pro-history', screenshotHistory()],
  ['04-settings-updates', screenshotSettings()],
  ['05-trust-model', screenshotTrust()],
];

for (const [name, svg] of screenshots) {
  const svgPath = path.join(screenshotDir, `${name}.svg`);
  const pngPath = path.join(screenshotDir, `${name}.png`);
  fs.writeFileSync(svgPath, svg);
  screenshot(svgPath, pngPath, 1280, 800);
}

const promos = [
  ['small-promo-440x280', promoSmall(), 440, 280],
  ['marquee-promo-1400x560', promoMarquee(), 1400, 560],
];

for (const [name, svg, width, height] of promos) {
  const svgPath = path.join(promoDir, `${name}.svg`);
  const pngPath = path.join(promoDir, `${name}.png`);
  fs.writeFileSync(svgPath, svg);
  screenshot(svgPath, pngPath, width, height);
}

writeGoogleSubmissionSet();
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Generated icons, store assets, and Google submission images.');

function writeGoogleSubmissionSet() {
  fs.rmSync(googleDir, { recursive: true, force: true });
  fs.mkdirSync(googleDir, { recursive: true });

  const files = [
    ['store-icon-128.png', path.join(root, 'icons', 'icon128.png')],
    ['screenshot-01-sync.png', path.join(screenshotDir, '01-sync-command-center.png')],
    ['screenshot-02-sign-in.png', path.join(screenshotDir, '02-private-sign-in.png')],
    ['screenshot-03-history.png', path.join(screenshotDir, '03-pro-history.png')],
    ['screenshot-04-settings.png', path.join(screenshotDir, '04-settings-updates.png')],
    ['screenshot-05-privacy.png', path.join(screenshotDir, '05-trust-model.png')],
    ['promo-small-440x280.png', path.join(promoDir, 'small-promo-440x280.png')],
    ['promo-marquee-1400x560.png', path.join(promoDir, 'marquee-promo-1400x560.png')],
  ];

  for (const [name, source] of files) {
    fs.copyFileSync(source, path.join(googleDir, name));
  }
}

function screenshot(svgPath, outPath, width, height) {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `--screenshot=${outPath}`,
    `file://${svgPath}`,
  ], { stdio: 'ignore' });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try the next known browser path/name.
    }
  }
  throw new Error('Chrome or Chromium is required to render store asset PNG files. Set CHROME_BIN to the browser executable path.');
}

function renderIcon(size) {
  const scale = 4;
  const w = size * scale;
  const h = size * scale;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = (x + 0.5) / w;
      const ny = (y + 0.5) / h;
      const idx = (y * w + x) * 4;
      const inBg = roundedRect(nx, ny, 0.07, 0.07, 0.86, 0.86, 0.21);
      if (!inBg) continue;
      const t = Math.min(1, Math.max(0, (nx + ny) / 2));
      const bg = mix([24, 167, 160], t < 0.58 ? [12, 110, 110] : [8, 63, 68], t < 0.58 ? t / 0.58 : (t - 0.58) / 0.42);
      let color = bg;
      let alpha = 255;
      if (poly(nx, ny, [[0.25,0.34],[0.57,0.34],[0.53,0.43],[0.21,0.43]]) || poly(nx, ny, [[0.53,0.25],[0.78,0.385],[0.53,0.52]])) {
        color = [255, 253, 248];
      } else if (poly(nx, ny, [[0.43,0.58],[0.75,0.58],[0.79,0.67],[0.47,0.67]]) || poly(nx, ny, [[0.47,0.49],[0.22,0.625],[0.47,0.76]])) {
        color = mix(bg, [255, 253, 248], 0.66);
      }
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = alpha;
    }
  }
  return encodePng(resample(rgba, w, h, size, size), size, size);
}

function roundedRect(x, y, rx, ry, rw, rh, r) {
  const cx = Math.max(rx + r, Math.min(x, rx + rw - r));
  const cy = Math.max(ry + r, Math.min(y, ry + rh - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

function poly(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function resample(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = sw / dw;
  const sy = sh / dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const acc = [0, 0, 0, 0];
      for (let yy = 0; yy < sy; yy += 1) {
        for (let xx = 0; xx < sx; xx += 1) {
          const idx = ((Math.floor(y * sy + yy) * sw) + Math.floor(x * sx + xx)) * 4;
          for (let c = 0; c < 4; c += 1) acc[c] += src[idx + c];
        }
      }
      const count = sx * sy;
      const outIdx = (y * dw + x) * 4;
      for (let c = 0; c < 4; c += 1) out[outIdx + c] = Math.round(acc[c] / count);
    }
  }
  return out;
}

function encodePng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunks = [
    chunk('IHDR', Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ...chunks]);
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  return Buffer.concat([u32(data.length), name, data, u32(crc32(Buffer.concat([name, data])))]); 
}

function crc32(buf) {
  let crc = -1;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function shell(title, subtitle, inner) {
  return `<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FBF7EF"/><stop offset="1" stop-color="#E9E1D3"/></linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18A7A0"/><stop offset=".58" stop-color="#0C6E6E"/><stop offset="1" stop-color="#083F44"/></linearGradient>
    <filter id="soft"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#26221B" flood-opacity=".14"/></filter>
  </defs>
  <rect width="1280" height="800" fill="url(#paper)"/>
  <g transform="translate(76 72)">
    ${miniLogo(0, 0, 52)}
    <text x="70" y="28" font-family="Avenir Next, Arial, sans-serif" font-size="24" font-weight="700" fill="#242019">Relay</text>
    <text x="70" y="54" font-family="Avenir Next, Arial, sans-serif" font-size="15" fill="#6F6659">Private bookmark sync</text>
    <text x="0" y="136" font-family="Avenir Next, Arial, sans-serif" font-size="46" font-weight="700" fill="#242019">${title}</text>
    <text x="0" y="178" font-family="Avenir Next, Arial, sans-serif" font-size="22" fill="#6F6659">${subtitle}</text>
  </g>
  ${inner}
</svg>`;
}

function miniLogo(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s / 512})">
    <rect x="56" y="56" width="400" height="400" rx="104" fill="url(#brand)"/>
    <path d="M128 178H294L252 136H322L404 218L322 300H252L294 258H128V178Z" fill="#FFFDF8"/>
    <path d="M384 334H218L260 376H190L108 294L190 212H260L218 254H384V334Z" fill="#FFFDF8" fill-opacity=".62"/>
  </g>`;
}

function appFrame(x, y, body) {
  return `<g transform="translate(${x} ${y})" filter="url(#soft)">
    <rect width="360" height="560" rx="22" fill="#FFFDF8" stroke="#D8CFC0"/>
    ${body}
  </g>`;
}

function screenshotSync() {
  return shell('Sync that feels invisible.', 'Encrypted vault sync, Pro status, and update controls.',
    appFrame(820, 132, `
      <rect x="0" y="0" width="360" height="560" rx="22" fill="#FBF7EF"/>
      <circle cx="68" cy="94" r="112" fill="#E9F4F1" opacity=".74"/>
      <circle cx="304" cy="36" r="88" fill="#F6E7D5" opacity=".55"/>
      ${miniLogo(18, 18, 38)}
      <text x="70" y="43" font-family="Avenir Next, Arial" font-size="17" font-weight="800" fill="#242019">Relay</text>
      <rect x="251" y="22" width="76" height="28" rx="14" fill="#E9F4F1"/>
      <text x="289" y="41" text-anchor="middle" font-family="Avenir Next, Arial" font-size="12" font-weight="800" fill="#0C6E6E">PRO</text>
      <rect x="20" y="74" width="320" height="88" rx="16" fill="#0C6E6E"/>
      <text x="44" y="108" font-family="Avenir Next, Arial" font-size="18" font-weight="800" fill="#FFFDF8">Relay Pro</text>
      <text x="44" y="132" font-family="Avenir Next, Arial" font-size="12.5" fill="#D4F3EF">Unlimited bookmarks · auto-sync · restore history</text>
      <text x="301" y="124" text-anchor="middle" font-family="Avenir Next, Arial" font-size="18" font-weight="800" fill="#FFFDF8">→</text>
      <rect x="20" y="178" width="320" height="210" rx="24" fill="#FFFDF8" stroke="#DDD2C4"/>
      <circle cx="180" cy="250" r="56" fill="#E9F4F1"/>
      <circle cx="180" cy="250" r="40" fill="#0C6E6E"/>
      <path d="M159 244h34l-11-11h19l23 23-23 23h-19l11-11h-34z" fill="#FFFDF8"/>
      <text x="180" y="332" text-anchor="middle" font-family="Avenir Next, Arial" font-size="24" font-weight="850" fill="#242019">Sync</text>
      <text x="180" y="357" text-anchor="middle" font-family="Avenir Next, Arial" font-size="14" fill="#6F6659">Encrypt and update your vault.</text>
      <rect x="44" y="404" width="126" height="56" rx="14" fill="#F7F4EE" stroke="#E4D8C9"/>
      <text x="107" y="428" text-anchor="middle" font-family="Avenir Next, Arial" font-size="18" font-weight="850" fill="#242019">1,248</text>
      <text x="107" y="449" text-anchor="middle" font-family="Avenir Next, Arial" font-size="11" fill="#8B8173">Bookmarks</text>
      <rect x="190" y="404" width="126" height="56" rx="14" fill="#F7F4EE" stroke="#E4D8C9"/>
      <text x="253" y="428" text-anchor="middle" font-family="Avenir Next, Arial" font-size="18" font-weight="850" fill="#242019">now</text>
      <text x="253" y="449" text-anchor="middle" font-family="Avenir Next, Arial" font-size="11" fill="#8B8173">Last sync</text>
      <rect x="20" y="478" width="320" height="58" rx="16" fill="#FFFDF8" stroke="#DDD2C4"/>
      <text x="54" y="503" font-family="Avenir Next, Arial" font-size="14" font-weight="800" fill="#242019">Auto-sync</text>
      <text x="54" y="523" font-family="Avenir Next, Arial" font-size="11.5" fill="#6F6659">Syncs on every change</text>
      <rect x="284" y="495" width="36" height="22" rx="11" fill="#0C6E6E"/>
      <circle cx="309" cy="506" r="9" fill="#FFFDF8"/>
    `));
}

function screenshotSignIn() {
  return shell('No email. No readable vault.', 'The sign-in flow is simple: username, password, encrypted sync.',
    appFrame(820, 132, `
      <rect x="0" y="0" width="360" height="560" rx="22" fill="#FBF7EF"/>
      <circle cx="68" cy="74" r="106" fill="#E9F4F1" opacity=".72"/>
      <circle cx="304" cy="34" r="86" fill="#F6E7D5" opacity=".52"/>
      <g transform="translate(126 76)">
        <rect width="108" height="108" rx="26" fill="#FFFDF8" stroke="#DDD2C4"/>
        <path d="M54 88s42-22 42-62V18L54 2 12 18v8c0 40 42 62 42 62z" fill="none" stroke="#0C6E6E" stroke-width="7"/>
      </g>
      <text x="180" y="234" text-anchor="middle" font-family="Avenir Next, Arial" font-size="26" font-weight="850" fill="#242019">Bookmarks, in sync.</text>
      <text x="180" y="262" text-anchor="middle" font-family="Avenir Next, Arial" font-size="14" fill="#6F6659">Sign in to access your encrypted vault.</text>
      <rect x="24" y="306" width="312" height="54" rx="14" fill="#FFFDF8" stroke="#D8CFC0"/>
      <text x="42" y="338" font-family="Avenir Next, Arial" font-size="16" fill="#8B8173">relay-vault</text>
      <rect x="24" y="374" width="312" height="54" rx="14" fill="#FFFDF8" stroke="#D8CFC0"/>
      <text x="42" y="406" font-family="Avenir Next, Arial" font-size="16" fill="#8B8173">••••••••••••</text>
      <rect x="24" y="444" width="312" height="54" rx="14" fill="url(#brand)"/>
      <text x="180" y="478" text-anchor="middle" font-family="Avenir Next, Arial" font-size="16" font-weight="800" fill="#FFFDF8">Sign In</text>
      <text x="180" y="526" text-anchor="middle" font-family="Avenir Next, Arial" font-size="12" fill="#8B8173">No reset email. Your password is the key.</text>
    `));
}

function screenshotHistory() {
  return shell('Restore without fear.', 'Pro history brings missing bookmarks back while current bookmarks stay.',
    appFrame(820, 132, `
      <rect x="0" y="0" width="360" height="560" rx="22" fill="#FBF7EF"/>
      <text x="24" y="42" font-family="Avenir Next, Arial" font-size="18" font-weight="850" fill="#242019">Sync History</text>
      <text x="24" y="78" font-family="Avenir Next, Arial" font-size="12" font-weight="800" fill="#8B8173">LAST 30 DAYS</text>
      ${historyRow(24, 100, 'Today, 9:41 AM', '1,248 bookmarks · just now')}
      ${historyRow(24, 174, 'Yesterday, 8:18 PM', '1,241 bookmarks · 13h ago')}
      ${historyRow(24, 248, 'Apr 26, 10:04 AM', '1,230 bookmarks · 2d ago')}
      ${historyRow(24, 322, 'Apr 24, 7:45 PM', '1,210 bookmarks · 4d ago')}
      <rect x="24" y="424" width="312" height="82" rx="16" fill="#E9F4F1" stroke="#BFDCD5"/>
      <text x="48" y="456" font-family="Avenir Next, Arial" font-size="16" font-weight="850" fill="#0C6E6E">Additive restore</text>
      <text x="48" y="482" font-family="Avenir Next, Arial" font-size="13" fill="#2D6F6A">Missing bookmarks come back.</text>
      <text x="48" y="502" font-family="Avenir Next, Arial" font-size="13" fill="#2D6F6A">Current bookmarks stay.</text>
    `));
}

function historyRow(x, y, title, sub) {
  return `<rect x="${x}" y="${y}" width="312" height="58" rx="9" fill="#FFFDF8" stroke="#D8CFC0"/>
  <circle cx="${x + 30}" cy="${y + 29}" r="15" fill="#E9F4F1"/>
  <text x="${x + 56}" y="${y + 25}" font-family="Avenir Next, Arial" font-size="15" font-weight="700" fill="#242019">${title}</text>
  <text x="${x + 56}" y="${y + 45}" font-family="Avenir Next, Arial" font-size="12" fill="#6F6659">${sub}</text>`;
}

function screenshotSettings() {
  return shell('Everything in reach.', 'Updates, privacy, restore, and Pro settings in one clean panel.',
    appFrame(820, 132, `
      <rect x="0" y="0" width="360" height="560" rx="22" fill="#FBF7EF"/>
      <text x="24" y="42" font-family="Avenir Next, Arial" font-size="18" font-weight="850" fill="#242019">Settings</text>
      <rect x="24" y="70" width="312" height="70" rx="15" fill="#0C6E6E"/>
      <text x="48" y="101" font-family="Avenir Next, Arial" font-size="16" font-weight="850" fill="#FFFDF8">Relay Pro</text>
      <text x="48" y="123" font-family="Avenir Next, Arial" font-size="12" fill="#D4F3EF">Unlimited bookmarks, auto-sync, history.</text>
      <rect x="24" y="158" width="312" height="106" rx="15" fill="#FFFDF8" stroke="#D8CFC0"/>
      <text x="48" y="190" font-family="Avenir Next, Arial" font-size="16" font-weight="850" fill="#242019">Relay is up to date</text>
      <text x="48" y="216" font-family="Avenir Next, Arial" font-size="13" fill="#6F6659">Installed: v${version}</text>
      <rect x="48" y="230" width="88" height="30" rx="9" fill="#E9F4F1"/>
      <text x="92" y="250" text-anchor="middle" font-family="Avenir Next, Arial" font-size="13" font-weight="800" fill="#0C6E6E">Check</text>
      <rect x="24" y="282" width="312" height="68" rx="15" fill="#FFFDF8" stroke="#D8CFC0"/>
      <text x="48" y="311" font-family="Avenir Next, Arial" font-size="15" font-weight="850" fill="#242019">Sync History</text>
      <text x="48" y="332" font-family="Avenir Next, Arial" font-size="12" fill="#6F6659">Restore missing bookmarks · Pro</text>
      <rect x="24" y="368" width="312" height="68" rx="15" fill="#FFFDF8" stroke="#D8CFC0"/>
      <text x="48" y="397" font-family="Avenir Next, Arial" font-size="15" font-weight="850" fill="#242019">No email. No tracking.</text>
      <text x="48" y="418" font-family="Avenir Next, Arial" font-size="12" fill="#6F6659">Relay keeps account data minimal.</text>
      <rect x="24" y="456" width="312" height="48" rx="13" fill="#F8E9E5" stroke="#E5BFB8"/>
      <text x="180" y="486" text-anchor="middle" font-family="Avenir Next, Arial" font-size="14" font-weight="850" fill="#B63D35">Delete account &amp; vault</text>
    `));
}

function screenshotTrust() {
  return shell('Private by default.', 'Relay is designed to sync bookmarks without turning them into a profile.',
    appFrame(820, 132, `
      <rect x="0" y="0" width="360" height="560" rx="22" fill="#FBF7EF"/>
      <text x="24" y="42" font-family="Avenir Next, Arial" font-size="18" font-weight="850" fill="#242019">Privacy</text>
      ${trustRow(24, 84, 'No email required', 'Use a username and password only.')}
      ${trustRow(24, 166, 'Encrypted before upload', 'Bookmarks leave as unreadable data.')}
      ${trustRow(24, 248, 'No tracking pixels', 'No analytics SDK or ad network.')}
      ${trustRow(24, 330, 'Minimal controls', 'Sync, restore, update, delete.')}
      <rect x="24" y="430" width="312" height="78" rx="16" fill="#E9F4F1" stroke="#BFDCD5"/>
      <text x="48" y="462" font-family="Avenir Next, Arial" font-size="16" font-weight="850" fill="#0C6E6E">Quiet by design</text>
      <text x="48" y="488" font-family="Avenir Next, Arial" font-size="13" fill="#2D6F6A">Relay keeps sync useful, not nosy.</text>
    `));
}

function trustRow(x, y, title, sub) {
  return `<rect x="${x}" y="${y}" width="312" height="64" rx="10" fill="#FFFDF8" stroke="#D8CFC0"/>
  <circle cx="${x + 31}" cy="${y + 32}" r="16" fill="#E9F4F1"/>
  <path d="M${x + 23} ${y + 32}l6 6 11-13" fill="none" stroke="#0C6E6E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${x + 60}" y="${y + 27}" font-family="Avenir Next, Arial" font-size="15" font-weight="750" fill="#242019">${title}</text>
  <text x="${x + 60}" y="${y + 48}" font-family="Avenir Next, Arial" font-size="12.5" fill="#6F6659">${sub}</text>`;
}

function promoSmall() {
  return `<svg width="440" height="280" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18A7A0"/><stop offset=".58" stop-color="#0C6E6E"/><stop offset="1" stop-color="#083F44"/></linearGradient></defs>
    <rect width="440" height="280" fill="#FBF7EF"/>
    ${miniLogo(34, 42, 70)}
    <text x="34" y="154" font-family="Avenir Next, Arial" font-size="38" font-weight="850" fill="#242019">Relay</text>
    <text x="34" y="188" font-family="Avenir Next, Arial" font-size="18" fill="#6F6659">Private bookmark sync</text>
    <text x="34" y="220" font-family="Avenir Next, Arial" font-size="15" fill="#0C6E6E">No email. No tracking.</text>
    <rect x="280" y="48" width="116" height="168" rx="18" fill="#FFFDF8" stroke="#D8CFC0"/>
    <circle cx="338" cy="104" r="28" fill="#E9F4F1"/>
    <path d="M324 100h22l-7-7h13l15 15-15 15h-13l7-7h-22z" fill="#0C6E6E"/>
    <text x="338" y="154" text-anchor="middle" font-family="Avenir Next, Arial" font-size="17" font-weight="850" fill="#242019">Sync</text>
    <text x="338" y="178" text-anchor="middle" font-family="Avenir Next, Arial" font-size="11" fill="#6F6659">Encrypted</text>
  </svg>`;
}

function promoMarquee() {
  return `<svg width="1400" height="560" viewBox="0 0 1400 560" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18A7A0"/><stop offset=".58" stop-color="#0C6E6E"/><stop offset="1" stop-color="#083F44"/></linearGradient></defs>
    <rect width="1400" height="560" fill="#FBF7EF"/>
    ${miniLogo(96, 104, 108)}
    <text x="96" y="282" font-family="Avenir Next, Arial" font-size="68" font-weight="800" fill="#242019">Relay</text>
    <text x="96" y="336" font-family="Avenir Next, Arial" font-size="28" fill="#6F6659">Your bookmarks. Always in reach.</text>
    <text x="96" y="388" font-family="Avenir Next, Arial" font-size="22" fill="#0C6E6E">No email. No tracking. No readable cloud vault.</text>
    <rect x="844" y="72" width="390" height="416" rx="28" fill="#FFFDF8" stroke="#D8CFC0"/>
    <rect x="876" y="106" width="326" height="76" rx="18" fill="#0C6E6E"/>
    <text x="904" y="140" font-family="Avenir Next, Arial" font-size="20" font-weight="850" fill="#FFFDF8">Relay Pro</text>
    <text x="904" y="164" font-family="Avenir Next, Arial" font-size="13" fill="#D4F3EF">Auto-sync · restore history</text>
    <circle cx="1039" cy="262" r="58" fill="#E9F4F1"/>
    <circle cx="1039" cy="262" r="42" fill="#0C6E6E"/>
    <path d="M1017 256h38l-12-12h21l25 25-25 25h-21l12-12h-38z" fill="#FFFDF8"/>
    <text x="1039" y="364" text-anchor="middle" font-family="Avenir Next, Arial" font-size="30" font-weight="850" fill="#242019">Sync</text>
    <text x="1039" y="402" text-anchor="middle" font-family="Avenir Next, Arial" font-size="17" fill="#6F6659">1,248 bookmarks encrypted</text>
  </svg>`;
}
