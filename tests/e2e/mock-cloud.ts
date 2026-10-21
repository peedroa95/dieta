import type { BrowserContext, Page, Route } from "@playwright/test";
import {
  emptyData,
  calculate,
  type Data,
  type Row,
  type Table,
} from "../../src/domain";
export const alice = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "alice@example.com",
};
export const bob = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "bob@example.com",
};
export type Person = typeof alice;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "X-Supabase-Api-Version",
  "x-supabase-api-version": "2024-01-01",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
export function session(person: Person, anonymous = false) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const jwt =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: person.id,
        email: person.email,
        role: "authenticated",
        aud: "authenticated",
        exp: expires,
        is_anonymous: anonymous,
      }),
    ).toString("base64url") +
    ".test-signature";
  return {
    access_token: jwt,
    refresh_token: "test-refresh-" + person.id,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expires,
    user: {
      ...person,
      email: anonymous ? undefined : person.email,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: anonymous,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: "2026-10-20T12:00:00Z",
    },
  };
}
export class MockCloud {
  data = new Map<string, Data>();
  sent: string[] = [];
  entered: string[] = [];
  signupFailure = false;
  migrationFailure = false;
  signups = 0;
  guests = new Set<string>();
  memberships = new Map<string, Person>();
  spaces = new Map<string, Person>([
    [alice.email, alice],
    [bob.email, bob],
  ]);
  readFailure = false;
  imports = 0;
  state(person: Person) {
    if (!this.data.has(person.id)) {
      const d = emptyData();
      d.profiles = [
        {
          id: person.id,
          user_id: person.id,
          name: "",
          age: null,
          sex: "",
          height: null,
          body_weight: null,
          body_fat: null,
          activity: 1.2,
          training: 0,
          objective: "maintain",
          timezone: "America/Fortaleza",
        },
      ];
      d.meals = ["Café da manhã", "Almoço", "Lanche", "Jantar"].map(
        (name, sort_order) => ({
          id: crypto.randomUUID(),
          user_id: person.id,
          name,
          sort_order,
        }),
      );
      this.data.set(person.id, d);
    }
    return this.data.get(person.id)!;
  }
  async attach(context: BrowserContext) {
    await context.route("https://nutria-auth-test.supabase.co/**", (route) =>
      this.handle(route),
    );
  }
  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const reply = (status: number, json: unknown) =>
      route.fulfill({ status, json, headers: cors });
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    let uid = "";
    try {
      const token =
        request.headers().authorization?.replace(/^Bearer /i, "") || "";
      uid = JSON.parse(
        Buffer.from(token.split(".")[1] || "", "base64url").toString(),
      ).sub;
    } catch {
      /* Public auth endpoints have no user yet. */
    }
    const person =
      this.memberships.get(uid) ||
      (uid === alice.id ? alice : uid === bob.id ? bob : null);
    if (url.pathname === "/auth/v1/signup") {
      this.signups++;
      if (this.signupFailure)
        return reply(422, {
          code: "anonymous_provider_disabled",
          message: "Anonymous sign-ins disabled",
        });
      const guest = { id: crypto.randomUUID(), email: "" };
      this.guests.add(guest.id);
      return reply(200, session(guest, true));
    }
    if (url.pathname === "/auth/v1/otp") {
      this.sent.push(request.postDataJSON().email);
      return reply(400, { message: "Email links are not part of this flow" });
    }
    if (url.pathname === "/rest/v1/rpc/get_email_space") {
      if (this.migrationFailure)
        return reply(404, { code: "PGRST202", message: "Missing RPC" });
      if (!person && !this.guests.has(uid))
        return reply(401, { message: "Authentication required" });
      return reply(200, person);
    }
    if (url.pathname === "/rest/v1/rpc/enter_email_space") {
      if (this.migrationFailure)
        return reply(404, { code: "PGRST202", message: "Missing RPC" });
      if (!person && !this.guests.has(uid))
        return reply(401, { message: "Authentication required" });
      const email = request.postDataJSON().address;
      let target = this.spaces.get(email);
      if (!target) {
        target = { id: uid, email };
        this.spaces.set(email, target);
      }
      this.entered.push(email);
      this.memberships.set(uid, target);
      return reply(200, target);
    }
    if (url.pathname === "/auth/v1/user")
      return person
        ? reply(200, session(person).user)
        : this.guests.has(uid)
          ? reply(200, session({ id: uid, email: "" }, true).user)
          : reply(401, { message: "Invalid test identity" });
    if (url.pathname === "/auth/v1/logout") return reply(200, {});
    if (!person) return reply(401, { message: "Authentication required" });
    const data = this.state(person);
    if (url.pathname.endsWith("/rpc/initialize_user")) return reply(200, null);
    if (url.pathname.endsWith("/rpc/transfer_local_data")) {
      const body = request.postDataJSON();
      const key = person.id + ":" + body.import_id;
      const already = this.imported.has(key);
      if (!already) {
        this.imports++;
        this.imported.add(key);
        const local = body.payload as Data;
        for (const f of local.foods)
          data.foods.push({
            ...f,
            id: crypto.randomUUID(),
            user_id: person.id,
          });
      }
      return reply(200, {
        already_imported: already,
        foods: already ? 0 : body.payload.foods.length,
        food_entries: 0,
        meals: 0,
        water_logs: 0,
        weight_logs: 0,
        daily_goals: 0,
        saved_meals: 0,
        saved_meal_items: 0,
      });
    }
    const table = url.pathname.split("/").at(-1) as Table;
    if (!(table in data)) return reply(404, { message: "Unknown table" });
    if (request.method() === "GET")
      return this.readFailure
        ? reply(503, { message: "Temporary test network failure" })
        : reply(200, data[table]);
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      const rows = (Array.isArray(body) ? body : [body]) as Row[];
      if (rows.some((r) => r.user_id !== person.id))
        return reply(403, { message: "RLS denied" });
      for (const row of rows) {
        const array = data[table] as Row[];
        const index = array.findIndex((r) => r.id === row.id);
        if (index < 0) array.push(structuredClone(row));
        else array[index] = structuredClone(row);
      }
      if (table === "food_entries")
        data.food_entries = data.food_entries.map((e) => ({
          ...e,
          nutrition: calculate(e.snapshot, e.quantity, e.unit),
        }));
      return reply(201, rows);
    }
    return reply(200, {});
  }
  private imported = new Set<string>();
}
export async function enter(page: Page, person: Person) {
  await page.goto("/");
  await page.getByLabel("Seu e-mail", { exact: true }).fill(person.email);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
}
export async function nav(page: Page, name: string) {
  if (page.viewportSize()!.width < 680)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Navegação principal", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
export async function createFood(page: Page, name: string) {
  await nav(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Novo alimento", exact: true })
    .click();
  await page.getByLabel("Nome do alimento", { exact: true }).fill(name);
  await page.getByLabel("Calorias (kcal)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Salvar alimento", exact: true })
    .click();
}
