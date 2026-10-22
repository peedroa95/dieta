import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { root, run, syncAndroid } from "./sync-android.mjs";

syncAndroid();
const sharedCache = existsSync("/workspace/.cache")
  ? "/workspace/.cache"
  : path.join(os.homedir(), ".cache", "nutria");
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(sharedCache, "android-sdk");
if (!existsSync(path.join(sdk, "platforms", "android-36", "android.jar")))
  throw new Error(
    "SDK Android 36 ausente. Instale pelo Android Studio ou execute npm run android:setup neste ambiente Linux.",
  );
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  GRADLE_USER_HOME:
    process.env.GRADLE_USER_HOME || path.join(sharedCache, "gradle"),
};
const cachedJdk = path.join(sharedCache, "jdk-21");
if (existsSync(path.join(cachedJdk, "bin", "javac"))) env.JAVA_HOME = cachedJdk;
const jvm = [];
// Use o proxy e os certificados do ambiente; nunca desative TLS ou checksums.
const proxyAddress = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyAddress) {
  const proxy = new URL(proxyAddress);
  jvm.push(
    `-Dhttps.proxyHost=${proxy.hostname}`,
    `-Dhttps.proxyPort=${proxy.port || 80}`,
    `-Dhttp.proxyHost=${proxy.hostname}`,
    `-Dhttp.proxyPort=${proxy.port || 80}`,
  );
  if (proxy.username || proxy.password)
    throw new Error(
      "Configure o proxy Java com autenticação fora do código do projeto.",
    );
}
const trust = path.join(sharedCache, "android-java-cacerts");
if (existsSync(trust)) jvm.push(`-Djavax.net.ssl.trustStore=${trust}`);
if (existsSync("/workspace/.cache")) {
  const userCache = path.join(sharedCache, "android-user");
  mkdirSync(userCache, { recursive: true });
  env.ANDROID_USER_HOME = userCache;
  jvm.push(`-Duser.home=${userCache}`);
}
env.JAVA_TOOL_OPTIONS = [env.JAVA_TOOL_OPTIONS || "", ...jvm].join(" ");
const windows = process.platform === "win32";
run(
  windows ? "gradlew.bat" : "./gradlew",
  ["assembleDebug", "--no-daemon", "--max-workers=2"],
  { cwd: path.join(root, "android"), env, shell: windows },
);
const artifacts = path.join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });
const destination = path.join(artifacts, "nutria-debug.apk");
copyFileSync(
  path.join(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
  destination,
);
const checksum = createHash("sha256")
  .update(readFileSync(destination))
  .digest("hex");
writeFileSync(destination + ".sha256", checksum + "  nutria-debug.apk\n");
console.log(`APK gerado: ${destination}`);
