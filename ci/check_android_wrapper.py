"""Verify exact official generated Gradle 9.9.1 wrapper inputs pre-execution."""
import hashlib
from pathlib import Path
import stat
import sys

ROOT = Path(__file__).resolve().parent.parent
OFFICIAL = {
    "android/gradle/wrapper/gradle-wrapper.jar": "621008afc4f5d59357fcf06ffa644dd5aade5e091bdc363742710445f73cdaf8",
    "android/gradlew": "a5a5c199ba02189ae8c46a334223371a20599d9c298ef65e7540ede4a3f72d59",
    "android/gradlew.bat": "f17917f8dbe61182b149273ee78090fec1197442c3f38276af907bfa5190db16",
}
DISTRIBUTION = (
    "distributionUrl=https\\://services.gradle.org/distributions/gradle-9.9.1-bin.zip",
    "distributionSha256Sum=d8a18a7a841dd5df825d35a685fad6f2d7f12ac0c280e57b67c27b4a520ba228",
)


def matches_sha(path: Path, expected: str) -> bool:
    try:
        if not stat.S_ISREG(path.lstat().st_mode):
            return False
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest() == expected
    except OSError:
        return False


def check(root: Path = ROOT) -> list[str]:
    failures = [relative for relative, digest in OFFICIAL.items()
                if not matches_sha(root / relative, digest)]
    try:
        props = (root / "android/gradle/wrapper/gradle-wrapper.properties").read_text()
        if not all(entry in props for entry in DISTRIBUTION):
            failures.append("android/gradle/wrapper/gradle-wrapper.properties")
    except OSError:
        failures.append("android/gradle/wrapper/gradle-wrapper.properties")
    return failures


if __name__ == "__main__":
    failed = check()
    if failed:
        print("BLOCKED: Gradle wrapper official SHA-256/preflight mismatch.")
        sys.exit(2)
    print("PASS: official Gradle 9.9.1 wrapper JAR, launchers, distribution and SHA-256.")
