"""Offline check: GitHub Actions are pinned to immutable 40-hex revisions."""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
USES = re.compile(r"^\s*-\s*uses:\s*(\S+)", re.MULTILINE)

class PinningTests(unittest.TestCase):
    def test_workflows_have_only_commit_pinned_remote_actions(self):
        workflow_paths = sorted((ROOT / ".github/workflows").glob("*.yml"))
        self.assertTrue(workflow_paths)
        for path in workflow_paths:
            refs = USES.findall(path.read_text(encoding="utf-8"))
            self.assertTrue(refs, path.name)
            for ref in refs:
                self.assertRegex(ref, r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-f]{40}$",
                                 msg=(path.name, ref))
                self.assertNotIn("@main", ref)
                self.assertNotIn("@master", ref)

    def test_pinned_revisions_preserve_human_readable_major_version(self):
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            for line in path.read_text(encoding="utf-8").splitlines():
                if "- uses:" in line:
                    self.assertRegex(line, r"#[ ]+v[0-9]+\s*$", path.name)

if __name__ == "__main__":
    unittest.main()
