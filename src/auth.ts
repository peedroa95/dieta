import { supabase } from "./api";
import { errorMessage } from "./errors";

export interface Account {
  id: string;
  email: string;
}
export const accountChanged = "nutria-account-changed";
function accountResult(value: unknown): Account | null {
  const data = value as Account | null;
  return data && typeof data.id === "string" && typeof data.email === "string"
    ? { id: data.id, email: data.email }
    : null;
}
export async function getAccount(): Promise<Account | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errorMessage(error));
  if (!data.session) return null;
  const result = await supabase.rpc("get_email_space");
  if (result.error) throw new Error(errorMessage(result.error));
  return accountResult(result.data);
}
export async function enterEmailSpace(email: string): Promise<void> {
  if (!supabase)
    throw new Error("A conexão com o Supabase ainda não foi configurada.");
  const address = email.trim().toLowerCase();
  if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    throw new Error("Informe um endereço de e-mail válido.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errorMessage(error));
  if (!data.session) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error) throw new Error(errorMessage(result.error));
  }
  const result = await supabase.rpc("enter_email_space", { address });
  if (result.error) throw new Error(errorMessage(result.error));
  if (!accountResult(result.data))
    throw new Error("Não foi possível abrir o espaço deste e-mail.");
  window.dispatchEvent(new Event(accountChanged));
}
export async function signOutAccount() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error(errorMessage(error));
}
export function callbackError(clear = true): string {
  if (typeof window === "undefined" || !window.location.hash) return "";
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("error")) return "";
  if (clear)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  return "Este link antigo expirou. Agora basta informar seu e-mail para entrar.";
}
// Mantém compatibilidade com links antigos, sem solicitar novos e-mails.
export const initialAccessError = callbackError(false);
