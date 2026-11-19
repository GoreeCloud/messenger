"""Offline unit tests. Never load actual homeserver secrets."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_homeserver import check_policy


def local_config():
    return {
        "server_name": "matrix.test.invalid",
        "enable_registration": False,
        "enable_registration_without_verification": False,
        "allow_guest_access": False,
        "url_preview_enabled": False,
        "report_stats": False,
        "enable_metrics": False,
        "enable_3pid_lookup": False,
        "app_service_config_files": [],
        "listeners": [
            {"port": 8008, "tls": False, "type": "http",
             "resources": [{"names": ["client"], "compress": False}]}
        ],
    }


class HomeserverPolicyTests(unittest.TestCase):
    def test_restricted_local_config(self):
        self.assertEqual([], check_policy(local_config()))

    def test_missing_explicit_false_fails_closed(self):
        item = local_config()
        del item["enable_registration"]
        self.assertTrue(any("enable_registration" in e for e in check_policy(item)))

    def test_open_registration_and_guest_access_rejected(self):
        item = local_config()
        item["enable_registration"] = True
        item["allow_guest_access"] = True
        self.assertEqual(2, len(check_policy(item)))

    def test_url_preview_is_disabled(self):
        item = local_config()
        item["url_preview_enabled"] = True
        self.assertTrue(any("url_preview_enabled" in e for e in check_policy(item)))

    def test_statistics_and_bridges_are_opt_in(self):
        item = local_config()
        item["report_stats"] = True
        item["app_service_config_files"] = ["/data/bridges.yaml"]
        self.assertEqual(2, len(check_policy(item)))

    def test_legacy_registration_override_is_detected(self):
        item = local_config()
        item["disable_registration"] = False
        self.assertTrue(any("disable_registration" in e for e in check_policy(item)))
        # Synapse parses quoted string "false" with strtobool, not YAML bool.
        item["disable_registration"] = "false"
        self.assertTrue(any("disable_registration" in e for e in check_policy(item)))

    def test_identity_lookup_and_telemetry_are_opt_in(self):
        item = local_config()
        item["enable_3pid_lookup"] = True
        item["enable_metrics"] = True
        item["sentry"] = {"dsn": "private"}
        self.assertEqual(3, len(check_policy(item)))

    def test_rejects_url_credentials(self):
        item = local_config()
        item["public_baseurl"] = "https://test:secret@matrix.test.invalid/"
        self.assertTrue(any("public_baseurl" in e for e in check_policy(item)))

    def test_no_client_listener_is_rejected(self):
        item = local_config()
        item["listeners"] = [{"port": 8448, "type": "http", "resources": [{"names": ["federation"]}]}]
        self.assertTrue(any("client" in e for e in check_policy(item)))

    def test_public_baseurl_rejects_http(self):
        item = local_config()
        item["public_baseurl"] = "http://matrix.test.invalid"
        self.assertTrue(any("public_baseurl" in e for e in check_policy(item)))

    def test_production_requires_postgres_and_https(self):
        item = local_config()
        item["database"] = {"name": "sqlite3"}
        errors = check_policy(item, "production")
        self.assertTrue(any("PostgreSQL" in e for e in errors))
        self.assertTrue(any("public_baseurl" in e for e in errors))
        item["database"] = {"name": "psycopg2"}
        item["public_baseurl"] = "https://matrix.test.invalid/"
        self.assertEqual([], check_policy(item, "production"))

    def test_rejects_nonmapping(self):
        self.assertTrue(check_policy([]))


if __name__ == "__main__":
    unittest.main()
