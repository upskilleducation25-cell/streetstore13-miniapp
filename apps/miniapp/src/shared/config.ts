// Налаштування Mini App, що задаються під час збірки (Vite env).

/** Адреса API. Порожня — той самий origin (у dev Vite проксує /api на :3000). */
export const API_BASE_URL = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/v1`;

/**
 * Поріг «Залишилось N шт.». Дублює налаштування inventory.lowStockThreshold з seed,
 * поки публічного ендпоїнту налаштувань немає.
 */
export const LOW_STOCK_THRESHOLD = 2;

export const PAGE_SIZE = 20;
