<div align="center">
  <img src="icons/icon128.png" width="80" alt="Relay">
  <h1>Relay</h1>
  <p><strong>Private bookmark sync across Chrome, Edge, and Safari.</strong><br>
  End-to-end encrypted. No email. No tracking. Fully anonymous.</p>
  
  <a href="https://tridentcx.github.io/relay-extension/pricing/">Website</a> ·
  <a href="https://tridentcx.github.io/relay-extension/privacy">Privacy Policy</a> ·
  <a href="https://github.com/tridentcx/relay-extension/issues">Support</a>
</div>

---

## What it does

Relay syncs your bookmarks across browsers using a username and password — no email, no account, no personal data collected. Your bookmarks are encrypted on your device before sync; the server stores a blob it cannot read.

## Plans

| | Free | Pro ($18/yr) |
|---|---|---|
| Browsers | 2 | Unlimited |
| Bookmarks | 500 | Unlimited |
| Sync | Manual | Auto + manual |
| History | — | 30-day restore |

## Security model

**Two-secret vault key:**
1. Your **password** — derives an AES-256-GCM encryption key via PBKDF2 (600,000 iterations). Encrypts and decrypts bookmark data. Never stored, never transmitted.
2. Your **account salt** — 32 random bytes generated on first install, stored in `chrome.storage.local`. Mixed into the vault key derivation alongside the username. Without this salt, an attacker who knows your username cannot locate your vault.

```
vault_key = PBKDF2(username, PEPPER || accountSalt)  →  64-char hex
encrypted = AES-256-GCM(bookmarks, PBKDF2(password, random_salt))
```

**What lives on the server:** only the vault key hash and an unreadable encrypted blob.

See [SECURITY.md](SECURITY.md) for full details.

## File structure

```
relay-extension/
├── manifest.json       — MV3 manifest (permissions: bookmarks, storage)
├── background.js       — Service worker: badge dot on bookmark changes
├── config.js           — Supabase public URL + anon key
├── crypto.js           — AES-256-GCM + PBKDF2 (IIFE, exports window._relayCrypto)
├── sync.js             — Supabase client, bookmark engine, sync logic (IIFE, exports window._relay)
├── popup.html          — All views + design system CSS
├── popup.js            — UI logic: all event handlers, view state
├── config.json         — Remote feature flags (served via GitHub Pages)
├── icons/              — icon16.png, icon48.png, icon128.png
└── pricing/            — GitHub Pages: pricing, privacy, success pages
```

## Architecture

```
Browser Extension
  chrome.storage.session  →  username + password (cleared on browser close)
  chrome.storage.local    →  browserId, accountSalt, writeToken, plan, lastSync

  popup.js  →  window._relay (sync.js)  →  Supabase REST API
  popup.js  →  window._relayCrypto (crypto.js)

Supabase (mgeiplftbehngfsqtbiq)
  vaults          — vault_key, encrypted data blob, plan, write_token
  sync_history    — Pro snapshots (30-day window)
  vault_browsers  — browser registrations per vault
  sync_log        — rate limiter log (service role only)
  relay_config    — remote feature flags (anon read)
  gift_codes      — Pro gift codes (service role only)
  vault_plan      — view: effective plan for each vault

Edge Functions
  create-checkout     — Stripe checkout session creation
  stripe-webhook      — Handles subscription lifecycle
  admin-gift-codes    — Admin API for gift code management (password protected)
  sync-rate-limiter   — Rate limiting (60/hr, 5/min per vault)
```

## Remote config

The extension fetches `config.json` from GitHub Pages on startup, allowing server-side feature control without a store update:

```json
{
  "free_bookmark_limit": 500,
  "free_browser_limit": 2,
  "maintenance_mode": false,
  "maintenance_message": ""
}
```

Set `maintenance_mode: true` to show a maintenance message to all users instantly.

## Development setup

```bash
git clone https://github.com/tridentcx/relay-extension
cd relay-extension

# Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select this folder

# Load in Edge  
# edge://extensions → Developer mode → Load unpacked → select this folder
```

No build step. All vanilla JS.

## Supabase setup

Run migrations in order:

```bash
# 1. Base billing schema
supabase/migration.sql

# 2. Security hardening (write_token, relay_config, bookmark limit trigger)
supabase/migration-v4.8.sql

# 3. Level 2 auth + RLS hardening
supabase/migration-level2-auth.sql

# 4. Rate limiter table
supabase/migration-rate-limiter.sql
```

Deploy Edge Functions:
```bash
supabase functions deploy create-checkout --project-ref mgeiplftbehngfsqtbiq
supabase functions deploy stripe-webhook --project-ref mgeiplftbehngfsqtbiq
supabase functions deploy admin-gift-codes --project-ref mgeiplftbehngfsqtbiq
supabase functions deploy sync-rate-limiter --project-ref mgeiplftbehngfsqtbiq
```

Required Supabase secrets:
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
SITE_URL = https://tridentcx.github.io/relay-extension
ADMIN_PASSWORD_HASH  (SHA-256 of your admin password)
```

## Chrome Web Store

- **Listing:** [Relay – Private Bookmark Sync](#)
- **Permissions:** `bookmarks`, `storage` only
- **Previous rejection:** v4.7.0 — `tabs` permission (removed in v4.14.1)

## License

MIT — see [LICENSE](LICENSE)
