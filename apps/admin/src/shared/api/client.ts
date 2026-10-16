import type { ApiErrorBody } from "@ss13/shared";
import { ADMIN_CSRF_HEADER } from "@ss13/shared";

/** Помилка API з машинним кодом і помилками полів (details) для форм. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type QueryValue = string | number | boolean | undefined | null;
export type QueryValueRecord = Record<string, QueryValue>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** CSRF-токен поточної сесії (з /admin/auth/me або login). */
  getCsrfToken: () => string | null;
  /** Сесія закінчилась (401): показати вхід. */
  onUnauthorized?: () => void;
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const method = init.method ?? "GET";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const csrf = options.getCsrfToken();
    if (UNSAFE.has(method) && csrf) headers[ADMIN_CSRF_HEADER] = csrf;

    let response: Response;
    try {
      response = await doFetch(`${options.baseUrl}${path}${buildQuery(init.query)}`, {
        method,
        headers,
        // Сесія — httpOnly cookie: браузер додає її сам, JS її не бачить.
        credentials: "include",
        body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
        signal: init.signal,
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new ApiError(0, "NETWORK_ERROR", "Немає зв'язку з сервером. Перевірте інтернет.");
    }

    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      const error = body as Partial<ApiErrorBody> | undefined;
      if (response.status === 401 && !path.startsWith("/admin/auth/login"))
        options.onUnauthorized?.();
      throw new ApiError(
        response.status,
        error?.code ?? "HTTP_ERROR",
        error?.message ??
          (response.status >= 500 ? "Помилка сервера. Спробуйте пізніше." : "Помилка запиту"),
        error?.details,
      );
    }
    return body as T;
  };
}

/** details помилки валідації → { поле: перше повідомлення }. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const result: Record<string, string> = {};
  for (const item of error.details as Array<{ field?: unknown; errors?: unknown }>) {
    if (
      typeof item?.field === "string" &&
      Array.isArray(item.errors) &&
      typeof item.errors[0] === "string"
    ) {
      result[item.field] ??= item.errors[0];
    }
  }
  return result;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Щось пішло не так. Оновіть сторінку.";
}
