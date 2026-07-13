import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TVMAZE_BASE = "https://api.tvmaze.com";

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

async function handleSearch(query: string): Promise<Response> {
  const res = await fetch(`${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(query)}`);
  const hits = (await res.json()) as TvmazeSearchHit[];
  const results = hits.map((hit) => ({
    id: hit.show.id,
    name: hit.show.name,
    poster_path: hit.show.image?.original ?? null,
    weight: hit.show.weight,
  }));
  return new Response(JSON.stringify({ results }), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface TvmazeShow {
  id: number;
  name: string;
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

async function handleShow(id: number): Promise<Response> {
  const [showRes, seasonsRes, imagesRes] = await Promise.all([
    fetch(`${TVMAZE_BASE}/shows/${id}`),
    fetch(`${TVMAZE_BASE}/shows/${id}/seasons`),
    fetch(`${TVMAZE_BASE}/shows/${id}/images`),
  ]);

  if (!showRes.ok) {
    return new Response(JSON.stringify({ error: "show not found" }), {
      status: showRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const show = (await showRes.json()) as TvmazeShow;
  const seasons = seasonsRes.ok ? ((await seasonsRes.json()) as TvmazeSeason[]) : [];
  const images = imagesRes.ok ? ((await imagesRes.json()) as TvmazeImage[]) : [];

  const background = images.find((img) => img.type === "background" && img.main) ??
    images.find((img) => img.type === "background") ??
    null;

  const network = show.network?.name ?? show.webChannel?.name;

  const body = {
    id: show.id,
    name: show.name,
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

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
