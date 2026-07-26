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
  all_seasons as (
    select
      (s->>'season_number')::integer as season_number,
      s->>'name' as name,
      (s->>'episode_count')::integer as episode_count,
      nullif(s->>'air_date', '')::date as air_date
    from jsonb_array_elements(p_seasons) as s
    union all
    -- Specials are bucketed under season_number 0 by the sync source, but TVmaze's own
    -- /seasons list never reports a "season 0" — synthesize one so those episodes have
    -- a season row to attach to. Only when p_seasons doesn't already define one itself
    -- (some shows do have a real season 0 in TVmaze's own listing).
    select 0, null, 0, null
    where not exists (
      select 1 from jsonb_array_elements(p_seasons) as s2 where (s2->>'season_number')::integer = 0
    )
    and exists (select 1 from season_episode_counts where season_number = 0)
  ),
  upserted_seasons as (
    -- A season with no reported episode order and no real episodes in this payload is an
    -- unannounced/placeholder season (e.g. TVmaze listing a future season before it has any
    -- episodes) — skip it rather than storing a permanent 0/0 season that can never be watched.
    insert into tvtime_seasons (show_id, season_number, name, episode_count, air_date)
    select
      p_show_id,
      als.season_number,
      als.name,
      greatest(coalesce(als.episode_count, 0), coalesce(sec.actual_count, 0)),
      als.air_date
    from all_seasons als
    left join season_episode_counts sec on sec.season_number = als.season_number
    where greatest(coalesce(als.episode_count, 0), coalesce(sec.actual_count, 0)) > 0
    on conflict (show_id, season_number) do update set
      name = excluded.name,
      episode_count = excluded.episode_count,
      air_date = excluded.air_date
    returning id, season_number
  )
  insert into tvtime_episodes (show_id, season_id, episode_number, name, air_date, airstamp)
  select
    p_show_id,
    us.id,
    (e->>'episode_number')::integer,
    e->>'name',
    nullif(e->>'air_date', '')::date,
    nullif(e->>'airstamp', '')::timestamptz
  from jsonb_array_elements(p_episodes) as e
  join upserted_seasons us on us.season_number = (e->>'season_number')::integer
  on conflict (season_id, episode_number) do update set
    name = excluded.name,
    air_date = excluded.air_date,
    airstamp = excluded.airstamp;
end;
$$;

revoke execute on function tvtime_update_seasons(uuid, jsonb, jsonb) from public, anon, service_role;
grant execute on function tvtime_update_seasons(uuid, jsonb, jsonb) to authenticated;
