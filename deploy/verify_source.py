#!/usr/bin/env python3
"""Check vendored source provenance and fail-closed loopback deployment defaults.

Deliberately never builds, executes, installs or downloads upstream code.
This is a shallow structural safety check, not a security audit.
"""
from __future__ import annotations

import hashlib
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "third_party" / "synapse"
EXPECTED_VERSION = "1.163.0"
EXPECTED_COMMIT = "193cf9466fbfbe334700c541dc1442f135179aaf"
EXPECTED_DIGEST = "8898778d5ffd986653741c33d0dd5a76d61a9c7ada1a8e51482d232741c6710a"


def source_digest(directory: Path = SOURCE) -> str:
    """Stable SHA256 over relative file paths, file contents and symlink targets."""
    digest = hashlib.sha256()
    for path in sorted(directory.rglob("*")):
        if ".git" in path.relative_to(directory).parts or path.is_dir():
            continue
        rel = path.relative_to(directory).as_posix()
        digest.update(rel.encode("utf-8") + b"\x00")
        if path.is_symlink():
            target = path.readlink().as_posix()
            resolved = (path.parent / target).resolve()
            if not resolved.is_relative_to(directory.resolve()):
                raise ValueError("Symlink escapes source tree: " + rel)
            digest.update(b"symlink\x00" + target.encode("utf-8"))
        else:
            digest.update(b"file\x00" + path.read_bytes())
        digest.update(b"\x00")
    return digest.hexdigest()


def check_source() -> list[str]:
    errors = []
    manifest = SOURCE / "pyproject.toml"
    if not manifest.is_file():
        return ["Missing Synapse source manifest."]
    try:
        version = tomllib.loads(manifest.read_text(encoding="utf-8"))["project"]["version"]
    except (KeyError, ValueError, TypeError) as exc:
        return ["Invalid Synapse source manifest: " + type(exc).__name__]
    if version != EXPECTED_VERSION:
        errors.append("Unexpected Synapse version: " + version)
    if not (SOURCE / "LICENSE-AGPL-3.0").is_file():
        errors.append("Upstream AGPL license is missing.")
    if not (SOURCE / "docker" / "Dockerfile").is_file():
        errors.append("Upstream source Dockerfile is missing.")
    return errors



def check_compose_bindings(content: str) -> list[str]:
    """Defensively pin the sole published preview port; static known-schema check."""
    errors: list[str] = []
    ports: list[str] = []
    blocks = 0
    lines = content.splitlines()
    for index, line in enumerate(lines):
        if line.lstrip().startswith("#"):
            continue
        if line.strip() == "ports:":
            blocks += 1
            level = len(line) - len(line.lstrip())
            for entry in lines[index + 1:]:
                if not entry.strip() or entry.lstrip().startswith("#"):
                    continue
                indentation = len(entry) - len(entry.lstrip())
                if indentation <= level:
                    break
                if indentation == level + 2 and entry.lstrip().startswith("- "):
                    ports.append(entry.strip()[2:].strip('"').strip("'"))
    if blocks != 1 or ports != ["127.0.0.1:8008:8008"]:
        errors.append("Only one explicit loopback-mapped 8008 port is permitted.")
    for unsafe in ("network_mode: host", "privileged: true", "pid: host", "/var/run/docker.sock"):
        if any(unsafe in line for line in lines if not line.lstrip().startswith("#")):
            errors.append("Host-privileged container configuration is forbidden.")
            break
    return errors


def check_compose(name: str, require_source: bool) -> list[str]:
    content = (ROOT / "deploy" / name).read_text(encoding="utf-8")
    errors = check_compose_bindings(content)
    if '"127.0.0.1:8008:8008"' not in content:
        errors.append(name + ": must bind HTTP to loopback only")
    if 'restart: "no"' not in content:
        errors.append(name + ": must not restart as a service")
    if "no-new-privileges:true" not in content:
        errors.append(name + ": no-new-privileges missing")
    if "SYNAPSE_CONFIG_PATH: /data/homeserver.yaml" not in content:
        errors.append(name + ": explicit homeserver config missing")
    if require_source:
        if "context: ../third_party/synapse" not in content or "dockerfile: docker/Dockerfile" not in content:
            errors.append(name + ": source build context missing")
        if "matrixdotorg/synapse" in content:
            errors.append(name + ": source build must not use upstream prebuilt image")
    return errors


def main() -> int:
    errors = check_source() + check_compose("compose.yaml", False) + check_compose("compose.source.yaml", True)
    if errors:
        for error in errors:
            print("FAIL: " + error, file=sys.stderr)
        return 1
    print("PASS: vendored Synapse " + EXPECTED_VERSION + " source structure and loopback Compose policies")
    print("Pinned upstream commit (provenance reference): " + EXPECTED_COMMIT)
    current_digest = source_digest()
    if current_digest != EXPECTED_DIGEST:
        print("FAIL: vendored source tree does not match pinned source snapshot.", file=sys.stderr)
        return 1
    print("Verified vendored source digest SHA256: " + current_digest)
    print("No image was built, executed or vulnerability-audited by this check.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
