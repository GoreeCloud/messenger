"""Offline safety checks for manual GitHub-hosted Android instrumentation."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/android-emulator-isolated.yml"


class DisposableAndroidWorkflowPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.content = WORKFLOW.read_text(encoding="utf-8")

    def test_manual_only_protected_main_with_yes_ack(self):
        before = self.content.split("\npermissions:", 1)[0]
        self.assertEqual(
            re.findall(r"(?m)^  ([a-z_]+):$", before),
            ["workflow_dispatch"],
        )
        self.assertIn('"refs/heads/main"', self.content)
        self.assertIn('"YES"', self.content)
        self.assertIn("needs: authorization-gate", self.content)
        self.assertNotIn("pull_request:", before)
        self.assertNotIn("push:", before)
        self.assertNotIn("schedule:", before)

    def test_limited_environment_privileges_and_no_secret_uploads(self):
        for required in (
            "contents: read",
            "persist-credentials: false",
            "environment: messenger-android-emulator",
            "timeout-minutes: 40",
        ):
            self.assertIn(required, self.content)
        for prohibited in ("secrets.", "upload-artifact", "workflow_run:", "actions/cache/save"):
            self.assertNotIn(prohibited, self.content)

    def test_signed_source_and_wrapper_are_verified(self):
        for required in ("python3 ci/check_gc_ui_source.py",
                         "python3 ci/check_android_wrapper.py",
                         'java-version: "21"',
                         "android-37.0",
                         "build-tools;36.0.0"):
            self.assertIn(required, self.content)

    def test_pinned_reviewed_emulator_runner_on_sdk_35(self):
        self.assertIn(
            "ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d",
            self.content,
        )
        for required in ("api-level: 35", "target: google_apis",
                         "arch: x86_64", "working-directory: android",
                         "connectedDebugAndroidTest", "--no-daemon",
                         "emulator-boot-timeout: 600"):
            self.assertIn(required, self.content)

    def test_kvm_change_is_runner_only_and_not_a_production_device_action(self):
        self.assertIn('"$GITHUB_ACTIONS" != "true"', self.content)
        self.assertIn('"$GITHUB_REF" != "refs/heads/main"', self.content)
        self.assertIn("if [[ -e /dev/kvm ]]; then", self.content)
        self.assertNotIn("ssh ", self.content)
        self.assertNotIn("adb install", self.content)
        self.assertNotIn("goreecloud-vps", self.content)

    def test_only_existing_synthetic_android_tests_are_invoked(self):
        self.assertIn("connectedDebugAndroidTest", self.content)
        self.assertNotIn("test:e2ee:live", self.content)
        base = ROOT / "android/app/src/androidTest/java/com/goreecloud/messenger"
        self.assertTrue((base / "AndroidSessionVaultInstrumentedTest.kt").is_file())
        self.assertTrue((base / "MessengerOnboardingInstrumentedTest.kt").is_file())


if __name__ == "__main__":
    unittest.main()
