# How Relay Protects Your Data

Relay was built privacy-first. Here's exactly how your data is protected — no marketing, no vague claims, just the technical truth.

---

## The security model

Relay uses **two independent secrets**. An attacker needs both to access your bookmarks.

### 🔑 Secret 1 — Your password

- **What it does:** Derives an AES-256-GCM encryption key via PBKDF2 (600,000 iterations, SHA-256, 32-byte random salt). Encrypts and decrypts your bookmark data.
- **Where it lives:** Only in your head. Relay never stores it, never transmits it, never logs it.
- **What it protects:** The content of your bookmarks. Without your password the encrypted blob is completely unreadable — even to us, even if our database is fully compromised.

### 🎲 Secret 2 — Your account salt

- **What it does:** A 32-byte cryptographically random value generated on first install. It is mixed into the vault key derivation alongside your username: `PBKDF2(username, PEPPER || accountSalt)`.
- **Where it lives:** `chrome.storage.local` on your device. It never leaves your browser.
- **What it protects against:** Vault enumeration. An attacker who knows your username cannot compute your vault key — and therefore cannot fetch your encrypted data — without also having physical access to your device.

---

## Why two secrets?

A common attack on encrypted cloud storage:

1. Enumerate or guess all vault identifiers in the database
2. For each vault, try offline password brute-force
3. If decryption succeeds, the data is compromised

If the vault key were purely derived from the username (deterministic, no device secret), an attacker who knows your username could fetch your encrypted blob and attempt offline brute-force.

By mixing in a random device-local salt, **the vault key is uncomputable without the device**:

| What the attacker has | What they can do |
|---|---|
| Username only | Cannot locate your vault |
| Password only | Cannot locate your vault |
| Username + password | Cannot locate your vault without the device salt |
| Username + device salt | Can find vault, cannot decrypt without password |
| All three | Full access |

The device salt is what makes the model genuinely two-factor at the vault level.

---

## What Relay and Supabase can see

| Data | What is stored | Can we read it? |
|---|---|---|
| Your bookmarks | AES-256-GCM encrypted blob | ❌ No |
| Vault identifier | PBKDF2(username, PEPPER ∥ deviceSalt) | ✅ Yes (row key) |
| Your password | Not stored at all | ❌ No |
| Your device salt | Not stored server-side | ❌ No |
| Your identity | Nothing — no email, no name | ❌ No |

Supabase stores only the encrypted blob and the derived vault key hash. Even a complete database breach yields nothing readable.

---

## Encryption details

| Property | Value |
|---|---|
| Bookmark encryption | AES-256-GCM |
| Key derivation (data) | PBKDF2-SHA256, **600,000 iterations** |
| Key derivation (vault key) | PBKDF2-SHA256, 200,000 iterations |
| Data key salt | 32 bytes, random per encrypt operation |
| IV / nonce | 12 bytes, random per encrypt operation |
| Key length | 256 bits |
| Vault key pepper | `relay-vault-pepper-v1` (public, fixed) |
| Device salt | 32 bytes, random per account, stored locally |

The data salt and IV are regenerated on every sync, so the same bookmark set produces different ciphertext every time. This prevents ciphertext comparison across syncs.

---

## Password strength

Relay generates strong passwords in the format `xxxxxx-xxxxxx-xxxxxx` — three groups of 6 characters drawn from a 32-character set (lowercase a–z, digits 2–9, excluding visually ambiguous characters). Each group is guaranteed to contain at least one digit.

**Entropy: ~71 bits.**

At PBKDF2-600k on a modern GPU (~1,000–3,000 attempts/sec), exhausting this space would take millions of years. You may use any password you choose, but the generated default is already very strong.

---

## What happens if you reinstall Relay?

Reinstalling clears `chrome.storage.local`, which deletes your account salt. Without it, Relay cannot compute your vault key and cannot locate your vault.

**Recovery:** You must have a copy of your account salt (included in your recovery key file). On the sign-in screen, use the recovery option and enter your username, password, and account salt. Your bookmarks will be restored from the cloud.

If you lose both your account salt and your recovery key, **your bookmarks cannot be recovered**. This is intentional — no back door means no one can use a back door against you.

---

## URL sync policy

Relay only syncs bookmarks with `http://`, `https://`, `ftp://`, and `ftps://` URLs. The following are **not synced**:

- `file://` — would leak local filesystem paths across devices
- `chrome://`, `edge://` — browser-internal URLs meaningless on other browsers
- `about://`, `javascript://`, `data://` — browser-internal or potentially dangerous

---

## Open source

Relay's source code is fully open. Verify every claim on this page by reading the code:

- Encryption & vault key: [`crypto.js`](./crypto.js)
- Sync engine & URL filtering: [`sync.js`](./sync.js)
- Account salt generation: [`popup.js`](./popup.js)

Found a security issue? Open a GitHub issue or contact us directly.
