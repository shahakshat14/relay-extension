# Support

Relay is privacy-first, so support is intentionally designed around minimal account data. There is no email identity, no password recovery, and no server-side access to bookmark contents.

## Best support path

Open an issue at [github.com/trident-cx/relay-extension/issues](https://github.com/trident-cx/relay-extension/issues).

Include:

- Browser and version
- Relay version from the extension settings screen
- Whether you are on Free or Pro
- The action that failed: sign in, sync, restore, upgrade, gift code, or delete account
- The exact error shown in Relay
- Whether this is a first browser or an additional browser

Do not include:

- Your password
- Full bookmark exports
- Stripe card details
- Private URLs or screenshots containing sensitive bookmarks

## Known support boundaries

- Lost passwords cannot be recovered because Relay never stores them.
- Deleted cloud vaults cannot be restored unless the user has a local browser profile or browser backup containing the bookmarks.
- Sync history is a Pro feature and stores encrypted snapshots only.
- Billing questions may require Stripe dashboard access.

## Security issues

For suspected vulnerabilities, open an issue with a minimal reproduction. If public disclosure would create risk, contact the repository owner through GitHub first and request a private reporting path.
