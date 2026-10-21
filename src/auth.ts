import type { User } from "@supabase/supabase-js";
import { supabase } from "./api";
import { errorMessage } from "./errors";
export function isAccount(user: User | null | undefined): user is User {
  return !!user?.email && !user.is_anonymous;
}
export async function getAccount(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errorMessage(error));
  return isAccount(data.session?.user) ? data.session!.user : null;
}
export async function sendAccessLink(email: string): Promise<void> {
  if (!supabase)
    throw new Error("A conexão com o Supabase ainda não foi configurada.");
  const address = email.trim().toLowerCase();
  const redirect = window.location.origin + window.location.pathname;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errorMessage(error));
  // Link an older anonymous session to an email, preserving its user_id and records.
  const result = data.session?.user.is_anonymous
    ? await supabase.auth.updateUser(
        { email: address },
        { emailRedirectTo: redirect },
      )
    : await supabase.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: redirect, shouldCreateUser: true },
      });
  if (result.error) throw new Error(errorMessage(result.error));
}
export async function signOutAccount() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error(errorMessage(error));
}
export function callbackError(clear = true): string {
  if (!window.location.hash) return "";
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has("error")) return "";
  if (clear)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  return "O link de acesso é inválido ou expirou. Solicite um novo e-mail abaixo.";
}

// Capture before the SDK consumes the callback fragment during initialization.
export const initialAccessError = callbackError(false);
