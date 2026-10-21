/** Only these two public values may be forwarded from server env into the client. */
export function supabaseClientDefines(env: Record<string, string | undefined>) {
  const url =
    env.VITE_SUPABASE_URL !== undefined
      ? env.VITE_SUPABASE_URL
      : env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY !== undefined
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY
      : env.SUPABASE_PUBLISHABLE_KEY;
  const publicKey = key?.trim() || "";
  let role: unknown;
  try {
    role = JSON.parse(
      Buffer.from(publicKey.split(".")[1] || "", "base64url").toString(),
    ).role;
  } catch {
    /* Publishable keys are not JWTs. */
  }
  if (publicKey.startsWith("sb_secret_") || role === "service_role")
    throw new Error(
      "Use a chave pública publishable/anon do Supabase. Chaves administrativas não podem ser compiladas para o navegador.",
    );
  return {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url?.trim() || ""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      key?.trim() || "",
    ),
  };
}
