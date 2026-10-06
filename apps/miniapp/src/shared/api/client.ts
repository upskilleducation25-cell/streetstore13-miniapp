import { networkError, toApiError } from "./errors";

export type QueryValue = string | number | boolean | string[] | undefined | null;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  method?: "GET" | "POST";
  body?: unknown;
  /** Додати JWT покупця; при 401 токен оновлюється і запит повторюється один раз. */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface TokenSource {
  getToken(): Promise<string | null>;
  invalidate(): void;
}

/** Масиви — через кому (API приймає brand=a,b); порожні значення пропускаються. */
export function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function createApiClient(options: {
  baseUrl: string;
  fetch?: typeof fetch;
  tokens?: TokenSource;
}) {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send<T>(path: string, init: RequestOptions, token: string | null) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}${buildQuery(init.query)}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: init.signal,
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw networkError();
    }

    const text = await response.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = undefined;
      }
    }
    return { ok: response.ok, status: response.status, body: body as T };
  }

  return {
    async request<T>(path: string, init: RequestOptions = {}): Promise<T> {
      const tokens = init.auth ? options.tokens : undefined;
      let result = await send<T>(path, init, (await tokens?.getToken()) ?? null);
      if (result.status === 401 && tokens) {
        // Токен протух або відкликаний: увійти ще раз і повторити один раз.
        tokens.invalidate();
        result = await send<T>(path, init, await tokens.getToken());
      }
      if (!result.ok) throw toApiError(result.status, result.body);
      return result.body;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
