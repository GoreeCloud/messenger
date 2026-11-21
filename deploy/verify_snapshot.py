#!/usr/bin/env python3
"""Offline PostgreSQL/media snapshot integrity verifier; never runs pg_restore.

The verified-hash manifest is NOT signed. This does not establish that
the supplied database dump is internally valid or server restorable.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat

_ALLOWED = frozenset({"database.dump", "media.tar"})
_MAX_MANIFEST_BYTES = 16_384
_MAX_FILE_BYTES = 1024**4

class SnapshotError(ValueError):
    pass


def _safe_read(path: Path):
    """Open a regular file via one FD, refusing symlink swaps at open-time."""
    if not hasattr(os, "O_NOFOLLOW"):
        raise SnapshotError("This platform cannot reject snapshot symlinks safely.")
    flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0)
    try:
        fd = os.open(path, flags)
    except OSError as exc:
        raise SnapshotError("Snapshot entry cannot be safely opened.") from exc
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise SnapshotError("Snapshot entries must be regular files, not links or devices.")
        handle = os.fdopen(fd, "rb")
        fd = -1  # Ownership transferred to the file context manager.
        return handle
    finally:
        if fd >= 0:
            os.close(fd)


def _file_sha256(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    with _safe_read(path) as handle:
        size = os.fstat(handle.fileno()).st_size
        if size < 1 or size > _MAX_FILE_BYTES:
            raise SnapshotError("Snapshot entry size is unsupported.")
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return size, digest.hexdigest()


def verify_snapshot(directory: Path) -> tuple[str, ...]:
    if directory.is_symlink() or not directory.is_dir():
        raise SnapshotError("Snapshot directory must exist and cannot be a symlink.")
    manifest_path = directory / "manifest.json"
    try:
        with _safe_read(manifest_path) as handle:
            if os.fstat(handle.fileno()).st_size > _MAX_MANIFEST_BYTES:
                raise SnapshotError("Snapshot manifest is oversized.")
            payload = handle.read(_MAX_MANIFEST_BYTES + 1)
        if len(payload) > _MAX_MANIFEST_BYTES:
            raise SnapshotError("Snapshot manifest is oversized.")
        manifest = json.loads(payload.decode("utf-8"))
    except (ValueError, UnicodeError, OSError) as exc:
        raise SnapshotError("Malformed snapshot manifest.") from exc
    if not isinstance(manifest, dict) or set(manifest) != {"version", "files"} or manifest.get("version") != 1:
        raise SnapshotError("Unsupported snapshot manifest version or fields.")
    entries = manifest.get("files")
    if not isinstance(entries, list) or len(entries) not in (1, 2):
        raise SnapshotError("Snapshot manifest must list the database and optional media.")
    present: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"name", "bytes", "sha256"}:
            raise SnapshotError("Invalid snapshot manifest entry.")
        name, size, digest = entry["name"], entry["bytes"], entry["sha256"]
        if not isinstance(name, str) or name not in _ALLOWED or name in present:
            raise SnapshotError("Invalid, duplicate or unsafe snapshot filename.")
        if type(size) is not int or size < 1 or size > _MAX_FILE_BYTES:
            raise SnapshotError("Invalid snapshot size.")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise SnapshotError("Invalid snapshot SHA-256 digest.")
        candidate = directory / name
        actual_size, actual_digest = _file_sha256(candidate)
        if actual_size != size or actual_digest != digest:
            raise SnapshotError("Snapshot entry failed size or SHA-256 verification.")
        present.add(name)
    if "database.dump" not in present:
        raise SnapshotError("A PostgreSQL database.dump is mandatory.")
    # An operator must not silently assume that unlisted sensitive files
    # were checked. Refuse ambiguous/unlisted entries in the snapshot root.
    root_entries = {item.name for item in directory.iterdir()}
    if root_entries != (present | {"manifest.json"}):
        raise SnapshotError("Snapshot directory contains unlisted or missing entries.")
    return tuple(sorted(present))


def copy_to_empty_rehearsal(directory: Path, dest: Path) -> tuple[str, ...]:
    names = verify_snapshot(directory)
    if dest.exists() or dest.is_symlink():
        raise SnapshotError("Refusing to overwrite an existing rehearsal destination.")
    if not dest.parent.is_dir() or dest.parent.is_symlink():
        raise SnapshotError("Rehearsal parent must be an existing non-symlink directory.")
    try:
        dest.mkdir(mode=0o700)
        for name in (*names, "manifest.json"):
            source = directory / name
            with _safe_read(source) as src, (dest / name).open("xb") as target:
                shutil.copyfileobj(src, target, length=1024 * 1024)
            os.chmod(dest / name, 0o600)
        if verify_snapshot(dest) != names:
            raise SnapshotError("Rehearsal copy failed integrity recheck.")
        return names
    except Exception:
        # Leave failed copy for investigation; never silently delete potentially
        # sensitive backup data or existing operator-controlled paths.
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline integrity checks for Synapse PostgreSQL snapshot inputs.")
    parser.add_argument("--snapshot-dir", type=Path, required=True)
    parser.add_argument("--rehearsal-dir", type=Path)
    parser.add_argument("--ack-sensitive-scratch-copy", action="store_true")
    args = parser.parse_args()
    try:
        if args.rehearsal_dir and not args.ack_sensitive_scratch_copy:
            raise SnapshotError("Sensitive rehearsal copy requires explicit acknowledgement.")
        if args.ack_sensitive_scratch_copy and not args.rehearsal_dir:
            raise SnapshotError("Acknowledgement has no effect without a rehearsal destination.")
        names = (copy_to_empty_rehearsal(args.snapshot_dir, args.rehearsal_dir)
                 if args.rehearsal_dir else verify_snapshot(args.snapshot_dir))
    except (SnapshotError, OSError) as exc:
        # No filenames, SQL content, tokens, keys or raw filesystem errors.
        print("BLOCKED: " + str(exc if isinstance(exc, SnapshotError) else "Snapshot I/O failed."))
        return 2
    print("PASS: offline integrity of " + ", ".join(names) + ".")
    print("NOT VERIFIED: PostgreSQL restore, Synapse keys, TLS, recovery or service availability.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
