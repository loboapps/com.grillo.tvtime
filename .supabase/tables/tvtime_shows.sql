create table tvtime_shows (
  id                 uuid primary key default gen_random_uuid(),
  tvmaze_id          integer unique,
  imdb_id            text,
  name               text not null,
  original_name      text,
  poster_path        text,
  backdrop_path      text,
  tvmaze_status      text,
  number_of_seasons  integer,
  number_of_episodes integer,
  user_status        text not null check (user_status in ('watching', 'finished', 'dropped')),
  next_air_date      date,
  added_at           timestamptz not null default now(),
  synced_at          timestamptz not null default now()
);

alter table tvtime_shows enable row level security;

create policy tvtime_shows_all on tvtime_shows
  for all to authenticated
  using (true)
  with check (true);
