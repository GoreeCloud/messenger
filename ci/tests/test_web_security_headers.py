"""Offline review of the nondeployed Caddy browser-header example."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "deploy/web-security.Caddyfile.example"


class WebBrowserHeadersTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = EXAMPLE.read_text(encoding="utf-8")

    def test_template_is_not_a_live_goreecloud_hostname(self):
        self.assertIn("messenger.example.invalid {", self.source)
        self.assertNotIn("messenger.goreecloud.com {", self.source)

    def test_explicit_privacy_browser_headers(self):
        for directive in (
            "Referrer-Policy", "no-referrer", "X-Frame-Options", "DENY",
            "X-Content-Type-Options", "nosniff", "Permissions-Policy",
            "geolocation=()", "Content-Security-Policy-Report-Only",
        ):
            self.assertIn(directive, self.source)

    def test_report_only_csp_restricts_code_and_uses_tls_transport(self):
        line = next(line for line in self.source.splitlines()
                    if line.strip().startswith("Content-Security-Policy-Report-Only "))
        for value in ("object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
                      "script-src 'self' 'wasm-unsafe-eval'",
                      "connect-src 'self' https: wss:",
                      "worker-src 'self' blob:"):
            self.assertIn(value, line)
        self.assertNotIn(" 'unsafe-eval'", line)
        self.assertNotIn(" 'unsafe-inline'", line)

    def test_template_must_not_claim_enforced_csp(self):
        self.assertNotIn('Content-Security-Policy "', self.source)
        self.assertIn("Report-Only:", self.source)


if __name__ == "__main__":
    unittest.main()
