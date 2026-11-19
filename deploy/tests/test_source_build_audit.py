"""Zero-network, nonexecuting policy tests for source Dockerfile preflight."""
from pathlib import Path
import subprocess
import sys
import unittest

DEPLOY = Path(__file__).resolve().parents[1]
ROOT = DEPLOY.parent
sys.path.insert(0, str(DEPLOY))
from audit_source_build import SOURCE_DOCKERFILE, audit_dockerfile


class SourceBuildAuditTests(unittest.TestCase):
    def test_known_current_upstream_risks_are_detected(self):
        result = audit_dockerfile(SOURCE_DOCKERFILE.read_text())
        for code in (
            "MUTABLE_BASE_IMAGES", "REMOTE_SHELL_INSTALLER",
            "FLOATING_RUST_TOOLCHAIN", "OPTIONAL_LOCK_BYPASS"
        ):
            self.assertTrue(any(code in warning for warning in result), code)

    def test_immutable_clean_sample_has_no_known_patterns(self):
        safe = """FROM debian@sha256:ab34c6e03a7a505c1dc641dc6e3088efbf1cf3de18bca44e293af510fd5a6759
RUN echo "No remote code executed"
"""
        self.assertEqual([], audit_dockerfile(safe))

    def test_wget_piped_to_bash_is_identified(self):
        risk = "FROM scratch\nRUN wget -qO- https://example.invalid/bootstrap | bash\n"
        self.assertTrue(any("REMOTE_SHELL_INSTALLER" in r for r in audit_dockerfile(risk)))

    def test_strict_preflight_fails_without_executing_docker(self):
        result = subprocess.run(
            [sys.executable, str(DEPLOY / "audit_source_build.py"), "--strict"],
            cwd=ROOT, text=True, capture_output=True, timeout=15,
        )
        self.assertEqual(2, result.returncode)
        self.assertIn("REMOTE_SHELL_INSTALLER", result.stdout)

    def test_execute_requires_extra_explicit_risk_acknowledgement(self):
        result = subprocess.run(
            ["bash", str(DEPLOY / "build_source.sh"), "--execute"],
            cwd=ROOT, text=True, capture_output=True, timeout=15,
        )
        self.assertEqual(2, result.returncode)
        self.assertIn("BLOCKED", result.stderr)
        self.assertNotIn("Step 1/", result.stdout)

    def test_default_source_build_remains_dry_run(self):
        result = subprocess.run(
            ["bash", str(DEPLOY / "build_source.sh")],
            cwd=ROOT, text=True, capture_output=True, timeout=15,
        )
        self.assertEqual(0, result.returncode)
        self.assertIn("DRY RUN:", result.stdout)
        self.assertIn("REMOTE_SHELL_INSTALLER", result.stdout)


if __name__ == "__main__":
    unittest.main()
