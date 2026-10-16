import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { CookieOptions, Request } from "express";

import type { Env } from "../config/env.js";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** У БД зберігається тільки SHA-256 токена: витік таблиці не дає готових сесій. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** З префіксом __Host- браузер приймає cookie тільки з Secure, Path=/ і без Domain. */
export function sessionCookieName(env: Env): string {
  return env.ADMIN_COOKIE_SECURE ? "__Host-ss13_admin" : "ss13_admin";
}

export function sessionCookieOptions(env: Env, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.ADMIN_COOKIE_SECURE,
    sameSite: env.ADMIN_COOKIE_SAMESITE,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

/** Читає одну cookie із заголовка без сторонніх залежностей. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Запити, що змінюють дані, приймаються тільки з дозволених адрес (CORS_ORIGINS) або без
 * Origin (не браузер). Разом із SameSite і CSRF-токеном закриває CSRF, зокрема login CSRF.
 */
export function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (env.CORS_ORIGINS.includes(origin)) return true;
  const host = request.headers.host;
  return host !== undefined && (origin === `http://${host}` || origin === `https://${host}`);
}
