-- Keep privileged RPCs out of caller-controlled schemas while preserving the
-- explicit authenticated RPC boundary used by the frontend.
alter function public.has_role(public.application_role) set search_path = '';
alter function public.assign_role_by_wallet(text, public.application_role) set search_path = '';
alter function public.current_wallet_address() set search_path = '';
alter function public.list_roles_with_wallets() set search_path = '';
alter function public.remove_role_by_wallet(text, public.application_role) set search_path = '';
alter function public.ensure_default_employee_role() set search_path = '';

drop policy if exists "users can read their own roles" on public.user_roles;
drop policy if exists "company admins manage roles" on public.user_roles;

create policy "users can read their own roles"
  on public.user_roles for select
  to authenticated
  using ((select auth.uid()) = user_id
    or (select public.has_role('company_admin'))
    or (select public.has_role('auditor')));

drop policy if exists "authorized users read profiles" on public.recipient_profiles;
drop policy if exists "users can create their own recipient profile" on public.recipient_profiles;
drop policy if exists "users can update their own recipient profile" on public.recipient_profiles;
drop policy if exists "users can delete their own recipient profile" on public.recipient_profiles;

create policy "authorized users read profiles"
  on public.recipient_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id
    or (select public.has_role('company_admin'))
    or (select public.has_role('hr_operator'))
    or (select public.has_role('auditor')));

create policy "users can create their own recipient profile"
  on public.recipient_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id
    and wallet_address = (select public.current_wallet_address()));

create policy "users can update their own recipient profile"
  on public.recipient_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and wallet_address = (select public.current_wallet_address()));

create policy "users can delete their own recipient profile"
  on public.recipient_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);
