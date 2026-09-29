package com.goreecloud.messenger.client

import android.content.Context

class MessengerGuidanceStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun isFirstUseComplete(): Boolean =
        preferences.getBoolean(KEY_FIRST_USE_COMPLETE, false)

    fun currentStep(): Int =
        MessengerGuidancePolicy.normalizeStep(preferences.getInt(KEY_CURRENT_STEP, 0))

    fun setCurrentStep(step: Int) {
        preferences.edit()
            .putInt(KEY_CURRENT_STEP, MessengerGuidancePolicy.normalizeStep(step))
            .apply()
    }

    fun completeFirstUse() {
        preferences.edit()
            .putBoolean(KEY_FIRST_USE_COMPLETE, true)
            .putInt(KEY_CURRENT_STEP, 0)
            .apply()
    }

    fun restartGuide() {
        preferences.edit().putInt(KEY_CURRENT_STEP, 0).apply()
    }

    fun areContextualHintsEnabled(): Boolean =
        preferences.getBoolean(KEY_CONTEXTUAL_HINTS_ENABLED, true)

    fun setContextualHintsEnabled(enabled: Boolean) {
        preferences.edit().putBoolean(KEY_CONTEXTUAL_HINTS_ENABLED, enabled).apply()
    }

    companion object {
        const val PREFERENCES_NAME = "goreecloud_messenger_guidance"
        private const val KEY_FIRST_USE_COMPLETE = "first_use_complete"
        private const val KEY_CURRENT_STEP = "current_step"
        private const val KEY_CONTEXTUAL_HINTS_ENABLED = "contextual_hints_enabled"
    }
}
