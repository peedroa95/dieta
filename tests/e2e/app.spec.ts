import { test, expect, type Page } from "@playwright/test";
async function navigate(page: Page, name: string) {
  if (page.viewportSize()!.width < 680)
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Navegação principal", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
async function food(
  page: Page,
  name: string,
  calories = "165",
  protein = "31",
  carbs = "0",
  fat = "3.6",
  unit = "g",
) {
  await page
    .getByRole("button", { name: "Novo alimento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do alimento", { exact: true }).fill(name);
  if (unit !== "g")
    await dialog
      .getByLabel("Unidade de referência", { exact: true })
      .selectOption(unit);
  await dialog.getByLabel("Calorias (kcal)", { exact: true }).fill(calories);
  await dialog.getByLabel("Proteínas (g)", { exact: true }).fill(protein);
  await dialog.getByLabel("Carboidratos (g)", { exact: true }).fill(carbs);
  await dialog.getByLabel("Gorduras (g)", { exact: true }).fill(fat);
  await dialog
    .getByRole("button", { name: "Salvar alimento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}
async function record(
  page: Page,
  name: string,
  quantity: string,
  meal = "Café da manhã",
) {
  await page
    .getByRole("button", { name: "Registrar alimento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await dialog
    .getByLabel("Quantidade consumida", { exact: true })
    .fill(quantity);
  await dialog
    .getByLabel("Refeição", { exact: true })
    .selectOption({ label: meal });
  await dialog
    .getByRole("button", { name: "Adicionar ao diário", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
});
test("cadastro, proporção, refeições, edição, exclusão, histórico e persistência", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await navigate(page, "Meus alimentos");
  await food(page, "Teste A");
  await food(page, "Teste B", "100", "10", "10", "2");
  await food(page, "Teste C", "200", "20", "20", "4");
  await record(page, "Teste A", "150");
  await record(page, "Teste B", "100");
  await record(page, "Teste C", "100", "Almoço");
  await navigate(page, "Diário");
  await expect(page.locator(".day-total")).toContainText("547,5");
  await expect(
    page.locator(".meal-card").filter({
      has: page.getByRole("heading", { name: "Café da manhã", exact: true }),
    }),
  ).toContainText("347,5");
  await page
    .getByRole("button", { name: "Editar registro de Teste A", exact: true })
    .click();
  await page.getByLabel("Quantidade consumida").fill("200");
  await page
    .getByLabel("Refeição", { exact: true })
    .selectOption({ label: "Jantar" });
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".day-total")).toContainText("630");
  await page
    .getByRole("button", { name: "Duplicar registro de Teste B", exact: true })
    .click();
  await expect(page.locator(".day-total")).toContainText("730");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Excluir registro de Teste B", exact: true })
    .first()
    .click();
  await expect(page.locator(".day-total")).toContainText("630");
  await navigate(page, "Meus alimentos");
  await page
    .locator(".food-card")
    .filter({
      has: page.getByRole("heading", { name: "Teste A", exact: true }),
    })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await page.getByLabel("Calorias (kcal)", { exact: true }).fill("999");
  await page
    .getByRole("button", { name: "Salvar alimento", exact: true })
    .click();
  await navigate(page, "Diário");
  await expect(page.locator(".day-total")).toContainText("630");
  await page
    .getByRole("button", { name: "Editar registro de Teste A", exact: true })
    .click();
  await page.getByLabel("Quantidade consumida").fill("300");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".day-total")).toContainText("795");
  await page.reload();
  await expect(page.locator(".calorie-stats")).toContainText("795");
  await navigate(page, "Diário");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Excluir registro de Teste A", exact: true })
    .click();
  await expect(page.locator(".day-total")).toContainText("300");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("favoritos, porções, refeições salvas e quantidades ajustáveis", async ({
  page,
}) => {
  await navigate(page, "Meus alimentos");
  await food(page, "Iogurte teste", "120", "8", "15", "3", "porção");
  await page
    .getByRole("button", { name: "Favoritar Iogurte teste", exact: true })
    .click();
  await navigate(page, "Refeições salvas");
  await page
    .getByRole("button", { name: "Nova combinação", exact: true })
    .click();
  await page
    .getByLabel("Nome da refeição", { exact: true })
    .fill("Minha combinação");
  await page
    .getByLabel("Escolher alimento para combinação")
    .selectOption({ label: "Iogurte teste" });
  await page.getByRole("button", { name: "Incluir", exact: true }).click();
  await page.getByLabel("Quantidade de Iogurte teste").fill("2");
  await page
    .getByRole("button", { name: "Salvar combinação", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Minha combinação" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Usar no diário", exact: true })
    .click();
  await page.getByLabel("Quantidade de Iogurte teste").fill("3");
  await page
    .getByRole("button", { name: "Adicionar refeição", exact: true })
    .click();
  await navigate(page, "Diário");
  await expect(page.locator(".day-total")).toContainText("360");
  await page
    .getByRole("button", { name: "Adicionar alimento", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Favoritos", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /^Iogurte teste/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar janela", exact: true })
    .click();
  await navigate(page, "Meus alimentos");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Excluir Iogurte teste", exact: true })
    .click();
  await navigate(page, "Diário");
  await expect(page.locator(".day-total")).toContainText("360");
});
test("metas, água, peso, relatórios e histórico de datas", async ({ page }) => {
  await page.getByRole("button", { name: "Adicionar 250 ml de água" }).click();
  await expect(page.locator(".water-content")).toContainText("250");
  await page.getByRole("button", { name: "Adicionar 250 ml de água" }).click();
  await expect(page.locator(".water-content")).toContainText("500");
  await navigate(page, "Configurações");
  await page.getByRole("button", { name: "Personalizar minhas metas" }).click();
  await page.getByLabel("Calorias (kcal)", { exact: true }).fill("3000");
  await page.getByLabel("Proteínas (g)", { exact: true }).fill("180");
  await page.getByRole("button", { name: "Salvar metas", exact: true }).click();
  await navigate(page, "Início");
  await expect(page.locator(".calorie-stats")).toContainText("3.000");
  await expect(
    page.getByRole("progressbar", { name: "Proteínas" }),
  ).toHaveAttribute("aria-valuemax", "180");
  await page
    .getByRole("button", { name: "Registrar peso", exact: true })
    .click();
  await page.getByLabel("Peso (kg)", { exact: true }).fill("80.5");
  await page.getByRole("button", { name: "Salvar peso", exact: true }).click();
  await expect(page.locator(".weight-content")).toContainText("80,5");
  await navigate(page, "Evolução do peso");
  await expect(page.locator(".weight-row")).toContainText("80,5");
  await expect(
    page.getByRole("img", { name: "Evolução do peso corporal" }),
  ).toBeVisible();
  await navigate(page, "Relatórios");
  await expect(
    page.getByRole("heading", { name: "Relatórios.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Peso no período do relatório" }),
  ).toBeVisible();
  await navigate(page, "Diário");
  await page.getByRole("button", { name: "Dia anterior", exact: true }).click();
  await expect(page.locator(".day-total")).toContainText("0");
  await page.getByRole("button", { name: "Dia seguinte", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("busca sem acentos, campos opcionais, duplicação e alerta de alimento repetido", async ({
  page,
}) => {
  await navigate(page, "Meus alimentos");
  await food(page, "Feijão preto", "100", "5", "15", "1");
  await page.getByLabel("Pesquisar alimentos", { exact: true }).fill("FEIJAO");
  await expect(
    page.getByRole("heading", { name: "Feijão preto", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar alimentos", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Duplicar Feijão preto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feijão preto (cópia)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Novo alimento", exact: true })
    .click();
  await page
    .getByLabel("Nome do alimento", { exact: true })
    .fill("feijao preto");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Salvar alimento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByLabel("Filtrar categoria").selectOption("Bebidas");
  await expect(
    page.getByRole("heading", { name: "Nenhum resultado por aqui" }),
  ).toBeVisible();
});
test("perfil e sugestão de metas exigem aceite explícito", async ({ page }) => {
  await navigate(page, "Meu perfil");
  await page.getByLabel("Como podemos chamar você?").fill("Pessoa Teste");
  await page.getByLabel("Idade", { exact: true }).fill("30");
  await page
    .getByLabel("Sexo para a estimativa metabólica")
    .selectOption("male");
  await page.getByLabel("Altura (cm)").fill("180");
  await page.getByLabel("Peso de referência (kg)").fill("80");
  await page
    .getByLabel("Nível de atividade (incluindo treinos)")
    .selectOption("1.55");
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Perfil atualizado");
  await page
    .getByRole("button", { name: "Estimar metas", exact: true })
    .click();
  await expect(page.locator(".suggestion-box")).toContainText("1.780");
  await expect(page.locator(".suggestion-box")).toContainText("2.759");
  await expect(page.getByLabel("Calorias (kcal)", { exact: true })).toHaveValue(
    "2000",
  );
  await page.getByRole("button", { name: "Usar valores sugeridos" }).click();
  await expect(page.getByLabel("Calorias (kcal)", { exact: true })).toHaveValue(
    "2759",
  );
  await page.getByRole("button", { name: "Salvar metas", exact: true }).click();
  await navigate(page, "Início");
  await expect(page.locator(".calorie-stats")).toContainText("2.759");
});

test("abre sem login e preserva os dados do modo local anterior", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", {
      name: /Entrar|Criar conta|Conectar minha conta|Sair da conta/,
    }),
  ).toHaveCount(0);
  await navigate(page, "Meus alimentos");
  await food(page, "Meu cadastro anterior");
  await page.evaluate(() => {
    localStorage.setItem("nutria-mode", "demo");
    const data = JSON.parse(localStorage.getItem("nutria-demo-v1")!);
    data.foods.forEach((f: Record<string, unknown>) => {
      delete f.barcode;
      delete f.source_url;
      delete f.unknown_nutrients;
    });
    localStorage.setItem("nutria-demo-v1", JSON.stringify(data));
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Um dia de cada vez." }),
  ).toBeVisible();
  await navigate(page, "Meus alimentos");
  await expect(
    page.getByRole("heading", { name: "Meu cadastro anterior", exact: true }),
  ).toBeVisible();
});

test("consulta EAN, exige conferência da unidade e salva o alimento com fonte e nutrientes", async ({
  page,
}) => {
  const code = "3017620422003";
  let requests = 0;
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    async (route) => {
      requests++;
      await route.fulfill({
        json: {
          status: 1,
          code,
          product: {
            product_name_pt: "Produto EAN de teste",
            brands: "Marca teste",
            nutriments: {
              "energy-kcal_100g": 120,
              proteins_100g: 8,
              carbohydrates_100g: 15,
              fat_100g: 3,
              sodium_100g: 0.12,
            },
          },
        },
      });
    },
  );
  await navigate(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("EAN / código de barras").fill(code);
  await d.getByRole("button", { name: "Buscar produto", exact: true }).click();
  await expect(d.locator(".barcode-result")).toContainText(
    "Produto EAN de teste",
  );
  await expect(
    d.getByRole("button", { name: "Usar dados no cadastro" }),
  ).toBeDisabled();
  await d.getByLabel("Confirme a referência no rótulo").selectOption("g");
  await d.getByRole("button", { name: "Usar dados no cadastro" }).click();
  await expect(d.getByLabel("Calorias (kcal)", { exact: true })).toHaveValue(
    "120",
  );
  await d.getByText("Outros nutrientes e observações").click();
  await expect(d.getByLabel("Sódio (mg)", { exact: true })).toHaveValue("120");
  await expect(d.getByLabel("Fibras (g)", { exact: true })).toHaveValue("");
  await d.getByRole("button", { name: "Salvar alimento", exact: true }).click();
  await expect(d).toBeHidden();
  await expect(page.locator(".food-card")).toContainText(code);
  await page.reload();
  await navigate(page, "Meus alimentos");
  await page.getByLabel("Pesquisar alimentos", { exact: true }).fill(code);
  await expect(
    page.getByRole("heading", { name: "Produto EAN de teste", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await page
    .getByRole("button", { name: "Registrar alimento", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Produto EAN de teste/ })
    .click();
  await page.getByLabel("Quantidade consumida").fill("150");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Adicionar ao diário", exact: true })
    .click();
  await navigate(page, "Diário");
  await expect(page.locator(".day-total")).toContainText("180");
  // The same EAN must be found locally rather than creating another product.
  await navigate(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  await page.getByLabel("EAN / código de barras").fill(code);
  await page
    .getByRole("button", { name: "Buscar produto", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("já está cadastrado");
  expect(requests).toBe(1);
});

test("EAN não encontrado permite cadastrar manualmente; código inválido não consulta a rede", async ({
  page,
}) => {
  let requests = 0;
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    async (route) => {
      requests++;
      await route.fulfill({ status: 404, json: { status: 0 } });
    },
  );
  await navigate(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("EAN / código de barras").fill("3017620422004");
  await d.getByRole("button", { name: "Buscar produto", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("inválido");
  expect(requests).toBe(0);
  await d.getByLabel("EAN / código de barras").fill("3017620422003");
  await d.getByRole("button", { name: "Buscar produto", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("não encontrado");
  await d
    .getByLabel("Nome do alimento", { exact: true })
    .fill("Cadastro manual EAN");
  await d.getByLabel("Calorias (kcal)", { exact: true }).fill("100");
  await d.getByRole("button", { name: "Salvar alimento", exact: true }).click();
  await expect(d).toBeHidden();
  await expect(page.locator(".food-card")).toContainText("3017620422003");
  expect(requests).toBe(1);
});

test("nutrientes essenciais ausentes exigem preenchimento antes de salvar", async ({
  page,
}) => {
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    (route) =>
      route.fulfill({
        json: {
          status: 1,
          code: "5901234123457",
          product: {
            product_name: "Produto incompleto de teste",
            nutriments: { proteins_100g: 4 },
          },
        },
      }),
  );
  await navigate(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("EAN / código de barras").fill("5901234123457");
  await d.getByRole("button", { name: "Buscar produto", exact: true }).click();
  await expect(d.locator(".barcode-result")).toContainText("Não informado");
  await d.getByLabel("Confirme a referência no rótulo").selectOption("ml");
  await d.getByRole("button", { name: "Usar dados no cadastro" }).click();
  await expect(d.getByLabel("Calorias (kcal)", { exact: true })).toHaveValue(
    "",
  );
  await expect(d.getByLabel("Proteínas (g)", { exact: true })).toHaveValue("4");
  await d.getByRole("button", { name: "Salvar alimento", exact: true }).click();
  await expect(d).toBeVisible();
  await d.getByLabel("Calorias (kcal)", { exact: true }).fill("90");
  await d.getByLabel("Carboidratos (g)", { exact: true }).fill("10");
  await d.getByLabel("Gorduras (g)", { exact: true }).fill("2");
  await d.getByRole("button", { name: "Salvar alimento", exact: true }).click();
  await expect(d).toBeHidden();
  await expect(page.locator(".food-card")).toContainText("100 ml");
});

test("erro de rede na consulta mantém cadastro manual disponível", async ({
  page,
}) => {
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    (route) => route.abort("failed"),
  );
  await navigate(page, "Meus alimentos");
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("EAN / código de barras").fill("3017620422003");
  await d.getByRole("button", { name: "Buscar produto", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("Verifique a conexão");
  await expect(
    d.getByLabel("Nome do alimento", { exact: true }),
  ).toBeEditable();
  await expect(
    d.getByRole("button", { name: "Salvar alimento", exact: true }),
  ).toBeEnabled();
});
