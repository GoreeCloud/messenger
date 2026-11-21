"""Offline GC UI design-language snapshot integrity and consumer wiring."""
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ci"))
from check_gc_ui_source import PINNED_SHA256, UPSTREAM_COMMIT, file_matches, verify


class GoreeCloudUiSourceTests(unittest.TestCase):
    def test_vendored_source_matches_reviewed_goreecloud_ui_commit(self):
        self.assertEqual(len(UPSTREAM_COMMIT), 40)
        self.assertEqual([], verify(ROOT))

    def test_modified_or_symlink_source_fails_source_pin(self):
        with tempfile.TemporaryDirectory() as directory:
            testfile = Path(directory) / "theme.kt"
            expected = next(iter(PINNED_SHA256.values()))
            testfile.write_text("untrusted updated theme", encoding="utf-8")
            self.assertFalse(file_matches(testfile, expected))
            link = Path(directory) / "theme-link.kt"
            link.symlink_to(ROOT / next(iter(PINNED_SHA256)))
            self.assertFalse(file_matches(link, expected))

    def test_android_app_wraps_native_screen_in_upstream_expressive_theme(self):
        source = (ROOT / "android/app/src/main/java/com/goreecloud/messenger/MainActivity.kt").read_text()
        self.assertIn("GoreeCloudExpressiveTheme { MessengerScreen() }", source)
        self.assertIn("GoreeCloudTheme.colors.surface", source)
        self.assertNotIn("darkColorScheme(", source)
        self.assertNotIn("private val brand = Color(", source)
        build = (ROOT / "android/app/build.gradle.kts").read_text()
        self.assertIn('implementation("androidx.compose.material3:material3:1.5.0")', build)

    def test_browser_imports_canonical_generated_tokens_and_dark_iris_scope(self):
        css = (ROOT / "web/src/styles.css").read_text()
        html = (ROOT / "web/index.html").read_text()
        self.assertIn('@import "./vendor/gc-ui-tokens.css";', css)
        self.assertIn("--brand:var(--gc-brand)", css)
        self.assertIn("--canvas:var(--gc-canvas)", css)
        self.assertIn('data-gc-theme="dark"', html)
        self.assertIn('data-gc-accent="iris"', html)


if __name__ == "__main__":
    unittest.main()
