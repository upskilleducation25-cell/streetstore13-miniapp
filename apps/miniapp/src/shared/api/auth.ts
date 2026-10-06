import type { AuthResponse, AuthUser } from "@ss13/shared";

import type { TokenSource } from "./client";

/** Оновлюємо токен заздалегідь, щоб він не протух посеред запиту. */
const REFRESH_MARGIN_MS = 60_000;

export interface Session {
  token: string;
  expiresAt: number;
  user: AuthUser;
}

/**
 * Сесія покупця: JWT живе тільки в пам'яті (не в localStorage). Новий токен отримуємо
 * повторним входом з initData. Паралельні запити чекають на один спільний вхід.
 */
export function createAuth(options: {
  getInitData: () => Promise<string | null>;
  login: (initData: string) => Promise<AuthResponse>;
  now?: () => number;
}): TokenSource & {
  getSession(): Promise<Session | null>;
} {
  const now = options.now ?? Date.now;
  let session: Session | null = null;
  let pending: Promise<Session | null> | null = null;

  async function login(): Promise<Session | null> {
    const initData = await options.getInitData();
    if (!initData) return null;
    const response = await options.login(initData);
    return {
      token: response.token,
      expiresAt: now() + response.expiresIn * 1000,
      user: response.user,
    };
  }

  async function getSession(): Promise<Session | null> {
    if (session && session.expiresAt - now() > REFRESH_MARGIN_MS) return session;
    pending ??= login()
      .then((next) => (session = next))
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  return {
    getSession,
    async getToken() {
      return (await getSession())?.token ?? null;
    },
    invalidate() {
      session = null;
    },
  };
}
