import { useState, useEffect } from "react";
import {
  Leaf,
  LayoutDashboard,
  BookOpen,
  Apple,
  Bookmark,
  BarChart3,
  Scale,
  User,
  Settings as SettingsIcon,
  ChevronDown,
  Plus,
  X,
  Menu,
  LoaderCircle,
} from "lucide-react";
import { supabase, ensurePersonalIdentity, initialize, load } from "./api";
import { StoreProvider, useStore } from "./store";
import { dateInZone, type Data } from "./domain";
import Dashboard from "./Dashboard";
import Diary, { AddFood } from "./Diary";
import Foods from "./Foods";
import Recipes from "./Recipes";
import { WeightPage, Reports } from "./Tracking";
import { Settings, ProfilePage } from "./Settings";
const nav = [
  { id: "home", name: "Início", icon: LayoutDashboard },
  { id: "diary", name: "Diário", icon: BookOpen },
  { id: "foods", name: "Meus alimentos", icon: Apple },
  { id: "recipes", name: "Refeições salvas", icon: Bookmark },
  { id: "reports", name: "Relatórios", icon: BarChart3 },
  { id: "weight", name: "Evolução do peso", icon: Scale },
  { id: "profile", name: "Meu perfil", icon: User },
  { id: "settings", name: "Configurações", icon: SettingsIcon },
];
function Shell() {
  const { profile, local, today, notice, setNotice, busy } = useStore();
  const [page, setPage] = useState("home");
  const [date, setDate] = useState(dateInZone(new Date(), profile.timezone));
  const [quick, setQuick] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice, setNotice]);
  function navigate(p: string) {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="Nutria início"
        >
          <span className="brand-symbol">
            <Leaf size={25} />
          </span>
          nutria<span className="brand-period">.</span>
        </button>
        <div className="workspace-label">SEU ESPAÇO DE CUIDADO</div>
        <nav aria-label="Navegação principal">
          {nav.map(({ id, name, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`${page === id ? "active" : ""} ${i === 6 ? "nav-divider" : ""}`}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{name}</span>
              {page === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-sparkle">✳</span>
            <h3>Progresso, não perfeição.</h3>
            <p>
              Cada pequena escolha
              <br />
              faz parte da sua jornada.
            </p>
            <Leaf size={49} strokeWidth={1} />
          </div>
          <button
            className="sidebar-profile"
            onClick={() => navigate("profile")}
          >
            <span className="avatar">
              {profile.name?.slice(0, 1).toUpperCase() || "N"}
            </span>
            <span>
              <strong>{profile.name || "Minha jornada"}</strong>
              <small>Meu espaço pessoal</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Meu espaço <span>/</span>{" "}
              <strong>{nav.find((n) => n.id === page)?.name}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              {new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="button compact"
              aria-label="Registrar alimento"
              onClick={() => setQuick(true)}
            >
              <Plus size={16} />
              <span>Registrar alimento</span>
            </button>
          </div>
        </header>
        {local && (
          <div className="demo-banner">
            <span>
              <span className="status-dot" />
              Uso pessoal • dados salvos neste navegador
            </span>
            <button onClick={() => navigate("settings")}>Meus dados</button>
          </div>
        )}
        <main className="main-content" aria-busy={busy}>
          {page === "home" ? (
            <Dashboard date={date} setDate={setDate} navigate={navigate} />
          ) : page === "diary" ? (
            <Diary date={date} setDate={setDate} />
          ) : page === "foods" ? (
            <Foods />
          ) : page === "recipes" ? (
            <Recipes date={date} />
          ) : page === "reports" ? (
            <Reports />
          ) : page === "weight" ? (
            <WeightPage />
          ) : page === "profile" ? (
            <ProfilePage />
          ) : (
            <Settings navigate={navigate} />
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} />
              nutria · nutrição com leveza
            </span>
            <span>Seu ritmo. Suas escolhas.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegação no celular">
        {nav.slice(0, 3).map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
        <button
          className={page === "reports" ? "active" : ""}
          onClick={() => navigate("reports")}
        >
          <BarChart3 size={21} />
          <span>Relatórios</span>
        </button>
        <button onClick={() => setMobile(true)}>
          <Menu size={21} />
          <span>Mais</span>
        </button>
      </nav>
      {notice && (
        <div
          className={`toast ${notice.startsWith("Não") ? "toast-error" : ""}`}
          role="status"
        >
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dispensar mensagem"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {quick && <AddFood date={date} onClose={() => setQuick(false)} />}
    </div>
  );
}
export default function App() {
  const local = !supabase;
  const [ready, setReady] = useState<{ data: Data; userId: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    setReady(null);
    void (async () => {
      try {
        const userId = await ensurePersonalIdentity();
        await initialize(local, userId);
        const data = await load(local);
        if (!cancelled) setReady({ data, userId });
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir seus dados.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [local, retry]);
  if (error)
    return (
      <div className="loading-screen">
        <Leaf size={40} />
        <h2>Vamos abrir seu espaço</h2>
        <p role="alert">{error}</p>
        <p>
          {local
            ? "Seus dados locais foram preservados. Tente novamente."
            : "Confira a configuração do Supabase e as migrações indicadas no README."}
        </p>
        <button className="button" onClick={() => setRetry((v) => v + 1)}>
          Tentar novamente
        </button>
      </div>
    );
  if (!ready)
    return (
      <div className="loading-screen">
        <LoaderCircle className="spinner" size={32} />
        <p>Preparando seu espaço…</p>
      </div>
    );
  return (
    <StoreProvider
      key={ready.userId}
      local={local}
      userId={ready.userId}
      initial={ready.data}
    >
      <Shell />
    </StoreProvider>
  );
}
