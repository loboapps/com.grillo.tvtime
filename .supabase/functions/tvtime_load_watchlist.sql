drop function if exists tvtime_load_watchlist();

create or replace function tvtime_load_watchlist(p_show_id uuid default null)
returns jsonb
language sql
security invoker
stable
set search_path = 'public'
as $$
with next_ep as (
  -- Only episodes that have actually aired are eligible to be a show's "next episode":
  -- a show whose sole remaining episode airs in the future stays off the watchlist
  -- entirely (all three sections) until that air date arrives.
  select distinct on (e.show_id)
    e.id as episode_id,
    e.show_id,
    e.season_id,
    s.season_number,
    s.episode_count,
    e.episode_number,
    e.name,
    e.air_date
  from tvtime_episodes e
  join tvtime_seasons s on s.id = e.season_id
  where e.watched = false
    and s.season_number != 0
    and e.air_date is not null and e.air_date <= current_date
    and (p_show_id is null or e.show_id = p_show_id)
  order by
    e.show_id,
    s.season_number asc,
    e.episode_number asc
),
pending_counts as (
  select e.show_id, count(*) as pending
  from tvtime_episodes e
  join tvtime_seasons s on s.id = e.season_id
  where e.watched = false and e.air_date is not null and e.air_date <= current_date
    and s.season_number != 0
    and (p_show_id is null or e.show_id = p_show_id)
  group by e.show_id
),
last_watched as (
  select show_id, max(watched_at) as last_watched_at
  from tvtime_episodes
  where watched = true
    and (p_show_id is null or show_id = p_show_id)
  group by show_id
),
rows as (
  select
    sh.id as show_id,
    sh.name,
    ne.air_date,
    lw.last_watched_at,
    (lw.last_watched_at is not null) as has_watched_before,
    (ne.air_date is not null and ne.air_date >= current_date - interval '15 days') as is_new,
    jsonb_build_object(
      'episode_id', ne.episode_id, 'show_id', sh.id, 'tmdb_id', sh.tmdb_id,
      'name', sh.name, 'poster_path', sh.poster_path,
      'season_number', ne.season_number, 'episode_number', ne.episode_number,
      'episode_name', ne.name,
      'remaining', coalesce(pc.pending, 0) - 1,
      'is_first_ep', (ne.episode_number = 1),
      'is_new', (ne.air_date is not null and ne.air_date >= current_date - interval '15 days'),
      'is_last_ep', (ne.episode_number = ne.episode_count)
    ) as entry_json
  from tvtime_shows sh
  join next_ep ne on ne.show_id = sh.id
  left join pending_counts pc on pc.show_id = sh.id
  left join last_watched lw on lw.show_id = sh.id
  where sh.user_status != 'dropped'
    and (p_show_id is null or sh.id = p_show_id)
)
-- Specials (season 0) are excluded from next_ep/pending_counts: they're stored like any other
-- episode, but season 0 sorts before every real season, so an unwatched special would otherwise
-- always win as "next episode to watch" ahead of the actual next real episode.
-- Categorization is fully derived from watch behavior (15-day window), never from user_status
-- beyond excluding dropped shows: watching = watched recently OR a followed show's new episode
-- arrived recently; want_to_see = never watched; not_seen_in_a_while = watched before, nothing
-- recently, no new episode pending. Mutually exclusive by construction (see below). Shows with
-- everything watched (or whose only remaining episode hasn't aired yet) have no next_ep row and
-- appear in none of the three, regardless of whether
-- user_status has already flipped to 'finished' — filtering on user_status = 'watching' instead
-- of != 'dropped' would wrongly hide a finished show the moment a new season gets synced in
-- (tvtime_sync_show doesn't re-flip the status; only tvtime_watch_episode does).
-- p_show_id scopes every CTE to one show (used to refresh a single row after a write without
-- recomputing the whole list); left null, it behaves exactly as before.
select jsonb_build_object(
  'watch_next', coalesce((
    select jsonb_agg(
      r.entry_json
      order by greatest(
        coalesce(r.last_watched_at, '-infinity'::timestamptz),
        case when r.has_watched_before and r.is_new
             then r.air_date::timestamptz else '-infinity'::timestamptz end
      ) desc
    )
    from rows r
    where (r.last_watched_at >= now() - interval '15 days')
       or (r.has_watched_before and r.is_new)
  ), '[]'::jsonb),
  'not_seen_in_a_while', coalesce((
    select jsonb_agg(r.entry_json order by r.name asc)
    from rows r
    where r.has_watched_before
      and (r.last_watched_at is null or r.last_watched_at < now() - interval '15 days')
      and not r.is_new
  ), '[]'::jsonb),
  'want_to_see', coalesce((
    select jsonb_agg(r.entry_json order by r.name asc)
    from rows r
    where not r.has_watched_before
  ), '[]'::jsonb)
);
$$;

grant execute on function tvtime_load_watchlist(uuid) to authenticated;
revoke execute on function tvtime_load_watchlist(uuid) from public, anon;
