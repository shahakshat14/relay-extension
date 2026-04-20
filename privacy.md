# Privacy Policy — Relay

*Last updated: April 19, 2026*

---

## The short version

Relay does not collect your personal information. It cannot read your bookmarks. It has no idea who you are.

---

## What we collect

**Nothing that identifies you.** When you create a Relay account, you choose a username. We never see it — it's hashed before it leaves your device and stored only as an unrecognisable hash.

**An encrypted blob.** Your bookmarks are encrypted on your device using your password before they're sent to our servers. We store the result. We cannot decrypt it. Nobody can without your password.

**A browser identifier.** A random UUID generated on first install. Used only to enforce the 2-browser limit on the free plan. Not tied to you, your device, or your identity in any way.

**Sync logs (hashed).** For rate limiting, we log sync events with a truncated hash of your IP address (first 8 bytes of SHA-256). This is not reversible to your actual IP. Logs are deleted after 2 hours.

---

## What we do not collect

- Your name
- Your email address
- Your actual IP address
- Your browsing history
- Your bookmark contents (encrypted — we can't read them)
- Any analytics or usage telemetry
- Device identifiers beyond the random browser UUID
- Location data

---

## Third parties

**Supabase** — our cloud database provider (hosted in Canada). Stores the encrypted vault blob and hashed vault key. Supabase cannot read your bookmark data.

**Stripe** — payment processor for Relay Pro subscriptions. Stripe handles payment data; we never see your card details. We link your Stripe subscription to your hashed vault key, not to a name or email.

Neither party receives personally identifiable information from Relay.

---

## Data retention

Your encrypted vault data is retained until you delete your account. Sync history snapshots (Pro) are kept for 30 days then auto-deleted. Sync logs are deleted after 2 hours.

When you delete your account, your vault, sync history, and browser registrations are permanently removed from our servers.

---

## Cookies and tracking

None. Relay has no website analytics, no tracking pixels, no third-party scripts. The extension does not inject content into web pages.

---

## Open source

Relay's source code is publicly available at [github.com/tridentcx/relay-extension](https://github.com/tridentcx/relay-extension). You can verify every claim in this policy by reading the code.

---

## Changes

If this policy changes materially, we'll update the date above and note it in the changelog. The extension will continue to work without any action from you.

---

## Contact

Questions? Open an issue at [github.com/tridentcx/relay-extension/issues](https://github.com/tridentcx/relay-extension/issues).
