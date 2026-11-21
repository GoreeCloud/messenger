"""Standard-library-only guard against unsafe edits to the live E2EE workflow.

This is static defense-in-depth. GitHub environment policy is separately
configured on the server and cannot be proven solely by repository tests.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/e2ee-isolated.yml"
HARNESS = ROOT / "web/scripts/e2ee-config.mjs"


class ManualE2EESafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = WORKFLOW.read_text(encoding="utf-8")

    def test_only_explicit_manual_trigger_is_present(self):
        preamble = self.source.split("\npermissions:", 1)[0]
        trigger = preamble.split("\non:\n", 1)[1]
        event_names = re.findall(r"(?m)^  ([A-Za-z_][A-Za-z_0-9-]*):", trigger)
        self.assertEqual(event_names, ["workflow_dispatch"])
        self.assertNotIn("pull_request:", preamble)
        self.assertNotIn("schedule:", preamble)
        self.assertNotIn("push:", preamble)

    def test_no_secret_needed_before_explicit_authorization(self):
        gate = self.source.split("  authorization-gate:\n", 1)[1].split(
            "  encrypted-two-account-roundtrip:\n", 1
        )[0]
        self.assertNotIn("secrets.", gate)
        self.assertIn("refs/heads/main", gate)
        self.assertIn('!= "YES"', gate)
        self.assertIn("disposable_accounts_ack", self.source)

    def test_credentials_are_protected_by_prior_gate_and_isolated_environment(self):
        test_job = self.source.split("  encrypted-two-account-roundtrip:\n", 1)[1]
        self.assertRegex(test_job, r"(?m)^    needs: authorization-gate$")
        self.assertRegex(test_job, r"(?m)^    environment: messenger-e2ee-isolated$")
        for required in (
            "MATRIX_TEST_HOMESERVER",
            "MATRIX_TEST_A_ID",
            "MATRIX_TEST_A_PASSWORD",
            "MATRIX_TEST_B_ID",
            "MATRIX_TEST_B_PASSWORD",
        ):
            self.assertIn("secrets." + required, test_job)
        self.assertIn("MATRIX_TEST_DISPOSABLE_ACK:", test_job)
        self.assertIn("npm run test:e2ee:live", test_job)

    def test_no_automatic_result_artifact_exposes_account_data(self):
        self.assertNotIn("upload-artifact", self.source)
        self.assertIn("contents: read", self.source)
        self.assertIn("MATRIX_TEST_DISPOSABLE_ACK", HARNESS.read_text())

    def test_backend_required_ci_invokes_offline_policy_suite(self):
        ci = (ROOT / ".github/workflows/ci.yml").read_text()
        backend = ci.split("\n  backend:\n", 1)[1]
        self.assertIn("python3 -m unittest discover -s ci/tests -v", backend)


if __name__ == "__main__":
    unittest.main()
