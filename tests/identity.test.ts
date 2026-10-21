import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), signInAnonymously: vi.fn(), signOut: vi.fn() },
  rpc: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mock }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubGlobal("window", {
    location: {
      origin: "https://nutria.example",
      pathname: "/",
      search: "",
      hash: "",
    },
    history: { replaceState: vi.fn() },
    dispatchEvent: vi.fn(),
  });
  mock.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  mock.auth.signInAnonymously.mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  mock.rpc.mockResolvedValue({
    data: { id: "owner", email: "person@example.com" },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("não abre perfil sem sessão nem cria sessão automaticamente", async () => {
  const { getAccount } = await import("../src/auth");
  expect(await getAccount()).toBeNull();
  expect(mock.auth.signInAnonymously).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("resolve o proprietário no banco, sem confundir a sessão do aparelho com o perfil", async () => {
  mock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "device-session", is_anonymous: true } } },
    error: null,
  });
  const { getAccount } = await import("../src/auth");
  expect(await getAccount()).toEqual({
    id: "owner",
    email: "person@example.com",
  });
  expect(mock.rpc).toHaveBeenCalledWith("get_email_space");
});
it("uma sessão ainda não vinculada continua no formulário", async () => {
  mock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "guest" } } },
    error: null,
  });
  mock.rpc.mockResolvedValue({ data: null, error: null });
  const { getAccount } = await import("../src/auth");
  expect(await getAccount()).toBeNull();
});
it("entra apenas com e-mail usando a sessão técnica e sem solicitar OTP", async () => {
  const { enterEmailSpace } = await import("../src/auth");
  await enterEmailSpace(" PERSON@example.com ");
  expect(mock.auth.signInAnonymously).toHaveBeenCalledOnce();
  expect(mock.rpc).toHaveBeenCalledWith("enter_email_space", {
    address: "person@example.com",
  });
  expect(window.dispatchEvent).toHaveBeenCalledOnce();
});
it("reutiliza sessões existentes para preservar dados antigos", async () => {
  mock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "old" } } },
    error: null,
  });
  const { enterEmailSpace } = await import("../src/auth");
  await enterEmailSpace("person@example.com");
  expect(mock.auth.signInAnonymously).not.toHaveBeenCalled();
});
it("informa como habilitar sessões anônimas e não tenta salvar sem sessão", async () => {
  mock.auth.signInAnonymously.mockResolvedValue({
    error: { code: "anonymous_provider_disabled" },
  });
  const { enterEmailSpace } = await import("../src/auth");
  await expect(enterEmailSpace("person@example.com")).rejects.toThrow(
    "Anonymous Sign-Ins",
  );
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("informa a migração pendente sem abrir dados de outro espaço", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  const { enterEmailSpace } = await import("../src/auth");
  await expect(enterEmailSpace("person@example.com")).rejects.toThrow(
    "202610210002_email_spaces.sql",
  );
  expect(window.dispatchEvent).not.toHaveBeenCalled();
});
it("não cria sessão para endereço inválido", async () => {
  const { enterEmailSpace } = await import("../src/auth");
  await expect(enterEmailSpace("invalid")).rejects.toThrow("e-mail válido");
  expect(mock.auth.signInAnonymously).not.toHaveBeenCalled();
});
it("sai apenas do aparelho atual", async () => {
  mock.auth.signOut.mockResolvedValue({ error: null });
  const { signOutAccount } = await import("../src/auth");
  await signOutAccount();
  expect(mock.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("limpa erros de links antigos e orienta o acesso direto", async () => {
  window.location.hash = "#error=access_denied&error_code=otp_expired";
  const { callbackError } = await import("../src/auth");
  expect(callbackError()).toContain("informar seu e-mail");
  expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/");
});
