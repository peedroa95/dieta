#!/usr/bin/env python3
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("public_env", Path(__file__).with_name("load-ios-env.py"))
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)
KEY = "sb_publishable_" + "public-test-value-for-fixture"
URL = "https://test-project.supabase.co"


class PublicConfigurationTests(unittest.TestCase):
    def test_explicit_public_variables_do_not_fetch(self):
        with patch.dict(os.environ, {"VITE_SUPABASE_URL": URL, "VITE_SUPABASE_PUBLISHABLE_KEY": KEY}, clear=True), patch.object(loader, "urlopen") as fetch:
            self.assertEqual(loader.public_config(), (URL, KEY))
            fetch.assert_not_called()

    def test_reads_public_script_on_same_origin_only(self):
        html = b'<script src="https://other.example/script.js"></script><script type="module" src="/assets/app.js"></script>'
        script = ('const url="' + URL + '", key="' + KEY + '";').encode()
        with patch.dict(os.environ, {}, clear=True), patch.object(loader, "urlopen", side_effect=[io.BytesIO(html), io.BytesIO(script)]) as fetch:
            self.assertEqual(loader.public_config(), (URL, KEY))
            self.assertEqual(fetch.call_count, 2)
            self.assertEqual(fetch.call_args_list[1].args[0], "https://dieta-beryl-two.vercel.app/assets/app.js")

    def test_rejects_ambiguous_configuration(self):
        script = (URL + ' https://another-project.supabase.co ' + KEY).encode()
        with patch.dict(os.environ, {}, clear=True), patch.object(loader, "urlopen", side_effect=[io.BytesIO(b'<script src="/app.js"></script>'), io.BytesIO(script)]):
            with self.assertRaises(RuntimeError):
                loader.public_config()

    def test_never_accepts_administrative_key(self):
        with patch.dict(os.environ, {"VITE_SUPABASE_URL": URL, "VITE_SUPABASE_PUBLISHABLE_KEY": "sb_secret_private-test-value"}, clear=True):
            with self.assertRaises(RuntimeError):
                loader.public_config()

    def test_rejects_http_origin(self):
        with patch.dict(os.environ, {"NUTRIA_SITE_URL": "http://example.com"}, clear=True), patch.object(loader, "urlopen") as fetch:
            with self.assertRaises(RuntimeError):
                loader.public_config()
            fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
