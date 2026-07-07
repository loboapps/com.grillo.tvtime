create or replace function tvtime_load_user()
returns uuid
language sql
stable
set search_path = 'public'
as $$
  select '663d48fa-fe0a-4345-9625-d899d429bfb1'::uuid;
$$;

grant execute on function tvtime_load_user() to authenticated;
