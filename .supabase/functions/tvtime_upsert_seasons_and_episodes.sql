create or replace function tvtime_upsert_seasons_and_episodes(
  p_show_id uuid,
  p_seasons jsonb,
  p_episodes jsonb
)
returns void
language plpgsql
security invoker
set search_path = 'public'
as $$
begin
  with upserted_seasons as (
    insert into tvtime_seasons (show_id, season_number, name, episode_count, air_date)
    select
      p_show_id,
      (s->>'season_number')::integer,
      s->>'name',
      (s->>'episode_count')::integer,
      nullif(s->>'air_date', '')::date
    from jsonb_array_elements(p_seasons) as s
    on conflict (show_id, season_number) do update set
      name = excluded.name,
      episode_count = excluded.episode_count,
      air_date = excluded.air_date
    returning id, season_number
  )
  insert into tvtime_episodes (show_id, season_id, episode_number, name, air_date)
  select
    p_show_id,
    us.id,
    (e->>'episode_number')::integer,
    e->>'name',
    nullif(e->>'air_date', '')::date
  from jsonb_array_elements(p_episodes) as e
  join upserted_seasons us on us.season_number = (e->>'season_number')::integer
  on conflict (season_id, episode_number) do update set
    name = excluded.name,
    air_date = excluded.air_date;
end;
$$;

revoke execute on function tvtime_upsert_seasons_and_episodes(uuid, jsonb, jsonb) from public;
