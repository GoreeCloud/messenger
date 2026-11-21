#!/usr/bin/env python3
"""Reject accidental drift in pinned, first-party gc-ui source snapshots.

This is an integrity check against a reviewed GitHub commit, not a security
certification or substitute for runtime accessibility and visual inspection.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import stat
import sys

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM_COMMIT = "5625121316230d78dd40a6e41a0671a250cb873b"
PINNED_SHA256 = {
    "android/app/src/main/java/com/goreecloud/ui/material3/GeneratedGoreePalettes.kt":
        "55250169a773d04f5ca78faba8c96055b3a84f59fc767b982ae540cfb8f0dd64",
    "android/app/src/main/java/com/goreecloud/ui/material3/GoreeCloudExpressiveTheme.kt":
        "3e80f1c62647081a32d48ddecfaa771f1559280fb44b538c96aad50336c63272",
    "web/src/vendor/gc-ui-tokens.css":
        "ac1237e9bf773ae014b0fa6a4d53a8fbbdaf499e4fbb9111011fbe6325b7b0ba",
    "third_party/gc-ui/LICENSE":
        "cf6d03d1d5b1a0bf28ce369c3df4a9386ca5fe1449014a2f540a8d21181a10f6",
}


def file_matches(path: Path, expected: str) -> bool:
    try:
        if not stat.S_ISREG(path.lstat().st_mode):
            return False
        digest = hashlib.sha256()
        with path.open("rb") as input_file:
            for chunk in iter(lambda: input_file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest() == expected
    except OSError:
        return False


def verify(root: Path = ROOT) -> list[str]:
    return [
        relative for relative, expected in PINNED_SHA256.items()
        if not file_matches(root / relative, expected)
    ]


if __name__ == "__main__":
    unexpected = verify()
    if unexpected:
        print("BLOCKED: GC UI first-party source drift detected; review pinned commit.")
        sys.exit(2)
    print("PASS: official GoreeCloud/gc-ui alpha source files match pinned commit "
          + UPSTREAM_COMMIT + ".")
