import { createApiClient } from "./client";

let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

/** Адреса API: у dev — проксі Vite (/api → :3000), у production — VITE_API_URL. */
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api/v1";

export const api = createApiClient({
  baseUrl: API_BASE,
  getCsrfToken: () => csrfToken,
  onUnauthorized: () => unauthorizedHandler?.(),
});

export { ApiError, errorMessage, fieldErrors } from "./client";
export type { QueryValueRecord } from "./client";
