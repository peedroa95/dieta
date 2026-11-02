import BarcodeLookup from "./BarcodeLookup";
import {
  barcodeValue,
  assertUniqueBarcode,
  type ProductLookup,
} from "./barcodes";
import { useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Star,
  Pencil,
  Copy,
  Trash2,
  ArrowUpRight,
  Barcode,
  FileJson,
} from "lucide-react";
import { useStore } from "./store";
import { Modal, Empty, NutrientPills } from "./ui";
import {
  categories,
  nutrients,
  labels,
  zero,
  normalize,
  searchFoods,
  format,
  calculate,
  type Food,
  type Unit,
  type Nutrient,
} from "./domain";
export function FoodForm({
  food,
  onClose,
  barcodeFocus = false,
}: {
  food?: Food;
  barcodeFocus?: boolean;
  onClose: () => void;
}) {
  const { data, userId, run, put, busy } = useStore();
  const [value, setValue] = useState<Food>(
    food || {
      id: crypto.randomUUID(),
      user_id: userId,
      name: "",
      brand: "",
      category: "Outros",
      unit: "g",
      reference: 100,
      portion_weight: null,
      notes: "",
      favorite: false,
      barcode: null,
      source_url: null,
      unknown_nutrients: [],
      ...zero(),
    },
  );
  const [error, setError] = useState("");
  const field = (key: keyof Food, v: unknown) =>
    setValue((old) => ({ ...old, [key]: v }));
  const [imported, setImported] = useState(false);
  function applyProduct(product: ProductLookup, unit: "g" | "ml") {
    if (
      (value.name.trim() || value.source_url) &&
      !window.confirm("Substituir os dados atuais pelos dados deste produto?")
    )
      return;
    setValue((old) => ({
      ...old,
      name: product.name,
      brand: product.brand,
      barcode: product.barcode,
      source_url: product.source_url,
      unit,
      reference: 100,
      portion_weight: null,
      ...Object.fromEntries(
        nutrients.map((n) => [
          n,
          product.nutrition[n] ?? (nutrients.indexOf(n) < 4 ? NaN : 0),
        ]),
      ),
      unknown_nutrients: product.missing.filter(
        (n) => nutrients.indexOf(n) >= 4,
      ),
      notes: [old.notes, "Fonte: Open Food Facts — " + product.source_url]
        .filter(Boolean)
        .join("\n"),
    }));
    setImported(true);
    setError("");
  }
  function changeNutrient(n: Nutrient, input: string) {
    const optional = nutrients.indexOf(n) >= 4;
    setValue((old) => ({
      ...old,
      [n]: input === "" ? (optional ? 0 : NaN) : Number(input),
      unknown_nutrients:
        optional && input === ""
          ? [...new Set([...(old.unknown_nutrients || []), n])]
          : (old.unknown_nutrients || []).filter((key) => key !== n),
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      calculate(value, value.reference, value.unit);
      const barcode = value.barcode?.trim()
        ? barcodeValue(value.barcode)
        : null;
      assertUniqueBarcode({ ...value, barcode }, data.foods);
      if (!value.name.trim()) throw new Error("Informe o nome do alimento.");
      const duplicate = data.foods.find(
        (f) =>
          f.id !== value.id &&
          normalize(f.name) === normalize(value.name) &&
          normalize(f.brand) === normalize(value.brand),
      );
      if (
        duplicate &&
        !window.confirm(
          `“${duplicate.name}” já está cadastrado. Deseja manter outro cadastro?`,
        )
      )
        return;
      if (
        await run(
          () =>
            put("foods", [
              {
                ...value,
                barcode,
                name: value.name.trim(),
                brand: value.brand.trim(),
              },
            ]),
          "Alimento salvo.",
        )
      )
        onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={food ? "Editar alimento" : "Novo alimento"}
      subtitle="Use os valores do rótulo ou de uma fonte identificada."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="form">
        <BarcodeLookup
          value={value.barcode || ""}
          onChange={(barcode) =>
            setValue((old) => ({
              ...old,
              barcode,
              source_url: barcode === old.barcode ? old.source_url : null,
            }))
          }
          onApply={applyProduct}
          foods={data.foods}
          foodId={value.id}
          autoFocus={barcodeFocus}
        />
        {imported && (
          <p className="success" role="status">
            Dados preenchidos. Confira o rótulo e complete os campos ausentes
            antes de salvar.
          </p>
        )}
        <div className="form-grid">
          <label className="span-2">
            Nome do alimento
            <input
              autoFocus={!barcodeFocus}
              required
              maxLength={150}
              value={value.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Ex.: Iogurte natural"
            />
          </label>
          <label>
            Marca <small>opcional</small>
            <input
              value={value.brand}
              onChange={(e) => field("brand", e.target.value)}
            />
          </label>
          <label>
            Categoria
            <select
              aria-label="Categoria"
              value={value.category}
              onChange={(e) => field("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Unidade de referência
            <select
              aria-label="Unidade de referência"
              value={value.unit}
              onChange={(e) => {
                field("unit", e.target.value as Unit);
                field("reference", e.target.value === "porção" ? 1 : 100);
              }}
            >
              <option value="g">Gramas (g)</option>
              <option value="ml">Mililitros (ml)</option>
              <option value="porção">Porções</option>
            </select>
          </label>
          <label>
            Quantidade de referência ({value.unit})
            <input
              type="number"
              min="0.001"
              step="any"
              required
              value={value.reference}
              onChange={(e) => field("reference", e.target.valueAsNumber)}
            />
          </label>
          {value.unit === "porção" && (
            <label className="span-2">
              Peso de uma porção (g){" "}
              <small>opcional; permite registrar em gramas</small>
              <input
                type="number"
                min="0.001"
                step="any"
                value={value.portion_weight ?? ""}
                onChange={(e) =>
                  field(
                    "portion_weight",
                    e.target.value ? e.target.valueAsNumber : null,
                  )
                }
              />
            </label>
          )}
        </div>
        <div className="form-divider">
          <h3>Informação nutricional</h3>
          <span>
            Por {format(value.reference)} {value.unit}
          </span>
        </div>
        <div className="form-grid">
          {nutrients.slice(0, 4).map((n) => (
            <label key={n}>
              {labels[n]} ({n === "calories" ? "kcal" : "g"})
              <input
                required
                type="number"
                min="0"
                step="any"
                value={
                  Number.isFinite(value[n]) &&
                  !value.unknown_nutrients?.includes(n)
                    ? value[n]
                    : ""
                }
                onChange={(e) => changeNutrient(n, e.target.value)}
              />
            </label>
          ))}
        </div>
        <details>
          <summary>Outros nutrientes e observações</summary>
          <div className="form-grid">
            {nutrients.slice(4).map((n) => (
              <label key={n}>
                {labels[n]} (
                {["sodium", "cholesterol"].includes(n) ? "mg" : "g"})
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    Number.isFinite(value[n]) &&
                    !value.unknown_nutrients?.includes(n)
                      ? value[n]
                      : ""
                  }
                  onChange={(e) => changeNutrient(n, e.target.value)}
                />
              </label>
            ))}
            <label className="span-2">
              Observações / fonte dos dados
              <textarea
                value={value.notes}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="Ex.: valores do rótulo da embalagem"
              />
            </label>
          </div>
        </details>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {value.source_url && (
          <p className="food-source">
            Fonte nutricional:{" "}
            <a href={value.source_url} target="_blank" rel="noreferrer">
              Open Food Facts · ODbL
            </a>
          </p>
        )}
        <footer className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar alimento"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export default function Foods() {
  const { data, run, put, del, busy, userId } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [barcodeFocus, setBarcodeFocus] = useState(false);
  const [editor, setEditor] = useState<Food | "new" | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const foods = searchFoods(data.foods, query).filter(
    (f) => (!category || f.category === category) && (!favorites || f.favorite),
  );
  async function importJson() {
    setJsonError("");
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const source = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { foods?: unknown }).foods)
          ? (parsed as { foods: unknown[] }).foods
          : [parsed];
      if (!source.length) throw new Error("O JSON não contém alimentos.");
      const importedSoFar: Food[] = [];
      const imported = source.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error(`Item ${index + 1}: esperado um objeto de alimento.`);
        const raw = item as Record<string, unknown>;
        const nutrition = (raw.nutrition && typeof raw.nutrition === "object"
          ? raw.nutrition
          : raw) as Record<string, unknown>;
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name) throw new Error(`Item ${index + 1}: informe name.`);
        for (const required of nutrients.slice(0, 4))
          if (nutrition[required] === undefined || !Number.isFinite(Number(nutrition[required])) || Number(nutrition[required]) < 0)
            throw new Error(`Item ${index + 1} (${name}): informe ${required} como um número não negativo.`);
        const unit = raw.unit ?? "g";
        if (!["g", "ml", "porção"].includes(String(unit)))
          throw new Error(`Item ${index + 1}: unit deve ser g, ml ou porção.`);
        const importedNutrition = nutrients.reduce((result, nutrient) => {
          result[nutrient] = Number(nutrition[nutrient] ?? 0);
          return result;
        }, zero());
        const food: Food = {
          id: crypto.randomUUID(),
          user_id: userId,
          name,
          brand: typeof raw.brand === "string" ? raw.brand.trim() : "",
          category: categories.includes(String(raw.category)) ? String(raw.category) : "Outros",
          unit: unit as Unit,
          reference: Number(raw.reference ?? (unit === "porção" ? 1 : 100)),
          portion_weight: raw.portion_weight == null ? null : Number(raw.portion_weight),
          notes: typeof raw.notes === "string" ? raw.notes : "",
          favorite: Boolean(raw.favorite),
          barcode: typeof raw.barcode === "string" ? raw.barcode : null,
          source_url: typeof raw.source_url === "string" ? raw.source_url : null,
          unknown_nutrients: [],
          ...importedNutrition,
        };
        try {
          calculate(food, food.reference, food.unit);
          assertUniqueBarcode(food, [...data.foods, ...importedSoFar]);
        } catch (error) {
          throw new Error(`Item ${index + 1} (${name}): ${(error as Error).message}`);
        }
        importedSoFar.push(food);
        return food;
      });
      const duplicates = imported.filter((food) =>
        data.foods.some((existing) => normalize(existing.name) === normalize(food.name) && normalize(existing.brand) === normalize(food.brand)),
      ).length;
      if (!window.confirm(`Importar ${imported.length} alimento(s)?${duplicates ? ` ${duplicates} já existem pelo nome e marca; serão adicionados como novos cadastros.` : ""}`)) return;
      if (await run(() => put("foods", imported), `${imported.length} alimento(s) importado(s).`)) {
        setJsonOpen(false);
        setJsonText("");
      }
    } catch (error) {
      setJsonError((error as Error).message || "Não foi possível ler o JSON.");
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SUA BIBLIOTECA NUTRICIONAL</span>
          <h1>
            Meus alimentos<span className="title-dot">.</span>
          </h1>
          <p>Cadastre uma vez. Registre do seu jeito, todos os dias.</p>
        </div>
        <div className="food-header-actions">
          <button className="button secondary" onClick={() => setJsonOpen(true)}>
            <FileJson size={18} />
            Importar JSON
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setBarcodeFocus(true);
              setEditor("new");
            }}
          >
            <Barcode size={18} />
            Código de barras
          </button>
          <button
            className="button"
            onClick={() => {
              setBarcodeFocus(false);
              setEditor("new");
            }}
          >
            <Plus size={18} />
            Novo alimento
          </button>
        </div>
      </div>
      {jsonOpen && (
        <Modal title="Importar alimentos por JSON" subtitle="Cole um alimento, uma lista ou um objeto com a propriedade foods." onClose={() => setJsonOpen(false)} wide>
          <div className="form">
            <label>
              Dados JSON
              <textarea className="json-import-input" value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder={'[{\n  "name": "Arroz cozido",\n  "category": "Arroz, massas e cereais",\n  "unit": "g",\n  "reference": 100,\n  "calories": 130,\n  "protein": 2.7,\n  "carbs": 28,\n  "fat": 0.3\n}]'} />
            </label>
            <p className="muted">Campos nutricionais aceitos: calories, protein, carbs, fat, fiber, sugar, saturated_fat, trans_fat, sodium e cholesterol. Os quatro primeiros são obrigatórios por alimento.</p>
            {jsonError && <p className="error" role="alert">{jsonError}</p>}
            <footer className="modal-actions">
              <button className="button secondary" onClick={() => setJsonOpen(false)}>Cancelar</button>
              <button className="button" disabled={busy || !jsonText.trim()} onClick={() => void importJson()}>{busy ? "Importando…" : "Validar e importar"}</button>
            </footer>
          </div>
        </Modal>
      )}
      <section className="card">
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Pesquisar alimentos"
              placeholder="Buscar nome, marca ou código de barras…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            className={`button ${favorites ? "" : "secondary"}`}
            onClick={() => setFavorites(!favorites)}
          >
            <Star size={16} />
            Favoritos
          </button>
        </div>
        {foods.length ? (
          <ul
            className="food-list"
            aria-label="Alimentos cadastrados"
            role="list"
          >
            {foods.map((food) => (
              <li className="food-card" key={food.id}>
                <div className="food-details">
                  <h3>{food.name}</h3>
                  <span className="food-category">{food.category}</span>
                  <p>
                    {food.brand || "Cadastro pessoal"} ·{" "}
                    {format(food.reference)} {food.unit}
                  </p>
                  {food.barcode && (
                    <p className="food-barcode">
                      <Barcode size={13} />
                      EAN {food.barcode}
                    </p>
                  )}
                  {food.source_url && (
                    <a
                      className="food-source-link"
                      href={food.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Dados: Open Food Facts · ODbL
                    </a>
                  )}
                </div>
                <NutrientPills nutrition={food} />
                <div className="food-card-actions">
                  <button
                    disabled={busy}
                    className={`icon-button ${food.favorite ? "favorite" : ""}`}
                    aria-label={`${food.favorite ? "Desfavoritar" : "Favoritar"} ${food.name}`}
                    onClick={() =>
                      run(
                        () =>
                          put("foods", [{ ...food, favorite: !food.favorite }]),
                        "Favoritos atualizados.",
                      )
                    }
                  >
                    <Star
                      size={18}
                      fill={food.favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setEditor(food)}
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Duplicar ${food.name}`}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          put("foods", [
                            {
                              ...food,
                              id: crypto.randomUUID(),
                              user_id: userId,
                              name: `${food.name} (cópia)`,
                              barcode: null,
                            },
                          ]),
                        "Cópia criada.",
                      )
                    }
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Excluir ${food.name}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir “${food.name}”? O histórico do diário será preservado; o alimento sairá das refeições salvas.`,
                        )
                      )
                        void run(
                          () => del("foods", food.id),
                          "Alimento excluído.",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title={
              query || category || favorites
                ? "Nenhum resultado por aqui"
                : "Sua alimentação, seus alimentos"
            }
            description="Adicione os alimentos que fazem parte da sua rotina, com os valores do rótulo ou de uma fonte confiável."
            action={() => setEditor("new")}
            label="Cadastrar primeiro alimento"
          />
        )}
      </section>
      <div className="info-banner">
        <ArrowUpRight size={20} />
        <div>
          <strong>Uma biblioteca construída por você</strong>
          <p>
            Cadastre pelo rótulo ou busque pelo código de barras no Open Food
            Facts. Confira os dados da fonte antes de salvar.
          </p>
        </div>
      </div>
      {editor && (
        <FoodForm
          key={editor === "new" ? "new" : editor.id}
          barcodeFocus={editor === "new" && barcodeFocus}
          food={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}

