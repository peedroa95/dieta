import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nutria.dieta",
  appName: "Nutria",
  webDir: "dist",
  // Os arquivos da interface são empacotados no APK; a API continua no Supabase.
  server: { androidScheme: "https", cleartext: false },
  android: { backgroundColor: "#f7f8f4" },
  plugins: { SystemBars: { insetsHandling: "native", style: "LIGHT" } },
};
export default config;
