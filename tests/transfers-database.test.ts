import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { transferFixture, owner as alice } from "./fixtures";
import type { Data } from "../src/domain";
let db: PGlite;
const bob = "22222222-2222-4222-8222-222222222222",
  source = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function asUser(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function transfer(data: Data, id = source) {
  const { rows } = await db.query<{
    result: { already_imported: boolean; foods: number; food_entries: number };
  }>("select transfer_local_data($1::jsonb,$2::uuid) result", [
    JSON.stringify(data),
    id,
  ]);
  return rows[0].result;
}
async function fails(data: Data, id = source) {
  await db.exec("savepoint fail");
  await expect(transfer(data, id)).rejects.toThrow();
  await db.exec("rollback to savepoint fail");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${alice}'),('${bob}');`,
  );
  for (const file of [
    "202610200001_initial.sql",
    "202610200002_food_barcodes.sql",
    "202610210001_account_transfers.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
  await asUser(alice);
  await db.exec("select initialize_user()");
});
afterEach(async () => {
  await db.exec("reset role;rollback");
});
it("transfere todas as entidades, mapeia refeições padrão e preserva snapshots históricos", async () => {
  const data = transferFixture();
  const result = await transfer(data);
  expect(result.foods).toBe(1);
  expect(result.food_entries).toBe(1);
  expect((await db.query("select * from meals")).rows).toHaveLength(4);
  const row = (
    await db.query<{
      calories_recorded: string;
      user_id: string;
      snapshot: { calories: number; user_id: string };
    }>("select calories_recorded,user_id,snapshot from food_entries")
  ).rows[0];
  expect(Number(row.calories_recorded)).toBe(247.5);
  expect(row.user_id).toBe(alice);
  expect(row.snapshot.calories).toBe(165);
  expect(row.snapshot.user_id).toBe(alice);
  for (const table of [
    "foods",
    "food_entries",
    "water_logs",
    "weight_logs",
    "daily_goals",
    "saved_meals",
    "saved_meal_items",
    "local_imports",
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
  expect(
    (await db.query<{ name: string }>("select name from profiles")).rows[0]
      .name,
  ).toBe("Perfil local");
});
it("não duplica a transferência após repetição ou perda da resposta", async () => {
  const data = transferFixture();
  await transfer(data);
  expect((await transfer(data)).already_imported).toBe(true);
  expect((await db.query("select * from food_entries")).rows).toHaveLength(1);
  expect((await db.query("select * from water_logs")).rows).toHaveLength(1);
});
it("reutiliza alimento por EAN sem sobrescrever o cadastro remoto", async () => {
  await db.exec(
    `insert into foods(user_id,name,unit,reference,calories,protein,carbs,fat,barcode) values('${alice}','Cadastro remoto','g',100,500,1,1,1,'3017620422003')`,
  );
  const result = await transfer(transferFixture());
  expect(result.foods).toBe(0);
  expect(
    (await db.query<{ name: string }>("select name from foods")).rows[0].name,
  ).toBe("Cadastro remoto");
  expect(
    Number(
      (
        await db.query<{ calories_recorded: string }>(
          "select calories_recorded from food_entries",
        )
      ).rows[0].calories_recorded,
    ),
  ).toBe(247.5);
});
it("mantém metas, peso e perfil já cadastrados na nuvem", async () => {
  await db.exec(
    `update profiles set name='Nome remoto' where user_id='${alice}';insert into weight_logs(user_id,date,weight) values('${alice}','2026-10-20',75);insert into daily_goals(user_id,date,calories,protein,carbs,fat,water) values('${alice}','2026-10-20',1800,100,200,60,2000);`,
  );
  await transfer(transferFixture());
  expect(
    Number(
      (await db.query<{ weight: string }>("select weight from weight_logs"))
        .rows[0].weight,
    ),
  ).toBe(75);
  expect(
    Number(
      (await db.query<{ calories: string }>("select calories from daily_goals"))
        .rows[0].calories,
    ),
  ).toBe(1800);
  expect(
    (await db.query<{ name: string }>("select name from profiles")).rows[0]
      .name,
  ).toBe("Nome remoto");
});
it("importa histórico cujo alimento foi excluído e recalcula edições pelo snapshot", async () => {
  const data = transferFixture();
  data.foods = [];
  data.food_entries[0].food_id = null;
  data.saved_meals = [];
  data.saved_meal_items = [];
  await transfer(data);
  await db.exec(
    "update food_entries set quantity=200,snapshot='{}',nutrition='{}'",
  );
  const row = (
    await db.query<{ food_id: null; calories_recorded: string }>(
      "select food_id,calories_recorded from food_entries",
    )
  ).rows[0];
  expect(row.food_id).toBeNull();
  expect(Number(row.calories_recorded)).toBe(330);
});
it("reverte toda a transferência em caso de snapshot inválido", async () => {
  const data = transferFixture();
  data.food_entries[0].snapshot.protein = -1;
  await fails(data);
  expect((await db.query("select * from foods")).rows).toHaveLength(0);
  expect((await db.query("select * from local_imports")).rows).toHaveLength(0);
});
it("rejeita referências a outro usuário e não expõe o lote a outra conta", async () => {
  const data = transferFixture();
  await transfer(data);
  await asUser(bob);
  await db.exec("select initialize_user()");
  expect((await db.query("select * from local_imports")).rows).toHaveLength(0);
  expect((await db.query("select * from food_entries")).rows).toHaveLength(0);
  await fails(data);
  const alternate = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const result = await transfer(data, alternate);
  expect(result.already_imported).toBe(false);
  expect(
    (await db.query<{ user_id: string }>("select user_id from food_entries"))
      .rows[0].user_id,
  ).toBe(bob);
});
it("uma falha de relacionamento não deixa importação parcial", async () => {
  const data = transferFixture();
  data.food_entries[0].meal_id = crypto.randomUUID();
  await fails(data);
  expect((await db.query("select * from water_logs")).rows).toHaveLength(0);
  expect((await db.query("select * from foods")).rows).toHaveLength(0);
});

it("reimportar exportação da própria conta não duplica registros que já estão na nuvem", async () => {
  await transfer(transferFixture());
  const cloudData = {} as Data;
  for (const table of [
    "foods",
    "meals",
    "food_entries",
    "daily_goals",
    "weight_logs",
    "water_logs",
    "saved_meals",
    "saved_meal_items",
    "profiles",
  ] as const) {
    const result = await db.query<{ records: unknown }>(
      `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) records from ${table} t`,
    );
    (cloudData[table] as unknown) = result.rows[0].records;
  }
  const result = await transfer(
    cloudData,
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  );
  expect(result.food_entries).toBe(0);
  expect(result.foods).toBe(0);
  for (const table of [
    "food_entries",
    "water_logs",
    "saved_meals",
    "saved_meal_items",
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
});
