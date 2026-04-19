/**
 * Relay – Supabase Security Audit Script
 * ───────────────────────────────────────
 * Paste this entire file into your browser DevTools console
 * (on any page — even a blank tab) and press Enter.
 *
 * It tests every endpoint the extension uses, checks RLS enforcement,
 * and reports exactly what an attacker with only the anon key can do.
 */

const SUPABASE_URL = 'https://mgeiplftbehngfsqtbiq.supabase.co';
const ANON_KEY     = 'sb_publishable_3BVQxcUH_AljAaamBNrhBA_7knbqxFI';

const HDR = {
  'apikey':        ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type':  'application/json',
};

// ── helpers ────────────────────────────────────────────────────────────────

async function get(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HDR });
  const body = await r.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { status: r.status, ok: r.ok, body, json };
}

async function post(path, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST', headers: HDR, body: JSON.stringify(data),
  });
  const body = await r.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { status: r.status, ok: r.ok, body, json };
}

async function rpc(fn, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: HDR, body: JSON.stringify(params),
  });
  const body = await r.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(body); } catch {}
  return { status: r.status, ok: r.ok, body, json };
}

function pass(msg) { console.log(`%c  ✓ PASS  %c ${msg}`, 'color:white;background:#28a745;padding:2px 6px;border-radius:3px', 'color:#28a745'); }
function fail(msg) { console.log(`%c  ✗ FAIL  %c ${msg}`, 'color:white;background:#d70015;padding:2px 6px;border-radius:3px', 'color:#d70015'); }
function warn(msg) { console.log(`%c  ⚠ WARN  %c ${msg}`, 'color:white;background:#b56600;padding:2px 6px;border-radius:3px', 'color:#b56600'); }
function info(msg) { console.log(`%c  ℹ INFO  %c ${msg}`, 'color:white;background:#0066cc;padding:2px 6px;border-radius:3px', 'color:#0066cc'); }
function section(msg) { console.log(`\n%c ${msg} `, 'font-weight:700;font-size:13px;background:#f2f2f7;padding:4px 10px;border-left:3px solid #007aff'); }

// ── tests ──────────────────────────────────────────────────────────────────

