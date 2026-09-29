#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "client" / "android"
CLIENT = ANDROID / "app" / "src" / "main"
MANIFEST = CLIENT / "AndroidManifest.xml"
STRINGS = CLIENT / "res" / "values" / "strings.xml"
APP_BUILD = ANDROID / "app" / "build.gradle.kts"
CLIENT_KOTLIN = CLIENT / "kotlin" / "com" / "goreecloud" / "messenger" / "client"
READINESS = CLIENT_KOTLIN / "DataMessagingReadiness.kt"
AUTHORITIES = CLIENT_KOTLIN / "DataMessagingAuthorityResolver.kt"
COORDINATOR = CLIENT_KOTLIN / "DataMessageSendCoordinator.kt"
GUIDANCE_STORE = CLIENT_KOTLIN / "MessengerGuidanceStore.kt"

errors: list[str] = []

if not MANIFEST.is_file():
    errors.append("Messenger Android client manifest is missing")
else:
    manifest = MANIFEST.read_text(encoding="utf-8")
    forbidden_permissions = (
        "android.permission.INTERNET",
        "android.permission.READ_CONTACTS",
        "android.permission.READ_SMS",
        "android.permission.SEND_SMS",
        "android.permission.RECEIVE_SMS",
        "android.permission.CALL_PHONE",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
    )
    for permission in forbidden_permissions:
        if permission in manifest:
            errors.append(f"Development client unexpectedly declares {permission}")
    if 'android:allowBackup="false"' not in manifest:
        errors.append("Development client must keep Android backup disabled")

# Network/storage/cryptographic implementation authority must not enter Kotlin
# source in this disconnected Development shell. This branch may consume only
# minimized authority evidence; it does not implement cryptography or transport locally.
# Android XML namespace URIs are intentionally not treated as network authority.
for path in CLIENT.rglob("*.kt"):
    text = path.read_text(encoding="utf-8")
    relative = path.relative_to(ROOT)
    forbidden_fragments = [
        "java.net.",
        "javax.net.",
        "java.security.",
        "javax.crypto.",
        "okhttp",
        "retrofit",
        "http://",
        "https://",
        "RoomDatabase",
        "SQLiteDatabase",
    ]
    if path != GUIDANCE_STORE:
        forbidden_fragments.extend(
            (
                "SharedPreferences",
                "getSharedPreferences(",
            ),
        )
    for fragment in forbidden_fragments:
        if fragment in text:
            errors.append(f"{relative}: forbidden Development client authority fragment {fragment!r}")

if not GUIDANCE_STORE.is_file():
    errors.append("Messenger first-use guidance preference store is missing")
else:
    guidance_store_text = GUIDANCE_STORE.read_text(encoding="utf-8")
    for required in (
        'PREFERENCES_NAME = "goreecloud_messenger_guidance"',
        'KEY_FIRST_USE_COMPLETE = "first_use_complete"',
        'KEY_CURRENT_STEP = "current_step"',
        'KEY_CONTEXTUAL_HINTS_ENABLED = "contextual_hints_enabled"',
    ):
        if required not in guidance_store_text:
            errors.append(
                f"Messenger guidance store is missing bounded preference contract {required!r}",
            )
    for forbidden in (
        "message_id",
        "conversation_id",
        "account_id",
        "identity_token",
        "access_token",
        "refresh_token",
        "ciphertext",
        "plaintext",
    ):
        if forbidden in guidance_store_text.lower():
            errors.append(
                f"Messenger guidance store must not persist messaging/authority data {forbidden!r}",
            )

if APP_BUILD.is_file():
    build_text = APP_BUILD.read_text(encoding="utf-8").lower()
    for dependency_fragment in ("okhttp", "retrofit", "ktor-client", "room-runtime"):
        if dependency_fragment in build_text:
            errors.append(
                f"client/android/app/build.gradle.kts: forbidden Development client dependency {dependency_fragment!r}",
            )
else:
    errors.append("Messenger Android client app build file is missing")

activity = CLIENT_KOTLIN / "MessengerClientActivity.kt"
if not activity.is_file():
    errors.append("Messenger native Android Development Activity is missing")
else:
    activity_text = activity.read_text(encoding="utf-8")
    for required in (
        "Development boundary",
        "Not Release Candidate",
        "R.string.provenance_heading",
    ):
        if required not in activity_text:
            errors.append(f"Messenger client is missing required visible boundary reference {required!r}")

if not STRINGS.is_file():
    errors.append("Messenger Android client strings resource is missing")
else:
    strings_text = STRINGS.read_text(encoding="utf-8")
    required_labels = (
        "Native Android Development preview",
        "Disconnected shell · No account · No network · No message storage",
        "Provenance examples",
    )
    for required in required_labels:
        if required not in strings_text:
            errors.append(f"Messenger client is missing required visible boundary label {required!r}")

