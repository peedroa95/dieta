import TransferData from "./TransferData";
import { localSourceId } from "./transfer";
import { useState, type FormEvent } from "react";
import {
  Target,
  Sparkles,
  Check,
  Download,
  ShieldCheck,
  Trash2,
  User,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "./store";
import { Modal } from "./ui";
import { clearLocal } from "./api";
import { goalAt, estimate, format, type Goal, type Profile } from "./domain";
type Suggestion = ReturnType<typeof estimate>;
export function GoalEditor({
  onClose,
  suggestion,
}: {
  onClose: () => void;
  suggestion?: Suggestion;
}) {
  const { data, userId, today, profile, run, put, busy } = useStore();
  const current = goalAt(data.daily_goals, today);
  const [value, setValue] = useState<Goal>({
    ...current,
    id: crypto.randomUUID(),
    user_id: userId,
    date: today,
  });
  const [proposed, setProposed] = useState<Suggestion | null>(
    suggestion || null,
  );
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const existing = data.daily_goals.find((g) => g.date === value.date);
    if (
      await run(
        () => put("daily_goals", [{ ...value, id: existing?.id || value.id }]),
        "Metas atualizadas a partir da data escolhida.",
      )
    )
      onClose();
  }
  return (
    <Modal
      title="Suas metas, seu ritmo"
      subtitle="Você decide o que faz sentido para a sua rotina."
      onClose={onClose}
      wide
    >
      <form className="form" onSubmit={submit}>
        <label>
          Válidas a partir de
          <input
            type="date"
            required
            value={value.date}
            onChange={(e) => setValue({ ...value, date: e.target.value })}
          />
        </label>
        <div className="form-grid">
          {(["calories", "protein", "carbs", "fat", "water"] as const).map(
            (n, i) => (
              <label key={n}>
                {
                  [
                    "Calorias (kcal)",
                    "Proteínas (g)",
                    "Carboidratos (g)",
                    "Gorduras (g)",
                    "Água (ml)",
                  ][i]
                }
                <input
                  type="number"
                  min={n === "calories" || n === "water" ? 1 : 0}
                  step="any"
                  required
                  value={value[n]}
                  onChange={(e) =>
                    setValue({ ...value, [n]: e.target.valueAsNumber })
                  }
                />
              </label>
            ),
          )}
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            try {
              setProposed(estimate(profile));
              setError("");
            } catch (e) {
              setError(
                `${(e as Error).message} Você pode completar esses dados em Meu perfil.`,
              );
            }
          }}
        >
          <Sparkles size={16} />
          Sugerir a partir do meu perfil
        </button>
        {proposed && (
          <div className="suggestion-box">
            <span className="eyebrow">ESTIMATIVA • MIFFLIN-ST JEOR</span>
            <div className="estimate-grid">
              <span>
                Metabolismo basal
                <strong>{format(proposed.basal, 0)} kcal</strong>
              </span>
              <span>
                Gasto diário
                <strong>{format(proposed.expenditure, 0)} kcal</strong>
              </span>
              <span>
                Meta sugerida
                <strong>{format(proposed.calories, 0)} kcal</strong>
              </span>
              <span>
                {proposed.delta < 0 ? "Déficit" : "Superávit"} estimado
                <strong>{format(Math.abs(proposed.delta), 0)} kcal</strong>
              </span>
            </div>
            <p>
              Estimativas para adultos. Ajuste conforme sua evolução, desempenho
              e orientação profissional. O nível de atividade já considera seus
              treinos.
            </p>
            <div className="inline-form">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setValue({
                    ...value,
                    calories: proposed.calories,
                    protein: proposed.protein,
                    carbs: proposed.carbs,
                    fat: proposed.fat,
                    water: proposed.water,
                  });
                  setProposed(null);
                }}
              >
                <Check size={16} />
                Usar valores sugeridos
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setProposed(null)}
              >
                Descartar
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">
          As metas anteriores continuam valendo nos dias anteriores à data
          escolhida. Nada é alterado até você salvar.
        </p>
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button" disabled={busy}>
            Salvar metas
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function ProfilePage() {
  const { profile, run, put, busy } = useStore();
  const [value, setValue] = useState<Profile>({ ...profile });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const change = (key: keyof Profile, v: unknown) =>
    setValue({ ...value, [key]: v });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(() => put("profiles", [value]), "Perfil atualizado.");
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">VAMOS NOS CONHECER</span>
          <h1>
            Meu perfil<span className="title-dot">.</span>
          </h1>
          <p>Suas informações ajudam a personalizar o seu caminho.</p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="card profile-summary">
          <div className="avatar large">
            {value.name ? (
              value.name.trim().slice(0, 1).toUpperCase()
            ) : (
              <User size={32} />
            )}
          </div>
          <h2>{value.name || "Seu espaço de cuidado"}</h2>
          <p>Uma rotina que respeita você.</p>
          <span className="subtle-tag">
            <ShieldCheck size={14} /> DADOS PRIVADOS
          </span>
        </section>
        <section className="card profile-form">
          <form className="form" onSubmit={submit}>
            <h2>Sobre você</h2>
            <div className="form-grid">
              <label className="span-2">
                Como podemos chamar você?
                <input
                  required
                  maxLength={100}
                  value={value.name}
                  onChange={(e) => change("name", e.target.value)}
                />
              </label>
              <label>
                Idade
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={value.age ?? ""}
                  onChange={(e) =>
                    change(
                      "age",
                      e.target.value ? e.target.valueAsNumber : null,
                    )
                  }
                />
              </label>
              <label>
                Sexo para a estimativa metabólica
                <select
                  aria-label="Sexo para a estimativa metabólica"
                  value={value.sex}
                  onChange={(e) => change("sex", e.target.value)}
                >
                  <option value="">Prefiro não informar</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  min="1"
                  max="250"
                  step="0.1"
                  value={value.height ?? ""}
                  onChange={(e) =>
                    change(
                      "height",
                      e.target.value ? e.target.valueAsNumber : null,
                    )
                  }
                />
              </label>
              <label>
                Peso de referência (kg)
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="0.01"
                  value={value.body_weight ?? ""}
                  onChange={(e) =>
                    change(
                      "body_weight",
                      e.target.value ? e.target.valueAsNumber : null,
                    )
                  }
                />
              </label>
              <label>
                Gordura corporal (%) <small>opcional</small>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={value.body_fat ?? ""}
                  onChange={(e) =>
                    change(
                      "body_fat",
                      e.target.value ? e.target.valueAsNumber : null,
                    )
                  }
                />
              </label>
              <label>
                Treinos por semana
                <select
                  aria-label="Treinos por semana"
                  value={value.training}
                  onChange={(e) => change("training", Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i}>
                      {i} {i === 1 ? "treino" : "treinos"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Nível de atividade (incluindo treinos)
                <select
                  aria-label="Nível de atividade (incluindo treinos)"
                  value={value.activity}
                  onChange={(e) => change("activity", Number(e.target.value))}
                >
                  <option value={1.2}>
                    Sedentário • pouco ou nenhum exercício
                  </option>
                  <option value={1.375}>
                    Leve • exercício 1–3 dias/semana
                  </option>
                  <option value={1.55}>
                    Moderado • exercício 3–5 dias/semana
                  </option>
                  <option value={1.725}>
                    Intenso • exercício 6–7 dias/semana
                  </option>
                  <option value={1.9}>
                    Muito intenso • trabalho físico e treino
                  </option>
                </select>
              </label>
              <label>
                Seu objetivo
                <select
                  aria-label="Seu objetivo"
                  value={value.objective}
                  onChange={(e) => change("objective", e.target.value)}
                >
                  <option value="lose">Emagrecimento</option>
                  <option value="maintain">Manutenção</option>
                  <option value="gain">Ganho de massa muscular</option>
                </select>
              </label>
              <label>
                Fuso horário
                <select
                  aria-label="Fuso horário"
                  value={value.timezone}
                  onChange={(e) => change("timezone", e.target.value)}
                >
                  {Array.from(
                    new Set([
                      value.timezone,
                      "America/Fortaleza",
                      "America/Sao_Paulo",
                      "America/Manaus",
                      "America/Recife",
                      "America/Belem",
                      "America/Cuiaba",
                      "America/Rio_Branco",
                      "America/Noronha",
                      "Europe/Lisbon",
                      "UTC",
                    ]),
                  ).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted small">
              O peso de referência é usado na estimativa. Os registros de
              evolução são mantidos separadamente. Gordura corporal não é usada
              na equação de Mifflin-St Jeor.
            </p>
            <div className="profile-buttons">
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  try {
                    setSuggestion(estimate(value));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Sparkles size={16} />
                Estimar metas
              </button>
              <button className="button" disabled={busy}>
                Salvar perfil
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
      </div>
      {suggestion && (
        <GoalEditor
          suggestion={suggestion}
          onClose={() => setSuggestion(null)}
        />
      )}
    </>
  );
}
export function Settings({ navigate }: { navigate: (p: string) => void }) {
  const {
    data,
    local,
    today,
    profile,
    email,
    refresh,
    refreshing,
    syncError,
    setNotice,
  } = useStore();
  const goal = goalAt(data.daily_goals, today);
  const [editing, setEditing] = useState(false);
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            source_id: local ? localSourceId() : undefined,
            schema_version: 1,
            mode: local ? "local" : "supabase",
            ...data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutria-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>
            Configurações<span className="title-dot">.</span>
          </h1>
          <p>Pequenos ajustes para uma experiência que é sua.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="card-title">
            <span className="card-icon sage">
              <Target size={21} />
            </span>
            <h2>Metas diárias</h2>
          </div>
          {goal.id === "default" && (
            <p className="soft-warning">
              Valores iniciais de referência, ainda não personalizados.
            </p>
          )}
          <div className="goal-list">
            {[
              ["Calorias", `${format(goal.calories)} kcal`],
              ["Proteínas", `${format(goal.protein)} g`],
              ["Carboidratos", `${format(goal.carbs)} g`],
              ["Gorduras", `${format(goal.fat)} g`],
              ["Água", `${format(goal.water)} ml`],
            ].map(([label, v]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <button className="button" onClick={() => setEditing(true)}>
            Personalizar minhas metas
            <ArrowUpRight size={16} />
          </button>
        </section>
        <div className="settings-stack">
          <section className="card settings-card">
            <div className="card-title">
              <span className="card-icon blue">
                <ShieldCheck size={21} />
              </span>
              <h2>Seus dados</h2>
            </div>
            <p>
              {local
                ? "Seus dados ficam salvos neste navegador. Exporte seus registros para manter uma cópia."
                : "Seus dados são salvos na nuvem e vinculados à sua conta. Entre com o mesmo e-mail no celular e no computador."}
            </p>
            {!local && (
              <>
                <p className="account-email">
                  Conta conectada: <strong>{email}</strong>
                </p>
                <button
                  className="button secondary"
                  disabled={refreshing}
                  onClick={() =>
                    void refresh().then((ok) =>
                      setNotice(
                        ok
                          ? "Dados atualizados."
                          : "Não foi possível atualizar. Confira sua conexão e tente novamente.",
                      ),
                    )
                  }
                >
                  {refreshing ? "Atualizando…" : "Atualizar dados"}
                </button>
                <p className="muted small">
                  Atualização ao voltar ao app e a cada 30 segundos enquanto
                  estiver aberto.
                </p>
                {syncError && (
                  <p className="error" role="alert">
                    Não foi possível atualizar: {syncError}
                  </p>
                )}
              </>
            )}
            <button className="button secondary" onClick={download}>
              <Download size={16} />
              Exportar meus registros
            </button>
            {local && (
              <button
                className="text-button danger clear-local"
                onClick={() => {
                  if (
                    window.confirm(
                      "Apagar todos os seus dados neste navegador? Esta ação não pode ser desfeita.",
                    )
                  ) {
                    clearLocal();
                    window.location.reload();
                  }
                }}
              >
                <Trash2 size={15} />
                Apagar dados locais
              </button>
            )}
          </section>
          {!local && <TransferData />}
          <section className="card settings-card">
            <div className="card-title">
              <span className="card-icon peach">
                <User size={21} />
              </span>
              <h2>Perfil e preferências</h2>
            </div>
            <p>
              Fuso horário: <strong>{profile.timezone}</strong>
            </p>
            <p>
              As datas dos registros seguem o dia escolhido no diário. Seu fuso
              define o que é “hoje”.
            </p>
            <button className="text-button" onClick={() => navigate("profile")}>
              Editar meu perfil
              <ArrowUpRight size={16} />
            </button>
          </section>
        </div>
      </div>
      {editing && <GoalEditor onClose={() => setEditing(false)} />}
    </>
  );
}
