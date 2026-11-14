create extension if not exists pgcrypto;

create type public.application_role as enum (
  'company_admin',
  'hr_operator',
  'employee',
  'auditor'
);

create table public.user_roles (
  wallet_address text not null,
  role public.application_role not null,
  assigned_by text not null,
  created_at timestamptz not null default now(),
  primary key (wallet_address, role),
  constraint user_roles_wallet_address_format
    check (wallet_address = lower(wallet_address)
      and wallet_address ~ '^0x[0-9a-f]{40}$'),
  constraint user_roles_assigned_by_format
    check (assigned_by = lower(assigned_by)
      and assigned_by ~ '^0x[0-9a-f]{40}$')
);

create table public.recipient_profiles (
  wallet_address text primary key,
  display_name text not null,
  employee_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipient_profiles_wallet_address_format
    check (wallet_address = lower(wallet_address)
      and wallet_address ~ '^0x[0-9a-f]{40}$'),
  constraint recipient_profiles_created_by_format
    check (created_by = lower(created_by)
      and created_by ~ '^0x[0-9a-f]{40}$')
);

create table public.auth_nonces (
  wallet_address text primary key,
  nonce_hash text not null unique,
  message text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint auth_nonces_wallet_address_format
    check (wallet_address = lower(wallet_address)
      and wallet_address ~ '^0x[0-9a-f]{40}$')
);

create or replace function public.current_wallet()
returns text
language sql
stable
as $$
  select lower((nullif(current_setting('request.jwt.claims', true), '')::jsonb
    ->> 'wallet_address'));
$$;

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
    where wallet_address = public.current_wallet()
      and role = required_role
  );
$$;

alter table public.user_roles enable row level security;
alter table public.recipient_profiles enable row level security;
alter table public.auth_nonces enable row level security;

create policy "users can read their own roles"
  on public.user_roles for select
  using (wallet_address = public.current_wallet()
    or public.has_role('company_admin')
    or public.has_role('auditor'));

create policy "company admins manage roles"
  on public.user_roles for all
  using (public.has_role('company_admin'))
  with check (public.has_role('company_admin'));

create policy "authorized users read profiles"
  on public.recipient_profiles for select
  using (wallet_address = public.current_wallet()
    or public.has_role('company_admin')
    or public.has_role('hr_operator')
    or public.has_role('auditor'));

create policy "operators manage profiles"
  on public.recipient_profiles for insert
  with check (public.has_role('company_admin')
    or public.has_role('hr_operator'));

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

create policy "wallet can read its nonce"
  on public.auth_nonces for select
  using (wallet_address = public.current_wallet());

-- Nonces are written and consumed by the server-side service-role client only.
revoke all on public.auth_nonces from anon, authenticated;

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
