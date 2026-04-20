-- Remove leftover direct anon/authenticated access from internal tables.
-- Public clients should use the RPC and GitHub-hosted config surfaces only.

do $$
declare
  t text;
begin
  foreach t in array array['vault_browsers', 'gift_codes', 'relay_config', 'sync_log']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
