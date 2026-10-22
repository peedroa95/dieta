import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  native: vi.fn(),
  addListener: vi.fn(),
  minimize: vi.fn(),
  write: vi.fn(),
  share: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: mock.native },
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: mock.addListener, minimizeApp: mock.minimize },
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: mock.write },
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: mock.share } }));
import { initializeNative, exportJsonFile, nativeBack } from "../src/native";
const callbacks = new Map<string, (data?: { isActive: boolean }) => void>();
const remove = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  callbacks.clear();
  mock.native.mockReturnValue(true);
  mock.addListener.mockImplementation(async (name, callback) => {
    callbacks.set(name, callback);
    return { remove };
  });
  vi.stubGlobal("window", { dispatchEvent: vi.fn().mockReturnValue(true) });
  vi.stubGlobal("document", { querySelector: vi.fn().mockReturnValue(null) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("não registra plugins no site", async () => {
  mock.native.mockReturnValue(false);
  (await initializeNative())();
  expect(mock.addListener).not.toHaveBeenCalled();
});
it("retomar o aplicativo solicita atualização e remove listeners ao finalizar", async () => {
  const dispose = await initializeNative();
  callbacks.get("appStateChange")!({ isActive: false });
  expect(window.dispatchEvent).not.toHaveBeenCalled();
  callbacks.get("appStateChange")!({ isActive: true });
  expect((vi.mocked(window.dispatchEvent).mock.calls[0][0] as Event).type).toBe(
    "focus",
  );
  dispose();
  expect(remove).toHaveBeenCalledTimes(2);
});
it("Voltar fecha o formulário antes de navegar ou minimizar", async () => {
  const modal = { dispatchEvent: vi.fn() };
  vi.mocked(document.querySelector).mockReturnValue(
    modal as unknown as Element,
  );
  await initializeNative();
  callbacks.get("backButton")!();
  expect((modal.dispatchEvent.mock.calls[0][0] as Event).type).toBe("cancel");
  expect(window.dispatchEvent).not.toHaveBeenCalled();
  expect(mock.minimize).not.toHaveBeenCalled();
});
it("Voltar respeita a navegação interna e minimiza apenas na raiz", async () => {
  await initializeNative();
  vi.mocked(window.dispatchEvent).mockReturnValue(false);
  callbacks.get("backButton")!();
  expect(mock.minimize).not.toHaveBeenCalled();
  expect((vi.mocked(window.dispatchEvent).mock.calls[0][0] as Event).type).toBe(
    nativeBack,
  );
  vi.mocked(window.dispatchEvent).mockReturnValue(true);
  callbacks.get("backButton")!();
  expect(mock.minimize).toHaveBeenCalledOnce();
});
it("exporta JSON Android por arquivo privado e compartilhamento nativo", async () => {
  mock.write.mockResolvedValue({ uri: "file:///cache/exports/nutria.json" });
  await exportJsonFile("nutria.json", '{"foods":[]}');
  expect(mock.write).toHaveBeenCalledWith({
    path: "exports/nutria.json",
    data: '{"foods":[]}',
    directory: "CACHE",
    encoding: "utf8",
    recursive: true,
  });
  expect(mock.share).toHaveBeenCalledWith(
    expect.objectContaining({ url: "file:///cache/exports/nutria.json" }),
  );
});
it("mantém o download JSON no navegador sem chamar plugins", async () => {
  vi.useFakeTimers();
  mock.native.mockReturnValue(false);
  const anchor = { href: "", download: "", click: vi.fn() };
  vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(anchor) });
  const revoke = vi.fn();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn().mockReturnValue("blob:test"),
    revokeObjectURL: revoke,
  });
  await exportJsonFile("nutria.json", "{}");
  expect(anchor.download).toBe("nutria.json");
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(mock.write).not.toHaveBeenCalled();
  expect(mock.share).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revoke).toHaveBeenCalledWith("blob:test");
});
