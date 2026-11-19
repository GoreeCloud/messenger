# CI reliability checks

The Android CI job executes the same Gradle test/build command through
ci/retry_transient_gradle.sh. Its only retry condition is an explicit HTTP 429
dependency repository rate limit. It makes at most three attempts and never
turns a failed test, compilation or dependency incompatibility into a pass.

Offline unit checks: python3 -m unittest discover -s ci/tests -v.

No external retry action or production secret is used. A successful build
remains necessary for GitHub branch protection; this is not a bypass.
