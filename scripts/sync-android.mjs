import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnv } from "vite";

export const root = fileURLToPath(new URL("../", import.meta.url));
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} falhou (código ${result.status}).`);
}
export function syncAndroid() {
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
      "Configure a URL e a chave pública do Supabase no .env.local antes de gerar o APK integrado.",
    );
  run("npm", ["run", "build"]);
  run("npx", ["--no-install", "cap", "sync", "android"]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  syncAndroid();
