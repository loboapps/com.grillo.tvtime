import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TVMAZE_BASE = "https://api.tvmaze.com";
const TVMAZE_TIMEOUT_MS = 10000;

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_TIMEOUT_MS = 10000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "search" | "show" | "episodes";
  query?: string;
  id?: number;
  language?: string;
  imdb_id?: string;
}

interface TvmazeSearchHit {
  score: number;
  show: {
    id: number;
    name: string;
    weight: number;
    image: { medium: string; original: string } | null;
  };
}

interface TvmazeShow {
  id: number;
  name: string;
  language: string;
  status: string;
  image: { medium: string; original: string } | null;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  externals: { imdb: string | null };
}

interface TvmazeSeason {
  number: number;
  name: string | null;
  episodeOrder: number | null;
  premiereDate: string | null;
}

interface TvmazeImage {
  type: string;
  main: boolean;
  resolutions: { original: { url: string } };
}

interface TvmazeAka {
  name: string;
  country: { code: string } | null;
}

interface TvmazeEpisode {
  season: number;
  number: number;
  name: string;
  airdate: string;
  image: { medium: string; original: string } | null;
  summary: string | null;
}

interface TmdbFindResult {
  tv_results: { id: number }[];
}

interface TmdbSeasonSummary {
  season_number: number;
}

interface TmdbShow {
  seasons: TmdbSeasonSummary[];
}

interface TmdbEpisode {
  name: string;
  air_date: string | null;
}

interface TmdbSeasonDetail {
  episodes: TmdbEpisode[];
}

