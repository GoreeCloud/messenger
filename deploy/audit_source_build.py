#!/usr/bin/env python3
"""Static source-Dockerfile risk inventory; never runs vendored build commands.

This is a preflight, not malware detection, a supply-chain attestation, or a
license/security approval. All inspected code remains untrusted.
"""
from pathlib import Path
import re

SOURCE_DOCKERFILE = Path(__file__).resolve().parents[1] / "third_party/synapse/docker/Dockerfile"

def audit_dockerfile(text: str) -> list[str]:
    findings: list[str] = []
    source = text.splitlines()
    mutable_images: list[str] = []
    for line in source:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if re.match(r"^FROM\s", stripped, re.I):
            tokens = stripped.split()
            image_position = 2
            if len(tokens) > 2 and tokens[1].startswith("--platform="):
                image_position = 3
            image = tokens[image_position - 1] if len(tokens) >= image_position else ""
            if image and "@sha256:" not in image:
                mutable_images.append(image)

    if mutable_images:
        findings.append("MUTABLE_BASE_IMAGES: base image references lack immutable sha256 digests")
    if re.search(r"\b(?:curl|wget)\b[^\n]*\|\s*(?:ba)?sh(?:\s|$)", text, re.I):
        findings.append("REMOTE_SHELL_INSTALLER: Dockerfile pipelines network download to a shell")
    if re.search(r"--default-toolchain\s+stable\b", text):
        findings.append("FLOATING_RUST_TOOLCHAIN: Rust stable compiler version is not pinned")
    if ("TEST_ONLY_IGNORE_POETRY_LOCKFILE" in text or
            "TEST_ONLY_SKIP_DEP_HASH_VERIFICATION" in text):
        findings.append("OPTIONAL_LOCK_BYPASS: upstream test build args can bypass dependency lock/hash checks")
    return findings

def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Static inspection of vendored upstream Dockerfile build risks.")
    parser.add_argument("--strict", action="store_true", help="Fail when risks are present.")
    args = parser.parse_args()
    try:
        source = SOURCE_DOCKERFILE.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        print(f"BLOCKED: cannot inspect source Dockerfile ({type(exc).__name__}).")
        return 2
    findings = audit_dockerfile(source)
    if not findings:
        print("No known high-risk static patterns matched; this is NOT a security approval.")
        return 0
    for finding in findings:
        print("RISK:", finding)
    print("Source build requires controlled isolation, supply-chain review, and explicit acknowledgement.")
    return 2 if args.strict else 0

if __name__ == "__main__":
    raise SystemExit(main())
