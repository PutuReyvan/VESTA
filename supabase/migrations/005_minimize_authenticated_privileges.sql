-- Keep the browser role limited to operations used by the frontend.
-- Role assignment and role removal remain SECURITY DEFINER RPC operations.
revoke all on table public.user_roles from authenticated;
grant select on table public.user_roles to authenticated;

revoke all on table public.recipient_profiles from authenticated;
grant select, insert, update, delete on table public.recipient_profiles to authenticated;
