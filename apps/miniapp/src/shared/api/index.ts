// Єдиний екземпляр API-клієнта і сесії покупця для всього застосунку.
import type { AuthResponse } from "@ss13/shared";

import { API_BASE_URL } from "../config";
import { createAuth } from "./auth";
import { createApiClient } from "./client";

let initDataProvider: () => Promise<string | null> = async () => null;

/** Викликається один раз на старті: звідки брати initData (Telegram або dev-мок). */
export function setInitDataProvider(provider: () => Promise<string | null>): void {
  initDataProvider = provider;
}

const publicClient = createApiClient({ baseUrl: API_BASE_URL });

export const auth = createAuth({
  getInitData: () => initDataProvider(),
  login: (initData) =>
    publicClient.request<AuthResponse>("/auth/telegram", { method: "POST", body: { initData } }),
});

export const api = createApiClient({ baseUrl: API_BASE_URL, tokens: auth });

export { ApiError, errorKind } from "./errors";
