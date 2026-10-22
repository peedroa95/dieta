import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const nativeBack = "nutria-native-back";

export async function initializeNative() {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listeners = await Promise.all([
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) window.dispatchEvent(new Event("focus"));
    }),
    App.addListener("backButton", () => {
      const modal = document.querySelector("dialog[open]");
      if (modal) {
        modal.dispatchEvent(new Event("cancel", { cancelable: true }));
        return;
      }
      if (window.dispatchEvent(new Event(nativeBack, { cancelable: true })))
        void App.minimizeApp();
    }),
  ]);
  return () => {
    for (const listener of listeners) void listener.remove();
  };
}

export async function exportJsonFile(filename: string, contents: string) {
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: "exports/" + filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: "Meus registros do Nutria",
      url: file.uri,
      dialogTitle: "Salvar ou compartilhar meus registros",
    });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
