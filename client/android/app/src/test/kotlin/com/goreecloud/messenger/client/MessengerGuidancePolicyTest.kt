package com.goreecloud.messenger.client

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MessengerGuidancePolicyTest {
    @Test
    fun persistedStepsAreBounded() {
        assertEquals(0, MessengerGuidancePolicy.normalizeStep(-2))
        assertEquals(1, MessengerGuidancePolicy.normalizeStep(1))
        assertEquals(2, MessengerGuidancePolicy.normalizeStep(9))
    }

    @Test
    fun contextualHintRequiresCompletionGlobalEnablementAndUndismissedState() {
        assertEquals(
            true,
            MessengerGuidancePolicy.shouldShowContextualHint(
                firstUseComplete = true,
                hintsEnabled = true,
                hintDismissed = false,
            ),
        )
        assertEquals(
            false,
            MessengerGuidancePolicy.shouldShowContextualHint(
                firstUseComplete = false,
                hintsEnabled = true,
                hintDismissed = false,
            ),
        )
        assertEquals(
            false,
            MessengerGuidancePolicy.shouldShowContextualHint(
                firstUseComplete = true,
                hintsEnabled = false,
                hintDismissed = false,
            ),
        )
        assertEquals(
            false,
            MessengerGuidancePolicy.shouldShowContextualHint(
                firstUseComplete = true,
                hintsEnabled = true,
                hintDismissed = true,
            ),
        )
    }

    @Test
    fun navigationStopsAtFinalStep() {
        assertEquals(1, MessengerGuidancePolicy.nextStep(0))
        assertEquals(2, MessengerGuidancePolicy.nextStep(1))
        assertNull(MessengerGuidancePolicy.nextStep(2))
        assertEquals(0, MessengerGuidancePolicy.previousStep(0))
        assertEquals(1, MessengerGuidancePolicy.previousStep(2))
    }
}
