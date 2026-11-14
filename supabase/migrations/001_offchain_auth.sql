create type public.application_role as enum (
  'company_admin',
  'hr_operator',
  'employee',
  'auditor'
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.application_role not null,
  assigned_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.recipient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique,
  display_name text not null,
  employee_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipient_profiles_wallet_address_format
    check (wallet_address = lower(wallet_address)
      and wallet_address ~ '^0x[0-9a-f]{40}$')
);

create or replace function public.has_role(required_role public.application_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
  );
$$;

revoke all on function public.has_role(public.application_role) from public;
grant execute on function public.has_role(public.application_role) to authenticated;

alter table public.user_roles enable row level security;
alter table public.recipient_profiles enable row level security;

create policy "users can read their own roles"
  on public.user_roles for select
  using (user_id = auth.uid()
    or public.has_role('company_admin')
    or public.has_role('auditor'));

create policy "company admins manage roles"
  on public.user_roles for all
  using (public.has_role('company_admin'))
  with check (public.has_role('company_admin') and assigned_by = auth.uid());

create policy "authorized users read profiles"
  on public.recipient_profiles for select
  using (user_id = auth.uid()
    or public.has_role('company_admin')
    or public.has_role('hr_operator')
    or public.has_role('auditor'));

create policy "operators create profiles"
  on public.recipient_profiles for insert
  with check ((public.has_role('company_admin')
    or public.has_role('hr_operator'))
    and created_by = auth.uid());

create policy "operators update profiles"
  on public.recipient_profiles for update
  using (public.has_role('company_admin')
    or public.has_role('hr_operator'))
  with check (public.has_role('company_admin')
    or public.has_role('hr_operator'));

create policy "operators delete profiles"
  on public.recipient_profiles for delete
  using (public.has_role('company_admin')
    or public.has_role('hr_operator'));

create or replace function public.touch_recipient_profile()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipient_profiles_updated_at
before update on public.recipient_profiles
for each row execute function public.touch_recipient_profile();
