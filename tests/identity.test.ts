import { beforeEach, afterEach, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});
afterEach(() => vi.unstubAllEnvs());
it("abre localmente sem exigir sessão quando não há Supabase", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  const api = await import("../src/api");
  expect(await api.ensurePersonalIdentity()).toBe(api.LOCAL_ID);
  expect(auth.getSession).not.toHaveBeenCalled();
});
it("reutiliza a identidade existente sem criar outro usuário", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "existing" } } },
    error: null,
  });
  const api = await import("../src/api");
  expect(await api.ensurePersonalIdentity()).toBe("existing");
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});
it("cria uma única sessão automática para chamadas concorrentes", async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.signInAnonymously.mockResolvedValue({
    data: { user: { id: "personal" } },
    error: null,
  });
  const api = await import("../src/api");
  expect(
    await Promise.all([
      api.ensurePersonalIdentity(),
      api.ensurePersonalIdentity(),
    ]),
  ).toEqual(["personal", "personal"]);
  expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
it("informa falhas do Supabase em vez de trocar silenciosamente de dados", async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.signInAnonymously.mockResolvedValue({
    data: { user: null },
    error: { message: "Anonymous sign-ins are disabled" },
  });
  const api = await import("../src/api");
  await expect(api.ensurePersonalIdentity()).rejects.toThrow(
    "Habilite Anonymous Sign-Ins",
  );
});
