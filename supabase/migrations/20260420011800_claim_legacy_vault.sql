-- One-time compatibility path for vaults created before writeToken was stored
-- inside the encrypted payload. The caller must prove they are claiming the
-- exact current encrypted blob they just pulled, then the next push embeds the
-- new token in the encrypted snapshot.

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
      and data = p_current_data;

  get diagnostics claimed_count = row_count;
  return jsonb_build_object('ok', claimed_count > 0);
end;
$$;

grant execute on function public.claim_legacy_vault(text, text, text) to anon, authenticated;
