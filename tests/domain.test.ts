import { describe, it, expect } from "vitest";
import {
  calculate,
  total,
  entryFor,
  reviseEntry,
  zero,
  dateInZone,
  goalAt,
  normalize,
  searchFoods,
  estimate,
  shiftDate,
  type Food,
  type Profile,
} from "../src/domain";
const food: Food = {
  id: "f1",
  user_id: "u1",
  name: "Exemplo de teste",
  brand: "",
  category: "Outros",
  unit: "g",
  reference: 100,
  portion_weight: null,
  notes: "Valores apenas para teste",
  favorite: false,
  ...zero(),
  calories: 165,
  protein: 31,
  fat: 3.6,
};
describe("Cálculos nutricionais", () => {
  it("multiplica todos os nutrientes por 1,5 e 2 sem arredondar antes da exibição", () => {
    expect(calculate(food, 150, "g")).toEqual({
      ...zero(),
      calories: 247.5,
      protein: 46.5,
      fat: 5.4,
    });
    expect(calculate(food, 200, "g")).toEqual({
      ...zero(),
      calories: 330,
      protein: 62,
      fat: 7.2,
    });
  });
  it("soma três alimentos e refeições com precisão decimal", () => {
    const items = [0.1, 0.2, 0.3].map((calories) => ({
      nutrition: { ...zero(), calories },
    }));
    expect(total(items).calories).toBe(0.6);
    const meals = [total(items.slice(0, 2)), total(items.slice(2))];
    expect(total(meals.map((nutrition) => ({ nutrition })))).toEqual(
      total(items),
    );
  });
  it("recalcula edições e remoções", () => {
    const entry = entryFor(food, 100, "g", "m1", "2026-10-20", "u1");
    const second = entryFor(food, 150, "g", "m2", "2026-10-20", "u1");
    expect(total([entry, second]).calories).toBe(412.5);
    expect(total([reviseEntry(entry, 200, "g", "m2"), second]).calories).toBe(
      577.5,
    );
    expect(total([second]).calories).toBe(247.5);
  });
  it("preserva snapshot histórico ao alterar cadastro e quantidade", () => {
    const original = structuredClone(food);
    const entry = entryFor(original, 150, "g", "m", "2026-10-20", "u");
    original.calories = 900;
    expect(entry.snapshot.calories).toBe(165);
    expect(reviseEntry(entry, 200, "g", "m").nutrition.calories).toBe(330);
  });
  it("rejeita quantidade zero, negativa e não finita", () => {
    for (const q of [0, -1, NaN, Infinity])
      expect(() => calculate(food, q, "g")).toThrow();
  });
  it("rejeita nutrientes negativos e referência inválida", () => {
    expect(() => calculate({ ...food, protein: -1 }, 100, "g")).toThrow();
    expect(() => calculate({ ...food, reference: 0 }, 100, "g")).toThrow();
  });
  it("não converte ml em g", () => {
    expect(() => calculate({ ...food, unit: "ml" }, 100, "g")).toThrow(
      "Unidades incompatíveis",
    );
    expect(calculate({ ...food, unit: "ml" }, 150, "ml").calories).toBe(247.5);
  });
  it("calcula porções e peso conhecido da porção", () => {
    const f = {
      ...food,
      unit: "porção" as const,
      reference: 2,
      portion_weight: 30,
    };
    expect(calculate(f, 3, "porção").calories).toBe(247.5);
    expect(calculate(f, 90, "g").calories).toBe(247.5);
    expect(() => calculate({ ...f, portion_weight: null }, 30, "g")).toThrow();
  });
  it("respeita data local em virada de dia e mudança de mês", () => {
    expect(
      dateInZone(new Date("2026-10-21T01:00:00Z"), "America/Fortaleza"),
    ).toBe("2026-10-20");
    expect(dateInZone(new Date("2026-10-21T01:00:00Z"), "Asia/Tokyo")).toBe(
      "2026-10-21",
    );
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("aplica metas pela vigência, sem alterar dias anteriores", () => {
    const base = goalAt([], "2026-10-20");
    const goals = [
      { ...base, id: "a", date: "2026-10-01", calories: 1800 },
      { ...base, id: "b", date: "2026-10-20", calories: 2400 },
    ];
    expect(goalAt(goals, "2026-10-19").calories).toBe(1800);
    expect(goalAt(goals, "2026-10-20").calories).toBe(2400);
  });
  it("pesquisa parcial ignora caixa, espaços e acentos e prioriza favoritos", () => {
    expect(normalize("  FEIJÃO   Preto ")).toBe("feijao preto");
    const a = { ...food, id: "a", name: "Feijão preto" },
      b = { ...food, id: "b", name: "Feijão branco", favorite: true };
    expect(searchFoods([a, b], "FEIJAO").map((f) => f.id)).toEqual(["b", "a"]);
  });
  it("estima Mifflin-St Jeor e exige aceitação externa", () => {
    const p = {
      age: 30,
      sex: "male",
      height: 180,
      body_weight: 80,
      activity: 1.55,
      objective: "lose",
    } as Profile;
    const result = estimate(p);
    expect(result.basal).toBe(1780);
    expect(result.expenditure).toBe(2759);
    expect(result.calories).toBe(2345);
    expect(() => estimate({ ...p, age: 17 })).toThrow();
  });
});
