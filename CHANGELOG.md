# Changelog — Relay

## v4.15.1 — 2026-04-19
- Migrated repository and all URLs to `tridentcx` organisation
- All `tridentcX` case variants corrected to `tridentcx`

## v4.15.0 — 2026-04-19
**Design upgrade**
- New brand identity: Relay Indigo (`#5B5CF6`) replaces generic Apple blue
- Teal success state (`#0D9488`) replaces green
- All emoji icons replaced with consistent SVG line icons across every view
- New app icon — unified two-arrow sync mark, consistent between toolbar and popup nav
- New animations: multi-layer pulse rings on sync orb, spring physics view transitions, orb shake on error
- Redesigned CSS design system with proper dark/light token separation

**Copywriting**
- All user-facing copy rewritten: plain English, benefit-focused, no jargon in UI
- Technical details (PBKDF2, AES-256) moved to SECURITY.md only
- Stronger upgrade CTA: "Unlock Relay Pro" with feature list

**Docs**
- README.md: complete rewrite with architecture, setup, security summary
- SECURITY.md: full technical security model documentation
- CHANGELOG.md: this file

## v4.14.3 — 2026-04-19
- Fixed IIFE cross-scope: sync.js now calls `window._relayCrypto.*` for all crypto operations
- Resolved "isValidVaultKey is not defined" login error

## v4.14.2 — 2026-04-19
- Wrapped `crypto.js` and `sync.js` in IIFEs — removes `encrypt`, `decrypt`, `supabase`, `vaultKey` etc. from global console scope
- Added `write_token` column: server-side vault ownership verification on UPDATE
- Added `relay_config` table: server-side bookmark limit enforcement via trigger
- Moved Supabase credentials out of popup.js global scope — `redeemGiftCode` and `deleteVault` moved into relay module
- Removed dead `goMainPending` function
- Fixed badge class name mismatch (`plan-badge` → `badge`)

## v4.14.1 — 2026-04-19
- **Fixes Chrome Web Store rejection (Purple Potassium):** removed `tabs` permission
- Fixed `'use strict'` placement in sync.js (must be first statement)
- Fixed PRICING_URL pointing to wrong org
- Fixed CSP to allow config.json fetch from GitHub Pages
- Tightened UUID regex to strict `8-4-4-4-12` format
- Fixed all `tridentCX` → `shahakshat14` URL revert after cancelled org migration

## v4.14.0 — 2026-04-19
- Added remote config (`config.json` on GitHub Pages): `free_bookmark_limit`, `maintenance_mode`, `maintenance_message`
- Maintenance mode: shows in-popup message without a store update
- Remote config URL in CSP

## v4.13.3 — 2026-04-18
- Reverted Level 2 anonymous auth (Supabase GoTrue `grant_type=anonymous` not yet supported on project)
- Restored `anon` RLS policies after Level 2 migration broke sync_history (401 errors)
- Removed rate-limiter call from sync path (Edge Function not yet deployed)
- Added `clearAuthToken` stub for future Level 2

## v4.13.2 — 2026-04-18
- Fixed anonymous auth endpoint: `/auth/v1/signup` → `/auth/v1/token?grant_type=anonymous`
- Added debug logging for auth failures

## v4.13.1 — 2026-04-18
- Fixed anonymous auth endpoint returning 422
- Removed CORS-blocked rate-limiter call from popup

## v4.13.0 — 2026-04-18
- **Level 2 auth attempt:** Supabase anonymous sign-in for real JWT-based RLS (reverted in v4.13.3)
- Added `write_token` support in pushToCloud/pullFromCloud
- Added vault claiming via `claim_vault` RPC
- Rate limiter Edge Function (`sync-rate-limiter`) with 60/hr + 5/min limits
- Rate limit error handler in popup UI

## v4.12.0 — 2026-04-18
- **Two-secret vault model restored:** `vaultKey()` now accepts `accountSalt` — 32-byte random device-local salt mixed into PBKDF2 derivation
- `createAccountSalt()` called on account creation; `getAccountSalt()` on every vault key operation
- Salt preserved across sign-out; sign-in tries salted key first, falls back to legacy
- **SAFE_PROTOCOLS hardened:** removed `file:`, `chrome:`, `edge:`, `about:` — only `http/https/ftp/ftps`
- **Password generator upgraded:** Apple-style `xxxxxx-xxxxxx-xxxxxx` (~71 bits) replaces 4-word list (~26 bits)
- **`noopener noreferrer`** added to all `target="_blank"` links
- SECURITY.md rewritten to accurately reflect current implementation

## v4.11.1 — 2026-04-17
- Migrated repo to tridentcx (reverted — cancelled)
- Updated all hardcoded URLs

## v4.11.0 — 2026-04-17
- Fixed plan badge class mismatch (`plan-badge` → `badge`) — badge styling was resetting on every plan update
- Background re-verification of plan from server on `goMain()` — catches stale cached plan
- Auto-sync forced OFF when downgrading Free → Pro
- Upgrade alert auto-hides on plan upgrade
- `applyRemote` errors no longer swallowed by parse catch block
- Removed dead `goMainPending` function

## v4.10.0 — 2026-04-17
- `clean()` function: detect folders by `Array.isArray(children)` not URL truthiness
- `mergeIn`: validates every node at every depth, caps at 10,000 bookmarks per sync
- `restoreFromSnapshot`: decrypt + parse + validate ALL succeed before any merge
- History list: DOM API instead of innerHTML (XSS safe)
- Eye icons: SVG with opacity toggle (consistent cross-OS)
- `rootMatch()`: null-safe title access
- Admin page: hashed password (`SHA-256`) replaces plaintext

## v4.9.0 — 2026-04-16
- Fixed sync history buttons dead (views were after script tags — listeners never attached)
- Auto-sync: revert toggle immediately on Free plan attempt
- Strength bar colors: CSS tokens (light-mode aware)
- Stale stats cleared on sign-out
- Toast: auto-dismiss after 5s (error) / 3s (success)
- After restore: main view stats refresh immediately
- Username sign-in: auto-lowercase + trim on input
- Password field cleared on failed sign-in attempt

## v4.8.0 — 2026-04-16
- Sign-in pre-verifies credentials (decrypt attempt) before advancing
- `write_token` RLS policy on vaults
- `relay_config` table for server-side feature flags
- Bookmark count trigger enforcement
- Snapshot UUID validation (strict format)
- Admin page password: SHA-256 hashed

## v4.7.0 — REJECTED
- Chrome Web Store rejection: `tabs` permission not needed. Fixed in v4.14.1.

## v4.6.0 — 2026-04-15
- Initial public release architecture
- AES-256-GCM encryption with PBKDF2-600k
- Supabase backend with RLS
- Free/Pro tiers via Stripe
- Gift code redemption
- Sync history (Pro)
