import { HttpStatus } from "@nestjs/common";
import type { Metadata } from "sharp";
import sharp from "sharp";

import { AppException } from "../common/app-exception.js";

/** Формати, які приймаємо. Визначаються за вмістом файлу (sharp), а не за MIME від браузера. */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const MAX_INPUT_PIXELS = 50_000_000;
const MIN_SIDE = 200;

export const IMAGE_SIZES = [
  { name: "thumb", width: 300 },
  { name: "medium", width: 600 },
  { name: "large", width: 1200 },
] as const;
export type ImageSizeName = (typeof IMAGE_SIZES)[number]["name"];

export interface ProcessedImage {
  width: number;
  height: number;
  variants: Array<{ name: ImageSizeName; body: Buffer; width: number; height: number }>;
}

export const unsupportedImage = (file: string, reason: string) =>
  new AppException(
    "UNSUPPORTED_IMAGE",
    `Файл «${file}» не підходить: ${reason}`,
    HttpStatus.BAD_REQUEST,
    [{ field: "files", errors: [reason] }],
  );

/**
 * Перевіряє вміст файлу і робить WebP-версії 300/600/1200 px завширшки (не більше за оригінал).
 * EXIF-орієнтація застосовується, метадані (зокрема геолокація) не зберігаються.
 */
export async function processImage(input: Buffer, fileName: string): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw unsupportedImage(fileName, "це не зображення або файл пошкоджено");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw unsupportedImage(fileName, "підтримуються JPEG, PNG, WebP, AVIF, HEIC");
  }
  if ((meta.pages ?? 1) > 1)
    throw unsupportedImage(fileName, "анімовані зображення не підтримуються");

  const variants: ProcessedImage["variants"] = [];
  for (const size of IMAGE_SIZES) {
    try {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: size.width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      variants.push({ name: size.name, body: data, width: info.width, height: info.height });
    } catch {
      throw unsupportedImage(fileName, "не вдалося обробити зображення");
    }
  }
  const largest = variants.at(-1)!;
  if (Math.min(largest.width, largest.height) < MIN_SIDE) {
    throw unsupportedImage(fileName, `замале зображення (мінімум ${MIN_SIDE} px)`);
  }
  return { width: largest.width, height: largest.height, variants };
}
