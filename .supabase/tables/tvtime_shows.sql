create table tvtime_shows (
  id                 uuid primary key default gen_random_uuid(),
  tmdb_id            integer not null unique,
  name               text not null,
  poster_path        text,
  backdrop_path      text,
  tmdb_status        text,
  number_of_seasons  integer,
  number_of_episodes integer,
  user_status        text not null check (user_status in ('watching', 'finished', 'want_to_see', 'dropped')),
  added_at           timestamptz not null default now(),
  synced_at          timestamptz not null default now()
);

alter table tvtime_shows enable row level security;

create policy tvtime_shows_all on tvtime_shows
  for all to authenticated
  using (true)
  with check (true);
