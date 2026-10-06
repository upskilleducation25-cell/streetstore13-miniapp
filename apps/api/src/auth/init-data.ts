import { timingSafeEqual } from "node:crypto";

import { signInitData } from "@ss13/shared/node";

export { dataCheckString, signInitData } from "@ss13/shared/node";

/** Користувач Telegram з перевіреного initData. */
export interface TelegramInitUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramInitUser;
  authDate: Date;
}

export type InitDataFailure =
  | "MISSING_HASH"
  | "INVALID_HASH"
  | "MISSING_AUTH_DATE"
  | "EXPIRED"
  | "FROM_FUTURE"
  | "MISSING_USER";

export class InitDataError extends Error {
  constructor(readonly reason: InitDataFailure) {
    super(`Некоректний initData: ${reason}`);
    this.name = "InitDataError";
  }
}

export interface ValidateOptions {
  /** Максимальний вік auth_date у секундах. */
  maxAgeSeconds: number;
  /** Поточний час (для тестів). */
  now?: Date;
  /** Допустимий розсинхрон годинника, коли auth_date трохи з майбутнього. */
  clockSkewSeconds?: number;
}

/**
 * Перевіряє сирий рядок Telegram.WebApp.initData за офіційним алгоритмом Mini Apps.
 * Кидає InitDataError; дані користувача повертаються тільки після успішної перевірки.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  options: ValidateOptions,
): ValidatedInitData {
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) throw new InitDataError("MISSING_HASH");

  const expected = Buffer.from(signInitData(params, botToken), "hex");
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError("INVALID_HASH");
  }

  const authDateRaw = params.get("auth_date");
  const authDateSeconds = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new InitDataError("MISSING_AUTH_DATE");
  }
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const age = nowSeconds - authDateSeconds;
  if (age < -(options.clockSkewSeconds ?? 60)) throw new InitDataError("FROM_FUTURE");
  if (age > options.maxAgeSeconds) throw new InitDataError("EXPIRED");

  const userRaw = params.get("user");
  let user: TelegramInitUser | undefined;
  try {
    user = userRaw ? (JSON.parse(userRaw) as TelegramInitUser) : undefined;
  } catch {
    user = undefined;
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new InitDataError("MISSING_USER");
  }

  return { user, authDate: new Date(authDateSeconds * 1000) };
}
