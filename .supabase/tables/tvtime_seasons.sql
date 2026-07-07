create table tvtime_seasons (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references tvtime_shows(id) on delete cascade,
  season_number integer not null,
  name          text,
  episode_count integer,
  air_date      date,
  user_status   text check (user_status is null or user_status in ('watching', 'finished', 'want_to_see', 'dropped')),
  unique (show_id, season_number)
);

alter table tvtime_seasons enable row level security;

create policy tvtime_seasons_all on tvtime_seasons
  for all to authenticated
  using (true)
  with check (true);
