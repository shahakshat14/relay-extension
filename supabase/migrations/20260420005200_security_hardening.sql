-- Relay security hardening
-- Apply after the existing Relay schema/migrations.

-- The extension now uses narrow SECURITY DEFINER RPCs instead of granting
-- anonymous REST access to the underlying tables/views.
revoke all on table public.vaults from anon, authenticated;
revoke all on table public.sync_history from anon, authenticated;
revoke all on table public.vault_plan from anon, authenticated;

alter table public.vaults enable row level security;
alter table public.sync_history enable row level security;

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('vaults', 'sync_history')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create or replace function public.is_relay_vault_key(p_vault_key text)
returns boolean
language sql
immutable
as $$
  select p_vault_key ~ '^[a-f0-9]{64}$';
$$;

create or replace function public.is_relay_write_token(p_write_token text)
returns boolean
language sql
immutable
as $$
  select p_write_token ~ '^[a-f0-9]{64}$';
$$;

create or replace function public.vault_exists(p_vault_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_relay_vault_key(p_vault_key) then
    return false;
  end if;

  return exists (
    select 1 from public.vaults where vault_key = p_vault_key
  );
end;
$$;

create or replace function public.pull_vault(p_vault_key text)
returns table(data text, updated_at timestamp with time zone)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_relay_vault_key(p_vault_key) then
    return;
  end if;

  return query
    select v.data, v.updated_at
    from public.vaults v
    where v.vault_key = p_vault_key
    limit 1;
end;
$$;

create or replace function public.push_vault(
  p_vault_key text,
  p_data text,
  p_write_token text,
  p_last_seen_updated_at timestamp with time zone default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing record;
begin
  if not public.is_relay_vault_key(p_vault_key)
     or not public.is_relay_write_token(p_write_token)
     or p_data is null
  then
    raise exception 'invalid vault write';
  end if;

  select v.updated_at, v.write_token
    into existing
    from public.vaults v
    where v.vault_key = p_vault_key
    for update;

  if not found then
    insert into public.vaults (vault_key, data, updated_at, write_token)
    values (p_vault_key, p_data, now(), p_write_token);
    return jsonb_build_object('ok', true, 'created', true);
  end if;

  if existing.write_token is not null and existing.write_token <> p_write_token then
    raise exception 'invalid write token';
  end if;

  if p_last_seen_updated_at is not null
     and existing.updated_at is distinct from p_last_seen_updated_at
  then
    return jsonb_build_object('ok', false, 'conflict', true);
  end if;

  update public.vaults
    set data = p_data,
        updated_at = now(),
        write_token = p_write_token
    where vault_key = p_vault_key;

  return jsonb_build_object('ok', true, 'created', false);
end;
$$;

create or replace function public.get_vault_plan(p_vault_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row record;
begin
  if not public.is_relay_vault_key(p_vault_key) then
    return jsonb_build_object('effective_plan', 'free', 'bookmark_count', 0);
  end if;

  select effective_plan, bookmark_count
    into plan_row
    from public.vault_plan
    where vault_key = p_vault_key
    limit 1;

  if not found then
    return jsonb_build_object('effective_plan', 'free', 'bookmark_count', 0);
  end if;

  return jsonb_build_object(
    'effective_plan', plan_row.effective_plan,
    'bookmark_count', coalesce(plan_row.bookmark_count, 0)
  );
end;
$$;

create or replace function public.save_sync_snapshot(
  p_vault_key text,
  p_data text,
  p_bookmark_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_relay_vault_key(p_vault_key) or p_data is null then
    raise exception 'invalid sync snapshot';
  end if;

  insert into public.sync_history (vault_key, data, bookmark_count)
  values (p_vault_key, p_data, greatest(coalesce(p_bookmark_count, 0), 0));
end;
$$;

create or replace function public.list_sync_history(
  p_vault_key text,
  p_cutoff timestamp with time zone
)
returns table(id uuid, bookmark_count integer, created_at timestamp with time zone)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_relay_vault_key(p_vault_key) then
    return;
  end if;

  return query
    select h.id, h.bookmark_count, h.created_at
    from public.sync_history h
    where h.vault_key = p_vault_key
      and h.created_at >= coalesce(p_cutoff, now() - interval '30 days')
    order by h.created_at desc
    limit 50;
end;
$$;

create or replace function public.get_sync_snapshot(
  p_vault_key text,
  p_snapshot_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_data text;
begin
  if not public.is_relay_vault_key(p_vault_key) then
    return null;
  end if;

  select h.data
    into snapshot_data
    from public.sync_history h
    where h.vault_key = p_vault_key
      and h.id = p_snapshot_id
    limit 1;

  return snapshot_data;
end;
$$;

create or replace function public.delete_vault(
  p_vault_key text,
  p_write_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_relay_vault_key(p_vault_key)
     or not public.is_relay_write_token(p_write_token)
  then
    raise exception 'invalid vault delete';
  end if;

  if not exists (
    select 1
    from public.vaults
    where vault_key = p_vault_key
      and write_token = p_write_token
  ) then
    raise exception 'invalid write token';
  end if;

  delete from public.sync_history where vault_key = p_vault_key;
  if to_regclass('public.vault_browsers') is not null then
    delete from public.vault_browsers where vault_key = p_vault_key;
  end if;
  delete from public.vaults
    where vault_key = p_vault_key
      and write_token = p_write_token;

  get diagnostics deleted_count = row_count;
  return jsonb_build_object('deleted', deleted_count > 0);
end;
$$;

grant execute on function public.vault_exists(text) to anon, authenticated;
grant execute on function public.pull_vault(text) to anon, authenticated;
grant execute on function public.push_vault(text, text, text, timestamp with time zone) to anon, authenticated;
grant execute on function public.get_vault_plan(text) to anon, authenticated;
grant execute on function public.save_sync_snapshot(text, text, integer) to anon, authenticated;
grant execute on function public.list_sync_history(text, timestamp with time zone) to anon, authenticated;
grant execute on function public.get_sync_snapshot(text, uuid) to anon, authenticated;
grant execute on function public.delete_vault(text, text) to anon, authenticated;
