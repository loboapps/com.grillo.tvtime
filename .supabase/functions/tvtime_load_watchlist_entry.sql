-- Same categorization rules as tvtime_load_watchlist, scoped to one show. Used to
-- refresh a single row after a write (e.g. marking an episode watched) without
-- recomputing every show in the watchlist.
create or replace function tvtime_load_watchlist_entry(p_show_id uuid)
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
  where e.watched = false and e.show_id = p_show_id
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
    and show_id = p_show_id
  group by show_id
),
last_watched as (
  select show_id, max(watched_at) as last_watched_at
  from tvtime_episodes
  where watched = true and show_id = p_show_id
  group by show_id
),
row_data as (
  select
    ne.is_aired,
    ne.air_date,
    lw.last_watched_at,
    (lw.last_watched_at is not null) as has_watched_before,
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
  where sh.id = p_show_id and sh.user_status != 'dropped'
)
select
  case
    when r.is_aired is null then null
    when (r.last_watched_at >= now() - interval '15 days')
      or (r.has_watched_before and r.is_aired and r.air_date >= current_date - interval '15 days')
      then jsonb_build_object('bucket', 'watch_next', 'entry', r.entry_json)
    when r.has_watched_before
      and (r.last_watched_at is null or r.last_watched_at < now() - interval '15 days')
      and not (r.is_aired and r.air_date >= current_date - interval '15 days')
      then jsonb_build_object('bucket', 'not_seen_in_a_while', 'entry', r.entry_json)
    else jsonb_build_object('bucket', 'want_to_see', 'entry', r.entry_json)
  end
from (select 1) as one
left join row_data r on true;
$$;

grant execute on function tvtime_load_watchlist_entry(uuid) to authenticated;
revoke execute on function tvtime_load_watchlist_entry(uuid) from public, anon;
