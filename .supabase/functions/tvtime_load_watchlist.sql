create or replace function tvtime_load_watchlist()
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
with next_ep as (
  select distinct on (e.show_id)
    e.id as episode_id,
    e.show_id,
    e.season_id,
    s.season_number,
    s.episode_count,
    e.episode_number,
    e.name,
    e.air_date,
    (e.air_date is not null and e.air_date <= current_date) as is_aired
  from tvtime_episodes e
  join tvtime_seasons s on s.id = e.season_id
  where e.watched = false
  order by
    e.show_id,
    (e.air_date is null or e.air_date > current_date) asc,
    s.season_number asc,
    e.episode_number asc
),
pending_counts as (
  select show_id, count(*) as pending
  from tvtime_episodes
  where watched = false and air_date is not null and air_date <= current_date
  group by show_id
),
last_watched as (
  select show_id, max(watched_at) as last_watched_at
  from tvtime_episodes
  where watched = true
  group by show_id
),
rows as (
  select
    sh.id as show_id,
    sh.name,
    ne.is_aired,
    ne.air_date,
    lw.last_watched_at,
    (lw.last_watched_at is not null) as has_watched_before,
    (ne.air_date is not null and ne.air_date >= current_date - interval '15 days') as is_new,
    jsonb_build_object(
      'episode_id', ne.episode_id, 'show_id', sh.id, 'tmdb_id', sh.tmdb_id,
      'name', sh.name, 'poster_path', sh.poster_path,
      'season_number', ne.season_number, 'episode_number', ne.episode_number,
      'episode_name', ne.name,
      'remaining', coalesce(pc.pending, 0) - (case when ne.is_aired then 1 else 0 end),
      'is_first_ep', (ne.episode_number = 1),
      'is_new', (ne.air_date is not null and ne.air_date >= current_date - interval '15 days'),
      'is_last_ep', (ne.episode_number = ne.episode_count)
    ) as entry_json
  from tvtime_shows sh
  join next_ep ne on ne.show_id = sh.id
  left join pending_counts pc on pc.show_id = sh.id
  left join last_watched lw on lw.show_id = sh.id
  where sh.user_status != 'dropped'
)
-- Categorization is fully derived from watch behavior (15-day window), never from a stored
-- status: watching = watched recently OR a followed show's new episode arrived recently;
-- want_to_see = never watched; not_seen_in_a_while = watched before, nothing recently, no new
-- episode pending. These three conditions are mutually exclusive by construction (see below),
-- so a show can never appear in more than one bucket. Shows with everything watched have no
-- next_ep row and therefore appear in none of the three ("finished" is implicit, not listed).
select jsonb_build_object(
  'watch_next', coalesce((
    select jsonb_agg(
      r.entry_json
      order by greatest(
        coalesce(r.last_watched_at, '-infinity'::timestamptz),
        case when r.has_watched_before and r.is_aired and r.is_new
             then r.air_date::timestamptz else '-infinity'::timestamptz end
      ) desc
    )
    from rows r
    where (r.last_watched_at >= now() - interval '15 days')
       or (r.has_watched_before and r.is_aired and r.is_new)
  ), '[]'::jsonb),
  'not_seen_in_a_while', coalesce((
    select jsonb_agg(r.entry_json order by r.name asc)
    from rows r
    where r.has_watched_before
      and (r.last_watched_at is null or r.last_watched_at < now() - interval '15 days')
      and not (r.is_aired and r.is_new)
  ), '[]'::jsonb),
  'want_to_see', coalesce((
    select jsonb_agg(r.entry_json order by r.name asc)
    from rows r
    where not r.has_watched_before
  ), '[]'::jsonb)
);
$$;

grant execute on function tvtime_load_watchlist() to authenticated;
revoke execute on function tvtime_load_watchlist() from public, anon;