// Every TVmaze call goes through this — a hung upstream request must not hang
// this function's own invocation indefinitely.
async function tvmazeFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TVMAZE_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Same timeout-guard pattern as tvmazeFetch — a hung TMDB call must not hang
// this function's own invocation indefinitely.
async function tmdbFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Only called when the show's TVmaze language isn't English. Matches TVmaze
// episodes to TMDB episodes by exact air date — never by season/episode
// position, since the two providers can number the same show differently
// (see the Task 24 numbering-reconciliation work in the parent migration).
// Mutates `episodes` in place, only overwriting names it found a match for.
// Any failure anywhere in this path (id not found, TMDB down, timeout,
// malformed response) leaves the original TVmaze names untouched — this
// never throws and never blocks the caller.
async function resolveEpisodeNamesViaTmdb(
  imdbId: string,
  episodes: TvmazeEpisode[],
): Promise<void> {
  try {
    const findRes = await tmdbFetch(
      `${TMDB_BASE}/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`,
    );
    if (!findRes.ok) return;
    const found = (await findRes.json()) as TmdbFindResult;
    const tmdbId = found.tv_results[0]?.id;
    if (!tmdbId) return;

    const showRes = await tmdbFetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!showRes.ok) return;
    const show = (await showRes.json()) as TmdbShow;

    const seasonResults = await Promise.all(
      show.seasons.map((s) =>
        tmdbFetch(`${TMDB_BASE}/tv/${tmdbId}/season/${s.season_number}?api_key=${TMDB_API_KEY}`),
      ),
    );
    const tmdbEpisodes: TmdbEpisode[] = [];
    for (const res of seasonResults) {
      if (!res.ok) continue;
      const season = (await res.json()) as TmdbSeasonDetail;
      tmdbEpisodes.push(...(season.episodes ?? []));
    }

    // The same air date can hold more than one episode (binge-release day) —
    // pull matches in list order, one TMDB name per TVmaze episode per date.
    const byAirDate = new Map<string, string[]>();
    for (const ep of tmdbEpisodes) {
      if (!ep.air_date) continue;
      if (!byAirDate.has(ep.air_date)) byAirDate.set(ep.air_date, []);
      byAirDate.get(ep.air_date)!.push(ep.name);
    }

    for (const ep of episodes) {
      const names = byAirDate.get(ep.airdate);
      const nextName = names?.shift();
      if (nextName) ep.name = nextName;
    }
  } catch {
    // Network error, timeout, malformed response — leave TVmaze names as-is.
  }
}

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSearch(query: string): Promise<Response> {
  const res = await tvmazeFetch(`${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    return errorResponse(502, "tvmaze_search_failed");
  }
  const hits = (await res.json()) as TvmazeSearchHit[];
  const results = hits.map((hit) => ({
    id: hit.show.id,
    name: hit.show.name,
    poster_path: hit.show.image?.original ?? null,
    weight: hit.show.weight,
  }));
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleShow(id: number): Promise<Response> {
  // seasons/images/akas are enrichment, not essential — Promise.allSettled so a
  // timeout on any one of them degrades to [] instead of sinking the whole
  // request the way Promise.all would (an AbortError on any entry used to reject
  // the entire group, even when the essential show fetch had already succeeded).
  const [showResult, seasonsResult, imagesResult, akasResult] = await Promise.allSettled([
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/seasons`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/images`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/akas`),
  ]);

  if (showResult.status === "rejected" || !showResult.value.ok) {
    const status = showResult.status === "fulfilled" && showResult.value.status === 404 ? 404 : 502;
    return errorResponse(status, "tvmaze_show_failed");
  }

  const show = (await showResult.value.json()) as TvmazeShow;
  const seasons =
    seasonsResult.status === "fulfilled" && seasonsResult.value.ok
      ? ((await seasonsResult.value.json()) as TvmazeSeason[])
      : [];
  const images =
    imagesResult.status === "fulfilled" && imagesResult.value.ok
      ? ((await imagesResult.value.json()) as TvmazeImage[])
      : [];
  const akas =
    akasResult.status === "fulfilled" && akasResult.value.ok
      ? ((await akasResult.value.json()) as TvmazeAka[])
      : [];

  const background = images.find((img) => img.type === "background" && img.main) ??
    images.find((img) => img.type === "background") ??
    null;

  const network = show.network?.name ?? show.webChannel?.name;

  // TVmaze returns show names in the original language/alphabet. For a
  // non-English show, the aka entry with country: null is consistently the
  // international/English title when one exists (verified live against
  // several non-English shows) — prefer it for display. For an
  // already-English show, skip aka lookup entirely: show.name is already
  // what's wanted, and country: null akas aren't reliably "the umbrella
  // title" — for an anthology show tracked as one entry across multiple
  // seasons (e.g. tvmaze_id 8161, "The Terror"), TVmaze's own country: null
  // aka can be a specific season's subtitle ("The Terror: Infamy") rather
  // than the series name, which would be actively misleading here.
  const internationalAka = show.language !== "English" ? akas.find((aka) => aka.country === null) : undefined;
  const resolvedName = internationalAka?.name ?? show.name;

  const body = {
    id: show.id,
    name: resolvedName,
    original_name: show.name,
    language: show.language,
    poster_path: show.image?.original ?? null,
    backdrop_path: background?.resolutions.original.url ?? null,
    status: show.status,
    imdb_id: show.externals.imdb,
    number_of_seasons: seasons.length,
    number_of_episodes: seasons.reduce((sum, s) => sum + (s.episodeOrder ?? 0), 0),
    seasons: seasons.map((s) => ({
      season_number: s.number,
      name: s.name,
      episode_count: s.episodeOrder ?? 0,
      air_date: s.premiereDate,
    })),
    networks: network ? [{ name: network }] : [],
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleEpisodes(id: number, language?: string, imdbId?: string): Promise<Response> {
  const res = await tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/episodes`);
  if (!res.ok) {
    return errorResponse(res.status === 404 ? 404 : 502, "tvmaze_episodes_failed");
  }
  const raw = (await res.json()) as TvmazeEpisode[];

  if (language && language !== "English" && imdbId) {
    await resolveEpisodeNamesViaTmdb(imdbId, raw);
  }

  const episodes = raw.map((ep) => ({
    season_number: ep.season,
    episode_number: ep.number,
    name: ep.name,
    air_date: ep.airdate || null,
    still_path: ep.image?.original ?? null,
    summary: ep.summary ?? null,
  }));
  return new Response(JSON.stringify({ episodes }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (body.action === "search") {
      return await handleSearch(body.query ?? "");
    }
    if (body.action === "show" || body.action === "episodes") {
      if (typeof body.id !== "number") {
        return errorResponse(400, "missing_id");
      }
      return body.action === "show"
        ? await handleShow(body.id)
        : await handleEpisodes(body.id, body.language, body.imdb_id);
    }

    return errorResponse(400, "unknown_action");
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return errorResponse(isTimeout ? 504 : 500, isTimeout ? "tvmaze_timeout" : "internal_error");
  }
});
