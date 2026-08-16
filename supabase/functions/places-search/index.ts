import { ApiError, json, readJson, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  await requireUser(request);
  const input = await readJson<{ query: string; language?: string }>(request);
  const query = String(input.query ?? "").trim();
  if (!query) return json(request, { places: [] });
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", input.language === "en" ? "en" : "zh");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new ApiError(502, "PLACE_SERVICE_UNAVAILABLE", "地点搜索暂时不可用。");
  const payload = (await response.json()) as {
    results?: Array<{
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      country_code?: string;
      admin1?: string;
      admin2?: string;
    }>;
  };
  const places = (payload.results ?? []).map((place) => ({
    id: `open-meteo-${place.id}`,
    name: place.name,
    detail: [place.admin2, place.admin1, place.country].filter(Boolean).join(" · "),
    nameEn: input.language === "en" ? place.name : "",
    country: place.country ?? place.country_code ?? "",
    lat: place.latitude,
    lon: place.longitude,
    source: "open-meteo",
  }));
  return json(request, { places });
});
