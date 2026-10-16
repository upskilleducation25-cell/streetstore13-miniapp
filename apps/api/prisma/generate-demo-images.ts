// Генерує прості локальні SVG-плейсхолдери 3:4 для demo-товарів у
// apps/miniapp/public/demo/products. Без зовнішніх сервісів; результат комітиться.
// Запуск: pnpm --filter @ss13/api demo:images
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { colors } from "./colors.js";
import {
  DEMO_IMAGE_HEIGHT as H,
  DEMO_IMAGE_WIDTH as W,
  DEMO_IMAGES_PER_COLOR,
  DEMO_PRODUCTS,
  demoImagePath,
} from "./demo-products.js";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "../../miniapp/public");
const outDir = join(publicDir, "demo/products");

// Силуети в полотні 600×800, центр приблизно (300, 380).
const SILHOUETTES: Record<string, string> = {
  jacket:
    "M215 175 L255 160 Q300 185 345 160 L385 175 L470 230 L505 470 L455 480 L425 300 L425 620 L175 620 L175 300 L145 480 L95 470 L130 230 Z",
  hoodie:
    "M240 175 Q245 120 300 118 Q355 120 360 175 L385 180 L470 235 L505 470 L455 480 L425 305 L425 620 L175 620 L175 305 L145 480 L95 470 L130 235 L215 180 Z",
  tshirt:
    "M225 180 Q300 215 375 180 L480 230 L445 310 L405 290 L405 600 L195 600 L195 290 L155 310 L120 230 Z",
  pants: "M200 160 L400 160 L420 620 L335 620 L300 300 L265 620 L180 620 Z",
  shoe: "M110 470 Q120 380 175 365 L250 360 Q300 330 345 345 L420 410 Q500 425 505 470 L505 505 Q505 520 490 520 L120 520 Q108 520 110 500 Z",
  cap: "M160 430 Q165 290 300 285 Q435 290 440 430 Z M300 430 L500 430 Q510 470 470 470 L300 470 Z",
  bag: "M170 330 L430 330 L455 600 L145 600 Z M235 330 Q235 230 300 230 Q365 230 365 330 L345 330 Q345 252 300 252 Q255 252 255 330 Z",
  socks:
    "M240 180 L330 180 L330 450 Q330 470 345 480 L440 540 Q470 560 455 595 Q440 620 405 605 L265 530 Q240 515 240 485 Z",
};

const SILHOUETTE_BY_CATEGORY: Record<string, string> = {
  puhovyky: "jacket",
  kurtky: "jacket",
  vitrovky: "jacket",
  hudi: "hoodie",
  svitshoty: "hoodie",
  futbolky: "tshirt",
  shtany: "pants",
  krosivky: "shoe",
  sumky: "bag",
  "holovni-ubory": "cap",
  aksesuary: "socks",
};

/** Змішує колір з білим (amount = частка білого). */
function tint(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 0xff;
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  return (
    (0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff)) /
    255
  );
}

const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function svg(options: { silhouette: string; hex: string; view: number; caption: string }): string {
  const { silhouette, hex, view, caption } = options;
  const light = luminance(hex) > 0.85;
  const background = view === 1 ? tint(hex, light ? 0 : 0.86) : tint(hex, light ? 0 : 0.74);
  const page = light ? (view === 1 ? "#EDEDED" : "#E2E2E2") : background;
  const stroke = light ? ' stroke="#BDBDBD" stroke-width="4"' : "";
  // Другий вигляд — віддзеркалений і трохи збільшений, щоб галерея відрізнялась.
  const transform =
    view === 1 ? "" : ` transform="translate(${W} 0) scale(-1 1) translate(-30 -40) scale(1.1)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${page}"/>
<path d="${silhouette}" fill="${hex}"${stroke}${transform}/>
<text x="${W / 2}" y="${H - 70}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="4" fill="${light || luminance(background) > 0.5 ? "#6B6B6B" : "#F2F2F2"}">${escapeXml(caption)}</text>
</svg>
`;
}

function main(): void {
  const hexBySlug = new Map(colors.map(([slug, , hex]) => [slug, hex]));
  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(outDir)) {
    if (file.endsWith(".svg")) rmSync(join(outDir, file));
  }

  let count = 0;
  for (const product of DEMO_PRODUCTS) {
    const silhouette = SILHOUETTES[SILHOUETTE_BY_CATEGORY[product.category] ?? "jacket"]!;
    for (const colorSlug of Object.keys(product.stock)) {
      const hex = hexBySlug.get(colorSlug);
      if (!hex) throw new Error(`Невідомий колір ${colorSlug}`);
      for (let view = 1; view <= DEMO_IMAGES_PER_COLOR; view++) {
        const path = join(publicDir, demoImagePath(product.sku, colorSlug, view));
        writeFileSync(path, svg({ silhouette, hex, view, caption: `DEMO · ${product.sku}` }));
        count++;
      }
    }
  }
  console.log(`Згенеровано ${count} плейсхолдерів у ${outDir}`);
}

main();
