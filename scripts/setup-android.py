#!/usr/bin/env python3
"""Instala o SDK oficial Android no cache local, validando o arquivo baixado."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile


def main():
    sdk = Path(os.environ.get("ANDROID_HOME", "/workspace/.cache/android-sdk"))
    sdk.mkdir(parents=True, exist_ok=True)
    manager = sdk / "cmdline-tools/20.0/bin/sdkmanager"
    if not manager.exists():
        with urllib.request.urlopen("https://dl.google.com/android/repository/repository2-1.xml", timeout=60) as response:
            root = ET.fromstring(response.read())
        package = next(p for p in root.iter("remotePackage") if p.get("path") == "cmdline-tools;20.0")
        archive = next(a.find("complete") for a in package.findall("./archives/archive") if a.findtext("host-os") == "linux")
        filename = archive.findtext("url")
        if not filename or "/" in filename:
            raise RuntimeError("Nome inesperado no catálogo oficial Android")
        destination = sdk / filename
        urllib.request.urlretrieve("https://dl.google.com/android/repository/" + filename, destination)
        checksum = hashlib.sha1(destination.read_bytes()).hexdigest()
        if checksum != archive.findtext("checksum"):
            destination.unlink()
            raise RuntimeError("Checksum do Android SDK divergente do catálogo oficial")
        temporary = sdk / "extract-commandline"
        with zipfile.ZipFile(destination) as downloaded:
            downloaded.extractall(temporary)
        manager.parent.parent.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temporary / "cmdline-tools"), str(manager.parent.parent))
        shutil.rmtree(temporary)
        destination.unlink()
        for binary in manager.parent.iterdir():
            binary.chmod(binary.stat().st_mode | 0o111)
    command = [str(manager), "--sdk_root=" + str(sdk)]
    proxy = urllib.parse.urlparse(os.environ.get("HTTPS_PROXY", os.environ.get("https_proxy", "")))
    if proxy.hostname:
        command += ["--proxy=http", "--proxy_host=" + proxy.hostname, "--proxy_port=" + str(proxy.port or 80)]
    env = os.environ.copy()
    jdk = sdk.parent / "jdk-21"
    if (jdk / "bin/javac").exists():
        env["JAVA_HOME"] = str(jdk)
        env["PATH"] = str(jdk / "bin") + os.pathsep + env.get("PATH", "")
    user_cache = sdk.parent / "android-user"
    user_cache.mkdir(parents=True, exist_ok=True)
    env["ANDROID_USER_HOME"] = str(user_cache)
    env["JAVA_TOOL_OPTIONS"] = env.get("JAVA_TOOL_OPTIONS", "") + " -Duser.home=" + str(user_cache)
    trust = sdk.parent / "android-java-cacerts"
    certs = list(Path("/usr/local/share/ca-certificates").glob("*.crt"))
    if certs:
        java = Path(shutil.which("java", path=env.get("PATH"))).resolve().parent.parent
        shutil.copyfile(java / "lib/security/cacerts", trust)
        for index, cert in enumerate(certs):
            subprocess.run([str(java / "bin/keytool"), "-importcert", "-noprompt", "-alias", "nutria-environment-" + str(index), "-file", str(cert), "-keystore", str(trust), "-storepass", "changeit"], check=True)
        env["JAVA_TOOL_OPTIONS"] = env.get("JAVA_TOOL_OPTIONS", "") + " -Djavax.net.ssl.trustStore=" + str(trust)
    # SDK licenses are accepted only for the development/build requested by the user.
    subprocess.run(command + ["--licenses"], input="y\n" * 100, text=True, check=True, env=env)
    subprocess.run(command + ["platforms;android-36", "build-tools;35.0.0", "platform-tools"], check=True, env=env)
    print("Android SDK pronto:", sdk)


if __name__ == "__main__":
    main()
