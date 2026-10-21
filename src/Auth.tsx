import { useEffect, useState, type FormEvent } from "react";
import {
  Leaf,
  Mail,
  ArrowRight,
  Check,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { sendAccessLink } from "./auth";
export default function Auth({ error: initialError = "" }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => setError(initialError), [initialError]);
  useEffect(() => {
    if (!cooldown) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || cooldown) return;
    setBusy(true);
    setError("");
    try {
      await sendAccessLink(email);
      setSent(true);
      setCooldown(60);
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
            <span className="orbit-chip chip-two">Seu espaço, só seu ✳</span>
          </div>
        </div>
        <small>SEU RITMO. SUAS ESCOLHAS. SUA JORNADA.</small>
      </aside>
      <main className="auth-main">
        <span className="auth-label">
          <ShieldCheck size={16} />
          Cada pessoa tem seu próprio espaço
        </span>
        <div className="auth-form-wrap">
          {sent ? (
            <>
              <span className="empty-icon">
                <Mail size={26} />
              </span>
              <h2>Confira seu e-mail</h2>
              <p className="muted">
                Enviamos um link para{" "}
                <strong>{email.trim().toLowerCase()}</strong>. Abra o link para
                entrar, sem senha.
              </p>
              <p className="access-hint">
                Você pode abrir o link no celular ou no computador. Use o mesmo
                e-mail para acessar seus registros em todos os aparelhos.
              </p>
            </>
          ) : (
            <>
              <h2>Seu bem-estar, conectado</h2>
              <p className="muted">
                Entre ou crie sua conta com um link por e-mail. Cada pessoa
                acessa apenas seus próprios registros.
              </p>
            </>
          )}
          <form className="form" onSubmit={submit}>
            {!sent && (
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
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button auth-submit"
              disabled={busy || cooldown > 0}
            >
              {busy
                ? "Enviando…"
                : cooldown
                  ? `Reenviar em ${cooldown}s`
                  : sent
                    ? "Reenviar link"
                    : "Enviar link de acesso"}
              {!cooldown && <ArrowRight size={17} />}
            </button>
            {sent && (
              <button
                className="text-button centered"
                type="button"
                onClick={() => {
                  setSent(false);
                  setError("");
                }}
              >
                <ArrowLeft size={15} />
                Usar outro e-mail
              </button>
            )}
          </form>
          <div className="auth-divider">
            <span>Simples e sem senha</span>
          </div>
          <p className="small muted centered">
            Seu e-mail identifica sua conta. Para outra pessoa utilizar, basta
            entrar com o próprio e-mail.
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
