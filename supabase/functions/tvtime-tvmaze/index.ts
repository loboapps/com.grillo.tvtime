import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TVMAZE_BASE = "https://api.tvmaze.com";
const TVMAZE_TIMEOUT_MS = 10000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "search" | "show" | "episodes";
  query?: string;
  id?: number;
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
  const [showRes, seasonsRes, imagesRes, akasRes] = await Promise.all([
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/seasons`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/images`),
    tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/akas`),
  ]);

  if (!showRes.ok) {
    return errorResponse(showRes.status === 404 ? 404 : 502, "tvmaze_show_failed");
  }

  const show = (await showRes.json()) as TvmazeShow;
  const seasons = seasonsRes.ok ? ((await seasonsRes.json()) as TvmazeSeason[]) : [];
  const images = imagesRes.ok ? ((await imagesRes.json()) as TvmazeImage[]) : [];
  const akas = akasRes.ok ? ((await akasRes.json()) as TvmazeAka[]) : [];

  const background = images.find((img) => img.type === "background" && img.main) ??
    images.find((img) => img.type === "background") ??
    null;

  const network = show.network?.name ?? show.webChannel?.name;

  // TVmaze returns show names in the original language/alphabet. The aka entry
  // with country: null is consistently the international/English title when
  // one exists (verified live against several non-English shows) — prefer it
  // for display, but always keep the original name too (original_name below).
  const internationalAka = akas.find((aka) => aka.country === null);
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

async function handleEpisodes(id: number): Promise<Response> {
  const res = await tvmazeFetch(`${TVMAZE_BASE}/shows/${id}/episodes`);
  if (!res.ok) {
    return errorResponse(res.status === 404 ? 404 : 502, "tvmaze_episodes_failed");
  }
  const raw = (await res.json()) as TvmazeEpisode[];
  const episodes = raw.map((ep) => ({
    season_number: ep.season,
    episode_number: ep.number,
    name: ep.name,
    air_date: ep.airdate || null,
    still_path: ep.image?.original ?? null,
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
    if (body.action === "show") {
      return await handleShow(body.id!);
    }
    if (body.action === "episodes") {
      return await handleEpisodes(body.id!);
    }

    return errorResponse(400, "unknown_action");
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return errorResponse(isTimeout ? 504 : 500, isTimeout ? "tvmaze_timeout" : "internal_error");
  }
});
