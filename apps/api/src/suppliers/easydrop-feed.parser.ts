/**
 * Strict, dependency-free XML reader for the EasyDrop feed's small XML subset.
 * DTDs, external entities, comments, CDATA, and unknown entities are rejected.
 * This intentionally fails closed if the supplier changes the feed format.
 */
export interface EasyDropFeedVariant {
  externalId: string;
  groupId: string;
  vendorCode: string;
  name: string;
  categoryId: string;
  priceUah: number;
  imageUrl: string;
  size: string;
  available: boolean;
  quantity: number;
}

export interface EasyDropFeedPreview {
  totalItems: number;
  shoeVariants: EasyDropFeedVariant[];
  skippedNonShoes: number;
  distinctModels: number;
}

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const MAX_XML_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS = 50_000;
const MAX_NODES = 250_000;
const MAX_DEPTH = 64;
const IMAGE_HOSTS = new Set(["easydrop.one", "www.easydrop.one"]);

function fail(message: string): never {
  throw new Error(`Некоректний XML EasyDrop: ${message}`);
}

function decodeXml(value: string): string {
  return value.replace(/&([^;]+);/g, (_whole, entity: string) => {
    const predefined: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    if (Object.hasOwn(predefined, entity)) return predefined[entity]!;
    const numeric = entity.startsWith("#x")
      ? Number.parseInt(entity.slice(2), 16)
      : entity.startsWith("#")
        ? Number.parseInt(entity.slice(1), 10)
        : Number.NaN;
    if (
      !Number.isInteger(numeric) ||
      numeric <= 0 ||
      numeric > 0x10ffff ||
      (numeric >= 0xd800 && numeric <= 0xdfff)
    ) {
      fail("невідома або недопустима XML-сутність");
    }
    return String.fromCodePoint(numeric);
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let offset = 0;
  while (offset < source.length) {
    while (/\s/.test(source[offset] ?? "")) offset++;
    if (offset >= source.length) break;
    const match = /^[A-Za-z_][\w:.-]*/.exec(source.slice(offset));
    if (!match) fail("неправильний атрибут");
    const name = match[0];
    offset += name.length;
    while (/\s/.test(source[offset] ?? "")) offset++;
    if (source[offset] !== "=") fail("в атрибуті немає знака =");
    offset++;
    while (/\s/.test(source[offset] ?? "")) offset++;
    const quote = source[offset];
    if (quote !== '"' && quote !== "'") fail("значення атрибута має бути в лапках");
    offset++;
    const end = source.indexOf(quote, offset);
    if (end < 0) fail("незакриті лапки атрибута");
    if (Object.hasOwn(attributes, name)) fail("повторний атрибут");
    attributes[name] = decodeXml(source.slice(offset, end));
    offset = end + 1;
  }
  return attributes;
}

function parseXml(xml: string): XmlNode {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) fail("файл перевищує ліміт 5 МБ");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) fail("DTD та оголошення сутностей заборонені");
  if (/<!--[\s\S]*?-->|<!\[CDATA\[/i.test(xml)) fail("коментарі та CDATA не підтримуються");
  const document: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
  const stack: XmlNode[] = [document];
  const tokens = /<\?[^?]*\?>|<[^>]*>|[^<]+|</g;
  let match: RegExpExecArray | null;
  let nodes = 0;
  let sawDeclaration = false;
  while ((match = tokens.exec(xml)) !== null) {
    const token = match[0];
    if (token === "<") fail("незакритий тег");
    if (token.startsWith("<?")) {
      if (
        sawDeclaration ||
        stack.length !== 1 ||
        !/^<\?xml\s+version=["']1\.[01]["'][^?]*\?>$/.test(token)
      ) {
        fail("недопустима XML-інструкція");
      }
      sawDeclaration = true;
      continue;
    }
    if (token.startsWith("</")) {
      const name = /^<\/\s*([A-Za-z_][\w:.-]*)\s*>$/.exec(token)?.[1];
      if (!name || stack.length <= 1 || stack[stack.length - 1]!.name !== name) {
        fail("теги не збігаються");
      }
      stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const opening = /^<\s*([A-Za-z_][\w:.-]*)([\s\S]*?)\s*(\/?)>$/.exec(token);
      if (!opening) fail("неправильний відкривальний тег");
      const name = opening[1]!;
      const node: XmlNode = {
        name,
        attributes: parseAttributes(opening[2]!),
        children: [],
        text: "",
      };
      stack[stack.length - 1]!.children.push(node);
      if (++nodes > MAX_NODES) fail("забагато XML-елементів");
      if (!opening[3]) {
        stack.push(node);
        if (stack.length > MAX_DEPTH) fail("перевищена вкладеність XML");
      }
      continue;
    }
    if (token.includes("]]>")) fail("недопустима послідовність у тексті");
    stack[stack.length - 1]!.text += decodeXml(token);
  }
  if (stack.length !== 1) fail("є незакриті теги");
  if (document.children.length !== 1 || document.children[0]!.name !== "shop") {
    fail("кореневим елементом має бути shop");
  }
  return document.children[0]!;
}

function child(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((entry) => entry.name === name);
}

function textOf(node: XmlNode, name: string): string {
  const value = child(node, name)?.text.trim();
  if (!value) fail(`відсутнє обов'язкове поле ${name}`);
  return value;
}

function parseInteger(value: string, field: string, min: number, max: number): number {
  if (!/^\d+$/.test(value)) fail(`поле ${field} має бути цілим числом`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    fail(`поле ${field} поза допустимими межами`);
  }
  return parsed;
}

function parseItem(node: XmlNode): EasyDropFeedVariant | null {
  const externalId = node.attributes.id;
  const groupId = node.attributes.group_id;
  if (!externalId || !/^\d{1,32}$/.test(externalId)) fail("item має неправильний id");
  if (!groupId || !/^\d{1,32}$/.test(groupId)) fail(`item ${externalId}: неправильний group_id`);

  const name = textOf(node, "name");
  const sizeParam = node.children.find(
    (entry) => entry.name === "param" && entry.attributes.name === "Розмір",
  );
  const sizeRaw = sizeParam?.text.trim();
  // Non-shoe catalog entries are ignored; shoe variants must carry an EU numeric size.
  if (!sizeRaw || !/^\d{2}$/.test(sizeRaw) || Number(sizeRaw) < 20 || Number(sizeRaw) > 50) {
    return null;
  }

  const priceUah = Number(textOf(node, "priceuah"));
  if (
    !Number.isFinite(priceUah) ||
    priceUah <= 0 ||
    Math.round(priceUah * 100) !== priceUah * 100
  ) {
    fail(`item ${externalId}: неправильна роздрібна ціна`);
  }
  const imageUrl = textOf(node, "image");
  let image: URL;
  try {
    image = new URL(imageUrl);
  } catch {
    fail(`item ${externalId}: неправильне посилання на фото`);
  }
  if (
    image.protocol !== "https:" ||
    !IMAGE_HOSTS.has(image.hostname) ||
    image.username ||
    image.password
  ) {
    fail(`item ${externalId}: фото має бути на дозволеному HTTPS-хості EasyDrop`);
  }
  const availableRaw = textOf(node, "available").toLowerCase();
  if (availableRaw !== "true" && availableRaw !== "false") {
    fail(`item ${externalId}: неправильне поле available`);
  }
  const quantity = parseInteger(
    textOf(node, "quantity_in_stock"),
    "quantity_in_stock",
    0,
    1_000_000,
  );
  const vendorCode = textOf(node, "vendorCode");
  const categoryId = textOf(node, "categoryId");
  if (!/^\d{1,32}$/.test(categoryId)) fail(`item ${externalId}: неправильний categoryId`);
  return {
    externalId,
    groupId,
    vendorCode,
    name,
    categoryId,
    priceUah,
    imageUrl: image.toString(),
    size: sizeRaw,
    available: availableRaw === "true",
    quantity: availableRaw === "true" ? quantity : 0,
  };
}

/** Parses and validates the whole feed before returning any usable data. */
export function parseEasyDropFeed(xml: string): EasyDropFeedPreview {
  const root = parseXml(xml);
  const itemsNode = child(root, "items");
  if (!itemsNode) fail("відсутній блок items");
  const itemNodes = itemsNode.children.filter((entry) => entry.name === "item");
  if (itemNodes.length === 0 || itemNodes.length > MAX_ITEMS) fail("недопустима кількість item");
  const seen = new Set<string>();
  const variants: EasyDropFeedVariant[] = [];
  let skippedNonShoes = 0;
  for (const item of itemNodes) {
    const id = item.attributes.id;
    if (!id || seen.has(id)) fail("порожній або повторний id товару");
    seen.add(id);
    const parsed = parseItem(item);
    if (parsed) variants.push(parsed);
    else skippedNonShoes++;
  }
  if (variants.length === 0) fail("у фіді не знайдено взуттєвих варіантів із розміром EU");
  return {
    totalItems: itemNodes.length,
    shoeVariants: variants,
    skippedNonShoes,
    distinctModels: new Set(variants.map((variant) => variant.groupId)).size,
  };
}
