import { useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Star,
  Clock,
  Sunrise,
  Sun,
  Coffee,
  Moon,
  Pencil,
  Copy,
  Trash2,
  BookmarkPlus,
  Utensils,
} from "lucide-react";
import { useStore } from "./store";
import { Modal, Empty, NutrientPills, DateControl } from "./ui";
import { FoodForm } from "./Foods";
import { RecipeModal } from "./Recipes";
import {
  calculate,
  entryFor,
  reviseEntry,
  total,
  searchFoods,
  format,
  zero,
  type Entry,
  type Food,
  type Unit,
  type Meal,
} from "./domain";
export const mealIcons = [Sunrise, Sun, Coffee, Moon];
export function AddFood({
  date,
  mealId,
  entry,
  onClose,
}: {
  date: string;
  mealId?: string;
  entry?: Entry;
  onClose: () => void;
}) {
  const { data, run, put, userId, busy } = useStore();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [food, setFood] = useState<Food | null>(entry?.snapshot || null);
  const [quantity, setQuantity] = useState(entry?.quantity || 100);
  const [unit, setUnit] = useState<Unit>(entry?.unit || "g");
  const [meal, setMeal] = useState(mealId || data.meals[0]?.id || "");
  const [error, setError] = useState("");
  const [newFood, setNewFood] = useState(false);
  const recent = [...data.food_entries]
    .sort((a, b) =>
      (b.created_at || b.date).localeCompare(a.created_at || a.date),
    )
    .map((e) => e.food_id)
    .filter(Boolean) as string[];
  const foods = searchFoods(data.foods, query, recent).filter((f) =>
    tab === "favorites"
      ? f.favorite
      : tab === "recent"
        ? recent.includes(f.id)
        : true,
  );
  let preview = zero();
  try {
    if (food) preview = calculate(food, quantity, unit);
  } catch {
    /* Validation appears on submit. */
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!food) return;
    setError("");
    try {
      if (!meal) throw new Error("Selecione uma refeição.");
      const row = entry
        ? reviseEntry(entry, quantity, unit, meal)
        : entryFor(food, quantity, unit, meal, date, userId);
      if (
        await run(
          () => put("food_entries", [row]),
          entry ? "Registro atualizado." : "Alimento adicionado ao diário.",
        )
      )
        onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Modal
        title={entry ? "Editar registro" : "Adicionar alimento"}
        subtitle={
          entry
            ? "O cálculo usa os nutrientes originais deste registro."
            : "Uma escolha de cada vez, uma rotina mais leve."
        }
        onClose={onClose}
        wide
      >
        {!entry && (
          <>
            <label className="search modal-search">
              <Search size={18} />
              <input
                autoFocus
                placeholder="O que você comeu?"
                aria-label="Buscar alimento para registrar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="tabs">
              {[
                ["all", "Todos"],
                ["recent", "Recentes"],
                ["favorites", "Favoritos"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {key === "recent" ? (
                    <Clock size={14} />
                  ) : key === "favorites" ? (
                    <Star size={14} />
                  ) : null}
                  {label}
                </button>
              ))}
            </div>
            <div className="food-picker">
              {foods.length ? (
                foods.map((f) => (
                  <button
                    key={f.id}
                    className={`pick-food ${food?.id === f.id ? "selected" : ""}`}
                    onClick={() => {
                      setFood(f);
                      setQuantity(f.reference);
                      setUnit(f.unit);
                      setError("");
                    }}
                  >
                    <span>
                      <strong>{f.name}</strong>
                      <small>
                        {f.brand || f.category} · {format(f.reference)} {f.unit}
                      </small>
                    </span>
                    <span>
                      {format(f.calories)} <small>kcal</small>
                      {f.favorite && <Star size={12} />}
                    </span>
                  </button>
                ))
              ) : (
                <div className="picker-empty">
                  Nenhum alimento encontrado.
                  <button
                    className="text-button"
                    onClick={() => setNewFood(true)}
                  >
                    <Plus size={15} />
                    Cadastrar alimento
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {food && (
          <form onSubmit={submit} className="form">
            <div className="selected-food">
              <span className="eyebrow">
                {entry ? "NUTRIENTES HISTÓRICOS" : "ALIMENTO SELECIONADO"}
              </span>
              <h3>{food.name}</h3>
            </div>
            <div className="form-grid">
              <label>
                Quantidade consumida
                <input
                  autoFocus={!!entry}
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.valueAsNumber)}
                />
              </label>
              <label>
                Unidade
                <select
                  aria-label="Unidade"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                >
                  <option value={food.unit}>
                    {food.unit === "porção"
                      ? "Porções"
                      : food.unit === "g"
                        ? "Gramas (g)"
                        : "Mililitros (ml)"}
                  </option>
                  {food.unit === "porção" && food.portion_weight && (
                    <option value="g">Gramas (g)</option>
                  )}
                </select>
              </label>
              <label className="span-2">
                Refeição
                <select
                  aria-label="Refeição"
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
            </div>
            <div className="nutrition-preview">
              <span>Prévia nutricional</span>
              <NutrientPills nutrition={preview} />
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <footer className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button className="button" disabled={busy}>
                {busy
                  ? "Salvando…"
                  : entry
                    ? "Salvar alterações"
                    : "Adicionar ao diário"}
              </button>
            </footer>
          </form>
        )}
        {!food && (
          <p className="muted helper">
            Selecione um alimento para informar a quantidade.
          </p>
        )}
      </Modal>
      {newFood && <FoodForm onClose={() => setNewFood(false)} />}
    </>
  );
}
export function NewMeal({ onClose }: { onClose: () => void }) {
  const { data, run, put, busy, userId } = useStore();
  const [name, setName] = useState("");
  return (
    <Modal title="Nova refeição" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              () =>
                put("meals", [
                  {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    name: name.trim(),
                    sort_order: data.meals.length,
                  },
                ]),
              "Refeição criada.",
            )
          )
            onClose();
        }}
      >
        <label>
          Nome da refeição
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Ceia"
            pattern=".*\S.*"
          />
        </label>
        <footer className="modal-actions">
          <button className="button" disabled={busy}>
            Criar refeição
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function MealCard({
  meal,
  index,
  entries,
  date,
  onAdd,
}: {
  meal: Meal;
  index: number;
  entries: Entry[];
  date: string;
  onAdd: () => void;
}) {
  const { run, put, del, busy, data } = useStore();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = mealIcons[index % 4] || Utensils;
  const sum = total(entries);
  return (
    <section className="card meal-card">
      <div className="meal-head">
        <div className="meal-name">
          <span className={`meal-icon meal-${index % 4}`}>
            <Icon size={21} />
          </span>
          <div>
            <h3>{meal.name}</h3>
            <small>
              {entries.length
                ? `${entries.length} ${entries.length === 1 ? "alimento" : "alimentos"} registrados`
                : "Um espaço para nutrir seu dia"}
            </small>
          </div>
        </div>
        <div className="meal-head-actions">
          <strong>
            {format(sum.calories)} <small>kcal</small>
          </strong>
          {entries.length > 0 && (
            <button
              className="icon-button"
              aria-label={`Salvar ${meal.name} como refeição`}
              onClick={() => setSaving(true)}
            >
              <BookmarkPlus size={18} />
            </button>
          )}
        </div>
      </div>
      {entries.length > 0 && (
        <div className="entry-list">
          {entries.map((e) => (
            <div className="entry-row" key={e.id}>
              <div className="entry-info">
                <strong>{e.snapshot.name}</strong>
                <small>
                  {format(e.quantity)} {e.unit}{" "}
                  {e.snapshot.brand ? `· ${e.snapshot.brand}` : ""}
                </small>
              </div>
              <div className="entry-macros">
                <NutrientPills nutrition={e.nutrition} />
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  aria-label={`Editar registro de ${e.snapshot.name}`}
                  onClick={() => setEditing(e)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  disabled={busy}
                  className="icon-button"
                  aria-label={`Duplicar registro de ${e.snapshot.name}`}
                  onClick={() => {
                    const food = data.foods.find((f) => f.id === e.food_id);
                    if (!food) {
                      window.alert(
                        "O cadastro foi excluído. Cadastre o alimento novamente para criar outro registro.",
                      );
                      return;
                    }
                    void run(
                      () =>
                        put("food_entries", [
                          entryFor(
                            food,
                            e.quantity,
                            e.unit,
                            e.meal_id,
                            e.date,
                            e.user_id,
                          ),
                        ]),
                      "Registro duplicado com os nutrientes atuais.",
                    );
                  }}
                >
                  <Copy size={14} />
                </button>
                <button
                  disabled={busy}
                  className="icon-button danger"
                  aria-label={`Excluir registro de ${e.snapshot.name}`}
                  onClick={() => {
                    if (window.confirm(`Excluir ${e.snapshot.name} deste dia?`))
                      void run(
                        () => del("food_entries", e.id),
                        "Registro excluído.",
                      );
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="meal-bottom">
        <button className="text-button" onClick={onAdd}>
          <Plus size={16} />
          Adicionar alimento
        </button>
        {entries.length > 0 && (
          <div className="mini-macros">
            <span>
              P <b>{format(sum.protein)} g</b>
            </span>
            <span>
              C <b>{format(sum.carbs)} g</b>
            </span>
            <span>
              G <b>{format(sum.fat)} g</b>
            </span>
          </div>
        )}
      </div>
      {editing && (
        <AddFood
          date={date}
          mealId={meal.id}
          entry={editing}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {saving && (
        <RecipeModal initial={entries} onClose={() => setSaving(false)} />
      )}
    </section>
  );
}
export default function Diary({
  date,
  setDate,
}: {
  date: string;
  setDate: (s: string) => void;
}) {
  const { data, today } = useStore();
  const [adding, setAdding] = useState<string | null>(null);
  const [newMeal, setNewMeal] = useState(false);
  const sum = total(data.food_entries.filter((e) => e.date === date));
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CADA REFEIÇÃO CONTA</span>
          <h1>
            Diário alimentar<span className="title-dot">.</span>
          </h1>
          <p>Seu dia em escolhas que fazem bem.</p>
        </div>
        <DateControl date={date} onChange={setDate} today={today} />
      </div>
      <div className="day-total card">
        <span>Total do dia</span>
        <NutrientPills nutrition={sum} />
      </div>
      <div className="diary-grid">
        {data.meals.map((meal, i) => (
          <MealCard
            key={meal.id}
            meal={meal}
            index={i}
            date={date}
            entries={data.food_entries.filter(
              (e) => e.date === date && e.meal_id === meal.id,
            )}
            onAdd={() => setAdding(meal.id)}
          />
        ))}
      </div>
      <button className="button secondary" onClick={() => setNewMeal(true)}>
        <Plus size={17} />
        Criar outra refeição
      </button>
      {adding && (
        <AddFood date={date} mealId={adding} onClose={() => setAdding(null)} />
      )}{" "}
      {newMeal && <NewMeal onClose={() => setNewMeal(false)} />}
    </>
  );
}
