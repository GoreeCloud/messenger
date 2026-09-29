package com.goreecloud.messenger.client

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MessengerGuidanceStoreRuntimeTest {
    private lateinit var context: Context
    private lateinit var store: MessengerGuidanceStore

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences(
            MessengerGuidanceStore.PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        ).edit().clear().commit()
        store = MessengerGuidanceStore(context)
    }

    @After
    fun tearDown() {
        context.getSharedPreferences(
            MessengerGuidanceStore.PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        ).edit().clear().commit()
    }

    @Test
    fun firstUseResumeCompletionAndHintPreferencePersist() {
        assertFalse(store.isFirstUseComplete())
        assertTrue(store.areContextualHintsEnabled())
        assertEquals(0, store.currentStep())

        store.setCurrentStep(1)
        assertEquals(1, MessengerGuidanceStore(context).currentStep())

        store.setContextualHintsEnabled(false)
        assertFalse(MessengerGuidanceStore(context).areContextualHintsEnabled())

        store.completeFirstUse()
        val reopened = MessengerGuidanceStore(context)
        assertTrue(reopened.isFirstUseComplete())
        assertEquals(0, reopened.currentStep())
        assertFalse(reopened.areContextualHintsEnabled())

        reopened.restartGuide()
        assertEquals(0, MessengerGuidanceStore(context).currentStep())
    }
}
