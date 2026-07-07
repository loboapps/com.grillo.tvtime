create table tvtime_episodes (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references tvtime_shows(id) on delete cascade,
  season_id      uuid not null references tvtime_seasons(id) on delete cascade,
  episode_number integer not null,
  name           text,
  air_date       date,
  watched        boolean not null default false,
  watched_at     timestamptz,
  unique (season_id, episode_number)
);

alter table tvtime_episodes enable row level security;

create policy tvtime_episodes_all on tvtime_episodes
  for all to authenticated
  using (true)
  with check (true);
