"""Offline unit tests. Never load actual homeserver secrets."""
import sys
import json
import os
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_homeserver import check_policy, check_dev_compose_policy, load_checked_yaml


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


def compose_config() -> dict:
    return {
        "services": {
            "synapse": {
                "image": "matrixdotorg/synapse@sha256:08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6",
                "pull_policy": "never",
                "ports": ["127.0.0.1:8008:8008"],
                "restart": "no",
                "security_opt": ["no-new-privileges:true"],
                "volumes": ["./data/synapse:/data"],
            }
        }
    }


class PreviewComposePolicyTests(unittest.TestCase):
    def test_restricted_dev_compose_is_accepted(self):
        self.assertEqual([], check_dev_compose_policy(compose_config()))

    def test_public_port_mappings_fail_closed(self):
        for unsafe in (
            "8008:8008", "0.0.0.0:8008:8008", "[::]:8008:8008",
            "127.0.0.1:8008:8448", 8008, "",
        ):
            with self.subTest(port=unsafe):
                config = compose_config()
                config["services"]["synapse"]["ports"] = [unsafe]
                self.assertTrue(check_dev_compose_policy(config))

    def test_source_image_must_preexist_and_never_trigger_implicit_build(self):
        config = compose_config()
        config["services"]["synapse"]["image"] = "goreecloud-messenger/synapse:1.163.0-source-local"
        self.assertEqual([], check_dev_compose_policy(config))
        config["services"]["synapse"]["build"] = {"context": "../third_party/synapse"}
        self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_mutable_external_tags_or_registry_pull(self):
        for image in ("matrixdotorg/synapse:v1.163.0", "matrixdotorg/synapse:latest",
                      "goreecloud-messenger/synapse:latest"):
            config = compose_config()
            config["services"]["synapse"]["image"] = image
            self.assertTrue(check_dev_compose_policy(config))
        config = compose_config()
        config["services"]["synapse"]["pull_policy"] = "always"
        self.assertTrue(check_dev_compose_policy(config))
        config = compose_config()
        del config["services"]["synapse"]["pull_policy"]
        self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_additional_unreviewed_services(self):
        config = compose_config()
        config["services"]["unknown"] = {"ports": ["0.0.0.0:8888:8888"]}
        self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_host_network_and_namespace_sharing(self):
        for key in ("network_mode", "pid", "ipc"):
            config = compose_config()
            config["services"]["synapse"][key] = "host"
            self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_privileged_devices_and_added_capabilities(self):
        for field, value in (
            ("privileged", True), ("privileged", "true"),
            ("devices", ["/dev/sda:/dev/sda"]),
            ("cap_add", ["SYS_ADMIN"]),
        ):
            config = compose_config()
            config["services"]["synapse"][field] = value
            self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_arbitrary_host_volumes(self):
        config = compose_config()
        config["services"]["synapse"]["volumes"] = ["/:/host:ro"]
        self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_missing_security_options_or_auto_restart(self):
        config = compose_config()
        config["services"]["synapse"].pop("security_opt")
        config["services"]["synapse"]["restart"] = "always"
        self.assertGreaterEqual(len(check_dev_compose_policy(config)), 2)

    def test_accepts_loopback_long_syntax(self):
        config = compose_config()
        config["services"]["synapse"]["ports"] = [{
            "target": 8008, "published": "8008",
            "host_ip": "127.0.0.1", "protocol": "tcp",
        }]
        self.assertEqual([], check_dev_compose_policy(config))

    def test_rejects_malformed_long_syntax_without_exception(self):
        for host in (["127.0.0.1"], "", "0.0.0.0", None):
            config = compose_config()
            config["services"]["synapse"]["ports"] = [{
                "target": 8008, "published": 8008, "host_ip": host,
            }]
            self.assertTrue(check_dev_compose_policy(config))

    def test_rejects_nonmapping_or_empty_ports(self):
        self.assertTrue(check_dev_compose_policy(["bad"]))
        config = compose_config()
        config["services"]["synapse"]["ports"] = []
        self.assertTrue(check_dev_compose_policy(config))


class SafeYamlInputTests(unittest.TestCase):
    class JsonParser:
        @staticmethod
        def safe_load(value):
            return json.loads(value)

    def test_opens_one_private_descriptor_without_persisting_input(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "synthetic.json"
            content = {"synthetic": True}
            source.write_text(json.dumps(content))
            os.chmod(source, 0o600)
            self.assertEqual(content, load_checked_yaml(source, self.JsonParser, private=True))

    def test_rejects_final_symlinks_and_world_readable_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "synthetic.json"
            source.write_text('{"synthetic":true}')
            os.chmod(source, 0o644)
            if os.name == "posix":
                with self.assertRaises(ValueError):
                    load_checked_yaml(source, self.JsonParser, private=True)
            symlink = Path(directory) / "alias.json"
            symlink.symlink_to(source)
            with self.assertRaises(OSError):
                load_checked_yaml(symlink, self.JsonParser, private=False)

    def test_refuses_directories_and_oversized_secret_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                load_checked_yaml(root, self.JsonParser, private=False)
            file = root / "large.json"
            file.write_bytes(b"x" * (1024 * 1024 + 1))
            os.chmod(file, 0o600)
            with self.assertRaises(ValueError):
                load_checked_yaml(file, self.JsonParser, private=True)


if __name__ == "__main__":
    unittest.main()
