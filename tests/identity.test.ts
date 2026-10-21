import { beforeEach, afterEach, it, expect, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth }) }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
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
  });
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("exige conta por e-mail em vez de criar identidade anônima", async () => {
  const { getAccount } = await import("../src/auth");
  expect(await getAccount()).toBeNull();
});
it("reutiliza a mesma conta em aparelhos diferentes", async () => {
  auth.getSession.mockResolvedValue({
    data: {
      session: {
        user: {
          id: "same-user",
          email: "person@example.com",
          is_anonymous: false,
        },
      },
    },
    error: null,
  });
  const { getAccount } = await import("../src/auth");
  expect((await getAccount())?.id).toBe("same-user");
});
it("não abre dados da antiga sessão anônima sem vincular e-mail", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "old", is_anonymous: true } } },
    error: null,
  });
  const { getAccount } = await import("../src/auth");
  expect(await getAccount()).toBeNull();
});
it("envia link sem senha permitindo novas contas e retorno ao app", async () => {
  auth.signInWithOtp.mockResolvedValue({ error: null });
  const { sendAccessLink } = await import("../src/auth");
  await sendAccessLink(" PERSON@example.com ");
  expect(auth.signInWithOtp).toHaveBeenCalledWith({
    email: "person@example.com",
    options: {
      emailRedirectTo: "https://nutria.example/",
      shouldCreateUser: true,
    },
  });
});
it("vincula a sessão anônima anterior sem perder o id dos registros", async () => {
  auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "old", is_anonymous: true } } },
    error: null,
  });
  auth.updateUser.mockResolvedValue({ error: null });
  const { sendAccessLink } = await import("../src/auth");
  await sendAccessLink("person@example.com");
  expect(auth.updateUser).toHaveBeenCalledWith(
    { email: "person@example.com" },
    { emailRedirectTo: "https://nutria.example/" },
  );
  expect(auth.signInWithOtp).not.toHaveBeenCalled();
});
it("traduz limite de e-mail e permite tentar novamente", async () => {
  auth.signInWithOtp.mockResolvedValue({
    error: { code: "over_email_send_rate_limit" },
  });
  const { sendAccessLink } = await import("../src/auth");
  await expect(sendAccessLink("p@example.com")).rejects.toThrow(
    "Limite de envio",
  );
});
it("sai apenas do aparelho atual", async () => {
  auth.signOut.mockResolvedValue({ error: null });
  const { signOutAccount } = await import("../src/auth");
  await signOutAccount();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("remove o erro de retorno da URL sem expor tokens", async () => {
  window.location.hash = "#error=access_denied&error_code=otp_expired";
  const { callbackError } = await import("../src/auth");
  expect(callbackError()).toContain("expirou");
  expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/");
});
