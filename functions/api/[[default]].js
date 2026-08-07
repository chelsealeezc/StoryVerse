const FORWARDED_HEADERS = ["accept", "accept-language", "content-type", "cookie", "user-agent", "x-request-id"];

export async function onRequest(context) {
  const origin = context.env.BACKEND_API_ORIGIN || context.env.CLOUDBASE_API_ORIGIN;
  if (!origin || !/^https:\/\//.test(origin)) return new Response("Backend API origin is not configured", { status: 503 });
  const incoming = new URL(context.request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, origin);
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("origin", incoming.origin);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", "https");
  const upstream = await fetch(target, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("cache-control", "private, no-store, max-age=0");
  responseHeaders.set("x-content-type-options", "nosniff");
  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete("access-control-allow-credentials");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
