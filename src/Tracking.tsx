import { useState, type FormEvent } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Scale,
  TrendingUp,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { useStore } from "./store";
import { Modal, LineChart, Empty } from "./ui";
import { format, total, goalAt, shiftDate, type Weight } from "./domain";
export function WeightModal({
  date,
  log,
  onClose,
}: {
  date: string;
  log?: Weight;
  onClose: () => void;
}) {
  const { data, userId, busy, run, put } = useStore();
  const [value, setValue] = useState(log?.weight || "");
  const [day, setDay] = useState(log?.date || date);
  const [notes, setNotes] = useState(log?.notes || "");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const existing = data.weight_logs.find(
      (w) => w.date === day && w.id !== log?.id,
    );
    if (
      existing &&
      !window.confirm("Já existe um peso nesta data. Substituir?")
    )
      return;
    const row = {
      id: existing?.id || log?.id || crypto.randomUUID(),
      user_id: userId,
      date: day,
      weight: Number(value),
      notes,
    };
    if (log && existing) {
      setError(
        "Para substituir este dia, edite o registro que já está nessa data.",
      );
      return;
    }
    if (await run(() => put("weight_logs", [row]), "Peso registrado."))
      onClose();
  }
  return (
    <Modal title={log ? "Editar peso" : "Registrar peso"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Data
            <input
              type="date"
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            Peso (kg)
            <input
              autoFocus
              type="number"
              min="1"
              max="500"
              step="0.01"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="span-2">
            Observações <small>opcional</small>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Como você está se sentindo?"
            />
          </label>
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
            Salvar peso
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function WeightPage() {
  const { data, today, run, del, busy } = useStore();
  const [period, setPeriod] = useState(30);
  const [editing, setEditing] = useState<Weight | "new" | null>(null);
  const points = [...data.weight_logs]
    .filter(
      (w) =>
        w.date <= today && (!period || w.date >= shiftDate(today, 1 - period)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = points[0],
    last = points.at(-1);
  const delta = first && last ? last.weight - first.weight : 0;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">NO SEU TEMPO</span>
          <h1>
            Sua evolução<span className="title-dot">.</span>
          </h1>
          <p>Mais que números: um olhar atento para a sua jornada.</p>
        </div>
        <button className="button" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Registrar peso
        </button>
      </div>
      <div className="stat-grid">
        {[
          ["Peso inicial", first ? `${format(first.weight)} kg` : "—"],
          ["Peso atual", last ? `${format(last.weight)} kg` : "—"],
          [
            "Variação no período",
            first ? `${delta > 0 ? "+" : ""}${format(delta)} kg` : "—",
          ],
        ].map(([label, value]) => (
          <div className="card stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>no período selecionado</small>
          </div>
        ))}
      </div>
      <section className="card chart-card">
        <div className="section-label">
          <h2>
            <Scale size={19} />
            Histórico de peso
          </h2>
          <div className="tabs">
            {[7, 30, 90, 0].map((p) => (
              <button
                key={p}
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {p ? `${p} dias` : "Tudo"}
              </button>
            ))}
          </div>
        </div>
        <LineChart
          points={points.map((w) => ({ date: w.date, value: w.weight }))}
          label="Evolução do peso corporal"
          unit="kg"
        />
      </section>
      <div className="info-banner">
        <TrendingUp size={21} />
        <p>
          Variações de peso também refletem hidratação, digestão e outros
          fatores. Observe tendências; nem toda mudança representa gordura
          corporal.
        </p>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>Seus registros</h2>
          <span className="muted">{points.length} no período</span>
        </div>
        {points.length ? (
          <div className="weight-list">
            {[...points].reverse().map((w) => (
              <div className="weight-row" key={w.id}>
                <span className="card-icon sage">
                  <Scale size={18} />
                </span>
                <div>
                  <strong>{format(w.weight)} kg</strong>
                  <small>
                    {new Date(`${w.date}T12:00:00`).toLocaleDateString("pt-BR")}
                    {w.notes ? ` · ${w.notes}` : ""}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Editar peso de ${w.date}`}
                  onClick={() => setEditing(w)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={busy}
                  aria-label={`Excluir peso de ${w.date}`}
                  onClick={() => {
                    if (window.confirm("Excluir este registro de peso?"))
                      void run(
                        () => del("weight_logs", w.id),
                        "Peso removido.",
                      );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Toda jornada tem um começo"
            description="Registre seu peso para visualizar a evolução ao longo do tempo."
            action={() => setEditing("new")}
            label="Registrar primeiro peso"
          />
        )}
      </section>
      {editing && (
        <WeightModal
          date={today}
          log={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
export function Reports() {
  const { data, today } = useStore();
  const [start, setStart] = useState(shiftDate(today, -6));
  const [end, setEnd] = useState(today);
  const days: string[] = [];
  if (start <= end)
    for (let d = start; d <= end && days.length < 366; d = shiftDate(d, 1))
      days.push(d);
  const invalid = start > end || shiftDate(start, 365) < end;
  const entries = data.food_entries.filter(
    (e) => e.date >= start && e.date <= end,
  );
  const sum = total(entries);
  const count = days.length || 1;
  const points = days.map((date) => ({
    date,
    value: total(entries.filter((e) => e.date === date)).calories,
  }));
  const avgGoal =
    days.reduce((s, d) => s + goalAt(data.daily_goals, d).calories, 0) / count;
  const mealCount = new Set(entries.map((e) => `${e.date}-${e.meal_id}`)).size;
  const possible = days.length * data.meals.length;
  const weights = [...data.weight_logs]
    .filter((w) => w.date >= start && w.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">UM OLHAR PARA A SUA ROTINA</span>
          <h1>
            Relatórios<span className="title-dot">.</span>
          </h1>
          <p>Descubra padrões nas escolhas que você registra.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setStart(shiftDate(today, -6));
            setEnd(today);
          }}
        >
          <CalendarDays size={17} />
          Esta semana
        </button>
      </div>
      <div className="card report-filters">
        <label>
          De
          <input
            required
            type="date"
            value={start}
            onChange={(e) => {
              if (e.target.value) setStart(e.target.value);
            }}
          />
        </label>
        <label>
          Até
          <input
            required
            type="date"
            value={end}
            onChange={(e) => {
              if (e.target.value) setEnd(e.target.value);
            }}
          />
        </label>
        <span className="muted">
          Médias incluem todos os dias do período, inclusive dias sem registros.
        </span>
      </div>
      {invalid ? (
        <p className="error" role="alert">
          Escolha um período válido de até 366 dias.
        </p>
      ) : (
        <>
          <div className="stat-grid four">
            <div className="card stat-card">
              <span>Média diária de calorias</span>
              <strong>
                {format(sum.calories / count, 0)} <small>kcal</small>
              </strong>
              <small>Meta média: {format(avgGoal, 0)} kcal</small>
            </div>
            {(["protein", "carbs", "fat"] as const).map((n, i) => (
              <div key={n} className="card stat-card">
                <span>
                  {["Proteínas", "Carboidratos", "Gorduras"][i]} / dia
                </span>
                <strong>
                  {format(sum[n] / count)} <small>g</small>
                </strong>
                <small>Média de {days.length} dias</small>
              </div>
            ))}
          </div>
          <section className="card chart-card">
            <div className="section-label">
              <h2>
                <BarChart3 size={19} />
                Consumo calórico diário
              </h2>
              <span className="subtle-tag">DADOS DOS SEUS REGISTROS</span>
            </div>
            {entries.length ? (
              <>
                <div className="calorie-bars">
                  {points.map((p) => {
                    const goal = goalAt(data.daily_goals, p.date).calories;
                    const max = Math.max(
                      ...points.map((x) => x.value),
                      ...days.map((d) => goalAt(data.daily_goals, d).calories),
                      1,
                    );
                    return (
                      <div className="bar-col" key={p.date}>
                        <div
                          className="bar-area"
                          title={`${p.date}: ${format(p.value)} / ${format(goal)} kcal`}
                        >
                          <span
                            className="bar-goal"
                            style={{ bottom: `${(goal / max) * 100}%` }}
                          />
                          <span
                            className="bar-value"
                            style={{ height: `${(p.value / max) * 100}%` }}
                          />
                        </div>
                        <small>
                          {p.date.slice(8)}/{p.date.slice(5, 7)}
                        </small>
                      </div>
                    );
                  })}
                </div>
                <p className="chart-legend">
                  <i className="dot green" /> Consumo{" "}
                  <span>┄ Meta vigente em cada dia</span>
                </p>
              </>
            ) : (
              <Empty
                title="Suas escolhas vão contar uma história"
                description="Registre alimentos no diário para visualizar o consumo e comparar com suas metas."
              />
            )}
          </section>
          <div className="report-grid">
            <section className="card report-frequency">
              <span className="card-icon sage">
                <CalendarDays size={21} />
              </span>
              <h2>Frequência de registro</h2>
              <strong>
                {format(possible ? (mealCount / possible) * 100 : 0, 0)}
                <small>%</small>
              </strong>
              <p>
                {mealCount} de {possible} refeições possíveis registradas.
              </p>
              <p className="muted small">
                Este indicador mostra a frequência de registros, não a qualidade
                da alimentação.
              </p>
            </section>
            <section className="card chart-card">
              <h2>Peso no período</h2>
              <LineChart
                points={weights.map((w) => ({ date: w.date, value: w.weight }))}
                label="Peso no período do relatório"
                unit="kg"
              />
            </section>
          </div>
        </>
      )}
    </>
  );
}
