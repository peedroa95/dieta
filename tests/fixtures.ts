import { emptyData, zero, entryFor, type Data, type Food } from "../src/domain";
export const owner = "11111111-1111-4111-8111-111111111111";
export function transferFixture(): Data {
  const food: Food = {
    id: crypto.randomUUID(),
    user_id: owner,
    name: "Alimento local de teste",
    brand: "",
    category: "Outros",
    unit: "g",
    reference: 100,
    portion_weight: null,
    notes: "",
    favorite: false,
    ...zero(),
    calories: 999,
    protein: 31,
    fat: 3.6,
    barcode: "3017620422003",
  };
  const meal = {
    id: crypto.randomUUID(),
    user_id: owner,
    name: "Café da manhã",
    sort_order: 0,
  };
  const data = emptyData();
  data.foods = [food];
  data.meals = [meal];
  data.food_entries = [
    entryFor(
      { ...food, calories: 165 },
      150,
      "g",
      meal.id,
      "2026-10-20",
      owner,
    ),
  ];
  data.water_logs = [
    {
      id: crypto.randomUUID(),
      user_id: owner,
      date: "2026-10-20",
      amount: 250,
    },
  ];
  data.weight_logs = [
    {
      id: crypto.randomUUID(),
      user_id: owner,
      date: "2026-10-20",
      weight: 80,
      notes: "",
    },
  ];
  data.daily_goals = [
    {
      id: crypto.randomUUID(),
      user_id: owner,
      date: "2026-10-20",
      calories: 2200,
      protein: 120,
      carbs: 260,
      fat: 70,
      water: 2200,
    },
  ];
  data.saved_meals = [
    { id: crypto.randomUUID(), user_id: owner, name: "Combinação de teste" },
  ];
  data.saved_meal_items = [
    {
      id: crypto.randomUUID(),
      user_id: owner,
      saved_meal_id: data.saved_meals[0].id,
      food_id: food.id,
      quantity: 100,
      unit: "g",
    },
  ];
  data.profiles = [
    {
      id: owner,
      user_id: owner,
      name: "Perfil local",
      age: 30,
      sex: "male",
      height: 180,
      body_weight: 80,
      body_fat: null,
      activity: 1.2,
      training: 0,
      objective: "maintain",
      timezone: "America/Fortaleza",
    },
  ];
  return data;
}
