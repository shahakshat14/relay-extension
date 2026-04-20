-- Tighten compatibility and browser registration RPCs after the initial
-- hardened-RPC migration.

create or replace function public.claim_legacy_vault(
  p_vault_key text,
  p_current_data text,
  p_write_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer;
begin
  if not public.is_relay_vault_key(p_vault_key)
     or not public.is_relay_write_token(p_write_token)
     or p_current_data is null
  then
    raise exception 'invalid vault claim';
  end if;

  update public.vaults
    set write_token = p_write_token
    where vault_key = p_vault_key
      and data = p_current_data
      and write_token is null;

  get diagnostics claimed_count = row_count;
  return jsonb_build_object('ok', claimed_count > 0);
end;
$$;

create or replace function public.register_browser(
  p_vault_key text,
  p_browser_id text,
  p_ua text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_plan text;
begin
  if not public.is_relay_vault_key(p_vault_key)
     or p_browser_id is null
     or length(p_browser_id) > 128
  then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;

  if not exists (select 1 from public.vaults where vault_key = p_vault_key) then
    return jsonb_build_object('allowed', false, 'reason', 'not_found');
  end if;

  if exists (
    select 1 from public.vault_browsers
    where vault_key = p_vault_key and browser_id = p_browser_id
  ) then
    update public.vault_browsers
      set last_seen = now(),
          user_agent = left(coalesce(p_ua, ''), 250)
      where vault_key = p_vault_key and browser_id = p_browser_id;
    return jsonb_build_object('allowed', true, 'reason', 'known');
  end if;

  select effective_plan
    into v_plan
    from public.vault_plan
    where vault_key = p_vault_key;

  v_count := public.browser_count(p_vault_key);

  if coalesce(v_plan, 'free') != 'pro' and v_count >= 2 then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'free_browser_limit',
      'count', v_count,
      'limit', 2
    );
  end if;

  insert into public.vault_browsers (vault_key, browser_id, user_agent)
  values (p_vault_key, p_browser_id, left(coalesce(p_ua, ''), 250));

  return jsonb_build_object('allowed', true, 'reason', 'new', 'count', v_count + 1);
end;
$$;

delete from public.vault_browsers
where user_agent = 'audit-script/1.0'
  and not exists (
    select 1 from public.vaults
    where vaults.vault_key = vault_browsers.vault_key
  );

grant execute on function public.claim_legacy_vault(text, text, text) to anon, authenticated;
grant execute on function public.register_browser(text, text, text) to anon, authenticated;
