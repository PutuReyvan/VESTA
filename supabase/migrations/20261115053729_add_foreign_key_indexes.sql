-- These foreign keys are used for audit and attribution joins. The indexes
-- keep role/profile administration responsive as the demo dataset grows.
create index if not exists recipient_profiles_created_by_idx
  on public.recipient_profiles (created_by);

create index if not exists user_roles_assigned_by_idx
  on public.user_roles (assigned_by);
