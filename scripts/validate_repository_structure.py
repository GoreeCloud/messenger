#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ALLOWED_ROOT_FILES = {
    ".editorconfig",
    ".gitignore",
    "LICENSE",
    "README.md",
    "go.mod",
    "goreecloud.platform.yaml",
}

REQUIRED_FILES = {
    "README.md",
    ".editorconfig",
    ".gitignore",
    ".github/SECURITY.md",
    "docs/SPECIFICATIONS.md",
    "docs/FEATURES.md",
    "docs/IMPLEMENTED-FEATURES.md",
    "docs/PLANNED-FEATURES.md",
    "docs/CHANGELOGS.md",
    "docs/BENEFITS.md",
    "docs/COMPETITIVE-OBJECTIVES.md",
    "docs/BRANDING.md",
    "docs/USER-MANUAL.md",
    "docs/PRIVACY.md",
    "docs/NOTES.md",
}

errors = []

root_files = {path.name for path in ROOT.iterdir() if path.is_file()}
unexpected = sorted(root_files - ALLOWED_ROOT_FILES)
if unexpected:
    errors.append(
        "unexpected root files; human-readable records belong under docs/: "
        + ", ".join(unexpected)
    )

missing = sorted(path for path in REQUIRED_FILES if not (ROOT / path).is_file())
if missing:
    errors.append("missing mandatory repository records: " + ", ".join(missing))

if (ROOT / "FEATURE-ROADMAP.md").exists():
    errors.append("retired FEATURE-ROADMAP.md must not exist at repository root")

if errors:
    print("Messenger repository structure validation FAILED:")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Messenger repository structure validation passed")
