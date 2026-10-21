import { test, expect } from "@playwright/test";
import { MockCloud, alice, bob, enter, nav, createFood } from "./mock-cloud";
import { transferFixture } from "../fixtures";

test("entra só com e-mail e mantém a sessão sem enviar mensagem ou solicitar senha", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Seu bem-estar, conectado" }),
  ).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/quem souber seu e-mail/)).toBeVisible();
  await page
    .getByLabel("Seu e-mail", { exact: true })
    .fill("ALICE@example.com");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  expect(cloud.entered).toEqual([alice.email]);
  expect(cloud.sent).toEqual([]);
  expect(cloud.signups).toBe(1);
  await nav(page, "Configurações");
  await expect(page.locator(".account-email")).toContainText(alice.email);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  expect(cloud.signups).toBe(1);
  expect(page.url()).not.toContain("access_token");
});

test("mesma conta lê e cadastra em dois aparelhos; atualização ao voltar ao app", async ({
  browser,
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await cloud.attach(other);
  const mobile = await other.newPage();
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await createFood(page, "Cadastrado no computador");
  await expect(
    page.getByRole("heading", {
      name: "Cadastrado no computador",
      exact: true,
    }),
  ).toBeVisible();
  await enter(mobile, alice);
  await expect(
    mobile.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await nav(mobile, "Meus alimentos");
  await expect(
    mobile.getByRole("heading", {
      name: "Cadastrado no computador",
      exact: true,
    }),
  ).toBeVisible();
  await createFood(mobile, "Cadastrado no celular");
  await expect(
    mobile.getByRole("heading", { name: "Cadastrado no celular", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Cadastrado no celular", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("contas separadas e saída sem dados da conta anterior na tela", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await createFood(page, "Somente Alice");
  await expect(
    page.getByRole("heading", { name: "Somente Alice", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu bem-estar, conectado" }),
  ).toBeVisible();
  await expect(page.getByText("Somente Alice", { exact: true })).toHaveCount(0);
  await enter(page, bob);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await nav(page, "Meus alimentos");
  await expect(
    page.getByRole("heading", { name: "Somente Alice", exact: true }),
  ).toHaveCount(0);
  await createFood(page, "Somente Bob");
  await expect(
    page.getByRole("heading", { name: "Somente Bob", exact: true }),
  ).toBeVisible();
  expect(cloud.state(alice).foods.map((f) => f.name)).toEqual([
    "Somente Alice",
  ]);
  expect(cloud.state(bob).foods.map((f) => f.name)).toEqual(["Somente Bob"]);
});

test("confirma transferência local para a conta e impede duplicação", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  const local = transferFixture();
  await page.addInitScript(
    (data) => localStorage.setItem("nutria-demo-v1", JSON.stringify(data)),
    local,
  );
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await nav(page, "Configurações");
  await page.getByRole("button", { name: "Transferir dados locais" }).click();
  await expect(page.getByRole("dialog")).toContainText(alice.email);
  expect(cloud.imports).toBe(0);
  await page.getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(cloud.imports).toBe(1);
  expect(
    await page.evaluate(() => !!localStorage.getItem("nutria-demo-v1")),
  ).toBe(true);
  await page.getByRole("button", { name: "Transferir dados locais" }).click();
  await page.getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".settings-card .success")).toContainText(
    "Nenhum registro foi duplicado",
  );
  expect(cloud.imports).toBe(1);
});

test("arquivo exportado de outro navegador pode ser transferido", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await nav(page, "Configurações");
  const backup = {
    ...transferFixture(),
    source_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };
  await page
    .getByLabel("Importar arquivo JSON", { exact: true })
    .setInputFiles({
      name: "meus-registros.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.getByRole("dialog")).toContainText("meus-registros.json");
  await page.getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(cloud.imports).toBe(1);
});

test("informa como habilitar o acesso direto quando as sessões anônimas estão desativadas", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  cloud.signupFailure = true;
  await cloud.attach(context);
  await page.goto("/");
  await page.getByLabel("Seu e-mail", { exact: true }).fill(alice.email);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("alert")).toContainText("Anonymous Sign-Ins");
  expect(cloud.entered).toHaveLength(0);
  expect(cloud.sent).toHaveLength(0);
  cloud.signupFailure = false;
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
});

test("migração pendente não cria dados locais e permite tentar de novo na mesma sessão", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  cloud.migrationFailure = true;
  await cloud.attach(context);
  await page.goto("/");
  await page.getByLabel("Seu e-mail", { exact: true }).fill(alice.email);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "202610210002_email_spaces.sql",
  );
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("nutria-demo-v1")),
  ).toBeNull();
  cloud.migrationFailure = false;
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  expect(cloud.signups).toBe(1);
  expect(cloud.sent).toHaveLength(0);
});

test("falha na atualização mantém os registros e permite reconectar", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  await cloud.attach(context);
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await createFood(page, "Registro preservado");
  await expect(
    page.getByRole("heading", { name: "Registro preservado", exact: true }),
  ).toBeVisible();
  await nav(page, "Configurações");
  cloud.readFailure = true;
  await page
    .getByRole("button", { name: "Atualizar dados", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível atualizar",
    { timeout: 15000 },
  );
  cloud.readFailure = false;
  await page
    .getByRole("button", { name: "Atualizar dados", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await nav(page, "Meus alimentos");
  await expect(
    page.getByRole("heading", { name: "Registro preservado", exact: true }),
  ).toBeVisible();
});
