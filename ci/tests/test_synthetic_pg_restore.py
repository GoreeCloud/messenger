"""Offline policy checks for the nonproduction disposable Postgres restore script."""
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "deploy/smoke_synthetic_pg_restore.sh"


class SyntheticPostgresRestoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SCRIPT.read_text(encoding="utf-8")

    def test_shell_syntax_without_running_containers(self):
        check = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(0, check.returncode, check.stderr)

    def test_requires_operator_explicit_synthetic_ack(self):
        result = subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, timeout=5)
        self.assertEqual(2, result.returncode)
        self.assertIn("BLOCKED", result.stderr)

    def test_sandbox_has_no_network_privileges_mounts_or_host_ports(self):
        for required in (
            "--pull never", "--network none", "--read-only", "--user 70:70",
            "--memory 384m", "--pids-limit 64", "--cap-drop ALL",
            "--security-opt no-new-privileges", "--tmpfs", "--rm",
            'trap cleanup EXIT',
        ):
            self.assertIn(required, self.source)
        self.assertNotIn(" -v /", self.source)
        self.assertNotIn("--volume /", self.source)
        self.assertNotIn(" -p 5432", self.source)
        self.assertNotIn("--privileged", self.source)

    def test_waits_for_actual_synthetic_database_not_only_server_socket(self):
        self.assertIn('psql -X -qAt -v ON_ERROR_STOP=1', self.source)
        self.assertIn('-d gcm_synthetic -c "SELECT 1"', self.source)
        self.assertIn("grep -qx '1'", self.source)

    def test_pinned_canonical_cached_image_digest(self):
        self.assertRegex(self.source, r'postgres@sha256:[0-9a-f]{64}')
        self.assertNotIn("docker pull", self.source)
        self.assertIn('docker image inspect "$image"', self.source)

    def test_restore_is_synthetic_exact_and_remains_private(self):
        for expected in (
            "synthetic-only-test", "gcm_synthetic", "gcm_restored",
            "pg_dump -Fc", "pg_restore --exit-on-error",
            "SELECT count(*)", "NOT VERIFIED: Synapse keys/media",
        ):
            self.assertIn(expected, self.source)
        self.assertNotIn("pg_restore -d postgres", self.source)
        self.assertNotIn("docker cp ", self.source)


if __name__ == "__main__":
    unittest.main()
