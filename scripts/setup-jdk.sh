#!/usr/bin/env bash
# Instalador local de OpenJDK 21 para este ambiente Debian; não altera pacotes do sistema.
set -euo pipefail
nutria_cache="/workspace/.cache"
nutria_apt="$nutria_cache/android-apt"
if [[ -x "$nutria_cache/jdk-21/bin/javac" ]]; then
  "$nutria_cache/jdk-21/bin/javac" -version
  exit 0
fi
mkdir -p "$nutria_apt"/{lists/partial,cache/archives/partial,conf.d,sourceparts,packages,unpack}
cat > "$nutria_apt/sources.list" <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian-security trixie-security main
SOURCES
cat > "$nutria_apt/apt.conf" <<CONF
Dir::Etc::parts "$nutria_apt/conf.d";
Dir::Etc::main "-";
Dir::Etc::sourcelist "$nutria_apt/sources.list";
Dir::Etc::sourceparts "$nutria_apt/sourceparts";
Dir::State "$nutria_apt";
Dir::Cache "$nutria_apt/cache";
APT::Sandbox::User "$(id -un)";
CONF
APT_CONFIG="$nutria_apt/apt.conf" apt-get update
cd "$nutria_apt/packages"
APT_CONFIG="$nutria_apt/apt.conf" apt-get download openjdk-21-jdk-headless openjdk-21-jre-headless
for nutria_package in ./*.deb; do
  dpkg-deb -x "$nutria_package" "$nutria_apt/unpack"
done
cp -a "$nutria_apt/unpack/usr/lib/jvm/java-21-openjdk-amd64" "$nutria_cache/jdk-21"
"$nutria_cache/jdk-21/bin/java" -version
"$nutria_cache/jdk-21/bin/javac" -version
