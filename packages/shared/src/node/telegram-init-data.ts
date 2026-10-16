// Тільки для Node (використовує node:crypto). Не імпортувати у фронтенд-код:
// підпис initData потребує токена бота, який ніколи не потрапляє в браузер.
import { createHmac } from "node:crypto";

/** secret_key = HMAC_SHA256(key = "WebAppData", message = bot_token). */
function secretKey(botToken: string): Buffer {
  return createHmac("sha256", "WebAppData").update(botToken).digest();
}

/** Рядок для підпису: усі поля, крім hash, відсортовані за ключем, через \n. */
export function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

/** hex(HMAC_SHA256(secret_key, data_check_string)) — офіційний алгоритм Mini Apps. */
export function signInitData(params: URLSearchParams, botToken: string): string {
  return createHmac("sha256", secretKey(botToken)).update(dataCheckString(params)).digest("hex");
}

export interface InitDataUserInput {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Збирає підписаний рядок initData. Потрібен тестам і dev-режиму Mini App поза Telegram;
 * у продакшені initData підписує сам Telegram.
 */
export function buildSignedInitData(
  user: InitDataUserInput,
  botToken: string,
  authDate: Date = new Date(),
): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(authDate.getTime() / 1000)),
    query_id: "dev-query",
    user: JSON.stringify(user),
  });
  params.set("hash", signInitData(params, botToken));
  return params.toString();
}
