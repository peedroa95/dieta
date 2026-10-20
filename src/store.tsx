import {
  createContext,
  useContext,
  useState,
  useRef,
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
  busy: boolean;
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
}: {
  children: ReactNode;
  local: boolean;
  userId: string;
  initial: Data;
}) {
  const [data, setData] = useState(initial || emptyData());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  async function run(
    action: () => Promise<void>,
    message = "Salvo com sucesso.",
  ) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      await action();
      setData(await api.load(local));
      if (message) setNotice(message);
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
        busy,
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
