import { proxyBackendRequest } from "@/lib/server/backend-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = proxyBackendRequest;
export const HEAD = proxyBackendRequest;
export const POST = proxyBackendRequest;
export const PUT = proxyBackendRequest;
export const PATCH = proxyBackendRequest;
export const DELETE = proxyBackendRequest;
export const OPTIONS = proxyBackendRequest;
