"""Offline, dependency-free tests for bounded Gradle rate-limit retry logic."""
import os
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "retry_transient_gradle.sh"

class RetryGradleTest(unittest.TestCase):
    def invoke(self, mode):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            count_file = root / "count"
            mock = root / "mock.sh"
            mock.write_text("""#!/usr/bin/env bash
set -eu
n=0
if test -f "$COUNT_FILE"; then n=$(cat "$COUNT_FILE"); fi
n=$((n + 1))
printf "%s" "$n" > "$COUNT_FILE"
if test "$MODE" = "success"; then exit 0; fi
if test "$MODE" = "compile"; then echo "Compilation failed: invalid type"; exit 7; fi
if test "$MODE" = "rate-limit-then-success" && test "$n" -gt 1; then exit 0; fi
echo "Could not resolve artifact: Received status code 429 from server: Too Many Requests" >&2
exit 23
""")
            mock.chmod(0o700)
            env = dict(os.environ, COUNT_FILE=str(count_file), MODE=mode,
                       MESSENGER_CI_RETRY_SECONDS="0")
            result = subprocess.run(["bash", str(SCRIPT), str(mock)],
                                    text=True, capture_output=True, env=env, timeout=15)
            return result, int(count_file.read_text())

    def test_success_only_runs_once(self):
        result, attempts = self.invoke("success")
        self.assertEqual((result.returncode, attempts), (0, 1))

    def test_compilation_failure_is_never_retried(self):
        result, attempts = self.invoke("compile")
        self.assertEqual((result.returncode, attempts), (7, 1))

    def test_rate_limit_is_bounded_by_three_attempts(self):
        result, attempts = self.invoke("rate-limit")
        self.assertEqual((result.returncode, attempts), (23, 3))

    def test_rate_limit_can_recover_without_hiding_success(self):
        result, attempts = self.invoke("rate-limit-then-success")
        self.assertEqual((result.returncode, attempts), (0, 2))

if __name__ == "__main__":
    unittest.main()
