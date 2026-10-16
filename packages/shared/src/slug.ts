// Транслітерація української для slug-ів (за паспортною системою КМУ 2010, спрощено).

const MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "iu",
  я: "ia",
  ы: "y",
  э: "e",
  ё: "io",
  ъ: "",
  "'": "",
  "’": "",
  ʼ: "",
};

export const SLUG_MAX_LENGTH = 120;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** «Пуховик Moncler Maya чорний» → "pukhovyk-moncler-maya-chornyi". */
export function slugify(input: string): string {
  const latin = Array.from(input.toLowerCase().normalize("NFC"))
    .map((char) => MAP[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}
