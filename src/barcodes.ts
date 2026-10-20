import Decimal from "decimal.js";
import { type Food, type Nutrient, labels } from "./domain";

/** Keep strings (including leading zeroes) and verify the GS1 check digit. */
export function barcodeValue(input: string): string {
  const code = input.trim().replace(/[\s-]/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code))
    throw new Error("Informe um EAN/GTIN válido de 8, 12, 13 ou 14 dígitos.");
  let sum = 0;
  for (
    let i = code.length - 2, weight = 3;
    i >= 0;
    i--, weight = weight === 3 ? 1 : 3
  )
    sum += Number(code[i]) * weight;
  if ((10 - (sum % 10)) % 10 !== Number(code.at(-1)))
    throw new Error("Código de barras inválido. Confira os dígitos do rótulo.");
  return code;
}
export const barcodeKey = (input: string) =>
  barcodeValue(input).padStart(14, "0");
export interface ProductLookup {
  barcode: string;
  name: string;
  brand: string;
  source_url: string;
  nutrition: Partial<Record<Nutrient, number>>;
  missing: Nutrient[];
}
function number(value: unknown): number | undefined {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+(\.\d+)?$/.test(value))
  )
    return;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}
export function productFromResponse(
  body: unknown,
  requested: string,
): ProductLookup {
  const code = barcodeValue(requested);
  if (!body || typeof body !== "object")
    throw new Error(
      "A fonte retornou uma resposta inválida. Você pode cadastrar pelo rótulo.",
    );
  const response = body as {
    status?: number;
    code?: string;
    product?: Record<string, unknown>;
  };
  if (response.status === 0)
    throw new Error(
      "Produto não encontrado no Open Food Facts. Cadastre os dados do rótulo manualmente com este código.",
    );
  if (response.status !== 1 || !response.product)
    throw new Error(
      "Não foi possível ler os dados deste produto. Preencha pelo rótulo.",
    );
  const p = response.product;
  if (
    typeof response.code !== "string" ||
    barcodeKey(response.code) !== barcodeKey(code)
  )
    throw new Error(
      "O código retornado pela fonte não corresponde ao informado.",
    );
  const n = (
    p.nutriments && typeof p.nutriments === "object" ? p.nutriments : {}
  ) as Record<string, unknown>;
  const nutrition: ProductLookup["nutrition"] = {};
  const mapping: Partial<Record<Nutrient, string>> = {
    calories: "energy-kcal_100g",
    protein: "proteins_100g",
    carbs: "carbohydrates_100g",
    fat: "fat_100g",
    fiber: "fiber_100g",
    sugar: "sugars_100g",
    saturated_fat: "saturated-fat_100g",
    trans_fat: "trans-fat_100g",
  };
  for (const [field, source] of Object.entries(mapping)) {
    const v = number(n[source]);
    if (v !== undefined) nutrition[field as Nutrient] = v;
  }
  if (nutrition.calories === undefined) {
    const kj = number(n["energy-kj_100g"]);
    if (kj !== undefined)
      nutrition.calories = new Decimal(kj).div(4.184).toNumber();
  }
  // OFF normalizes sodium to grams. Our UI and database use milligrams.
  const sodium = number(n.sodium_100g);
  if (sodium !== undefined)
    nutrition.sodium = new Decimal(sodium).mul(1000).toNumber();
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  return {
    barcode: code,
    name: text(p.product_name_pt) || text(p.product_name),
    brand: text(p.brands),
    source_url: `https://world.openfoodfacts.org/product/${code}`,
    nutrition,
    missing: (Object.keys(labels) as Nutrient[]).filter(
      (k) => nutrition[k] === undefined,
    ),
  };
}
export async function lookupBarcode(
  input: string,
  signal?: AbortSignal,
): Promise<ProductLookup> {
  const code = barcodeValue(input);
  const fields = "code,product_name,product_name_pt,brands,nutriments";
  let response: Response;
  try {
    response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`,
      {
        signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
      },
    );
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      "Não foi possível consultar o Open Food Facts. Verifique a conexão ou preencha os dados do rótulo.",
    );
  }
  if (response.status === 404)
    throw new Error(
      "Produto não encontrado no Open Food Facts. Cadastre os dados do rótulo manualmente com este código.",
    );
  if (response.status === 429)
    throw new Error(
      "A fonte está recebendo muitas consultas. Aguarde um pouco ou cadastre manualmente.",
    );
  if (!response.ok)
    throw new Error(
      "A consulta está indisponível no momento. Você pode preencher os dados manualmente.",
    );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "A fonte retornou uma resposta inválida. Preencha pelo rótulo.",
    );
  }
  return productFromResponse(body, code);
}
export function assertUniqueBarcode(
  food: Pick<Food, "id" | "barcode">,
  foods: Food[],
) {
  if (!food.barcode) return;
  const key = barcodeKey(food.barcode);
  const existing = foods.find(
    (f) => f.id !== food.id && f.barcode && barcodeKey(f.barcode) === key,
  );
  if (existing)
    throw new Error(
      `Este código já está cadastrado em “${existing.name}”. Edite o alimento existente para atualizar os dados.`,
    );
}
