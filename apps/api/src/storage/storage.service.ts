import { randomUUID } from "node:crypto";

import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import type { ImageUrls } from "@ss13/shared";

import { AppException } from "../common/app-exception.js";
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import type { ProcessedImage } from "./image-processing.js";
import { IMAGE_SIZES } from "./image-processing.js";
import type { StorageDriverImpl } from "./storage.js";
import { createStorageDriver, isOwnedBase } from "./storage.js";

export interface StoredImage {
  storageKey: string;
  urls: Required<ImageUrls>;
}

const keyFor = (base: string, size: string) => `${base}-${size}.webp`;

@Injectable()
export class StorageService {
  private readonly logger = new Logger("Storage");
  readonly driver: StorageDriverImpl | null;

  constructor(@Inject(ENV) env: Env) {
    this.driver = createStorageDriver(env);
  }

  /** Без налаштованого сховища завантаження чесно відмовляє (503), а не вдає успіх. */
  private require(): StorageDriverImpl {
    if (!this.driver) {
      throw new AppException(
        "STORAGE_NOT_CONFIGURED",
        "Сховище фото не налаштовано (STORAGE_DRIVER / R2_*). Зверніться до власника.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.driver;
  }

  assertAvailable(): void {
    this.require();
  }

  async saveImage(
    prefix: "products" | "categories",
    ownerId: string,
    image: ProcessedImage,
  ): Promise<StoredImage> {
    const driver = this.require();
    const base = `${prefix}/${ownerId}/${randomUUID()}`;
    const uploaded: string[] = [];
    try {
      for (const variant of image.variants) {
        const key = keyFor(base, variant.name);
        await driver.put(key, variant.body, "image/webp");
        uploaded.push(key);
      }
    } catch (error) {
      // Без ключів і тіла запиту в лозі: тільки тип помилки.
      this.logger.error(`Збій завантаження у сховище (${driver.name}): ${(error as Error).name}`);
      await driver.delete(uploaded).catch(() => undefined);
      throw new AppException(
        "STORAGE_ERROR",
        "Не вдалося зберегти фото у сховищі. Спробуйте ще раз.",
        HttpStatus.BAD_GATEWAY,
      );
    }
    const url = (size: string) => driver.publicUrl(keyFor(base, size));
    return {
      storageKey: base,
      urls: { thumb: url("thumb"), medium: url("medium"), large: url("large") },
    };
  }

  /** Видаляє файли після commit; збій сховища не ламає дію адміна, а пишеться в лог. */
  async deleteImages(storageKeys: string[]): Promise<void> {
    const driver = this.driver;
    const owned = storageKeys.filter(isOwnedBase);
    if (!driver || owned.length === 0) return;
    const keys = owned.flatMap((base) => IMAGE_SIZES.map((size) => keyFor(base, size.name)));
    try {
      await driver.delete(keys);
    } catch (error) {
      this.logger.warn(
        `Не вдалося видалити ${keys.length} файл(и) зі сховища: ${(error as Error).name}`,
      );
    }
  }

  /** Базовий ключ за публічним URL фото (для зображень категорій, де ключ не зберігається). */
  baseFromUrl(url: string | null): string | null {
    if (!url || !this.driver) return null;
    const medium = this.driver.publicUrl(keyFor("§", "medium"));
    const [prefix, suffix] = medium.split("§") as [string, string];
    if (!url.startsWith(prefix) || !url.endsWith(suffix)) return null;
    const base = url.slice(prefix.length, url.length - suffix.length);
    return isOwnedBase(base) ? base : null;
  }
}
