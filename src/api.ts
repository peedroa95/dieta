import { assertUniqueBarcode } from "./barcodes";
import { errorMessage } from "./errors";
import { createClient } from "@supabase/supabase-js";
import {
  emptyData,
  type Data,
  type Table,
  type Row,
  type SavedMeal,
  type SavedItem,
} from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "implicit",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
export const LOCAL_ID = "11111111-1111-4111-8111-111111111111";
const LOCAL_KEY = "nutria-demo-v1";
export function readLocal(): Data {
  const saved = localStorage.getItem(LOCAL_KEY);
  return saved ? { ...emptyData(), ...JSON.parse(saved) } : emptyData();
}
function writeLocal(data: Data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}
function check(error: { message: string } | null) {
  if (error) throw new Error(errorMessage(error));
}
export async function load(
  local: boolean,
  expectedUserId?: string,
): Promise<Data> {
  if (local) return readLocal();
  if (!supabase) throw new Error("Configure o projeto Supabase.");
  const data = emptyData();
  await Promise.all(
    (Object.keys(data) as Table[]).map(async (table) => {
      let rows: unknown[] = [];
      let from = 0;
      while (true) {
        const { data: page, error } = await supabase!
          .from(table)
          .select("*")
          .order("id")
          .range(from, from + 999);
        check(error);
        if (
          expectedUserId &&
          page!.some((row) => row.user_id !== expectedUserId)
        )
          throw new Error(
            "A conta mudou durante a leitura. Atualize a página.",
          );
        rows.push(...page!);
        if (page!.length < 1000) break;
        from += 1000;
      }
      (data[table] as unknown[]) = rows;
    }),
  );
  data.meals.sort((a, b) => a.sort_order - b.sort_order);
  return data;
}
export async function initialize(local: boolean, userId: string) {
  if (!local) {
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    const name = session?.user.user_metadata?.name;
    const { error } = await supabase!.rpc("initialize_user", {
      initial_name: typeof name === "string" ? name : "",
    });
    check(error);
    return;
  }
  const data = readLocal();
  if (!data.profiles.length)
    data.profiles.push({
      id: userId,
      user_id: userId,
      name: "",
      age: null,
      sex: "",
      height: null,
      body_weight: null,
      body_fat: null,
      activity: 1.2,
      training: 0,
      objective: "maintain",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  if (!data.meals.length)
    data.meals = ["Café da manhã", "Almoço", "Lanche", "Jantar"].map(
      (name, sort_order) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        name,
        sort_order,
      }),
    );
  writeLocal(data);
}
export async function save<T extends Row>(
  local: boolean,
  table: Table,
  rows: T[],
) {
  if (local) {
    const data = readLocal();
    const existing = data[table] as Row[];
    if (table === "foods") {
      const proposed = [
        ...data.foods.filter((f) => !rows.some((r) => r.id === f.id)),
        ...(rows as unknown as Data["foods"]),
      ];
      for (const food of rows as unknown as Data["foods"])
        assertUniqueBarcode(food, proposed);
    }
    for (const row of rows) {
      const i = existing.findIndex((r) => r.id === row.id);
      if (i < 0)
        existing.push({
          ...structuredClone(row),
          created_at: new Date().toISOString(),
        });
      else existing[i] = structuredClone(row);
    }
    writeLocal(data);
    return;
  }
  // Colunas geradas e timestamps do servidor não são enviados em upserts.
  const clean = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(
        ([k]) =>
          ![
            "calories_recorded",
            "protein_recorded",
            "carbs_recorded",
            "fat_recorded",
            "updated_at",
            "created_at",
          ].includes(k),
      ),
    ),
  );
  const { error } = await supabase!.from(table).upsert(clean);
  check(error);
}
export async function remove(local: boolean, table: Table, id: string) {
  if (local) {
    const data = readLocal();
    (data[table] as Row[]) = (data[table] as Row[]).filter((r) => r.id !== id);
    if (table === "foods") {
      data.food_entries = data.food_entries.map((e) =>
        e.food_id === id ? { ...e, food_id: null } : e,
      );
      data.saved_meal_items = data.saved_meal_items.filter(
        (i) => i.food_id !== id,
      );
    }
    if (table === "saved_meals")
      data.saved_meal_items = data.saved_meal_items.filter(
        (i) => i.saved_meal_id !== id,
      );
    writeLocal(data);
    return;
  }
  const { error } = await supabase!.from(table).delete().eq("id", id);
  check(error);
}
export async function saveRecipe(
  local: boolean,
  recipe: SavedMeal,
  items: SavedItem[],
) {
  if (local) {
    const data = readLocal();
    data.saved_meals = [
      ...data.saved_meals.filter((r) => r.id !== recipe.id),
      recipe,
    ];
    data.saved_meal_items = [
      ...data.saved_meal_items.filter((i) => i.saved_meal_id !== recipe.id),
      ...items,
    ];
    writeLocal(data);
    return;
  }
  const { error } = await supabase!.rpc("save_recipe", {
    recipe_id: recipe.id,
    recipe_name: recipe.name,
    items: items.map(({ food_id, quantity, unit }) => ({
      food_id,
      quantity,
      unit,
    })),
  });
  check(error);
}
export function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
}
