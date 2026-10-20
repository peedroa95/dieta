import { useState, type FormEvent } from "react";
import { Plus, Bookmark, Trash2, Pencil } from "lucide-react";
import { useStore } from "./store";
import { Modal, Empty, NutrientPills } from "./ui";
import { saveRecipe } from "./api";
import {
  calculate,
  total,
  entryFor,
  format,
  type Entry,
  type SavedMeal,
  type SavedItem,
  type Unit,
} from "./domain";
export function RecipeModal({
  recipe,
  initial,
  consume,
  date,
  onClose,
}: {
  recipe?: SavedMeal;
  initial?: Entry[];
  consume?: boolean;
  date?: string;
  onClose: () => void;
}) {
  const { data, userId, local, busy, run, put } = useStore();
  const id = recipe?.id || crypto.randomUUID();
  const [name, setName] = useState(recipe?.name || "");
  const [meal, setMeal] = useState(data.meals[0]?.id || "");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [items, setItems] = useState<SavedItem[]>(() =>
    recipe
      ? data.saved_meal_items.filter((i) => i.saved_meal_id === recipe.id)
      : initial
          ?.filter((e) => data.foods.some((f) => f.id === e.food_id))
          .map((e) => ({
            id: crypto.randomUUID(),
            user_id: userId,
            saved_meal_id: id,
            food_id: e.food_id!,
            quantity: e.quantity,
            unit: e.unit,
          })) || [],
  );
  const update = (index: number, patch: Partial<SavedItem>) =>
    setItems((old) =>
      old.map((i, n) => (n === index ? { ...i, ...patch } : i)),
    );
  let nutrition = total([]);
  try {
    nutrition = total(
      items.map((i) => ({
        nutrition: calculate(
          data.foods.find((f) => f.id === i.food_id)!,
          i.quantity,
          i.unit,
        ),
      })),
    );
  } catch {
    /* Submit shows validation. */
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (!items.length) throw new Error("Adicione pelo menos um alimento.");
      const entries = items.map((i) =>
        entryFor(
          data.foods.find((f) => f.id === i.food_id)!,
          i.quantity,
          i.unit,
          meal,
          date || "",
          userId,
        ),
      );
      const ok = consume
        ? await run(
            () => put("food_entries", entries),
            "Refeição adicionada ao diário.",
          )
        : await run(
            () =>
              saveRecipe(
                local,
                { id, user_id: userId, name: name.trim() },
                items.map((i) => ({ ...i, saved_meal_id: id })),
              ),
            "Refeição salva.",
          );
      if (ok) onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={
        consume
          ? "Adicionar refeição ao diário"
          : recipe
            ? "Editar refeição salva"
            : "Salvar uma refeição"
      }
      subtitle={
        consume
          ? "Ajuste as quantidades. Usaremos os nutrientes atuais dos alimentos."
          : "Sua rotina mais prática, com as suas combinações."
      }
      onClose={onClose}
      wide
    >
      <form className="form" onSubmit={submit}>
        {!consume && (
          <label>
            Nome da refeição
            <input
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Meu almoço de sempre"
              pattern=".*\S.*"
            />
          </label>
        )}
        {consume && (
          <>
            <h3>{recipe?.name}</h3>
            <label>
              Adicionar em
              <select
                aria-label="Adicionar em"
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
              >
                {data.meals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <div className="recipe-items">
          {items.map((item, index) => {
            const f = data.foods.find((f) => f.id === item.food_id);
            if (!f) return null;
            return (
              <div className="recipe-item" key={item.id}>
                <strong>{f.name}</strong>
                <label>
                  <span className="sr-only">Quantidade de {f.name}</span>
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      update(index, { quantity: e.target.valueAsNumber })
                    }
                  />
                </label>
                <select
                  aria-label={`Unidade de ${f.name}`}
                  value={item.unit}
                  onChange={(e) =>
                    update(index, { unit: e.target.value as Unit })
                  }
                >
                  <option value={f.unit}>{f.unit}</option>
                  {f.unit === "porção" && f.portion_weight && (
                    <option value="g">g</option>
                  )}
                </select>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remover ${f.name} da combinação`}
                  onClick={() =>
                    setItems((old) => old.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
        {!consume && (
          <div className="inline-form">
            <select
              aria-label="Escolher alimento para combinação"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Escolha um alimento…</option>
              {data.foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button secondary"
              disabled={!selected}
              onClick={() => {
                const f = data.foods.find((f) => f.id === selected)!;
                setItems([
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    saved_meal_id: id,
                    food_id: f.id,
                    quantity: f.reference,
                    unit: f.unit,
                  },
                ]);
                setSelected("");
              }}
            >
              <Plus size={17} />
              Incluir
            </button>
          </div>
        )}
        <div className="nutrition-preview">
          <span>Total da combinação</span>
          <NutrientPills nutrition={nutrition} />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button" disabled={busy}>
            {consume ? "Adicionar refeição" : "Salvar combinação"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export default function Recipes({ date }: { date: string }) {
  const { data, run, del, busy } = useStore();
  const [modal, setModal] = useState<{
    recipe?: SavedMeal;
    consume?: boolean;
  } | null>(null);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SUAS COMBINAÇÕES FAVORITAS</span>
          <h1>
            Refeições salvas<span className="title-dot">.</span>
          </h1>
          <p>Menos tempo registrando. Mais tempo vivendo.</p>
        </div>
        <button className="button" onClick={() => setModal({})}>
          <Plus size={18} />
          Nova combinação
        </button>
      </div>
      {data.saved_meals.length ? (
        <div className="recipe-grid">
          {data.saved_meals.map((r) => {
            const items = data.saved_meal_items.filter(
              (i) => i.saved_meal_id === r.id,
            );
            let nutrition = total([]);
            try {
              nutrition = total(
                items.map((i) => ({
                  nutrition: calculate(
                    data.foods.find((f) => f.id === i.food_id)!,
                    i.quantity,
                    i.unit,
                  ),
                })),
              );
            } catch {
              /* Incompatible units are explained and editable. */
            }
            const invalid = items.some((i) => {
              try {
                calculate(
                  data.foods.find((f) => f.id === i.food_id)!,
                  i.quantity,
                  i.unit,
                );
                return false;
              } catch {
                return true;
              }
            });
            return (
              <article className="card recipe-card" key={r.id}>
                <span className="empty-icon">
                  <Bookmark size={24} />
                </span>
                <h3>{r.name}</h3>
                <ul>
                  {items.map((i) => (
                    <li key={i.id}>
                      {format(i.quantity)} {i.unit} de{" "}
                      {data.foods.find((f) => f.id === i.food_id)?.name ||
                        "Alimento excluído"}
                    </li>
                  ))}
                </ul>
                {!items.length && (
                  <p className="muted">
                    Os alimentos desta combinação foram excluídos. Edite para
                    incluir novos.
                  </p>
                )}
                {invalid && (
                  <p className="error">
                    Uma unidade de referência mudou. Edite a combinação para
                    ajustar.
                  </p>
                )}
                <NutrientPills nutrition={nutrition} />
                <div className="recipe-actions">
                  <button
                    className="button secondary"
                    disabled={!items.length || invalid}
                    onClick={() => setModal({ recipe: r, consume: true })}
                  >
                    <Plus size={16} />
                    Usar no diário
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Editar ${r.name}`}
                    onClick={() => setModal({ recipe: r })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={busy}
                    aria-label={`Excluir ${r.name}`}
                    onClick={() => {
                      if (window.confirm(`Excluir a combinação “${r.name}”?`))
                        void run(
                          () => del("saved_meals", r.id),
                          "Combinação excluída.",
                        );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Uma boa rotina merece ser salva"
            description="Combine seus alimentos em refeições que você pode registrar com poucos toques."
            action={() => setModal({})}
            label="Criar combinação"
          />
        </section>
      )}
      {modal && (
        <RecipeModal {...modal} date={date} onClose={() => setModal(null)} />
      )}
    </>
  );
}
