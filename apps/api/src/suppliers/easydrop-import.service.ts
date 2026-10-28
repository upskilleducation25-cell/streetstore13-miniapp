import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { parseEasyDropFeed } from "./easydrop-feed.parser.js";

const MAX_FEED_BYTES = 5 * 1024 * 1024;
const FEED_HOSTS = new Set(["easydrop.one", "www.easydrop.one"]);

@Injectable()
export class EasyDropImportService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async preview() {
    const configuredUrl = this.env.EASYDROP_FEED_URL;
    if (!configuredUrl) {
      throw new ServiceUnavailableException({
        code: "EASYDROP_FEED_NOT_CONFIGURED",
        message: "EASYDROP_FEED_URL не налаштовано на сервері API.",
      });
    }

    let url: URL;
    try {
      url = new URL(configuredUrl);
    } catch {
      throw new ServiceUnavailableException("EASYDROP_FEED_URL має бути коректною URL-адресою.");
    }
    if (
      url.protocol !== "https:" ||
      !FEED_HOSTS.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new ServiceUnavailableException(
        "Для EasyDrop дозволено лише HTTPS-адресу на домені easydrop.one.",
      );
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { accept: "application/xml, text/xml;q=0.9" },
      });
      if (!response.ok) {
        throw new Error(`Постачальник відповів HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        contentType &&
        !contentType.includes("xml") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("octet-stream")
      ) {
        throw new Error("Постачальник повернув не XML-вміст");
      }
      const contentLength = response.headers.get("content-length");
      if (contentLength && Number(contentLength) > MAX_FEED_BYTES) {
        throw new Error("Фід перевищує ліміт 5 МБ");
      }
      if (!response.body) throw new Error("Порожня відповідь постачальника");

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_FEED_BYTES) {
            await reader.cancel();
            throw new Error("Фід перевищує ліміт 5 МБ");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      const xmlBytes = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        xmlBytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
      const parsed = parseEasyDropFeed(xml);
      return {
        status: "PREVIEW",
        totalItems: parsed.totalItems,
        shoeVariants: parsed.shoeVariants.length,
        skippedNonShoes: parsed.skippedNonShoes,
        distinctModels: parsed.distinctModels,
        sample: parsed.shoeVariants.slice(0, 20).map((variant) => ({
          externalId: variant.externalId,
          groupId: variant.groupId,
          vendorCode: variant.vendorCode,
          name: variant.name,
          size: variant.size,
          priceUah: variant.priceUah,
          available: variant.available,
          quantity: variant.quantity,
        })),
        applied: false,
        message: "Попередній перегляд: база даних і залишки не змінювалися.",
      };
    } catch (error) {
      // Never return the URL or the original fetch error; the feed URL may contain a secret key.
      const message =
        error instanceof Error && error.message.startsWith("Некоректний XML EasyDrop:")
          ? error.message
          : "Не вдалося безпечно завантажити та перевірити фід EasyDrop.";
      throw new BadGatewayException({
        code: "EASYDROP_FEED_INVALID",
        message,
      });
    }
  }
}
