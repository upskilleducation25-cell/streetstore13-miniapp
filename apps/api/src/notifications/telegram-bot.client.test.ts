import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  redact,
  TelegramBotClient,
  TelegramSendError,
  truncateMessage,
} from "./telegram-bot.client.js";

const TOKEN = "123456:TEST-ONLY-token-not-real";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const sleeps: number[] = [];
  const bot = new TelegramBotClient({
    token: TOKEN,
    baseUrl: "https://bot.test/",
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      const next = responses.shift();
      if (!next) throw new Error("Немає відповіді");
      if (next instanceof Error) throw next;
      return next;
    },
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { bot, calls, sleeps };
}

async function failure(promise: Promise<unknown>): Promise<TelegramSendError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof TelegramSendError);
    return error;
  }
  throw new Error("Очікувалась помилка");
}

describe("TelegramBotClient", () => {
  test("sendMessage: chat_id рядком для bigint, кнопка web_app, без прев'ю посилань", async () => {
    const { bot, calls } = client([json(200, { ok: true, result: {} })]);
    await bot.sendMessage(990000000123n, "Привіт", {
      buttons: [{ text: "Відкрити", web_app: { url: "https://shop.test/orders/SS13-1" } }],
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `https://bot.test/bot${TOKEN}/sendMessage`);
    assert.equal(calls[0]!.body.chat_id, "990000000123");
    assert.deepEqual(calls[0]!.body.reply_markup, {
      inline_keyboard: [
        [{ text: "Відкрити", web_app: { url: "https://shop.test/orders/SS13-1" } }],
      ],
    });
    assert.deepEqual(calls[0]!.body.link_preview_options, { is_disabled: true });
    assert.equal(calls[0]!.body.parse_mode, undefined);
  });

  test("403 (бот заблоковано) — без повторів", async () => {
    const { bot, calls } = client([
      json(403, {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      }),
    ]);
    const error = await failure(bot.sendMessage(1, "x"));
    assert.equal(error.kind, "FORBIDDEN");
    assert.equal(calls.length, 1);
  });

  test("5xx і мережа — до 3 спроб з паузою, потім помилка", async () => {
    const { bot, calls, sleeps } = client([
      json(502, { ok: false, description: "Bad Gateway" }),
      new TypeError("fetch failed"),
      json(500, { ok: false, description: "Internal" }),
    ]);
    const error = await failure(bot.sendMessage(1, "x"));
    assert.equal(error.kind, "SERVER");
    assert.equal(calls.length, 3);
    assert.deepEqual(sleeps, [500, 1000]);
  });

  test("429 з retry_after — чекає і повторює", async () => {
    const { bot, calls, sleeps } = client([
      json(429, { ok: false, description: "Too Many Requests", parameters: { retry_after: 2 } }),
      json(200, { ok: true }),
    ]);
    await bot.sendMessage(1, "x");
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [2000]);
  });

  test("429 з довгим retry_after — не чекає хвилинами", async () => {
    const { bot, calls } = client([
      json(429, { ok: false, description: "Too Many Requests", parameters: { retry_after: 60 } }),
    ]);
    const error = await failure(bot.sendMessage(1, "x"));
    assert.equal(error.kind, "RATE_LIMITED");
    assert.equal(calls.length, 1);
  });

  test("токен бота не потрапляє в текст помилки", async () => {
    const { bot } = client([
      new TypeError(`connect ECONNREFUSED https://bot.test/bot${TOKEN}/sendMessage`),
      new TypeError(`connect ECONNREFUSED https://bot.test/bot${TOKEN}/sendMessage`),
      new TypeError(`connect ECONNREFUSED https://bot.test/bot${TOKEN}/sendMessage`),
    ]);
    const error = await failure(bot.sendMessage(1, "x"));
    assert.equal(error.kind, "NETWORK");
    assert.ok(!error.message.includes(TOKEN));
    assert.match(error.message, /\*\*\*/);
  });

  test("redact і обрізання довгого повідомлення", () => {
    assert.equal(redact(`a ${TOKEN} b ${TOKEN}`, TOKEN), "a *** b ***");
    assert.equal(truncateMessage("x".repeat(5000)).length, 4096);
    assert.equal(truncateMessage("коротко"), "коротко");
  });
});
