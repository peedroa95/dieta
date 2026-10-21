import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("instala todas as tabelas e RLS pelo arquivo único de primeira instalação", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/primeira_instalacao.sql", import.meta.url),
        "utf8",
      ),
    );
    const tables = (
      await db.query<{ tablename: string; rowsecurity: boolean }>(
        "select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename",
      )
    ).rows;
    expect(tables.map((t) => t.tablename)).toEqual([
      "daily_goals",
      "email_space_sessions",
      "email_spaces",
      "food_entries",
      "foods",
      "local_imports",
      "meals",
      "profiles",
      "saved_meal_items",
      "saved_meals",
      "water_logs",
      "weight_logs",
    ]);
    expect(tables.every((t) => t.rowsecurity)).toBe(true);
  } finally {
    await db.close();
  }
});
