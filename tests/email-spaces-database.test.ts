import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { transferFixture } from "./fixtures";
const alice = "11111111-1111-4111-8111-111111111111";
const desktop = "22222222-2222-4222-8222-222222222222";
const phone = "33333333-3333-4333-8333-333333333333";
const bob = "44444444-4444-4444-8444-444444444444";
const db = new PGlite();
const asUser = async (id: string) => {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
};
const enter = (email: string) =>
  db.query<{ account: { id: string; email: string } }>(
    "select enter_email_space($1) as account",
    [email],
  );
beforeAll(async () => {
  await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
  insert into auth.users values('${alice}','alice@example.com'),('${desktop}',null),('${phone}',null),('${bob}',null);`);
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
  await asUser(alice);
  await db.exec(
    `select initialize_user('Alice');insert into foods(user_id,name,unit,reference,calories,protein,carbs,fat) values('${alice}','Alimento antigo','g',100,100,1,2,3);`,
  );
  await db.exec("reset role");
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610210002_email_spaces.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("preserva a conta antiga e liga outra sessão ao proprietário correto", async () => {
  await asUser(alice);
  expect(
    (
      await db.query<{ account: { id: string } }>(
        "select get_email_space() as account",
      )
    ).rows[0].account.id,
  ).toBe(alice);
  await asUser(desktop);
  expect(
    (
      await db.query<{ account: unknown }>(
        "select get_email_space() as account",
      )
    ).rows[0].account,
  ).toBeNull();
  expect((await enter("  ALICE@example.com  ")).rows[0].account).toEqual({
    id: alice,
    email: "alice@example.com",
  });
  expect(
    (await db.query<{ name: string }>("select name from foods")).rows.map(
      (r) => r.name,
    ),
  ).toEqual(["Alimento antigo"]);
});
it("mesmo e-mail em outro aparelho acessa e grava no mesmo espaço sem confirmação", async () => {
  await asUser(phone);
  expect((await enter("alice@example.com")).rows[0].account.id).toBe(alice);
  await db.exec(
    `insert into water_logs(user_id,date,amount) values('${alice}','2026-10-20',350);select initialize_user('');`,
  );
  await asUser(desktop);
  expect(
    (await db.query<{ amount: string }>("select amount from water_logs"))
      .rows[0].amount,
  ).toBe("350");
  expect(
    (await db.query<{ n: number }>("select count(*)::integer as n from meals"))
      .rows[0].n,
  ).toBe(4);
});
it("outro e-mail começa separado e não consegue gravar no proprietário anterior", async () => {
  await asUser(bob);
  expect((await enter("bob@example.com")).rows[0].account.id).toBe(bob);
  await db.exec("select initialize_user('Bob')");
  expect((await db.query("select * from foods")).rows).toHaveLength(0);
  await expect(
    db.exec(
      `insert into water_logs(user_id,date,amount) values('${alice}','2026-10-20',200)`,
    ),
  ).rejects.toThrow(/row-level security/);
});
it("sessão vinculada não troca de endereço por alteração direta no cadastro", async () => {
  await asUser(desktop);
  await expect(enter("bob@example.com")).rejects.toThrow(
    "Saia do espaço atual",
  );
  await expect(db.query("select * from email_spaces")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    db.exec(`update email_space_sessions set email='bob@example.com'`),
  ).rejects.toThrow(/permission denied/);
  await expect(enter("email-invalido")).rejects.toThrow("e-mail válido");
});
it("salva receitas e transfere histórico pelo proprietário, não pelo id do aparelho", async () => {
  await asUser(phone);
  const food = (await db.query<{ id: string }>("select id from foods limit 1"))
    .rows[0].id;
  await db.query("select save_recipe($1,'Receita do celular',$2::jsonb)", [
    "55555555-5555-4555-8555-555555555555",
    JSON.stringify([{ food_id: food, quantity: 100, unit: "g" }]),
  ]);
  expect(
    (await db.query<{ user_id: string }>("select user_id from saved_meals"))
      .rows[0].user_id,
  ).toBe(alice);
  const params = [
    JSON.stringify(transferFixture()),
    "66666666-6666-4666-8666-666666666666",
  ];
  const result = await db.query<{ result: { already_imported: boolean } }>(
    "select transfer_local_data($1::jsonb,$2::uuid) as result",
    params,
  );
  expect(result.rows[0].result.already_imported).toBe(false);
  await asUser(desktop);
  expect(
    (
      await db.query<{ result: { already_imported: boolean } }>(
        "select transfer_local_data($1::jsonb,$2::uuid) as result",
        params,
      )
    ).rows[0].result.already_imported,
  ).toBe(true);
  expect(
    (
      await db.query<{ user_id: string }>(
        "select distinct user_id from food_entries",
      )
    ).rows[0].user_id,
  ).toBe(alice);
});
it("não permite listar e-mails nem chamar as funções sem sessão", async () => {
  await db.exec(
    "reset role;set role anon;select set_config('request.jwt.claim.sub','',false);",
  );
  await expect(enter("alice@example.com")).rejects.toThrow(/permission denied/);
  await expect(db.query("select * from email_spaces")).rejects.toThrow(
    /permission denied/,
  );
  await db.exec("reset role");
});
