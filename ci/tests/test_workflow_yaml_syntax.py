"""Validate GitHub Actions YAML syntax in required CI, without a downloaded linter."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
CI_FILE = WORKFLOWS / "ci.yml"


class WorkflowYamlSyntaxTests(unittest.TestCase):
    def test_required_backend_check_has_safe_syntax_guard(self):
        source = CI_FILE.read_text()
        backend = source.split("\n  backend:\n", 1)[1]
        self.assertIn("Validate all GitHub Actions workflow YAML syntax", backend)
        self.assertIn("YAML.parse_file(file)", backend)

    @unittest.skipUnless(shutil.which("ruby"), "Ruby is needed only for the optional local parser smoke.")
    def test_real_workflows_parse_without_executing_tasks(self):
        check = subprocess.run(
            ["ruby", "-ryaml", "-e",
             'Dir[".github/workflows/*.{yml,yaml}"].sort.each { |file| YAML.parse_file(file) }'],
            cwd=ROOT, capture_output=True, text=True, timeout=8,
        )
        self.assertEqual(0, check.returncode, check.stderr)

    @unittest.skipUnless(shutil.which("ruby"), "Ruby is needed only for the optional parser negative test.")
    def test_unquoted_colon_space_run_argument_is_rejected(self):
        malicious_yaml = "jobs:\n  backend:\n    steps:\n      - run: python3 -m pip --only-binary=:all: PyYAML==6.0.4\n"
        check = subprocess.run(
            ["ruby", "-ryaml", "-e", "YAML.parse(STDIN.read)"],
            input=malicious_yaml, capture_output=True, text=True, timeout=8,
        )
        self.assertNotEqual(0, check.returncode)


if __name__ == "__main__":
    unittest.main()
