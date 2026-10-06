import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  countActiveFilters,
  emptyFilters,
  filtersToApiQuery,
  filtersToSearchParams,
  hryvniasToKopecks,
  kopecksToHryvniaInput,
  parseFilters,
  toggleValue,
} from "./filters";

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe("фільтри каталогу", () => {
  test("порожній URL — фільтри за замовчуванням, сортування new", () => {
    assert.deepEqual(parse(""), emptyFilters());
  });

  test("розбір усіх фільтрів з URL", () => {
    const f = parse(
      "category=kurtky&brand=nike,acne-studios&color=black&size=M,L&minPrice=100000&maxPrice=500000&inStock=true&isNew=true&isSale=1&sort=price_asc",
    );
    assert.deepEqual(f, {
      category: "kurtky",
      brand: ["nike", "acne-studios"],
      color: ["black"],
      size: ["M", "L"],
      minPrice: 100_000,
      maxPrice: 500_000,
      inStock: true,
      isNew: true,
      isPopular: false,
      isSale: true,
      sort: "price_asc",
    });
  });

  test("некоректні значення відкидаються, а не йдуть в API", () => {
    const f = parse("sort=random&minPrice=-5&maxPrice=12.5&brand=,,nike,nike&inStock=yes");
    assert.equal(f.sort, "new");
    assert.equal(f.minPrice, undefined);
    assert.equal(f.maxPrice, undefined);
    assert.deepEqual(f.brand, ["nike"]);
    assert.equal(f.inStock, false);
  });

  test("minPrice > maxPrice у URL — значення міняються місцями", () => {
    const f = parse("minPrice=500000&maxPrice=100000");
    assert.equal(f.minPrice, 100_000);
    assert.equal(f.maxPrice, 500_000);
  });

  test("запит до API: ціни в копійках, вимкнені позначки не передаються", () => {
    const query = filtersToApiQuery({
      ...emptyFilters("hudi"),
      brand: ["nike"],
      minPrice: 250_000,
    });
    assert.deepEqual(query, {
      category: "hudi",
      brand: ["nike"],
      color: [],
      size: [],
      minPrice: 250_000,
      maxPrice: undefined,
      inStock: undefined,
      isNew: undefined,
      isPopular: undefined,
      isSale: undefined,
      sort: "new",
    });
  });

  test("URL ← фільтри → URL без втрат, значення за замовчуванням не пишуться", () => {
    const original =
      "category=kurtky&brand=nike%2Cpremiata&size=42&maxPrice=1500000&isPopular=true&sort=price_desc";
    const roundTrip = filtersToSearchParams(parse(original));
    assert.deepEqual(parse(roundTrip.toString()), parse(original));
    assert.equal(filtersToSearchParams(emptyFilters()).toString(), "");
  });

  test("лічильник активних фільтрів (без категорії і сортування)", () => {
    assert.equal(countActiveFilters(emptyFilters("kurtky")), 0);
    assert.equal(
      countActiveFilters({
        ...emptyFilters(),
        brand: ["a", "b"],
        color: ["black"],
        minPrice: 1,
        maxPrice: 2,
        inStock: true,
        sort: "price_asc",
      }),
      5,
    );
  });

  test("перемикання значення в мультивиборі", () => {
    assert.deepEqual(toggleValue(["a"], "b"), ["a", "b"]);
    assert.deepEqual(toggleValue(["a", "b"], "a"), ["b"]);
  });

  test("поле ціни: цілі гривні → копійки", () => {
    assert.equal(hryvniasToKopecks("2999"), 299_900);
    assert.equal(hryvniasToKopecks("1 500"), 150_000);
    assert.equal(hryvniasToKopecks(""), undefined);
    assert.equal(hryvniasToKopecks("12.5"), undefined);
    assert.equal(hryvniasToKopecks("abc"), undefined);
    assert.equal(kopecksToHryvniaInput(299_900), "2999");
    assert.equal(kopecksToHryvniaInput(undefined), "");
  });
});
