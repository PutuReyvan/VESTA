-- Read the wallet only from Supabase Auth's verified Web3 identity. This must be
-- SECURITY DEFINER because authenticated clients cannot read auth.identities or
-- write the protected wallet_identities table directly.
create or replace function public.ensure_wallet_identity()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_user_id uuid := auth.uid();
  web3_identity_count bigint;
  all_web3_identities_valid boolean;
  distinct_wallet_count bigint;
  verified_wallet text;
  mapped_user_id uuid;
begin
  if caller_user_id is null then
    raise exception 'A signed-in user is required' using errcode = '42501';
  end if;

  select
    count(*),
    coalesce(bool_and(
      (identity_data #>> '{custom_claims,address}') is not null
      and (identity_data #>> '{custom_claims,address}')
        = btrim(identity_data #>> '{custom_claims,address}')
      and (identity_data #>> '{custom_claims,address}')
        ~ '^0x[0-9A-Fa-f]{40}$'
    ), false),
    count(distinct lower(identity_data #>> '{custom_claims,address}')),
    min(lower(identity_data #>> '{custom_claims,address}'))
  into
    web3_identity_count,
    all_web3_identities_valid,
    distinct_wallet_count,
    verified_wallet
  from auth.identities
  where user_id = caller_user_id
    and provider = 'web3';

  -- Multiple rows are acceptable only when every verified identity resolves to
  -- the same canonical address. Any malformed or ambiguous state fails closed.
  if web3_identity_count = 0
    or not all_web3_identities_valid
    or distinct_wallet_count <> 1 then
    raise exception 'A single verified Ethereum identity is required'
      using errcode = '42501';
  end if;

  -- Serialize claims for the same canonical address before checking ownership.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wallet-identity:' || verified_wallet, 0)
  );

  select user_id
    into mapped_user_id
  from public.wallet_identities
  where wallet_address = verified_wallet
  for update;

  if mapped_user_id is not null and mapped_user_id <> caller_user_id then
    raise exception 'The verified wallet is already bound to another user'
      using errcode = '42501';
  end if;

  insert into public.wallet_identities (user_id, wallet_address, verified_at)
  values (caller_user_id, verified_wallet, pg_catalog.now())
  on conflict (user_id) do update
    set wallet_address = excluded.wallet_address,
        verified_at = excluded.verified_at;

  return verified_wallet;
end;
$function$;

comment on function public.ensure_wallet_identity() is
  'Binds auth.uid() to its unambiguous, verified Supabase Web3 Ethereum identity.';

-- Functions receive EXECUTE for PUBLIC by default. Keep this privileged RPC
-- callable only by signed-in clients; its body performs the per-user check.
revoke all on function public.ensure_wallet_identity() from public;
revoke all on function public.ensure_wallet_identity() from anon;
revoke all on function public.ensure_wallet_identity() from authenticated;
grant execute on function public.ensure_wallet_identity() to authenticated;

-- Backfill valid, unambiguous Web3 identities. A verified address is never
-- reassigned from another user: conflicts are skipped and surfaced as warnings
-- for manual review instead of choosing an owner arbitrarily.
do $backfill$
declare
  candidate record;
  mapped_user_id uuid;
  invalid_or_ambiguous_users bigint := 0;
  duplicate_address_users bigint := 0;
  existing_mapping_conflicts bigint := 0;
  concurrent_mapping_conflicts bigint := 0;
begin
  with per_user as (
    select
      user_id,
      coalesce(bool_and(
        (identity_data #>> '{custom_claims,address}') is not null
        and (identity_data #>> '{custom_claims,address}')
          = btrim(identity_data #>> '{custom_claims,address}')
        and (identity_data #>> '{custom_claims,address}')
          ~ '^0x[0-9A-Fa-f]{40}$'
      ), false) as all_identities_valid,
      count(distinct lower(identity_data #>> '{custom_claims,address}'))
        as wallet_count
    from auth.identities
    where provider = 'web3'
    group by user_id
  )
  select count(*)
    into invalid_or_ambiguous_users
  from per_user
  where not all_identities_valid
    or wallet_count <> 1;

  with valid_per_user as (
    select
      user_id,
      min(lower(identity_data #>> '{custom_claims,address}')) as wallet_address
    from auth.identities
    where provider = 'web3'
    group by user_id
    having coalesce(bool_and(
      (identity_data #>> '{custom_claims,address}') is not null
      and (identity_data #>> '{custom_claims,address}')
        = btrim(identity_data #>> '{custom_claims,address}')
      and (identity_data #>> '{custom_claims,address}')
        ~ '^0x[0-9A-Fa-f]{40}$'
    ), false)
      and count(distinct lower(identity_data #>> '{custom_claims,address}')) = 1
  ), duplicate_addresses as (
    select wallet_address, count(*) as claimant_count
    from valid_per_user
    group by wallet_address
    having count(*) > 1
  )
  select coalesce(sum(claimant_count), 0)
    into duplicate_address_users
  from duplicate_addresses;

  for candidate in
    with valid_per_user as (
      select
        user_id,
        min(lower(identity_data #>> '{custom_claims,address}')) as wallet_address
      from auth.identities
      where provider = 'web3'
      group by user_id
      having coalesce(bool_and(
        (identity_data #>> '{custom_claims,address}') is not null
        and (identity_data #>> '{custom_claims,address}')
          = btrim(identity_data #>> '{custom_claims,address}')
        and (identity_data #>> '{custom_claims,address}')
          ~ '^0x[0-9A-Fa-f]{40}$'
      ), false)
        and count(distinct lower(identity_data #>> '{custom_claims,address}')) = 1
    )
    select user_id, wallet_address
    from valid_per_user as candidate_user
    where not exists (
      select 1
      from valid_per_user as other_user
      where other_user.wallet_address = candidate_user.wallet_address
        and other_user.user_id <> candidate_user.user_id
    )
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'wallet-identity:' || candidate.wallet_address,
        0
      )
    );

    select user_id
      into mapped_user_id
    from public.wallet_identities
    where wallet_address = candidate.wallet_address
    for update;

    if mapped_user_id is not null and mapped_user_id <> candidate.user_id then
      existing_mapping_conflicts := existing_mapping_conflicts + 1;
      continue;
    end if;

    begin
      insert into public.wallet_identities (user_id, wallet_address, verified_at)
      values (candidate.user_id, candidate.wallet_address, pg_catalog.now())
      on conflict (user_id) do update
        set wallet_address = excluded.wallet_address,
            verified_at = excluded.verified_at
        where public.wallet_identities.wallet_address
          is distinct from excluded.wallet_address;
    exception
      when unique_violation then
        -- A concurrent writer that does not use the advisory lock still cannot
        -- steal an address because the table's unique constraint remains final.
        concurrent_mapping_conflicts := concurrent_mapping_conflicts + 1;
    end;
  end loop;

  if invalid_or_ambiguous_users > 0 then
    raise warning
      'Wallet identity backfill skipped % user(s) with invalid or ambiguous Web3 identities',
      invalid_or_ambiguous_users;
  end if;

  if duplicate_address_users > 0 then
    raise warning
      'Wallet identity backfill skipped % user(s) whose verified address is claimed by multiple Auth users',
      duplicate_address_users;
  end if;

  if existing_mapping_conflicts > 0 then
    raise warning
      'Wallet identity backfill skipped % verified address(es) already mapped to another user',
      existing_mapping_conflicts;
  end if;

  if concurrent_mapping_conflicts > 0 then
    raise warning
      'Wallet identity backfill skipped % address conflict(s) created concurrently',
      concurrent_mapping_conflicts;
  end if;
end;
$backfill$;

-- Delete access is intentionally owner-only. Remove both the live policy and
-- the legacy operator policy before recreating the known policy name.
drop policy if exists "users can delete their own recipient profile"
  on public.recipient_profiles;
drop policy if exists "operators delete profiles"
  on public.recipient_profiles;

create policy "users can delete their own recipient profile"
  on public.recipient_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
