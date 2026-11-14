create or replace function public.ensure_default_employee_role()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_roles where user_id = auth.uid()
  ) then
    insert into public.user_roles (user_id, role, assigned_by)
    values (auth.uid(), 'employee', auth.uid());
  end if;

  return true;
end;
$$;

revoke all on function public.ensure_default_employee_role() from public;
revoke execute on function public.ensure_default_employee_role() from anon;
grant execute on function public.ensure_default_employee_role() to authenticated;
