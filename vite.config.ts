import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { supabaseClientDefines } from "./config/client-env";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: supabaseClientDefines(
    loadEnv(mode, process.cwd(), [
      "VITE_SUPABASE_",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
    ]),
  ),
  server: { port: 5173, strictPort: true },
}));
