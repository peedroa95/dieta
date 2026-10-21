import { it, expect } from "vitest";
import { supabaseClientDefines } from "../config/client-env";
it("aceita os nomes públicos fornecidos pela integração Supabase", () => {
  const env = supabaseClientDefines({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-example",
  });
  expect(env).toEqual({
    "import.meta.env.VITE_SUPABASE_URL": '"https://example.supabase.co"',
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"public-example"',
  });
});
it("prioriza VITE e respeita valores explicitamente vazios dos testes isolados", () => {
  const env = supabaseClientDefines({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-example",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_PUBLISHABLE_KEY: "",
  });
  expect(env["import.meta.env.VITE_SUPABASE_URL"]).toBe('""');
  expect(env["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]).toBe('""');
});
it("nunca repassa chave secreta, service role ou URL JWKS para o navegador", () => {
  const env = supabaseClientDefines({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "private-sentinel",
    SUPABASE_SERVICE_ROLE_KEY: "admin-sentinel",
    SUPABASE_JWKS_URL: "private-metadata",
  });
  expect(Object.keys(env)).toHaveLength(2);
  expect(JSON.stringify(env)).not.toMatch(
    /private-sentinel|admin-sentinel|private-metadata/,
  );
  expect(env["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]).toBe('""');
});

it("recusa chaves administrativas colocadas por engano no campo público", () => {
  expect(() =>
    supabaseClientDefines({
      SUPABASE_PUBLISHABLE_KEY: "sb_secret_admin-sentinel",
    }),
  ).toThrow("chave pública");
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role" }),
  ).toString("base64url");
  expect(() =>
    supabaseClientDefines({
      VITE_SUPABASE_PUBLISHABLE_KEY: "test." + payload + ".test",
    }),
  ).toThrow("chave pública");
});
