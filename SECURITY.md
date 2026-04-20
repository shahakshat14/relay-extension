# Security Model — Relay v4.15

Relay was built privacy-first. This document describes the actual implementation — no marketing, no vague claims.

---

## Two-secret vault model

Relay uses two independent secrets to locate and decrypt your vault. An attacker needs **all three** (username + account salt + password) to access your bookmarks.

### Secret 1 — Account salt

- **What:** 32 cryptographically random bytes generated on first install
- **Where:** `chrome.storage.local` on your device. Never transmitted.
- **Role:** Mixed into vault key derivation. Knowing your username alone is not enough to find your vault — the salt must also be present.

### Secret 2 — Password

- **What:** Your chosen password (or the generated `xxxxxx-xxxxxx-xxxxxx` format — ~71 bits entropy)
- **Where:** Held in `chrome.storage.session` during your browser session. Cleared when the browser closes. Never stored server-side, never transmitted in plaintext.
- **Role:** Derives the AES-256-GCM encryption key for your bookmark data via PBKDF2 (600,000 iterations, SHA-256). Without it, the stored blob is completely unreadable.

---

## Vault key derivation

```
vault_key = PBKDF2(username, PEPPER || accountSalt, 200_000 iters) → 64-char hex
```

- `PEPPER` = `"relay-vault-pepper-v1"` (public constant)
- `accountSalt` = 32 random bytes, device-local
- Result is the row identifier in the database

Without the `accountSalt`, an attacker who knows the username cannot compute the vault key.

---

## Data encryption

```
ciphertext = AES-256-GCM(
  plaintext  = JSON.stringify(bookmarks),
  key        = PBKDF2(password, random_32_byte_salt, 600_000 iters),
  iv         = random_12_bytes,
  salt       = random_32_bytes   ← new on every encrypt
)

stored_blob = base64(salt || iv || ciphertext)
```

The salt and IV are regenerated on every sync, so the same bookmark set produces different ciphertext each time. This prevents ciphertext comparison across snapshots.

---

## What the server stores

| Data | Stored as | Readable by server? |
|---|---|---|
| Bookmarks | AES-256-GCM encrypted blob | ❌ No |
| Vault identifier | PBKDF2(username ∥ salt) hash | ✅ Yes (row key) |
| Password | Not stored | ❌ No |
| Account salt | Not stored | ❌ No |
| Username | Not stored | ❌ No |
| Identity | Nothing | ❌ No |

Even a complete database breach yields only unreadable ciphertexts.

---

## Password strength

Generated passwords use the format `xxxxxx-xxxxxx-xxxxxx`:
- 3 groups of 6 characters
- Character set: `abcdefghijkmnpqrstuvwxyz23456789` (32 chars, no ambiguous l/1/0/o)
- Each group guaranteed to contain at least one digit
- **Entropy: ~71 bits**

At PBKDF2-600k on a modern GPU (~1,000–3,000 guesses/sec), exhausting this space would take millions of years.

---

## Write token

Each vault has a `write_token` — a 32-byte random hex string generated at account creation and stored locally. Current vault snapshots also include this token inside the encrypted payload, so a second browser can recover it only after decrypting with the account password. Supabase RPCs require the token before updating or deleting a vault.

---

## Code isolation (IIFE modules)

`crypto.js` and `sync.js` are wrapped in IIFEs. Their internal functions (`encrypt`, `decrypt`, `vaultKey`, `supabase`, etc.) are not accessible from the browser console. Only the explicitly exported surfaces are reachable:

```javascript
window._relayCrypto = { encrypt, decrypt, vaultKey, isValidVaultKey }
window._relay       = { doSync, pullFromCloud, checkUsernameAvailable,
                        getPlan, listHistory, restoreFromSnapshot,
                        redeemGiftCode, deleteVault, clearAuthToken }
```

The Supabase URL and anon key are in `config.js` (intentionally public — all security comes from RLS, not key secrecy).

---

## URL filtering

Only bookmarks with these protocols are synced: `http:`, `https:`, `ftp:`, `ftps:`

Excluded:
- `file://` — would leak local filesystem paths across devices
- `chrome://`, `edge://` — browser-internal URLs meaningless on other browsers
- `about://`, `javascript://`, `data://` — browser-internal or dangerous

---

## Database RLS policies

| Table / view | anon INSERT | anon SELECT | anon UPDATE | anon DELETE |
|---|---|---|---|---|
| `vaults` | ❌ use `push_vault` RPC | ❌ use `pull_vault` RPC | ❌ use `push_vault` RPC | ❌ use `delete_vault` RPC |
| `sync_history` | ❌ use `save_sync_snapshot` RPC | ❌ use history RPCs | ❌ | ❌ |
| `vault_plan` | n/a | ❌ use `get_vault_plan` RPC | n/a | n/a |
| `vault_browsers` | ❌ use `register_browser` RPC | ❌ | ❌ use `register_browser` RPC | ❌ |
| `gift_codes` | ❌ service_role only | ❌ service_role only | ❌ | ❌ |
| `sync_log` | ❌ service_role only | ❌ service_role only | ❌ | ❌ |
| `relay_config` | ❌ | ❌ use GitHub-hosted `config.json` | ❌ | ❌ |

Sensitive RPCs (`pull_vault`, `push_vault`, `delete_vault`, history helpers, `register_browser`, `redeem_gift_code`) are `SECURITY DEFINER` and expose only the fields required by the extension. `write_token` is never returned by an anonymous API response.

---

## Rate limiting

The `sync-rate-limiter` Edge Function enforces:
- 60 syncs per hour per vault
- 5 syncs per minute per vault (burst protection)

IPs are stored as truncated SHA-256 hashes (first 8 bytes) for abuse detection without storing raw IPs.

---

## Content Security Policy

```
script-src  'self'
object-src  'self'
connect-src 'self' https://*.supabase.co https://tridentcx.github.io
```

No inline scripts. No eval. No external script sources.

---

## Reporting a vulnerability

Open a GitHub issue at [github.com/tridentcx/relay-extension/issues](https://github.com/tridentcx/relay-extension/issues) or email directly. We aim to respond within 48 hours.
