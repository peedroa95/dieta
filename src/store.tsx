import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  emptyData,
  type Data,
  type Table,
  type Row,
  type Profile,
  dateInZone,
} from "./domain";
import * as api from "./api";
interface Store {
  data: Data;
  local: boolean;
  userId: string;
  email: string;
  busy: boolean;
  refreshing: boolean;
  syncError: string;
  refresh: () => Promise<boolean>;
  notice: string;
  setNotice: (s: string) => void;
  run: (action: () => Promise<void>, message?: string) => Promise<boolean>;
  put: <T extends Row>(table: Table, rows: T[]) => Promise<void>;
  del: (table: Table, id: string) => Promise<void>;
  profile: Profile;
  today: string;
}
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
export function StoreProvider({
  children,
  local,
  userId,
  initial,
  email = "",
}: {
  children: ReactNode;
  local: boolean;
  userId: string;
  initial: Data;
  email?: string;
}) {
  const [data, setData] = useState(initial || emptyData());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const revision = useRef(0);
  const alive = useRef(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const pending = useRef<Promise<boolean> | null>(null);
  const refresh = useCallback((): Promise<boolean> => {
    if (locked.current) return Promise.resolve(false);
    if (pending.current) return pending.current;
    const started = revision.current;
    setRefreshing(true);
    pending.current = (async () => {
      try {
        const next = await api.load(local, userId);
        if (alive.current && started === revision.current && !locked.current) {
          setData(next);
          setSyncError("");
        }
        return true;
      } catch (e) {
        if (alive.current && started === revision.current && !locked.current)
          setSyncError(
            e instanceof Error ? e.message : "Não foi possível atualizar.",
          );
        return false;
      } finally {
        pending.current = null;
        if (alive.current) setRefreshing(false);
      }
    })();
    return pending.current;
  }, [local, userId]);
  useEffect(() => {
    alive.current = true;
    if (local)
      return () => {
        alive.current = false;
      };
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(onFocus, 30000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [local, refresh]);
  async function run(
    action: () => Promise<void>,
    message = "Salvo com sucesso.",
  ) {
    if (locked.current) return false;
    locked.current = true;
    revision.current++;
    setBusy(true);
    try {
      await action();
      try {
        setData(await api.load(local, userId));
        setSyncError("");
        if (message) setNotice(message);
      } catch (e) {
        setSyncError(
          e instanceof Error ? e.message : "Não foi possível atualizar.",
        );
        setNotice(
          "Salvo na nuvem. Não foi possível atualizar a tela; use Atualizar dados.",
        );
      }
      return true;
    } catch (e) {
      setNotice(
        `Não foi possível salvar: ${e instanceof Error ? e.message : "tente novamente"}`,
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const profile = data.profiles[0];
  return (
    <Context.Provider
      value={{
        data,
        local,
        userId,
        email,
        busy,
        refreshing,
        syncError,
        refresh,
        notice,
        setNotice,
        run,
        put: (table, rows) => api.save(local, table, rows),
        del: (table, id) => api.remove(local, table, id),
        profile,
        today: dateInZone(new Date(), profile?.timezone),
      }}
    >
      {children}
    </Context.Provider>
  );
}