async function audit() {
  console.log('%cRelay – Supabase Security Audit', 'font-size:16px;font-weight:700;color:#007aff');
  console.log(`Project: ${SUPABASE_URL}\n`);

  // ── 1. Schema exposure ────────────────────────────────────────────────────
  section('1 · Schema / OpenAPI exposure');
  const schema = await get('');
  if (schema.status === 200 && schema.json?.paths) {
    const paths = Object.keys(schema.json.paths);
    const defs  = Object.keys(schema.json.definitions || {});
    warn(`OpenAPI schema is public. Exposed tables/views: ${paths.join(', ')}`);
    if (defs.length) warn(`Exposed column definitions: ${defs.join(', ')}`);
  } else if (schema.status === 401 || schema.status === 403) {
    pass('OpenAPI schema is restricted (not publicly browsable)');
  } else {
    info(`Schema response: HTTP ${schema.status} — ${schema.body.slice(0,120)}`);
  }

  // ── 2. vaults — full table scan ───────────────────────────────────────────
  section('2 · vaults table – full scan (no filter)');
  const vAll = await get('vaults?limit=5');
  if (vAll.ok && Array.isArray(vAll.json) && vAll.json.length > 0) {
    fail(`RLS MISSING — returned ${vAll.json.length} vault row(s) without any filter!`);
    console.table(vAll.json.map(r => ({ vault_key: r.vault_key?.slice(0,12)+'…', has_data: !!r.data, updated_at: r.updated_at })));
  } else if (vAll.ok && Array.isArray(vAll.json) && vAll.json.length === 0) {
    warn('vaults full scan returned empty array — RLS may be off but table is empty, or RLS is on and hiding rows. Check dashboard.');
  } else if (vAll.status === 401 || vAll.status === 403) {
    pass('vaults full scan blocked by RLS (401/403)');
  } else {
    info(`vaults full scan: HTTP ${vAll.status} — ${vAll.body.slice(0,200)}`);
  }

  // ── 3. vaults — read a specific (fake) vault key ─────────────────────────
  section('3 · vaults table – read by vault_key');
  const fakeKey = 'a'.repeat(64); // fake 64-char hex key
  const vOne = await get(`vaults?vault_key=eq.${fakeKey}&select=vault_key,updated_at`);
  if (vOne.ok && Array.isArray(vOne.json)) {
    pass(`Keyed vault read works (returned ${vOne.json.length} rows for fake key — expected 0)`);
  } else {
    warn(`Keyed vault read: HTTP ${vOne.status} — ${vOne.body.slice(0,200)}`);
  }

  // ── 4. vaults — unauthenticated write (INSERT) ───────────────────────────
  section('4 · vaults table – unauthenticated INSERT');
  const testKey = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const vIns = await post('vaults', { vault_key: testKey, data: 'audit-test', updated_at: new Date().toISOString() });
  if (vIns.ok) {
    warn(`INSERT succeeded with anon key (vault_key: ${testKey.slice(0,12)}…) — anyone can create vaults. Check if this is intended.`);
    // Clean up
    await fetch(`${SUPABASE_URL}/rest/v1/vaults?vault_key=eq.${testKey}`, { method:'DELETE', headers: HDR });
    info('Test row cleaned up.');
  } else if (vIns.status === 401 || vIns.status === 403) {
    pass('Anonymous INSERT into vaults is blocked');
  } else {
    info(`vaults INSERT: HTTP ${vIns.status} — ${vIns.body.slice(0,200)}`);
  }

  // ── 5. sync_history — full table scan ────────────────────────────────────
  section('5 · sync_history table – full scan');
  const shAll = await get('sync_history?limit=5');
  if (shAll.ok && Array.isArray(shAll.json) && shAll.json.length > 0) {
    fail(`RLS MISSING on sync_history — returned ${shAll.json.length} row(s) without a filter!`);
  } else if (shAll.ok && Array.isArray(shAll.json) && shAll.json.length === 0) {
    warn('sync_history full scan returned []. RLS may be off but table is empty. Verify in dashboard.');
  } else if (shAll.status === 401 || shAll.status === 403) {
    pass('sync_history full scan blocked by RLS');
  } else {
    info(`sync_history: HTTP ${shAll.status} — ${shAll.body.slice(0,200)}`);
  }

  // ── 6. vault_plan — full scan ─────────────────────────────────────────────
  section('6 · vault_plan view – full scan');
  const vpAll = await get('vault_plan?limit=5');
  if (vpAll.ok && Array.isArray(vpAll.json) && vpAll.json.length > 0) {
    fail(`RLS MISSING on vault_plan — returned ${vpAll.json.length} row(s)!`);
  } else if (vpAll.ok && Array.isArray(vpAll.json) && vpAll.json.length === 0) {
    warn('vault_plan returned []. Check dashboard — RLS may be off on an empty view.');
  } else if (vpAll.status === 401 || vpAll.status === 403) {
    pass('vault_plan full scan blocked');
  } else {
    info(`vault_plan: HTTP ${vpAll.status} — ${vpAll.body.slice(0,200)}`);
  }

  // ── 7. register_browser RPC ───────────────────────────────────────────────
  section('7 · register_browser RPC – probe');
  const rb = await rpc('register_browser', {
    p_vault_key:  fakeKey,
    p_browser_id: crypto.randomUUID(),
    p_ua:         'audit-script/1.0',
  });
  if (rb.ok) {
    info(`register_browser responded: ${rb.body.slice(0,200)}`);
    if (rb.json?.allowed === false) pass('RPC correctly blocked fake vault key');
    else warn('RPC returned allowed:true or unexpected response — verify rate limiting logic');
  } else {
    info(`register_browser: HTTP ${rb.status} — ${rb.body.slice(0,200)}`);
  }

  // ── 8. redeem_gift_code RPC ───────────────────────────────────────────────
  section('8 · redeem_gift_code RPC – probe');
  const gc = await rpc('redeem_gift_code', { p_code: 'AAAA-AAAA-AAAA', p_vault_key: fakeKey });
  if (gc.ok) {
    if (gc.json?.success === false) pass(`RPC rejects bad code correctly: "${gc.json.error}"`);
    else warn(`Unexpected response from redeem_gift_code: ${gc.body.slice(0,200)}`);
  } else {
    info(`redeem_gift_code: HTTP ${gc.status} — ${gc.body.slice(0,200)}`);
  }

  // ── 9. vault enumeration speed test ──────────────────────────────────────
  section('9 · Vault enumeration – can attacker iterate known keys?');
  const t0 = Date.now();
  const probeKey = 'b'.repeat(64);
  await get(`vaults?vault_key=eq.${probeKey}&select=vault_key`);
  const ms = Date.now() - t0;
  info(`Single vault key lookup: ${ms}ms`);
  if (ms < 50) {
    warn(`Fast lookup (${ms}ms) — no rate limiting visible on REST endpoint. An attacker can probe ~${Math.floor(1000/ms)} keys/sec.`);
  } else {
    pass(`Lookup takes ${ms}ms — rate limiting or network latency makes enumeration slow`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section('Audit complete');
  console.log('Review each ✗ FAIL and ⚠ WARN above.');
  console.log('Recommended RLS SQL is in the SECURITY.md or ask Claude for the exact policies.');
}

audit().catch(console.error);
