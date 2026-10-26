import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";
import { root, run } from "./sync-android.mjs";

export function syncIos() {
  const env = loadEnv("production", root, [
    "VITE_SUPABASE_",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
  ]);
  const url = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    env.SUPABASE_PUBLISHABLE_KEY ??
    env.VITE_SUPABASE_ANON_KEY;
  if (!url?.trim() || !key?.trim())
    throw new Error(
      "Configure a URL e a chave pública do Supabase antes de preparar o aplicativo iOS integrado.",
    );
  run("npm", ["run", "build"]);
  run("npx", ["--no-install", "cap", "sync", "ios"]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  syncIos();
