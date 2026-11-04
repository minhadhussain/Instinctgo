// Called only by the Node.js route handler, never by client code or middleware.
const API_PREFIX = "/api/v1";

export function backendRequestUrl(requestUrl: string): URL {
  // Read at request time: service bindings do not exist during next build.
  const base = process.env.BACKEND_URL || (!process.env.VERCEL
    ? process.env.LOCAL_BACKEND_URL || "http://127.0.0.1:8000"
    : undefined);
  if (!base) throw new Error("The backend service binding is unavailable.");
  const incoming = new URL(requestUrl);
  if (incoming.pathname !== API_PREFIX && !incoming.pathname.startsWith(`${API_PREFIX}/`)) {
    throw new Error("Unsupported API path.");
  }
  // Preserve a binding's base path, the FastAPI /api/v1 prefix and query string.
  const target = new URL(incoming.pathname.slice(1), base.endsWith("/") ? base : `${base}/`);
  target.search = incoming.search;
  return target;
}

export async function proxyBackendRequest(request: Request): Promise<Response> {
  let target: URL;
  try { target = backendRequestUrl(request.url); }
  catch { return Response.json({ detail: "Backend service is not configured." }, { status: 503 }); }

  const headers = new Headers();
  for (const name of ["accept", "content-type", "authorization"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110000)]),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "allow", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const location = response.headers.get("location");
    if (location) {
      const redirected = new URL(location, target);
      const basePath = target.pathname.slice(0, target.pathname.indexOf(API_PREFIX));
      if (redirected.origin === target.origin && redirected.pathname.startsWith(`${basePath}${API_PREFIX}`)) {
        responseHeaders.set("Location", `${redirected.pathname.slice(basePath.length)}${redirected.search}`);
      } else {
        return Response.json({ detail: "Unexpected backend redirect." }, { status: 502 });
      }
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ detail: "Backend service is unavailable. Please try again." }, { status: 502 });
  }
}
