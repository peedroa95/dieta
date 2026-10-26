import { mkdirSync } from "node:fs";
import path from "node:path";
import { root, run } from "./sync-android.mjs";
import { syncIos } from "./sync-ios.mjs";

if (process.platform !== "darwin")
  throw new Error(
    "A compilação iOS requer macOS com Xcode. Use o workflow iOS no GitHub Actions para compilar em um Mac na nuvem.",
  );
syncIos();
const build = path.join(root, "artifacts/ios");
mkdirSync(build, { recursive: true });
run("xcodebuild", [
  "-project",
  "ios/App/App.xcodeproj",
  "-scheme",
  "App",
  "-configuration",
  "Release",
  "-sdk",
  "iphonesimulator",
  "-destination",
  "generic/platform=iOS Simulator",
  "-derivedDataPath",
  build,
  "CODE_SIGNING_ALLOWED=NO",
  "build",
]);
console.log(
  "Build de simulador concluído. Não é instalável em iPhone; para instalar, use a distribuição assinada pelo TestFlight.",
);
