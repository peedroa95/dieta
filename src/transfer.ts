import { readLocal, supabase } from "./api";
import {
  emptyData,
  calculate,
  zero,
  nutrients,
  type Data,
  type Food,
  type Row,
  type Table,
} from "./domain";
import { barcodeValue } from "./barcodes";
import { errorMessage } from "./errors";
import { getAccount } from "./auth";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sourceKey = "nutria-local-source-v1";
export interface TransferResult {
  already_imported: boolean;
  foods: number;
  food_entries: number;
  meals: number;
  water_logs: number;
  weight_logs: number;
  daily_goals: number;
  saved_meals: number;
  saved_meal_items: number;
}
export function localSourceId() {
  let id = localStorage.getItem(sourceKey);
  if (!id || !uuid.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(sourceKey, id);
  }
  return id;
}
export const transferOwner = (sourceId: string) =>
  localStorage.getItem("nutria-transfer-owner:" + sourceId);
export function transferSize(data: Data) {
  return (
    data.foods.length +
    data.food_entries.length +
    data.daily_goals.length +
    data.weight_logs.length +
    data.water_logs.length +
    data.saved_meals.length +
    data.saved_meal_items.length +
    (data.profiles.some((p) => p.name || p.age || p.height) ? 1 : 0)
  );
}
function invalid() {
  throw new Error(
    "O arquivo não contém registros válidos do Nutria. Use um arquivo JSON exportado pelo aplicativo.",
  );
}
function normalizeFood(value: unknown): Food {
  if (!value || typeof value !== "object") return invalid() as never;
  const raw = value as Food;
  if (
    typeof raw.name !== "string" ||
    !raw.name.trim() ||
    !uuid.test(raw.id) ||
    !["g", "ml", "porção"].includes(raw.unit)
  )
    invalid();
  for (const n of nutrients.slice(0, 4))
    if (typeof raw[n] !== "number" || !Number.isFinite(raw[n]) || raw[n] < 0)
      invalid();
  if (
    raw.unknown_nutrients &&
    (!Array.isArray(raw.unknown_nutrients) ||
      raw.unknown_nutrients.some((n) => !nutrients.slice(4).includes(n)))
  )
    invalid();
  const food = { ...zero(), ...raw };
  food.unknown_nutrients = [
    ...new Set([
      ...(raw.unknown_nutrients || []),
      ...nutrients.slice(4).filter((n) => raw[n] === undefined),
    ]),
  ];
  if (food.barcode) food.barcode = barcodeValue(food.barcode);
  calculate(food, food.reference, food.unit);
  return food;
}
export function validateTransfer(input: unknown): Data {
  if (!input || typeof input !== "object") invalid();
  const obj = input as Record<string, unknown>;
  const data = emptyData();
  let count = 0;
  for (const table of Object.keys(data) as Table[]) {
    if (!Array.isArray(obj[table])) invalid();
    const rows = obj[table] as Row[];
    count += rows.length;
    if (count > 5000)
      throw new Error("Transfira até 5000 registros por arquivo.");
    const ids = new Set<string>();
    for (const row of rows) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        !uuid.test(row.id) ||
        ids.has(row.id)
      )
        invalid();
      ids.add(row.id);
    }
    (data[table] as Row[]) = structuredClone(rows);
  }
  data.foods = data.foods.map(normalizeFood);
  const mealIds = new Set(data.meals.map((m) => m.id)),
    foodIds = new Set(data.foods.map((f) => f.id)),
    recipeIds = new Set(data.saved_meals.map((r) => r.id));
  for (const entry of data.food_entries) {
    entry.snapshot = normalizeFood(entry.snapshot);
    entry.nutrition = calculate(entry.snapshot, entry.quantity, entry.unit);
    if (!mealIds.has(entry.meal_id))
      throw new Error(
        "Há um registro sem a refeição correspondente no arquivo.",
      );
  }
  for (const item of data.saved_meal_items) {
    if (!recipeIds.has(item.saved_meal_id) || !foodIds.has(item.food_id))
      invalid();
    calculate(
      data.foods.find((f) => f.id === item.food_id)!,
      item.quantity,
      item.unit,
    );
  }
  for (const p of data.profiles) {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: p.timezone });
    } catch {
      throw new Error("O fuso horário do perfil é inválido.");
    }
  }
  return data;
}
export async function backupSource(
  input: unknown,
  data: Data,
): Promise<string> {
  const saved = (input as { source_id?: unknown })?.source_id;
  if (typeof saved === "string" && uuid.test(saved)) return saved;
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function localTransfer() {
  return { data: validateTransfer(readLocal()), sourceId: localSourceId() };
}
export async function transferToAccount(
  data: Data,
  sourceId: string,
  userId: string,
): Promise<TransferResult> {
  if (!supabase)
    throw new Error("Configure o Supabase antes de transferir para a nuvem.");
  if (!uuid.test(sourceId)) invalid();
  const owner = transferOwner(sourceId);
  if (owner && owner !== userId)
    throw new Error(
      "Estes dados locais já foram transferidos para outra conta.",
    );
  const account = await getAccount();
  if (!account || account.id !== userId)
    throw new Error("A conta mudou. Entre novamente antes de transferir.");
  const { data: result, error } = await supabase.rpc("transfer_local_data", {
    payload: validateTransfer(data),
    import_id: sourceId,
  });
  if (error) throw new Error(errorMessage(error));
  localStorage.setItem("nutria-transfer-owner:" + sourceId, userId);
  return result as TransferResult;
}
