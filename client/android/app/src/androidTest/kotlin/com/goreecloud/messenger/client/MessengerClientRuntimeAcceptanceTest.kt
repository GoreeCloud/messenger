package com.goreecloud.messenger.client

import android.Manifest
import android.content.Context
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Emulator acceptance for the disconnected Development shell only.
 *
 * This does not establish account/session binding, Data transport, message persistence, E2EE,
 * carrier messaging, calling, accessibility certification, physical-device acceptance, or RC.
 */
@RunWith(AndroidJUnit4::class)
class MessengerClientRuntimeAcceptanceTest {
    private lateinit var context: Context

    @Before
    fun resetGuidanceStateBeforeTest() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences(
            MessengerGuidanceStore.PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        ).edit().clear().commit()
    }

    @After
    fun resetGuidanceStateAfterTest() {
        context.getSharedPreferences(
            MessengerGuidanceStore.PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        ).edit().clear().commit()
    }

    @Test
    fun launchPreservesVisibleDevelopmentBoundaryAndRestrictedAuthority() {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0x00001000)
        val requestedPermissions = packageInfo.requestedPermissions.orEmpty().toSet()
        val forbiddenPermissions = setOf(
            Manifest.permission.INTERNET,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
        )
        assertTrue(
            "Disconnected Development shell must not request live communication authority",
            requestedPermissions.intersect(forbiddenPermissions).isEmpty(),
        )

        ActivityScenario.launch(MessengerClientActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                assertDisconnectedDevelopmentBoundary(activity.window.decorView)
            }
        }
    }

    @Test
    fun activityRecreationRetainsDisconnectedDevelopmentBoundary() {
        ActivityScenario.launch(MessengerClientActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                assertDisconnectedDevelopmentBoundary(activity.window.decorView)
            }

            scenario.recreate()

            scenario.onActivity { activity ->
                assertDisconnectedDevelopmentBoundary(activity.window.decorView)
            }
        }
    }

    private fun assertDisconnectedDevelopmentBoundary(root: View) {
        val visibleText = collectText(root)
        assertTrue(visibleText.any { it.contains("Native Android Development preview") })
        assertTrue(visibleText.any { it.contains("Disconnected shell") })
        assertTrue(visibleText.any { it.contains("Development boundary") })
        assertTrue(visibleText.any { it.contains("Data messaging readiness") })
        assertTrue(visibleText.any { it.contains("Data send unavailable") })
        assertTrue(visibleText.any { it.contains("Identity session/device binding") })
        assertTrue(visibleText.any { it.contains("Conversation authorization") })
        assertTrue(visibleText.any { it.contains("GoreeCloud Data transport") })
        assertTrue(visibleText.any { it.contains("Verified active E2EE") })
        assertTrue(
            visibleText.any {
                it.contains("No verified GoreeCloud Identity session/device binding evidence is available.")
            },
        )
        assertTrue(
            visibleText.any {
                it.contains("No verified conversation-participant authorization evidence is available.")
            },
        )
        assertTrue(
            visibleText.any {
                it.contains("No verified GoreeCloud Data transport availability evidence is available.")
            },
        )
        assertTrue(visibleText.any { it.contains("No verified active E2EE evidence is available.") })
        assertTrue(visibleText.any { it.contains("Not Release Candidate") })
        assertTrue(visibleText.any { it.contains("Provenance examples") })

        // A disconnected provenance/readiness preview must not grow a live message-send control.
        assertFalse(visibleText.any { it.trim().equals("Send", ignoreCase = true) })

        // Guidance controls are presentation-only and may be interactive. Keep the authority
        // boundary fail-closed by allowing only the explicit Help entry in the underlying shell;
        // no composer, send, call, provider, or transport action may become interactive here.
        val interactiveViews = collectViews(root).filter {
            it.isShown && (it.isClickable || it.isLongClickable)
        }
        val interactiveLabels = interactiveViews
            .mapNotNull { view -> (view as? TextView)?.text?.toString()?.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
        assertTrue(
            "Disconnected Development shell may expose only bounded guidance interaction",
            interactiveLabels == setOf("Help & guidance"),
        )
        assertFalse(
            "Disconnected Development shell must not expose messaging-authority controls",
            interactiveLabels.any { label ->
                label.equals("Send", ignoreCase = true) ||
                    label.contains("Compose", ignoreCase = true) ||
                    label.contains("Call", ignoreCase = true) ||
                    label.contains("Connect", ignoreCase = true) ||
                    label.contains("Sign in", ignoreCase = true)
            },
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val headings = collectTextViews(root)
                .filter { it.isAccessibilityHeading }
                .map { it.text?.toString().orEmpty() }
                .toSet()
            assertTrue(
                headings.containsAll(
                    setOf(
                        "GoreeCloud Messenger",
                        "Data messaging readiness",
                        "Provenance examples",
                        "RC integration boundary",
                    ),
                ),
            )
        }
    }

    private fun collectViews(view: View): List<View> = when (view) {
        is ViewGroup -> buildList {
            add(view)
            repeat(view.childCount) { index -> addAll(collectViews(view.getChildAt(index))) }
        }
        else -> listOf(view)
    }

    private fun collectTextViews(view: View): List<TextView> = when (view) {
        is TextView -> listOf(view)
        is ViewGroup -> buildList {
            repeat(view.childCount) { index -> addAll(collectTextViews(view.getChildAt(index))) }
        }
        else -> emptyList()
    }

    private fun collectText(view: View): List<String> = when (view) {
        is TextView -> listOf(view.text?.toString().orEmpty())
        is ViewGroup -> buildList {
            repeat(view.childCount) { index -> addAll(collectText(view.getChildAt(index))) }
        }
        else -> emptyList()
    }
}
