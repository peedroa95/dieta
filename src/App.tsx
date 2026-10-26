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
  LogOut,
  Cloud,
} from "lucide-react";
import { supabase, LOCAL_ID, initialize, load } from "./api";
import {
  getAccount,
  accountChanged,
  type Account,
  signOutAccount,
  callbackError,
  initialAccessError,
} from "./auth";
import Auth from "./AccessScreen";
import { nativeBack } from "./native";
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
function Shell({
  account,
  onExit,
}: {
  account: Account | null;
  onExit: () => Promise<void>;
}) {
  const {
    profile,
    local,
    today,
    notice,
    setNotice,
    busy,
    refreshing,
    syncError,
  } = useStore();
  const [page, setPage] = useState("home");
  const [date, setDate] = useState(dateInZone(new Date(), profile.timezone));
  const [quick, setQuick] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice, setNotice]);
  useEffect(() => {
    const back = (event: Event) => {
      if (mobile) {
        event.preventDefault();
        setMobile(false);
      } else if (page !== "home") {
        event.preventDefault();
        setPage("home");
      }
    };
    window.addEventListener(nativeBack, back);
    return () => window.removeEventListener(nativeBack, back);
  }, [page, mobile]);
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
              <small>{account?.email || "Meu espaço local"}</small>
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
            {!local && (
              <span className="sync-status">
                <Cloud size={14} />
                {syncError
                  ? "Sem conexão"
                  : refreshing
                    ? "Atualizando…"
                    : "Na nuvem"}
              </span>
            )}
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
            {account && (
              <button
                className="icon-button"
                aria-label="Sair da conta"
                title="Sair da conta neste aparelho"
                disabled={busy}
                onClick={() =>
                  void onExit().catch((e) =>
                    setNotice("Não foi possível sair: " + e.message),
                  )
                }
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        {local && (
          <div className="demo-banner">
            <span>
              <span className="status-dot" />
              Dados apenas neste navegador • sincronização ainda não configurada
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
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(local);
  const [authError, setAuthError] = useState(initialAccessError);
  const [ready, setReady] = useState<{ data: Data; userId: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let version = 0;
    if (authError) callbackError();
    async function refreshAccount() {
      const request = ++version;
      try {
        const user = await getAccount();
        if (!cancelled && request === version) {
          setAccount(user);
          setAuthReady(true);
          if (user) setAuthError("");
        }
      } catch (e) {
        if (!cancelled && request === version) {
          setAuthError((e as Error).message);
          setAuthReady(true);
        }
      }
    }
    const changed = () => {
      void refreshAccount();
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        version++;
        if (!cancelled) {
          setAccount(null);
          setAuthReady(true);
        }
      } else {
        // Supabase holds its auth lock during this callback; read the RPC afterwards.
        setTimeout(() => {
          if (!cancelled) void refreshAccount();
        }, 0);
      }
    });
    window.addEventListener(accountChanged, changed);
    void refreshAccount();
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener(accountChanged, changed);
    };
  }, []);
  const activeId = local ? LOCAL_ID : account?.id;
  useEffect(() => {
    let cancelled = false;
    setReady(null);
    setError("");
    if (!activeId) return;
    void (async () => {
      try {
        await initialize(local, activeId);
        const data = await load(local, activeId);
        if (!cancelled) setReady({ data, userId: activeId });
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
  }, [local, activeId, retry]);
  if (!local && authReady && !account) return <Auth error={authError} />;
  if (error && activeId)
    return (
      <div className="loading-screen">
        <Leaf size={40} />
        <h2>Vamos abrir seu espaço</h2>
        <p role="alert">{error}</p>
        <p>
          {local
            ? "Seus dados locais foram preservados. Tente novamente."
            : "Confira a conexão e as migrações do Supabase indicadas no README."}
        </p>
        <button className="button" onClick={() => setRetry((v) => v + 1)}>
          Tentar novamente
        </button>
        {!local && (
          <button
            className="button secondary"
            onClick={() =>
              void signOutAccount().catch((e) => setError(e.message))
            }
          >
            Sair da conta
          </button>
        )}
      </div>
    );
  if (!authReady || !ready || ready.userId !== activeId)
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
      email={account?.email || ""}
    >
      <Shell account={account} onExit={signOutAccount} />
    </StoreProvider>
  );
}
