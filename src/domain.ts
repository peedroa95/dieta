import Decimal from "decimal.js";
export const nutrients = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "saturated_fat",
  "trans_fat",
  "sodium",
  "cholesterol",
] as const;
export type Nutrient = (typeof nutrients)[number];
export type Nutrition = Record<Nutrient, number>;
export type Unit = "g" | "ml" | "porção";
export interface Row {
  id: string;
  user_id: string;
  created_at?: string;
}
export interface Food extends Row, Nutrition {
  barcode?: string | null;
  source_url?: string | null;
  unknown_nutrients?: Nutrient[];
  name: string;
  brand: string;
  category: string;
  unit: Unit;
  reference: number;
  portion_weight: number | null;
  notes: string;
  favorite: boolean;
}
export interface Meal extends Row {
  name: string;
  sort_order: number;
}
export interface Entry extends Row {
  food_id: string | null;
  meal_id: string;
  date: string;
  quantity: number;
  unit: Unit;
  snapshot: Food;
  nutrition: Nutrition;
}
export interface Goal extends Row {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}
export interface Weight extends Row {
  date: string;
  weight: number;
  notes: string;
}
export interface Water extends Row {
  date: string;
  amount: number;
}
export interface SavedMeal extends Row {
  name: string;
}
export interface SavedItem extends Row {
  saved_meal_id: string;
  food_id: string;
  quantity: number;
  unit: Unit;
}
export interface Profile extends Row {
  name: string;
  age: number | null;
  sex: string;
  height: number | null;
  body_weight: number | null;
  body_fat: number | null;
  activity: number;
  training: number;
  objective: string;
  timezone: string;
}
export interface Data {
  foods: Food[];
  meals: Meal[];
  food_entries: Entry[];
  daily_goals: Goal[];
  weight_logs: Weight[];
  water_logs: Water[];
  saved_meals: SavedMeal[];
  saved_meal_items: SavedItem[];
  profiles: Profile[];
}
export type Table = keyof Data;
export const emptyData = (): Data => ({
  foods: [],
  meals: [],
  food_entries: [],
  daily_goals: [],
  weight_logs: [],
  water_logs: [],
  saved_meals: [],
  saved_meal_items: [],
  profiles: [],
});
export const categories = [
  "Carnes e aves",
  "Peixes e frutos do mar",
  "Ovos",
  "Arroz, massas e cereais",
  "Feijão e leguminosas",
  "Frutas",
  "Verduras e legumes",
  "Leite e derivados",
  "Pães e panificados",
  "Oleaginosas",
  "Suplementos",
  "Bebidas",
  "Alimentos industrializados",
  "Outros",
];
export const labels: Record<Nutrient, string> = {
  calories: "Calorias",
  protein: "Proteínas",
  carbs: "Carboidratos",
  fat: "Gorduras",
  fiber: "Fibras",
  sugar: "Açúcares",
  saturated_fat: "Gorduras saturadas",
  trans_fat: "Gorduras trans",
  sodium: "Sódio",
  cholesterol: "Colesterol",
};
export const zero = (): Nutrition =>
  Object.fromEntries(nutrients.map((n) => [n, 0])) as Nutrition;
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export function calculate(food: Food, quantity: number, unit: Unit): Nutrition {
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Informe uma quantidade maior que zero.");
  if (!Number.isFinite(food.reference) || food.reference <= 0)
    throw new Error("Referência inválida.");
  let ratio: Decimal;
  if (unit === food.unit) ratio = new Decimal(quantity).div(food.reference);
  else if (
    food.unit === "porção" &&
    unit === "g" &&
    food.portion_weight &&
    food.portion_weight > 0
  )
    ratio = new Decimal(quantity).div(food.portion_weight).div(food.reference);
  else
    throw new Error(
      "Unidades incompatíveis. Mililitros não são convertidos em gramas.",
    );
  return Object.fromEntries(
    nutrients.map((n) => {
      if (!Number.isFinite(food[n]) || food[n] < 0)
        throw new Error("Os nutrientes devem ser números não negativos.");
      return [n, new Decimal(food[n]).mul(ratio).toNumber()];
    }),
  ) as Nutrition;
}
export function total(items: { nutrition: Nutrition }[]): Nutrition {
  return Object.fromEntries(
    nutrients.map((n) => [
      n,
      items.reduce((s, i) => s.plus(i.nutrition[n]), new Decimal(0)).toNumber(),
    ]),
  ) as Nutrition;
}
export function entryFor(
  food: Food,
  quantity: number,
  unit: Unit,
  meal_id: string,
  date: string,
  user_id: string,
): Entry {
  return {
    id: crypto.randomUUID(),
    user_id,
    food_id: food.id,
    meal_id,
    date,
    quantity,
    unit,
    snapshot: structuredClone(food),
    nutrition: calculate(food, quantity, unit),
    created_at: new Date().toISOString(),
  };
}
export function reviseEntry(
  entry: Entry,
  quantity: number,
  unit: Unit,
  meal_id: string,
): Entry {
  return {
    ...entry,
    quantity,
    unit,
    meal_id,
    nutrition: calculate(entry.snapshot, quantity, unit),
  };
}
export const format = (n: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);
export function dateInZone(
  date = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function goalAt(goals: Goal[], date: string): Goal {
  return (
    [...goals]
      .filter((g) => g.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || {
      id: "default",
      user_id: "",
      date: "2000-01-01",
      calories: 2000,
      protein: 100,
      carbs: 250,
      fat: 67,
      water: 2000,
    }
  );
}
export function estimate(p: Profile) {
  if (
    !p.age ||
    p.age < 18 ||
    p.age > 100 ||
    !p.height ||
    p.height < 100 ||
    p.height > 250 ||
    !p.body_weight ||
    p.body_weight < 25 ||
    p.body_weight > 400 ||
    !["female", "male"].includes(p.sex)
  )
    throw new Error(
      "Preencha idade (18–100), sexo, altura (100–250 cm) e peso (25–400 kg).",
    );
  const basal =
    10 * p.body_weight +
    6.25 * p.height -
    5 * p.age +
    (p.sex === "male" ? 5 : -161);
  const expenditure = basal * p.activity;
  const adjustment =
    p.objective === "lose" ? -0.15 : p.objective === "gain" ? 0.1 : 0;
  const calories = Math.round(expenditure * (1 + adjustment));
  const protein = Math.round(p.body_weight * 1.6),
    fat = Math.round((calories * 0.3) / 9),
    carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    basal,
    expenditure,
    calories,
    protein,
    fat,
    carbs,
    water: Math.round(p.body_weight * 35),
    delta: calories - expenditure,
  };
}
export function searchFoods(
  foods: Food[],
  query: string,
  recent: string[] = [],
) {
  const q = normalize(query);
  return foods
    .filter((f) =>
      normalize(`${f.name} ${f.brand} ${f.barcode || ""}`).includes(q),
    )
    .sort((a, b) => {
      const score = (f: Food) =>
        (normalize(f.name) === q
          ? 100
          : normalize(f.name).startsWith(q)
            ? 30
            : 0) +
        (f.favorite ? 10 : 0) +
        (recent.includes(f.id) ? 5 / (recent.indexOf(f.id) + 1) : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name, "pt-BR");
    });
}
