import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const foodId = "33333333-3333-4333-8333-333333333333",
  entryId = "44444444-4444-4444-8444-444444444444";
let mealId: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${alice}'),('${bob}');`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610200001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610200002_food_barcodes.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610210001_account_transfers.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await asUser(alice);
  await db.exec("select initialize_user();select initialize_user();");
  const rows = await db.query<{ id: string }>(
    "select id from meals order by sort_order",
  );
  mealId = rows.rows[0].id;
  await db.exec(
    `insert into foods(id,user_id,name,unit,reference,calories,protein,carbs,fat) values('${foodId}','${alice}','Alimento de teste','g',100,165,31,0,3.6);`,
  );
  await db.exec(`
    insert into water_logs(user_id,date,amount) values('${alice}','2026-10-20',250);
    insert into weight_logs(user_id,date,weight) values('${alice}','2026-10-20',80);
    insert into daily_goals(user_id,date,calories,protein,carbs,fat,water)
      values('${alice}','2026-10-20',2000,100,250,67,2000);
    select save_recipe('66666666-6666-4666-8666-666666666666','Receita da Alice',
      '[{"food_id":"${foodId}","quantity":100,"unit":"g"}]');
  `);
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("Migração PostgreSQL e isolamento RLS", () => {
  it("inicializa apenas quatro refeições e um perfil de forma repetível", async () => {
    expect((await db.query("select * from meals")).rows).toHaveLength(4);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
  });
  it("calcula no banco ignorando nutrientes falsificados pelo cliente", async () => {
    await db.exec(
      `insert into food_entries(id,user_id,food_id,meal_id,date,quantity,unit,snapshot,nutrition) values('${entryId}','${alice}','${foodId}','${mealId}','2026-10-20',150,'g','{}','{"calories":9999}');`,
    );
    const { rows } = await db.query<{
      calories_recorded: string;
      fat_recorded: string;
    }>("select calories_recorded,fat_recorded from food_entries");
    expect(Number(rows[0].calories_recorded)).toBe(247.5);
    expect(Number(rows[0].fat_recorded)).toBe(5.4);
  });
  it("recusa valores negativos e unidades incompatíveis", async () => {
    await expect(
      db.exec(`update foods set protein=-1 where id='${foodId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update food_entries set unit='ml' where id='${entryId}'`),
    ).rejects.toThrow();
  });
  it("preserva valores históricos e recalcula com snapshot ao editar", async () => {
    await db.exec(
      `update foods set calories=999 where id='${foodId}';update food_entries set quantity=200,snapshot='{}',nutrition='{}' where id='${entryId}';`,
    );
    const { rows } = await db.query<{
      calories_recorded: string;
      snapshot: { calories: number };
    }>("select calories_recorded,snapshot from food_entries");
    expect(Number(rows[0].calories_recorded)).toBe(330);
    expect(rows[0].snapshot.calories).toBe(165);
  });
  it("isola SELECT, INSERT, UPDATE, DELETE e referências cruzadas entre usuários", async () => {
    for (const table of [
      "foods",
      "food_entries",
      "weight_logs",
      "water_logs",
      "daily_goals",
      "saved_meals",
      "saved_meal_items",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
    await asUser(bob);
    await db.exec("select initialize_user();");
    for (const table of [
      "foods",
      "food_entries",
      "weight_logs",
      "water_logs",
      "daily_goals",
      "saved_meals",
      "saved_meal_items",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect((await db.query(`select * from profiles`)).rows).toHaveLength(1);
    expect((await db.query(`select * from meals`)).rows).toHaveLength(4);
    expect(
      (
        await db.query(
          `update foods set name='Invadido' where id='${foodId}' returning *`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query(`delete from foods where id='${foodId}' returning *`))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into water_logs(user_id,date,amount) values('${alice}','2026-10-20',250)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into food_entries(user_id,food_id,meal_id,date,quantity,unit,snapshot,nutrition) values('${bob}','${foodId}','${mealId}','2026-10-20',100,'g','{}','{}')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `select save_recipe('55555555-5555-4555-8555-555555555555','Invasão','[{"food_id":"${foodId}","quantity":100,"unit":"g"}]')`,
      ),
    ).rejects.toThrow();
    expect((await db.query("select * from saved_meals")).rows).toHaveLength(0);
    await asUser(alice);
    expect(
      (await db.query<{ name: string }>("select name from foods")).rows[0].name,
    ).toBe("Alimento de teste");
  });
  it("recusa uma refeição de outro usuário mesmo com alimento próprio", async () => {
    await asUser(bob);
    const bobMeal = (
      await db.query<{ id: string }>("select id from meals limit 1")
    ).rows[0].id;
    await asUser(alice);
    await expect(
      db.exec(
        `update food_entries set meal_id='${bobMeal}' where id='${entryId}'`,
      ),
    ).rejects.toThrow();
  });
  it("recusa acesso anônimo às tabelas", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from foods")).rejects.toThrow();
    await asUser(alice);
  });
  it("valida EAN no banco e bloqueia duplicação por usuário, incluindo UPC equivalente", async () => {
    await db.exec(
      `update foods set barcode='036000291452' where id='${foodId}'`,
    );
    await expect(
      db.exec(`update foods set barcode='036000291453' where id='${foodId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into foods(user_id,name,unit,reference,calories,protein,carbs,fat,barcode) values('${alice}','Duplicado','g',100,1,1,1,1,'0036000291452')`,
      ),
    ).rejects.toThrow();
    await asUser(bob);
    await db.exec(
      `insert into foods(user_id,name,unit,reference,calories,protein,carbs,fat,barcode) values('${bob}','Mesmo produto, outro usuário','g',100,1,1,1,1,'036000291452')`,
    );
    await db.exec(`delete from foods where user_id='${bob}'`);
    await asUser(alice);
  });
  it("exclusão do cadastro mantém o histórico e seus nutrientes", async () => {
    await db.exec(`delete from foods where id='${foodId}'`);
    const { rows } = await db.query<{
      food_id: null;
      calories_recorded: string;
    }>("select food_id,calories_recorded from food_entries");
    expect(rows[0].food_id).toBeNull();
    expect(Number(rows[0].calories_recorded)).toBe(330);
  });
});
