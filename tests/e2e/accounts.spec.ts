import { test, expect } from "@playwright/test";
import { MockCloud, alice, bob, enter, nav, createFood } from "./mock-cloud";
import { transferFixture } from "../fixtures";

test("envia link de acesso sem senha e abre a sessão do e-mail", async ({
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
  await page.getByLabel("Seu e-mail", { exact: true }).fill(alice.email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu e-mail" }),
  ).toBeVisible();
  expect(cloud.sent).toEqual([alice.email]);
  await expect(
    page.getByRole("button", { name: /Reenviar em/ }),
  ).toBeDisabled();
  await enter(page, alice);
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await nav(page, "Configurações");
  await expect(page.locator(".account-email")).toContainText(alice.email);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
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

test("links expirados e limite de envio exibem mensagem clara", async ({
  page,
  context,
}) => {
  const cloud = new MockCloud();
  cloud.otpFailure = true;
  await cloud.attach(context);
  await page.goto("/#error=access_denied&error_code=otp_expired");
  await expect(page.getByRole("alert")).toContainText("expirou");
  await page.getByLabel("Seu e-mail", { exact: true }).fill(alice.email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("alert")).toContainText("Limite de envio");
  await expect(
    page.getByRole("button", { name: "Enviar link de acesso" }),
  ).toBeEnabled();
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
