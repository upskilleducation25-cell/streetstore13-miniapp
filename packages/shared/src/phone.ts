// Телефони покупців: тільки українські мобільні та стаціонарні номери у форматі +380XXXXXXXXX.

/**
 * Приводить номер до +380XXXXXXXXX. Приймає «+380 67 123 45 67», «067-123-45-67»,
 * «380671234567», «(067) 1234567». Повертає null, якщо це не український номер.
 */
export function normalizeUaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  const plain = digits.replace(/^\+/, "");
  let national: string;
  if (plain.length === 12 && plain.startsWith("380")) national = plain.slice(3);
  else if (plain.length === 10 && plain.startsWith("0")) national = plain.slice(1);
  else return null;
  // Код оператора чи міста не починається з 0.
  if (!/^[1-9]\d{8}$/.test(national)) return null;
  return `+380${national}`;
}

/** +380671234567 → «+380 67 123 45 67» */
export function formatUaPhone(phone: string): string {
  const normalized = normalizeUaPhone(phone);
  if (!normalized) return phone;
  const n = normalized.slice(4);
  return `+380 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
}
