#!/usr/bin/env python3
"""Reutiliza somente configuração pública: vars GitHub ou bundle público da Vercel."""
import os
import re
import sys
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen


def public_config():
    url = os.environ.get("VITE_SUPABASE_URL", "").strip()
    key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not url or not key:
        site = os.environ.get("NUTRIA_SITE_URL", "https://dieta-beryl-two.vercel.app/")
        if urlparse(site).scheme != "https":
            raise RuntimeError("O endereço publicado deve usar HTTPS")
        with urlopen(site, timeout=30) as response:
            html = response.read().decode()
        assets = re.findall(r'<script\b[^>]*\bsrc=[\"\x27]([^\"\x27]+)[\"\x27]', html)
        content = []
        for asset in assets:
            address = urljoin(site, asset)
            if urlparse(address).netloc != urlparse(site).netloc:
                continue
            with urlopen(address, timeout=30) as response:
                content.append(response.read().decode())
        scripts = "\n".join(content)
        urls = set(re.findall(r'https://[a-z0-9-]+\.supabase\.co', scripts))
        keys = set(re.findall(r'sb_publishable_[A-Za-z0-9_-]{20,}', scripts))
        if not url and len(urls) == 1:
            url = urls.pop()
        if not key and len(keys) == 1:
            key = keys.pop()
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url) or not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]{20,}", key):
        raise RuntimeError("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nas Variables do GitHub, usando somente os valores públicos")
    if "\n" in key or "\r" in key:
        raise RuntimeError("Chave pública inválida")
    return url, key


if __name__ == "__main__":
    try:
        url, key = public_config()
        if "--check" not in sys.argv:
            with open(os.environ["GITHUB_ENV"], "a") as output:
                output.write("VITE_SUPABASE_URL=" + url + "\n")
                output.write("VITE_SUPABASE_PUBLISHABLE_KEY=" + key + "\n")
        print("URL e chave pública Supabase localizadas; nenhum valor foi registrado no log.")
    except Exception:
        raise SystemExit("Não foi possível obter configuração pública da Vercel. Defina as duas Variables públicas Supabase no repositório GitHub.")
