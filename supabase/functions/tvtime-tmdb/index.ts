import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "search" | "show" | "season";
  query?: string;
  id?: number;
  season?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    let tmdbUrl: string;

    if (body.action === "search") {
      tmdbUrl = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(body.query ?? "")}&api_key=${TMDB_API_KEY}`;
    } else if (body.action === "show") {
      tmdbUrl = `${TMDB_BASE}/tv/${body.id}?api_key=${TMDB_API_KEY}`;
    } else if (body.action === "season") {
      tmdbUrl = `${TMDB_BASE}/tv/${body.id}/season/${body.season}?api_key=${TMDB_API_KEY}`;
    } else {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tmdbRes = await fetch(tmdbUrl);
    const data = await tmdbRes.json();
    return new Response(JSON.stringify(data), {
      status: tmdbRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
