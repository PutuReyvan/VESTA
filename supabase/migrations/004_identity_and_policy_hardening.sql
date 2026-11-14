create table if not exists public.wallet_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint wallet_identities_address_format
    check (wallet_address = lower(wallet_address)
      and wallet_address ~ '^0x[0-9a-f]{40}$')
);

alter table public.wallet_identities enable row level security;
revoke all on table public.wallet_identities from anon, authenticated;

create or replace function public.ensure_wallet_identity()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  verified_wallet text;
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required' using errcode = '42501';
  end if;

  select lower(identity_data ->> 'address')
    into verified_wallet
  from auth.identities
  where user_id = auth.uid()
    and provider = 'ethereum'
  limit 1;

  if verified_wallet is null
    or verified_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'A verified Ethereum identity is required' using errcode = '42501';
  end if;

  insert into public.wallet_identities (user_id, wallet_address, verified_at)
  values (auth.uid(), verified_wallet, now())
  on conflict (user_id) do update
    set wallet_address = excluded.wallet_address,
        verified_at = excluded.verified_at;

  return verified_wallet;
end;
$$;

create or replace function public.current_wallet_address()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wallet_address
  from public.wallet_identities
  where user_id = auth.uid();
$$;

create or replace function public.assign_role_by_wallet(
  target_wallet text,
  target_role public.application_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_wallet text := lower(trim(target_wallet));
  target_user_id uuid;
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can assign roles' using errcode = '42501';
  end if;

  select user_id into target_user_id
  from public.wallet_identities
  where wallet_address = normalized_wallet;

  if target_user_id is null then
    raise exception 'Wallet must sign in once before it can receive a role';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (target_user_id, target_role, auth.uid())
  on conflict (user_id, role) do nothing;

  return target_user_id;
end;
$$;

create or replace function public.list_roles_with_wallets()
returns table (wallet_address text, role public.application_role, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can list roles' using errcode = '42501';
  end if;

  return query
  select wi.wallet_address, ur.role, ur.created_at
  from public.user_roles as ur
  join public.wallet_identities as wi on wi.user_id = ur.user_id
  order by ur.created_at;
end;
$$;

create or replace function public.remove_role_by_wallet(
  target_wallet text,
  target_role public.application_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_wallet text := lower(trim(target_wallet));
  target_user_id uuid;
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can remove roles' using errcode = '42501';
  end if;

  select user_id into target_user_id
  from public.wallet_identities
  where wallet_address = normalized_wallet;

  if target_user_id is null then
    raise exception 'Wallet has not signed in yet';
  end if;

  if target_role = 'company_admin' then
    perform pg_advisory_xact_lock(hashtextextended('vesta-company-admin-role', 0));
    if (select count(*) from public.user_roles where role = 'company_admin') <= 1 then
      raise exception 'The last company admin role cannot be removed';
    end if;
  end if;

  delete from public.user_roles
  where user_id = target_user_id and role = target_role;
end;
$$;

create or replace function public.ensure_default_employee_role()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (auth.uid(), 'employee', auth.uid())
  on conflict (user_id, role) do nothing;

  return true;
end;
$$;

drop policy if exists "operators create profiles" on public.recipient_profiles;
drop policy if exists "operators update profiles" on public.recipient_profiles;
drop policy if exists "operators delete profiles" on public.recipient_profiles;

create or replace function public.prevent_recipient_profile_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id <> old.user_id
    or new.wallet_address <> old.wallet_address
    or new.created_by <> old.created_by then
    raise exception 'Recipient profile identity fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists recipient_profiles_identity_immutable on public.recipient_profiles;
create trigger recipient_profiles_identity_immutable
before update on public.recipient_profiles
for each row execute function public.prevent_recipient_profile_identity_change();

revoke all on table public.user_roles from anon;
revoke all on table public.recipient_profiles from anon;
grant select on table public.user_roles to authenticated;
grant select, insert, update, delete on table public.recipient_profiles to authenticated;

revoke all on function public.ensure_wallet_identity() from public;
revoke execute on function public.ensure_wallet_identity() from anon;
grant execute on function public.ensure_wallet_identity() to authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;
