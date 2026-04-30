const assert = require('node:assert/strict');
const fs = require('node:fs');

const config = fs.readFileSync('config.js', 'utf8');
const url = config.match(/SUPABASE_URL = '([^']+)'/)?.[1];
const key = config.match(/SUPABASE_KEY = '([^']+)'/)?.[1];

assert(url, 'SUPABASE_URL missing from config.js');
assert(key, 'SUPABASE_KEY missing from config.js');

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function rawRpc(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function rpc(name, body) {
  const result = await rawRpc(name, body);
  assert.equal(result.ok, true, `${name} failed with ${result.status}: ${result.text}`);
  return result.data;
}

function deniedOrEmpty(result) {
  if (!result.ok) return true;
  if (result.data == null) return true;
  if (Array.isArray(result.data)) return result.data.length === 0;
  if (typeof result.data === 'object') {
    return result.data.deleted === false || result.data.ok === false || Object.keys(result.data).length === 0;
  }
  return false;
}

(async () => {
  const vaultKey = randomHex(32);
  const writeToken = randomHex(32);
  const wrongToken = randomHex(32);
  const payload = `adversarial-encrypted-placeholder-${Date.now()}`;

  try {
    const pushed = await rpc('push_vault', {
      p_vault_key: vaultKey,
      p_data: payload,
      p_write_token: writeToken,
      p_last_seen_updated_at: null,
    });
    assert.equal(pushed.ok, true);

    const pulled = await rpc('pull_vault', { p_vault_key: vaultKey });
    assert.equal(pulled.length, 1);
    assert.equal(pulled[0].data, payload);

    const wrongDelete = await rawRpc('delete_vault', {
      p_vault_key: vaultKey,
      p_write_token: wrongToken,
    });
    assert.notEqual(wrongDelete.data?.deleted, true, 'wrong write token must not report a successful delete');
    assert.equal(deniedOrEmpty(wrongDelete), true, 'wrong write token must not delete vault');

    const stillThere = await rpc('pull_vault', { p_vault_key: vaultKey });
    assert.equal(stillThere.length, 1, 'vault disappeared after wrong-token delete attempt');
    assert.equal(stillThere[0].data, payload);

    const wrongHistory = await rawRpc('list_sync_history', {
      p_vault_key: vaultKey,
      p_write_token: wrongToken,
      p_cutoff: new Date(Date.now() - 30 * 86400_000).toISOString(),
    });
    assert.equal(deniedOrEmpty(wrongHistory), true, 'wrong write token must not expose history');

    const wrongSnapshot = await rawRpc('get_sync_snapshot', {
      p_vault_key: vaultKey,
      p_write_token: wrongToken,
      p_snapshot_id: crypto.randomUUID(),
    });
    assert.equal(deniedOrEmpty(wrongSnapshot), true, 'wrong write token must not expose snapshots');

    const invalidVaultPull = await rawRpc('pull_vault', { p_vault_key: 'not-a-vault-key' });
    assert.equal(deniedOrEmpty(invalidVaultPull), true, 'invalid vault keys must not expose data');

    const deleted = await rpc('delete_vault', {
      p_vault_key: vaultKey,
      p_write_token: writeToken,
    });
    assert.equal(deleted.deleted, true);

    const afterDelete = await rpc('pull_vault', { p_vault_key: vaultKey });
    assert.deepEqual(afterDelete, []);

    console.log('PASS adversarial RPC ownership contract');
  } finally {
    await rawRpc('delete_vault', {
      p_vault_key: vaultKey,
      p_write_token: writeToken,
    });
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
