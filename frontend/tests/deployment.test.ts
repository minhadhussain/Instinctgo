import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiUrl } from "../src/lib/api";
import { backendRequestUrl, proxyBackendRequest } from "../src/lib/server/backend-proxy";

const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(["BACKEND_URL", "LOCAL_BACKEND_URL", "VERCEL"].map((key) => [key, process.env[key]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("browser URLs remain same-origin while runtime bindings preserve the API path", () => {
  assert.equal(apiUrl("noting/capabilities"), "/api/v1/noting/capabilities");
  process.env.BACKEND_URL = "https://internal.example/binding/base";
  assert.equal(backendRequestUrl("https://preview.example/api/v1/workflows?limit=5").href,
    "https://internal.example/binding/base/api/v1/workflows?limit=5");
  process.env.BACKEND_URL = "https://second.example/";
  assert.equal(backendRequestUrl("https://preview.example/api/v1/health").host, "second.example");
  assert.throws(() => backendRequestUrl("https://preview.example/other"));
});

test("a deployment without its binding cannot accidentally call localhost", async () => {
  delete process.env.BACKEND_URL;
  process.env.VERCEL = "1";
  process.env.LOCAL_BACKEND_URL = "http://127.0.0.1:8000";
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return Response.json({}); };
  const result = await proxyBackendRequest(new Request("https://site.example/api/v1/health"));
  assert.equal(result.status, 503);
  assert.equal(fetched, false);
  delete process.env.VERCEL;
  assert.equal(backendRequestUrl("http://localhost:3000/api/v1/health").href,
    "http://127.0.0.1:8000/api/v1/health");
});

test("the API gateway preserves JSON bodies, authorization, query and error status", async () => {
  process.env.BACKEND_URL = "https://internal.example/";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://internal.example/api/v1/noting/draft?mode=review");
    assert.equal(init?.method, "POST");
    assert.equal(new TextDecoder().decode(init?.body as ArrayBuffer), '{"proposal_text":"new request"}');
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
    assert.equal(new Headers(init?.headers).has("host"), false);
    assert.equal(init?.cache, "no-store");
    return Response.json({ detail: "Invalid proposal" }, { status: 422 });
  };
  const result = await proxyBackendRequest(new Request("https://site.example/api/v1/noting/draft?mode=review", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-token", Host: "site.example" },
    body: '{"proposal_text":"new request"}',
  }));
  assert.equal(result.status, 422);
  assert.deepEqual(await result.json(), { detail: "Invalid proposal" });
  assert.equal(result.headers.get("cache-control"), "no-store");
});

test("redirects stay on the public origin and upstream failures return a usable error", async () => {
  process.env.BACKEND_URL = "https://internal.example/binding/";
  globalThis.fetch = async () => new Response(null, {
    status: 307, headers: { Location: "https://internal.example/binding/api/v1/workflows/?limit=5" },
  });
  const request = new Request("https://site.example/api/v1/workflows?limit=5");
  const redirect = await proxyBackendRequest(request);
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), "/api/v1/workflows/?limit=5");
  globalThis.fetch = async () => { throw new Error("internal.example connection failed"); };
  const failure = await proxyBackendRequest(request);
  assert.equal(failure.status, 502);
  assert.equal((await failure.text()).includes("internal.example"), false);
});
