create or replace function public.keepalive_ping()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select true;
$function$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon;
