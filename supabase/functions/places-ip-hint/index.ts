import { ApiError, json, serve } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method !== "GET" && request.method !== "POST")
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "不支持这个请求方式。");
  await requireUser(request);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || realIp;
  if (!ip) return json(request, { place: null });
  let payload: {
    success?: boolean;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return json(request, { place: null });
    payload = await response.json();
  } catch {
    return json(request, { place: null });
  }
  if (payload.success === false || !payload.city) return json(request, { place: null });
  return json(request, {
    place: {
      id: `ip-${payload.city}`,
      name: payload.city,
      detail: [payload.region, payload.country].filter(Boolean).join(" · "),
      nameEn: payload.city,
      country: payload.country ?? "",
      lat: Number.isFinite(payload.latitude) ? payload.latitude : null,
      lon: Number.isFinite(payload.longitude) ? payload.longitude : null,
      source: "ipwhois",
    },
  });
});
