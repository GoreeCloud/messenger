"""Fail closed when editing the manual disposable Matrix test infrastructure."""
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/e2ee-disposable-local.yml"
RUNNER = ROOT / "deploy/smoke_ephemeral_e2ee.sh"
PROXY = ROOT / "web/scripts/ephemeral-tls-proxy.mjs"
IMMUTABLE_SYN = ("matrixdotorg/synapse@sha256:"
                 "08521a4b734b5474681378a2cd0a6fb9ee767529ce58dbaa987e337be8e6cfd6")


class DisposableMatrixPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text()
        cls.runner = RUNNER.read_text()
        cls.proxy = PROXY.read_text()

    def test_workflow_never_runs_automatically(self):
        event = self.workflow.split("\npermissions:", 1)[0]
        self.assertEqual(
            re.findall(r"(?m)^  ([A-Za-z_-]+):$", event),
            ["workflow_dispatch"],
        )
        for forbidden in ("pull_request:", "push:", "schedule:"):
            self.assertNotIn(forbidden, event)

    def test_pip_args_with_colons_use_yaml_block_scalar_not_broken_plain_value(self):
        self.assertIn("run: |\n          python3 -m pip install", self.workflow)
        self.assertNotIn("run: python3 -m pip install", self.workflow)

    def test_authorization_gate_precedes_job_and_credentials(self):
        self.assertIn("refs/heads/main", self.workflow)
        self.assertIn('"YES"', self.workflow)
        self.assertIn("needs: authorization-gate", self.workflow)
        self.assertIn("environment: messenger-e2ee-isolated", self.workflow)
        self.assertIn("permissions:\n  contents: read", self.workflow)
        self.assertIn("persist-credentials: false", self.workflow)
        self.assertNotIn("secrets.", self.workflow)
        self.assertNotIn("upload-artifact", self.workflow)

    def test_only_pinned_official_image_and_temporary_files(self):
        self.assertIn(IMMUTABLE_SYN, self.runner)
        self.assertIn('docker pull --quiet "$image"', self.runner)
        self.assertIn('docker network create --internal "$network"', self.runner)
        self.assertIn('--publish 127.0.0.1:18008:8008', self.runner)
        for guarded in (
            "--network none", "--read-only", "--cap-drop ALL",
            "--security-opt no-new-privileges", "--pids-limit",
            "--memory", "--cpus", "--mount", "--tmpfs",
            'trap cleanup EXIT', "mktemp -d",
        ):
            self.assertIn(guarded, self.runner)
        for dangerous in ("--privileged", "docker build", "docker login",
                          "--network host", "docker cp", "curl -k", "NODE_TLS_REJECT_UNAUTHORIZED=0"):
            self.assertNotIn(dangerous, self.runner)

    def test_accounts_disposable_tls_verified_no_artifact(self):
        for required in (
            'export MATRIX_TEST_DISPOSABLE_ACK="YES"',
            'export NODE_EXTRA_CA_CERTS=',
            'curl -fsS --cacert "$workspace/tls-cert.pem"',
            "openssl rand -hex 24", "register_new_matrix_user",
            "node web/scripts/e2ee-smoke.mjs",
            "MATRIX_TEST_A_PASSWORD", "MATRIX_TEST_B_PASSWORD",
            'GITHUB_ACTIONS', "--ack-disposable-only",
        ):
            self.assertIn(required, self.runner)
        self.assertNotIn("matrix.goreecloud.com", self.runner)
        self.assertNotIn("127.0.0.1:18008:8008/tcp", self.runner)

    def test_rejects_unacknowledged_local_execution_without_docker(self):
        code = subprocess.run(
            ["bash", str(RUNNER)], capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(2, code.returncode)
        self.assertIn("BLOCKED", code.stderr)

    def test_shell_syntax_and_proxy_no_external_bind(self):
        code = subprocess.run(["bash", "-n", str(RUNNER)], capture_output=True, text=True)
        self.assertEqual(0, code.returncode, code.stderr)
        self.assertIn('server.listen(18443, "127.0.0.1"', self.proxy)
        self.assertIn('hostname: "127.0.0.1"', self.proxy)
        self.assertNotIn("0.0.0.0", self.proxy)
        self.assertNotIn("localhost:443", self.proxy)


if __name__ == "__main__":
    unittest.main()
