create or replace function tvtime_update_seasons(
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
  with season_episode_counts as (
    select (e->>'season_number')::integer as season_number, count(*) as actual_count
    from jsonb_array_elements(p_episodes) as e
    group by (e->>'season_number')::integer
  ),
  upserted_seasons as (
    -- A season with no reported episode order and no real episodes in this payload is an
    -- unannounced/placeholder season (e.g. TVmaze listing a future season before it has any
    -- episodes) — skip it rather than storing a permanent 0/0 season that can never be watched.
    insert into tvtime_seasons (show_id, season_number, name, episode_count, air_date)
    select
      p_show_id,
      (s->>'season_number')::integer,
      s->>'name',
      greatest(coalesce((s->>'episode_count')::integer, 0), coalesce(sec.actual_count, 0)),
      nullif(s->>'air_date', '')::date
    from jsonb_array_elements(p_seasons) as s
    left join season_episode_counts sec on sec.season_number = (s->>'season_number')::integer
    where greatest(coalesce((s->>'episode_count')::integer, 0), coalesce(sec.actual_count, 0)) > 0
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

revoke execute on function tvtime_update_seasons(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function tvtime_update_seasons(uuid, jsonb, jsonb) to authenticated;
