// Browser requests always use this deployment's origin. Only the runtime route
// handler knows the internal backend binding URL.
const API_URL = "/api/v1";

export function apiUrl(path: string) {
  return `${API_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
