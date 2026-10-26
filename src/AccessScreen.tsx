import { useEffect, useState, type FormEvent } from "react";
import { Leaf, ArrowRight, Check, Cloud } from "lucide-react";
import { enterEmailSpace } from "./auth";
export default function Auth({ error: initialError = "" }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  useEffect(() => setError(initialError), [initialError]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await enterEmailSpace(email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <div className="brand">
          <span className="brand-symbol">
            <Leaf size={27} />
          </span>
          nutria<span className="brand-period">.</span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">SUA ROTINA, SEMPRE COM VOCÊ</span>
          <h1>
            Um cuidado.
            <br />
            Em qualquer
            <br />
            lugar<span>.</span>
          </h1>
          <p>
            Registre uma refeição no celular. Acompanhe seu progresso no
            computador. Suas escolhas seguem com você.
          </p>
          <div className="auth-orbit">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-center">
              <Leaf size={68} strokeWidth={1.2} />
            </div>
            <span className="orbit-chip chip-one">
              <Check size={15} /> Seus dados na nuvem
            </span>
            <span className="orbit-chip chip-two">Sua rotina, na nuvem ✳</span>
          </div>
        </div>
        <small>SEU RITMO. SUAS ESCOLHAS. SUA JORNADA.</small>
      </aside>
      <main className="auth-main">
        <span className="auth-label">
          <Cloud size={16} />
          Seus registros em qualquer aparelho
        </span>
        <div className="auth-form-wrap">
          <h2>Seu bem-estar, conectado</h2>
          <p className="muted">
            Digite seu e-mail para abrir seus registros. Sem senha e sem
            confirmação por e-mail.
          </p>
          <form className="form" onSubmit={submit}>
            <label>
              Seu e-mail
              <input
                autoFocus
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button auth-submit" disabled={busy}>
              {busy ? "Abrindo…" : "Entrar no meu espaço"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-divider">
            <span>Entre direto, sem esperar</span>
          </div>
          <p className="small muted centered">
            Use o mesmo e-mail em todos os aparelhos. O acesso não verifica sua
            identidade: quem souber seu e-mail poderá abrir e alterar seus
            registros.
          </p>
        </div>
        <p className="auth-footer">
          <Leaf size={14} />
          Seu espaço de cuidado, onde você estiver.
        </p>
      </main>
    </div>
  );
}
