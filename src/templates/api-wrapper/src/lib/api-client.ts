import process from "node:process";

/**
 * API Client — pre-configured HTTP wrapper for the upstream REST API.
 *
 * Features:
 *   - Base URL from .env
 *   - Auth header injected on every request
 *   - Configurable timeout (default: 10s)
 *   - HTTP error → MCP-friendly error mapping
 *   - Response validation via Zod schemas
 *
 * Usage:
 *   const data = await apiClient.get("/endpoint", { query: "value" });
 *   const validated = MySchema.parse(data);
 */

const baseUrl = process.env.API_BASE_URL ?? "";
const apiKey = process.env.API_KEY ?? "";
const authHeader = process.env.API_AUTH_HEADER ?? "__AUTH_HEADER__";
const authType = "__AUTH_TYPE__"; // "api-key" | "bearer" | "none"
const timeoutMs = parseInt(process.env.API_TIMEOUT_MS ?? "10000", 10);

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, params, headers = {} } = options;

  // Build URL with query params
  const url = new URL(endpoint, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  // Build headers with auth
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (authType === "bearer" && apiKey) {
    requestHeaders["Authorization"] = `Bearer ${apiKey}`;
  } else if (authType === "api-key" && apiKey) {
    requestHeaders[authHeader] = apiKey;
  }

  // Make request with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiClientError(
        `API returned ${res.status}: ${res.statusText}`,
        res.status,
        text,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiClientError(`Request timed out after ${timeoutMs}ms`, 408);
    }
    throw new ApiClientError(
      `Network error: ${err instanceof Error ? err.message : "Unknown"}`,
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: "PUT", body }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),
};

export { ApiClientError };
