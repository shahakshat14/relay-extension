'use strict';

// ─────────────────────────────────────────────────────────────────────
// E2E Encryption using Web Crypto API (AES-256-GCM)
// The passphrase never leaves the device.
// Supabase only ever stores the encrypted blob — unreadable without key.
// ─────────────────────────────────────────────────────────────────────

const ENC = new TextEncoder();
const DEC = new TextDecoder();

// Derive a 256-bit AES key from the passphrase using PBKDF2
async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey(
    'raw', ENC.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext string → base64 blob (salt + iv + ciphertext)
async function encrypt(plaintext, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);
  const ct   = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENC.encode(plaintext)
  );
  // Pack: [salt 32b][iv 12b][ciphertext]
  const buf = new Uint8Array(32 + 12 + ct.byteLength);
  buf.set(salt, 0);
  buf.set(iv, 32);
  buf.set(new Uint8Array(ct), 44);
  return btoa(String.fromCharCode(...buf));
}

// Decrypt base64 blob → plaintext string
async function decrypt(blob, passphrase) {
  const buf  = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
  const salt = buf.slice(0, 32);
  const iv   = buf.slice(32, 44);
  const ct   = buf.slice(44);
  const key  = await deriveKey(passphrase, salt);
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return DEC.decode(pt);
}

// Derive a vault key (public identifier) from passphrase
// This is a one-way hash — cannot reverse to passphrase
async function vaultKey(passphrase) {
  const salt = ENC.encode('relay-vault-id-v1');
  const base = await crypto.subtle.importKey(
    'raw', ENC.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2,'0')).join('');
}
