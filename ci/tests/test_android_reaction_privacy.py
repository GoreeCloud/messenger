"""Offline guard against reintroducing SDK plaintext reaction send paths."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "android/app/src/main/java/com/goreecloud/messenger/MatrixEngine.kt"
UI = ROOT / "android/app/src/main/java/com/goreecloud/messenger/MainActivity.kt"
POLICY = ROOT / "android/app/src/main/java/com/goreecloud/messenger/ReactionPolicy.kt"


class AndroidReactionPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = ENGINE.read_text(encoding="utf-8")
        cls.ui = UI.read_text(encoding="utf-8")
        cls.policy = POLICY.read_text(encoding="utf-8")

    def test_sdk_unencrypted_reaction_transport_remains_blocked(self):
        self.assertIn("ReactionPolicy.refusePlaintextReactionTransport()", self.engine)
        self.assertNotIn("current.toggleReaction(", self.engine)
        self.assertNotIn("room.sendReaction(", self.engine)
        self.assertIn("throw UnsupportedOperationException(", self.policy)
        self.assertIn("Encrypted emoji reactions are unavailable", self.policy)

    def test_native_ui_never_offers_unsafely_encrypted_reaction_action(self):
        self.assertNotIn("engine.toggleReaction(", self.ui)
        self.assertNotIn("ReactionPolicy.supportedEmoji.forEach", self.ui)
        self.assertIn("Emoji reactions unavailable", self.ui)

    def test_encrypted_replies_remain_available_independently(self):
        self.assertIn("engine.sendEncryptedReply(", self.ui)
        self.assertIn("activeTimeline.sendReply(", self.engine)

    def test_encryption_guard_preserved_when_transport_reenabled(self):
        self.assertIn("ReactionPolicy.requireEncryptedReaction(", self.engine)
        self.assertIn("room.isEncrypted()", self.engine)
        self.assertIn("Membership.JOINED", self.engine)


if __name__ == "__main__":
    unittest.main()
