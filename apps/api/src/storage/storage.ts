import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { Env } from "../config/env.js";

/** Префікс, під яким local-драйвер віддає файли через API. */
export const LOCAL_UPLOADS_ROUTE = "/api/v1/uploads";

/** Базові ключі, які створює адмінка. Демо- і тестові фото (demo/, test/) сховище не чіпає. */
const OWNED_BASE_RE = /^(products|categories)\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export interface StorageDriverImpl {
  readonly name: "r2" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  publicUrl(key: string): string;
}

export class LocalStorageDriver implements StorageDriverImpl {
  readonly name = "local" as const;
  readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error("Некоректний ключ файлу");
    return path;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.pathFor(key), { force: true })));
  }

  publicUrl(key: string): string {
    return `${LOCAL_UPLOADS_ROUTE}/${key}`;
  }
}

/** Cloudflare R2 через S3 API. Ключі доступу живуть тільки на сервері. */
export class R2StorageDriver implements StorageDriverImpl {
  readonly name = "r2" as const;
  private readonly client: S3Client;

  constructor(private readonly env: Env) {
    this.client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Ключ унікальний для кожного завантаження, тож файл можна кешувати назавжди.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.env.R2_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.env.R2_PUBLIC_URL}/${key}`;
  }
}

export function createStorageDriver(env: Env): StorageDriverImpl | null {
  if (env.STORAGE_DRIVER === "r2") return new R2StorageDriver(env);
  if (env.STORAGE_DRIVER === "local") return new LocalStorageDriver(env.LOCAL_STORAGE_DIR);
  return null;
}

export function isOwnedBase(base: string): boolean {
  return OWNED_BASE_RE.test(base);
}
