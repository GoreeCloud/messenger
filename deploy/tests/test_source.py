"""Structural provenance tests; upstream source is not executed by this suite."""
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_source import EXPECTED_DIGEST, SOURCE, check_compose, check_compose_bindings, check_source, source_digest


class SourceChecks(unittest.TestCase):
    def test_vendored_manifest_and_license(self):
        self.assertEqual([], check_source())

    def test_pinned_source_matches_reference_digest(self):
        self.assertEqual(EXPECTED_DIGEST, source_digest(SOURCE))

    def test_local_compose_is_loopback_only(self):
        self.assertEqual([], check_compose("compose.yaml", False))

    def test_source_compose_builds_from_vendored_tree(self):
        self.assertEqual([], check_compose("compose.source.yaml", True))

    def test_exposed_public_port_is_rejected(self):
        unsafe = """services:
  synapse:
    ports:
      - "127.0.0.1:8008:8008"
      - "0.0.0.0:8448:8448"
"""
        self.assertTrue(check_compose_bindings(unsafe))

    def test_host_privileged_container_is_rejected(self):
        unsafe = """services:
  synapse:
    ports:
      - "127.0.0.1:8008:8008"
    privileged: true
"""
        self.assertTrue(check_compose_bindings(unsafe))

    def test_digest_changes_on_content_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "file.txt").write_text("one")
            first = source_digest(root)
            (root / "file.txt").write_text("two")
            self.assertNotEqual(first, source_digest(root))

    def test_symlink_escape_is_blocked(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "outside").symlink_to("/etc/passwd")
            with self.assertRaises(ValueError):
                source_digest(root)


if __name__ == "__main__":
    unittest.main()
