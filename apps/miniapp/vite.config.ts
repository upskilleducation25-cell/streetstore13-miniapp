import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildSignedInitData } from "@ss13/shared/node";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { parse } from "dotenv";
import { defineConfig, type Plugin } from "vite";

const DEV_INIT_DATA_ENDPOINT = "/__ss13_dev/telegram-init-data";

/** Тестовий покупець для локальної розробки поза Telegram. */
const DEV_USER = {
  id: 100000001,
  first_name: "Тестовий",
  last_name: "Покупець",
  username: "ss13_dev_buyer",
};

/**
 * ТІЛЬКИ `vite dev` (apply: "serve"): підписує initData тестового користувача токеном бота
 * з локального apps/api/.env, щоб працював вхід поза Telegram. Токен лишається на сервері
 * розробки і не потрапляє ні в браузер, ні в production-збірку.
 */
function devTelegramInitData(): Plugin {
  return {
    name: "ss13-dev-telegram-init-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(DEV_INIT_DATA_ENDPOINT, (_req, res) => {
        const envPath = fileURLToPath(new URL("../api/.env", import.meta.url));
        const token =
          process.env.TELEGRAM_BOT_TOKEN ||
          (existsSync(envPath) ? parse(readFileSync(envPath)).TELEGRAM_BOT_TOKEN : undefined);
        res.setHeader("Content-Type", "application/json");
        if (!token) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({ code: "DEV_TOKEN_MISSING", message: "TELEGRAM_BOT_TOKEN не задано" }),
          );
          return;
        }
        res.end(JSON.stringify({ initData: buildSignedInitData(DEV_USER, token) }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devTelegramInitData()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
