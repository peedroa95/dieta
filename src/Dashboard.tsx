import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Flame,
  Droplets,
  Scale,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { useStore } from "./store";
import { DateControl, MacroLine, Modal } from "./ui";
import { AddFood, MealCard } from "./Diary";
import { WeightModal } from "./Tracking";
import { total, goalAt, format } from "./domain";
export default function Dashboard({
  date,
  setDate,
  navigate,
}: {
  date: string;
  setDate: (s: string) => void;
  navigate: (s: string) => void;
}) {
  const { data, profile, today, userId, busy, run, put, del } = useStore();
  const [adding, setAdding] = useState<string | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);
  const [waterAmount, setWaterAmount] = useState(250);
  const [weightOpen, setWeightOpen] = useState(false);
  const entries = data.food_entries.filter((e) => e.date === date);
  const sum = total(entries);
  const goal = goalAt(data.daily_goals, date);
  const remaining = goal.calories - sum.calories;
  const waterLogs = data.water_logs.filter((w) => w.date === date);
  const water = waterLogs.reduce((s, w) => s + w.amount, 0);
  const weights = [...data.weight_logs]
    .filter((w) => w.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weight = weights.at(-1);
  const ring = 2 * Math.PI * 77;
  const percentage = Math.min(sum.calories / goal.calories, 1);
  const addWater = (amount: number) =>
    run(
      () =>
        put("water_logs", [
          { id: crypto.randomUUID(), user_id: userId, date, amount },
        ]),
      `${format(amount)} ml de água registrados.`,
    );
  return (
    <>
      <div className="page-title dashboard-title">
        <div>
          <div className="eyebrow">
            <span className="tiny-leaf">✳</span> SEU BEM-ESTAR COMEÇA NAS
            PEQUENAS ESCOLHAS
          </div>
          <h1>
            Um dia de cada vez<span className="title-dot">.</span>
          </h1>
          <p>
            {profile.name
              ? `${profile.name.split(" ")[0]}, acompanhe`
              : "Acompanhe"}{" "}
            sua alimentação e celebre cada progresso.
          </p>
        </div>
        <DateControl date={date} onChange={setDate} today={today} />
      </div>
      <div className="section-label">
        <h2>
          Seu resumo de hoje
          {date !== today && (
            <small>
              {" "}
              · {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}
            </small>
          )}
        </h2>
        <button
          className="text-button muted"
          onClick={() => navigate("settings")}
        >
          Personalizar metas
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="summary-grid">
        <section className="card calorie-card">
          <div className="card-title">
            <span className="card-icon peach">
              <Flame size={18} />
            </span>
            <h3>Calorias</h3>
            <span className="subtle-tag">DIÁRIO</span>
          </div>
          <div className="calorie-body">
            <div className="calorie-ring">
              <svg
                viewBox="0 0 180 180"
                aria-label={`${format(sum.calories)} de ${format(goal.calories)} calorias`}
                role="img"
              >
                <circle
                  cx="90"
                  cy="90"
                  r="77"
                  stroke="#edf0e7"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="77"
                  stroke="#6c8860"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${ring * percentage} ${ring}`}
                  transform="rotate(-90 90 90)"
                />
              </svg>
              <div>
                <strong>{format(Math.abs(remaining), 0)}</strong>
                <span>
                  kcal {remaining >= 0 ? "restantes" : "acima da meta"}
                </span>
              </div>
            </div>
            <div className="calorie-stats">
              <div>
                <span>
                  <i className="dot green" />
                  Consumidas
                </span>
                <strong>
                  {format(sum.calories, 0)} <small>kcal</small>
                </strong>
              </div>
              <div>
                <span>
                  <i className="dot gray" />
                  Meta diária
                </span>
                <strong>
                  {format(goal.calories, 0)} <small>kcal</small>
                </strong>
              </div>
            </div>
          </div>
          <div className="card-foot">
            <span className="status-dot" />
            {entries.length
              ? "Cada registro é um passo no seu caminho."
              : "Seu dia está pronto para começar."}
          </div>
        </section>
        <section className="card macros-card">
          <div className="card-title">
            <span className="card-icon sage">
              <Sparkles size={18} />
            </span>
            <h3>Macronutrientes</h3>
            <span className="muted small">consumo / meta</span>
          </div>
          <MacroLine
            name="Proteínas"
            value={sum.protein}
            goal={goal.protein}
            color="#bd806d"
          />
          <MacroLine
            name="Carboidratos"
            value={sum.carbs}
            goal={goal.carbs}
            color="#c4a65b"
          />
          <MacroLine
            name="Gorduras"
            value={sum.fat}
            goal={goal.fat}
            color="#7891ac"
          />
        </section>
      </div>
      <div className="wellness-grid">
        <section className="water-card">
          <div className="wellness-heading">
            <span className="card-icon blue">
              <Droplets size={19} />
            </span>
            <h3>Um gole de cuidado</h3>
            <button
              className="icon-button"
              aria-label="Ver registros de água"
              onClick={() => setWaterOpen(true)}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="water-content">
            <div>
              <strong>
                {format(water, 0)} <small>/ {format(goal.water, 0)} ml</small>
              </strong>
              <p>Água também faz parte da sua rotina.</p>
            </div>
            <button
              className="water-add"
              aria-label="Adicionar 250 ml de água"
              disabled={busy}
              onClick={() => addWater(250)}
            >
              <Plus size={17} />
              250 ml
            </button>
          </div>
          <div
            className="water-drops"
            aria-label={`${format(water)} ml registrados`}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <Droplets
                key={i}
                size={24}
                fill={water / goal.water > i / 8 ? "#77a7bd" : "none"}
                color={water / goal.water > i / 8 ? "#77a7bd" : "#c6dbe3"}
              />
            ))}
          </div>
        </section>
        <section className="weight-mini card">
          <div className="wellness-heading">
            <span className="card-icon peach">
              <Scale size={19} />
            </span>
            <h3>Seu corpo, sua jornada</h3>
            <button
              className="icon-button"
              aria-label="Ver evolução de peso"
              onClick={() => navigate("weight")}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="weight-content">
            <div>
              <strong>
                {weight ? format(weight.weight) : "—"} <small>kg</small>
              </strong>
              <p>
                {weight
                  ? `Último registro em ${new Date(`${weight.date}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : "Registre seu primeiro peso"}
              </p>
            </div>
            <button
              className="button secondary compact"
              onClick={() => setWeightOpen(true)}
            >
              <Plus size={15} />
              Registrar peso
            </button>
          </div>
        </section>
      </div>
      <div className="section-label meals-section">
        <h2>
          Suas refeições{" "}
          <span className="count-badge">{data.meals.length}</span>
        </h2>
        <button className="text-button" onClick={() => navigate("diary")}>
          Abrir diário completo
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="dashboard-meals">
        {data.meals.map((meal, i) => (
          <MealCard
            key={meal.id}
            index={i}
            meal={meal}
            date={date}
            entries={entries.filter((e) => e.meal_id === meal.id)}
            onAdd={() => setAdding(meal.id)}
          />
        ))}
      </div>
      <div className="gentle-note">
        <span>
          <Check size={17} />
        </span>
        <p>
          Consistência vale mais que perfeição.{" "}
          <strong>Cuide de você, uma refeição por vez.</strong>
        </p>
      </div>
      {adding && (
        <AddFood date={date} mealId={adding} onClose={() => setAdding(null)} />
      )}{" "}
      {weightOpen && (
        <WeightModal date={date} onClose={() => setWeightOpen(false)} />
      )}{" "}
      {waterOpen && (
        <Modal
          title="Sua hidratação"
          subtitle={`Registros de ${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}`}
          onClose={() => setWaterOpen(false)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await addWater(waterAmount)) setWaterAmount(250);
            }}
          >
            <label>
              Quantidade de água (ml)
              <input
                required
                type="number"
                min="1"
                max="20000"
                step="1"
                value={waterAmount}
                onChange={(e) => setWaterAmount(e.target.valueAsNumber)}
              />
            </label>
            <button className="button" disabled={busy}>
              <Plus size={16} />
              Registrar água
            </button>
          </form>
          <div className="water-history">
            {waterLogs.length ? (
              waterLogs.map((w) => (
                <div key={w.id}>
                  <Droplets size={16} />
                  <span>{format(w.amount)} ml</span>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Remover este registro de água?"))
                        void run(
                          () => del("water_logs", w.id),
                          "Registro removido.",
                        );
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))
            ) : (
              <p className="muted">Nenhum registro de água neste dia.</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
