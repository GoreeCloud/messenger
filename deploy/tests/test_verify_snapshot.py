"""No-network snapshot verification with fabricated, never real, backup bytes."""
import hashlib
import json
import subprocess
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_snapshot import SnapshotError, verify_snapshot, copy_to_empty_rehearsal


class SnapshotRehearsalTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.parent = Path(self.temporary.name)
        self.snapshot = self.parent / "fixture"
        self.snapshot.mkdir()
        self.db = self.snapshot / "database.dump"
        self.db.write_bytes(b"SYNTHETIC_NON_DATABASE_DATA_TEST_ONLY")
        self._rewrite_manifest()

    def _rewrite_manifest(self, extra=None):
        entries = [self._entry("database.dump")]
        if extra:
            entries.extend(extra)
        (self.snapshot / "manifest.json").write_text(
            json.dumps({"version": 1, "files": entries}), encoding="utf-8"
        )

    def _entry(self, name):
        data = (self.snapshot / name).read_bytes()
        return {"name": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    def test_verifies_synthetic_database_without_postgres(self):
        self.assertEqual(("database.dump",), verify_snapshot(self.snapshot))

    def test_verifies_synthetic_media_as_an_opaque_blob(self):
        (self.snapshot / "media.tar").write_bytes(b"synthetic-media-bundle-test-only")
        self._rewrite_manifest([self._entry("media.tar")])
        self.assertEqual(("database.dump", "media.tar"), verify_snapshot(self.snapshot))

    def test_detects_corrupted_snapshot_and_size_change(self):
        self.db.write_bytes(b"tampered but synthetic")
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)

    def test_rejects_missing_database_or_traversal(self):
        manifest = {"version": 1, "files": [{
            "name": "../secrets", "bytes": 1, "sha256": "0" * 64
        }]}
        (self.snapshot / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)

    def test_rejects_symlink_snapshot_file(self):
        self.db.unlink()
        self.db.symlink_to(self.parent / "outside-file")
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)

    def test_rejects_symlink_root(self):
        alias = self.parent / "shortcut"
        alias.symlink_to(self.snapshot, target_is_directory=True)
        with self.assertRaises(SnapshotError):
            verify_snapshot(alias)

    def test_rejects_duplicate_manifest_records(self):
        self._rewrite_manifest([self._entry("database.dump")])
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)

    def test_rejects_noncanonical_sha_and_boolean_size(self):
        manifest = json.loads((self.snapshot / "manifest.json").read_text())
        manifest["files"][0]["bytes"] = True
        (self.snapshot / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)

    def test_copy_into_fresh_private_directory_and_rechecks(self):
        dest = self.parent / "private-restore-input"
        names = copy_to_empty_rehearsal(self.snapshot, dest)
        self.assertEqual(names, ("database.dump",))
        self.assertEqual(verify_snapshot(dest), names)
        self.assertEqual((dest / "database.dump").read_bytes(), self.db.read_bytes())
        self.assertEqual(dest.stat().st_mode & 0o777, 0o700)
        self.assertEqual((dest / "database.dump").stat().st_mode & 0o777, 0o600)

    def test_never_overwrites_existing_or_symlink_destination(self):
        dest = self.parent / "existing"
        dest.mkdir()
        marker = dest / "marker"
        marker.write_text("preserve")
        with self.assertRaises(SnapshotError):
            copy_to_empty_rehearsal(self.snapshot, dest)
        self.assertEqual(marker.read_text(), "preserve")

    def test_cli_requires_acknowledgement_for_sensitive_copy(self):
        dest = self.parent / "isolated-test"
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / "verify_snapshot.py"),
             "--snapshot-dir", str(self.snapshot), "--rehearsal-dir", str(dest)],
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("BLOCKED", result.stdout)
        self.assertFalse(dest.exists())

    def test_cli_verify_only_never_creates_a_scratch_copy(self):
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / "verify_snapshot.py"),
             "--snapshot-dir", str(self.snapshot)],
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("NOT VERIFIED", result.stdout)

    def test_rejects_unlisted_extra_snapshot_contents(self):
        (self.snapshot / "secret.txt").write_text("synthetic unlisted data")
        with self.assertRaisesRegex(SnapshotError, "unlisted"):
            verify_snapshot(self.snapshot)

    def test_refuses_special_files_in_manifest(self):
        self.db.unlink()
        self.db.mkdir()
        with self.assertRaises(SnapshotError):
            verify_snapshot(self.snapshot)


if __name__ == "__main__":
    unittest.main()
