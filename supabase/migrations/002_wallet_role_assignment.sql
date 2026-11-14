-- Role management is addressed by the wallet users recognize, not auth.users UUIDs.
create or replace function public.assign_role_by_wallet(
  target_wallet text,
  target_role public.application_role
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_wallet text := lower(trim(target_wallet));
  target_user_id uuid;
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can assign roles' using errcode = '42501';
  end if;

  if normalized_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'Invalid wallet address';
  end if;

  select u.id into target_user_id
  from auth.users as u
  where lower(u.raw_user_meta_data #>> '{custom_claims,address}') = normalized_wallet
  limit 1;

  if target_user_id is null then
    raise exception 'Wallet must sign in once before it can receive a role';
  end if;

  insert into public.user_roles (user_id, role, assigned_by)
  values (target_user_id, target_role, auth.uid())
  on conflict (user_id, role) do nothing;

  return target_user_id;
end;
$$;

create or replace function public.current_wallet_address()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(raw_user_meta_data #>> '{custom_claims,address}')
  from auth.users
  where id = auth.uid();
$$;

create or replace function public.list_roles_with_wallets()
returns table (wallet_address text, role public.application_role, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can list roles' using errcode = '42501';
  end if;

  return query
  select lower(u.raw_user_meta_data #>> '{custom_claims,address}'), ur.role, ur.created_at
  from public.user_roles as ur
  join auth.users as u on u.id = ur.user_id
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
set search_path = public, auth
as $$
declare
  normalized_wallet text := lower(trim(target_wallet));
  target_user_id uuid;
  admin_count integer;
begin
  if auth.uid() is null or not public.has_role('company_admin') then
    raise exception 'Only company admins can remove roles' using errcode = '42501';
  end if;

  select u.id into target_user_id
  from auth.users as u
  where lower(u.raw_user_meta_data #>> '{custom_claims,address}') = normalized_wallet
  limit 1;

  if target_user_id is null then
    raise exception 'Wallet has not signed in yet';
  end if;

  if target_role = 'company_admin' then
    select count(*) into admin_count from public.user_roles where role = 'company_admin';
    if admin_count <= 1 then
      raise exception 'The last company admin role cannot be removed';
    end if;
  end if;

  delete from public.user_roles where user_id = target_user_id and role = target_role;
end;
$$;

revoke all on function public.assign_role_by_wallet(text, public.application_role) from public;
revoke all on function public.list_roles_with_wallets() from public;
revoke all on function public.remove_role_by_wallet(text, public.application_role) from public;
revoke execute on function public.assign_role_by_wallet(text, public.application_role) from anon;
revoke execute on function public.list_roles_with_wallets() from anon;
revoke execute on function public.remove_role_by_wallet(text, public.application_role) from anon;
grant execute on function public.assign_role_by_wallet(text, public.application_role) to authenticated;
grant execute on function public.list_roles_with_wallets() to authenticated;
grant execute on function public.remove_role_by_wallet(text, public.application_role) to authenticated;
revoke all on function public.current_wallet_address() from public;
revoke execute on function public.current_wallet_address() from anon;
grant execute on function public.current_wallet_address() to authenticated;

create policy "users can create their own recipient profile"
  on public.recipient_profiles for insert
  with check (user_id = auth.uid() and wallet_address = public.current_wallet_address());

create policy "users can update their own recipient profile"
  on public.recipient_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and wallet_address = public.current_wallet_address());
