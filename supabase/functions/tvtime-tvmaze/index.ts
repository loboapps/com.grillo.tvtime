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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (body.action === "search") {
      return await handleSearch(body.query ?? "");
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
