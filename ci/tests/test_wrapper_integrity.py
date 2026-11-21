"""Wrapper source integrity check works and refuses modified or missing bytes."""
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ci"))
from check_android_wrapper import OFFICIAL, check, matches_sha


class AndroidWrapperTest(unittest.TestCase):
    def test_pinned_official_generated_wrapper_is_present(self):
        self.assertEqual([], check(ROOT))

    def test_corrupt_content_fails_hash_check(self):
        with tempfile.TemporaryDirectory() as scratch:
            file = pathlib.Path(scratch) / "gradle-wrapper.jar"
            file.write_bytes(b"tampered-test-data")
            self.assertFalse(matches_sha(file, OFFICIAL["android/gradle/wrapper/gradle-wrapper.jar"]))

    def test_missing_or_symlink_wrapper_is_rejected(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = pathlib.Path(scratch)
            missing = root / "missing.jar"
            self.assertFalse(matches_sha(missing, "0" * 64))
            symlink = root / "link.jar"
            symlink.symlink_to(ROOT / "android/gradle/wrapper/gradle-wrapper.jar")
            self.assertFalse(matches_sha(symlink, OFFICIAL["android/gradle/wrapper/gradle-wrapper.jar"]))


if __name__ == "__main__":
    unittest.main()