provenance = CLIENT_KOTLIN / "CommunicationProvenance.kt"
if not provenance.is_file():
    errors.append("Messenger communication provenance contract is missing")
else:
    provenance_text = provenance.read_text(encoding="utf-8")
    if "E2EE_ACTIVE || transport == CommunicationTransport.DATA" not in provenance_text:
        errors.append("Messenger provenance contract does not fail closed on carrier E2EE claims")

if not READINESS.is_file():
    errors.append("Messenger Data messaging readiness contract is missing")
else:
    readiness_text = READINESS.read_text(encoding="utf-8")
    for required in (
        "val authorizedConversationId: String? = null",
        "val e2eeConversationId: String? = null",
        "evidence.authorizedConversationId",
        "evidence.e2eeConversationId",
        "authorizedConversationId == null",
        "e2eeConversationId == null",
        "e2eeConversationId != authorizedConversationId",
        "evidence.conversationAccess != ConversationAccessState.VERIFIED_PARTICIPANT",
        "evidence.cryptography != CryptographicState.E2EE_ACTIVE",
        "val verifiedConversationId: String,",
        "Result.Ready(verifiedConversationId = checkNotNull(authorizedConversationId))",
    ):
        if required not in readiness_text:
            errors.append(
                f"Messenger readiness contract is missing scoped authority guard {required!r}",
            )

if not AUTHORITIES.is_file():
    errors.append("Messenger independent messaging authority resolver is missing")
else:
    authority_text = AUTHORITIES.read_text(encoding="utf-8")
    for required in (
        "fun interface GoreeCloudIdentitySessionAuthority",
        "fun interface ConversationAuthorizationAuthority",
        "enum class DataTransportAcceptanceState",
        "data class DataTransportEvidence",
        "val configuration: DataTransportAcceptanceState",
        "val authenticationBinding: DataTransportAcceptanceState",
        "val channelProtection: DataTransportAcceptanceState",
        "val failurePolicy: DataTransportAcceptanceState",
        "val deploymentBinding: DataTransportAcceptanceState",
        "val decisionFreshness: DataTransportAcceptanceState",
        "configuration == DataTransportAcceptanceState.ACCEPTED",
        "authenticationBinding == DataTransportAcceptanceState.ACCEPTED",
        "channelProtection == DataTransportAcceptanceState.ACCEPTED",
        "failurePolicy == DataTransportAcceptanceState.ACCEPTED",
        "deploymentBinding == DataTransportAcceptanceState.ACCEPTED",
        "decisionFreshness == DataTransportAcceptanceState.ACCEPTED",
        "fun interface GoreeCloudDataTransportAuthority",
        "fun evidence(): DataTransportEvidence",
        "dataTransportAuthority.evidence().readinessProjection().state",
        "fun interface E2EESessionAuthority",
        "enum class E2EEImplementationReviewState",
        "enum class E2EEDeviceIdentityState",
        "enum class E2EESessionEstablishmentState",
        "enum class E2EEKeyLifecycleState",
        "implementationReview == E2EEImplementationReviewState.ACCEPTED",
        "deviceIdentity == E2EEDeviceIdentityState.ENROLLED",
        "sessionEstablishment == E2EESessionEstablishmentState.ESTABLISHED",
        "keyLifecycle == E2EEKeyLifecycleState.CURRENT",
        ".readinessProjectionFor(targetConversationId)",
        "class DataMessagingAuthorityResolver",
        "conversationAuthorizationAuthority.accessFor(targetConversationId)",
        "e2eeSessionAuthority",
        "ConversationAccessState.UNKNOWN",
        "DataTransportState.UNKNOWN",
        "CryptographicState.UNKNOWN",
    ):
        if required not in authority_text:
            errors.append(
                f"Messenger authority resolver is missing independent fail-closed provider guard {required!r}",
            )
    if "fun availability(): DataMessagingReadiness.DataTransportState" in authority_text:
        errors.append("Messenger Data transport authority must not expose bare availability as accepted readiness")

if not COORDINATOR.is_file():
    errors.append("Messenger Data message send coordinator is missing")
else:
    coordinator_text = COORDINATOR.read_text(encoding="utf-8")
    for required in (
        "private val authorityResolver: DataMessagingAuthorityResolver",
        "fun submit(message: PreparedEncryptedDataMessage): Result",
        "authorityResolver.evidenceFor(message.conversationId)",
        "readiness.verifiedConversationId != message.conversationId",
        "DataMessagingReadiness.BlockReason.CONVERSATION_ACCESS_NOT_VERIFIED",
        "transport.submit(message)",
    ):
        if required not in coordinator_text:
            errors.append(
                f"Messenger send coordinator is missing provider-owned conversation-bound guard {required!r}",
            )
    if "evidence: DataMessagingReadiness.Evidence" in coordinator_text:
        errors.append("Messenger send coordinator must not accept caller-assembled readiness evidence")

if errors:
    print("Messenger Android Development client boundary FAILED:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Messenger Android Development client boundary passed")
