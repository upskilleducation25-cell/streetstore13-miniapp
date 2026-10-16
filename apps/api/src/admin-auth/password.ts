import argon2 from "argon2";

// Argon2id з параметрами за замовчуванням бібліотеки (64 МіБ, 3 ітерації, 4 потоки).
const OPTIONS = { type: argon2.argon2id } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Перевіряє пароль. Без хешу (адміна немає або вимкнено) все одно рахує Argon2 по
 * фіктивному хешу, щоб час відповіді не видавав, чи існує email.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= hashPassword("dummy-password-for-timing-only");
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
