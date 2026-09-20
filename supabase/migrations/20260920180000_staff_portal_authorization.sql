create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role in ('super_admin', 'operations_admin', 'finance_manager')
  );
$$;

create or replace function public.is_staff_portal_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff_portal_user() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_portal_user() to authenticated;
