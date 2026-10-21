import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { transferFixture } from "./fixtures";
import {
  validateTransfer,
  backupSource,
  transferSize,
  localSourceId,
} from "../src/transfer";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("valida os dados e recalcula histórico pelo snapshot, sem alterar o original", () => {
  const data = transferFixture();
  data.food_entries[0].nutrition.calories = 99999;
  const result = validateTransfer(data);
  expect(result.food_entries[0].nutrition.calories).toBe(247.5);
  expect(data.food_entries[0].nutrition.calories).toBe(99999);
  expect(transferSize(result)).toBeGreaterThan(0);
});
it("rejeita JSON malformado, ids repetidos e referências incompletas", () => {
  expect(() => validateTransfer({})).toThrow();
  const data = transferFixture();
  data.foods.push(data.foods[0]);
  expect(() => validateTransfer(data)).toThrow();
  const missing = transferFixture();
  missing.meals = [];
  expect(() => validateTransfer(missing)).toThrow("refeição");
});
it("rejeita nutrientes negativos e fuso inválido", () => {
  const data = transferFixture();
  data.foods[0].fat = -1;
  expect(() => validateTransfer(data)).toThrow();
  const other = transferFixture();
  other.profiles[0].timezone = "invalid/timezone";
  expect(() => validateTransfer(other)).toThrow("fuso");
});
it("preserva a identidade do lote exportado e gera ids estáveis para arquivos antigos", async () => {
  const data = transferFixture();
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(await backupSource({ source_id: id }, data)).toBe(id);
  expect(await backupSource(data, data)).toBe(
    await backupSource(data, structuredClone(data)),
  );
});
it("mantém o mesmo identificador de origem local entre tentativas", () => {
  expect(localSourceId()).toBe(localSourceId());
});
