import { describe, it, expect } from "vitest";
import {
  barcodeValue,
  barcodeKey,
  productFromResponse,
  assertUniqueBarcode,
} from "../src/barcodes";
import { zero, type Food } from "../src/domain";
const code = "3017620422003";
const response = (nutriments: Record<string, unknown> = {}) => ({
  status: 1,
  code,
  product: {
    product_name_pt: "Produto de teste",
    brands: "Marca de teste",
    nutriments,
  },
});
describe("EAN e importação Open Food Facts", () => {
  it("aceita EAN-8, UPC-A, EAN-13 e GTIN-14 e mantém zeros", () => {
    for (const v of ["96385074", "036000291452", code, "00036000291452"])
      expect(barcodeValue(v)).toBe(v);
    expect(barcodeValue(" 3017-6204 22003 ")).toBe(code);
    expect(barcodeKey("036000291452")).toBe(barcodeKey("0036000291452"));
  });
  it("rejeita dígito verificador incorreto e caracteres não numéricos", () => {
    for (const v of [
      "3017620422004",
      "0000000000000",
      "123",
      "EAN3017620422003",
    ])
      expect(() => barcodeValue(v)).toThrow();
  });
  it("mapeia nutrientes por 100 g/ml e converte sódio de g para mg", () => {
    const p = productFromResponse(
      response({
        "energy-kcal_100g": 120,
        proteins_100g: 8,
        carbohydrates_100g: 15,
        fat_100g: 3,
        sodium_100g: 0.12,
      }),
      code,
    );
    expect(p.nutrition).toEqual({
      calories: 120,
      protein: 8,
      carbs: 15,
      fat: 3,
      sodium: 120,
    });
    expect(p.source_url).toBe(
      `https://world.openfoodfacts.org/product/${code}`,
    );
    expect(p.missing).toContain("fiber");
    expect(p.missing).toContain("cholesterol");
  });
  it("não inventa nutrientes ausentes, não numéricos ou negativos", () => {
    const p = productFromResponse(
      response({
        proteins_100g: -3,
        fat_100g: "indisponível",
        carbohydrates_100g: 0,
      }),
      code,
    );
    expect(p.nutrition).toEqual({ carbs: 0 });
    expect(p.missing).toContain("protein");
    expect(p.missing).toContain("calories");
  });
  it("converte energia explicitamente informada em kJ para kcal", () => {
    expect(
      productFromResponse(response({ "energy-kj_100g": 418.4 }), code).nutrition
        .calories,
    ).toBe(100);
  });
  it("não usa dados por porção como valores por 100 g", () => {
    expect(
      productFromResponse(
        response({ "energy-kcal_serving": 100, proteins_serving: 10 }),
        code,
      ).nutrition,
    ).toEqual({});
  });
  it("recusa produto ausente, resposta malformada e código diferente", () => {
    expect(() => productFromResponse({ status: 0 }, code)).toThrow(
      "não encontrado",
    );
    expect(() => productFromResponse({}, code)).toThrow();
    expect(() =>
      productFromResponse({ ...response(), code: "5901234123457" }, code),
    ).toThrow("não corresponde");
  });
  it("impede duplicação por código equivalente sem impedir edição", () => {
    const food = {
      id: "f",
      user_id: "u",
      name: "Existente",
      barcode: "036000291452",
      brand: "",
      category: "Outros",
      unit: "g",
      reference: 100,
      portion_weight: null,
      notes: "",
      favorite: false,
      ...zero(),
    } as Food;
    expect(() =>
      assertUniqueBarcode({ id: "other", barcode: "0036000291452" }, [food]),
    ).toThrow("Existente");
    expect(() => assertUniqueBarcode(food, [food])).not.toThrow();
  });
});
