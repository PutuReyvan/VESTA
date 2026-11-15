BEGIN;
SELECT plan(11);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_roles'),
  'user_roles has RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'recipient_profiles'),
  'recipient_profiles has RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'wallet_identities'),
  'wallet_identities has RLS enabled'
);

SELECT ok(not has_table_privilege('anon', 'public.user_roles', 'select'),
  'anon cannot read roles');
SELECT ok(not has_table_privilege('anon', 'public.recipient_profiles', 'select'),
  'anon cannot read profiles');
SELECT ok(not has_table_privilege('authenticated', 'public.user_roles', 'insert'),
  'authenticated cannot directly insert roles');
SELECT ok(not has_table_privilege('authenticated', 'public.user_roles', 'delete'),
  'authenticated cannot directly delete roles');
SELECT ok(has_table_privilege('authenticated', 'public.recipient_profiles', 'select'),
  'authenticated can read profiles through RLS');
SELECT ok(has_table_privilege('authenticated', 'public.recipient_profiles', 'insert'),
  'authenticated can create own profiles through RLS');
SELECT ok(
  not exists (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname in (
        'assign_role_by_wallet', 'current_wallet_address',
        'ensure_default_employee_role', 'ensure_wallet_identity',
        'has_role', 'list_roles_with_wallets', 'remove_role_by_wallet'
      )
      AND has_function_privilege('anon', p.oid, 'execute')
  ),
  'anon cannot execute privileged RPCs'
);
SELECT ok(
  has_function_privilege('anon', 'public.keepalive_ping()', 'execute'),
  'anon can execute only the no-data keepalive RPC'
);

SELECT * FROM finish();
ROLLBACK;
