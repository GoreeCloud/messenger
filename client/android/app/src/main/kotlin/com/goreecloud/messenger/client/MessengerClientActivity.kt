package com.goreecloud.messenger.client

import android.animation.ValueAnimator
import android.app.Activity
import android.app.Dialog
import android.content.res.Configuration
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class MessengerClientActivity : Activity() {
    private lateinit var guidanceStore: MessengerGuidanceStore
    private lateinit var contextualHintLabel: TextView
    private var guidanceDialog: Dialog? = null

    private val runtimePresentation: GlazeMessengerResolvedPresentation
        get() = GlazeMessengerPresentationPolicy.resolve(
            requestedMaterial = GlazeMessengerMaterialRole.RAISED,
            context = MessengerAndroidGlazeContext.fromSignals(
                MessengerAndroidGlazeSignals(
                    fontScale = resources.configuration.fontScale,
                    animationsEnabled = ValueAnimator.areAnimatorsEnabled(),
                    touchExplorationEnabled = getSystemService(AccessibilityManager::class.java)
                        ?.isTouchExplorationEnabled == true,
                ),
            ),
        )

    private val isDark: Boolean
        get() = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK ==
            Configuration.UI_MODE_NIGHT_YES

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        guidanceStore = MessengerGuidanceStore(this)
        window.navigationBarColor = palette().canvas
        window.statusBarColor = palette().canvas
        setContentView(buildContent())
        refreshContextualHint()

        if (!guidanceStore.isFirstUseComplete()) {
            showStartupGuide(replay = false)
        }
    }

    override fun onDestroy() {
        guidanceDialog?.dismiss()
        guidanceDialog = null
        super.onDestroy()
    }

    private fun buildContent(): View {
        val colors = palette()
        val presentation = runtimePresentation
        val root = ScrollView(this).apply {
            setBackgroundColor(colors.canvas)
            isFillViewport = true
        }
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val gutter = dp(
                if (presentation.densityMayYieldToReflow) {
                    GlazeClientTokens.LargeTextScreenGutterDp
                } else {
                    GlazeClientTokens.ScreenGutterDp
                },
            )
            setPadding(gutter, dp(28), gutter, dp(36))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        content.addView(heading("GoreeCloud Messenger", 30f, colors.text))
        content.addView(spacer(8))
        content.addView(
            Button(this).apply {
                text = getString(R.string.help_and_guidance)
                contentDescription = getString(R.string.help_and_guidance_content_description)
                setAllCaps(false)
                setOnClickListener {
                    if (guidanceStore.isFirstUseComplete()) {
                        showGuidanceMenu()
                    }
                }
            },
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )
        contextualHintLabel = text(
            getString(R.string.contextual_hint_disconnected),
            14f,
            colors.muted,
            Typeface.NORMAL,
        ).apply {
            setPadding(0, dp(8), 0, 0)
            visibility = View.GONE
        }
        content.addView(contextualHintLabel)
        content.addView(spacer(16))
        content.addView(text(getString(R.string.development_title), 17f, colors.text, Typeface.BOLD))
        content.addView(spacer(4))
        content.addView(text(getString(R.string.development_summary), 15f, colors.muted, Typeface.NORMAL))
        content.addView(spacer(14))
        content.addView(
            surface(
                title = "Development boundary",
                body = getString(R.string.development_detail),
                colors = colors,
            ),
        )

        content.addView(spacer(22))
        content.addView(heading(getString(R.string.readiness_heading), 20f, colors.text))
        content.addView(spacer(5))
        content.addView(text(getString(R.string.readiness_summary), 14f, colors.muted, Typeface.NORMAL))
        content.addView(spacer(12))
        val readinessEvidence = disconnectedReadinessEvidence()
        content.addView(
            surface(
                title = "Data send unavailable",
                body = readinessExplanation(
                    result = DataMessagingReadiness.evaluate(readinessEvidence),
                    evidence = readinessEvidence,
                    e2eeFailure = E2EEAcceptanceFailure.CRYPTOGRAPHY_NOT_ACTIVE,
                ),
                colors = colors,
            ),
        )

        content.addView(spacer(22))
        content.addView(heading(getString(R.string.provenance_heading), 20f, colors.text))
        content.addView(spacer(5))
        content.addView(text(getString(R.string.provenance_summary), 14f, colors.muted, Typeface.NORMAL))
        content.addView(spacer(12))

        val examples = listOf(
            CommunicationProvenance(
                CommunicationTransport.DATA,
                CommunicationProtection.E2EE_ACTIVE,
            ) to "Allowed only after the client can verify the GoreeCloud E2EE state.",
            CommunicationProvenance(
                CommunicationTransport.DATA,
                CommunicationProtection.UNKNOWN,
            ) to "Used when Data transport is known but protection has not been verified.",
            CommunicationProvenance(
                CommunicationTransport.SMS,
                CommunicationProtection.UNKNOWN,
            ) to "Carrier transport remains visibly SMS; this client cannot label it GoreeCloud E2EE.",
            CommunicationProvenance(
                CommunicationTransport.RCS,
                CommunicationProtection.UNKNOWN,
            ) to "RCS is shown only as a transport example and is not claimed available in this build.",
        )
        examples.forEachIndexed { index, (provenance, explanation) ->
            content.addView(
                surface(
                    title = provenance.displayLabel(),
                    body = explanation,
                    colors = colors,
                ),
            )
            if (index != examples.lastIndex) content.addView(spacer(10))
        }

        content.addView(spacer(22))
        content.addView(heading(getString(R.string.platform_heading), 20f, colors.text))
        content.addView(spacer(10))
        content.addView(
            surface(
                title = "Not Release Candidate",
                body = getString(R.string.platform_summary),
                colors = colors,
            ),
        )

        root.addView(content)
        return root
    }

    private fun showStartupGuide(replay: Boolean) {
        guidanceDialog?.takeIf { it.isShowing }?.dismiss()
        if (replay) {
            guidanceStore.restartGuide()
        }

        val colors = palette()
        val dialog = Dialog(this)
        guidanceDialog = dialog
        dialog.setCancelable(replay)
        dialog.setCanceledOnTouchOutside(false)

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(20))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(GlazeClientTokens.SurfaceRadiusDp).toFloat()
                setColor(colors.surface)
                setStroke(dp(1), colors.border)
            }
        }
        val title = heading(getString(R.string.startup_guide_title), 22f, colors.text)
        val progress = text("", 13f, colors.muted, Typeface.NORMAL).apply {
            setPadding(0, dp(10), 0, 0)
        }
        val stepTitle = text("", 18f, colors.text, Typeface.BOLD).apply {
            setPadding(0, dp(14), 0, 0)
        }
        val body = text("", 15f, colors.muted, Typeface.NORMAL).apply {
            setPadding(0, dp(10), 0, dp(16))
        }
        val navigation = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }
        val backButton = Button(this).apply {
            text = getString(R.string.guide_back)
            setAllCaps(false)
        }
        val nextButton = Button(this).apply {
            setAllCaps(false)
        }
        val closeButton = Button(this).apply {
            text = getString(R.string.guide_close)
            setAllCaps(false)
            visibility = if (replay) View.VISIBLE else View.GONE
        }

        navigation.addView(backButton)
        navigation.addView(nextButton)
        navigation.addView(closeButton)
        panel.addView(title)
        panel.addView(progress)
        panel.addView(stepTitle)
        panel.addView(body)
        panel.addView(navigation)

        fun renderStep() {
            val step = guidanceStore.currentStep()
            progress.text = getString(
                R.string.startup_step_progress,
                step + 1,
                MessengerGuidancePolicy.STEP_COUNT,
            )
            when (step) {
                0 -> {
                    stepTitle.text = getString(R.string.startup_step_disconnected_title)
                    body.text = getString(R.string.startup_step_disconnected_body)
                }
                1 -> {
                    stepTitle.text = getString(R.string.startup_step_authority_title)
                    body.text = getString(R.string.startup_step_authority_body)
                }
                else -> {
                    stepTitle.text = getString(R.string.startup_step_privacy_title)
                    body.text = getString(R.string.startup_step_privacy_body)
                }
            }
            backButton.isEnabled = step > 0
            nextButton.text = if (MessengerGuidancePolicy.nextStep(step) == null) {
                getString(R.string.guide_finish)
            } else {
                getString(R.string.guide_next)
            }
        }

        backButton.setOnClickListener {
            guidanceStore.setCurrentStep(
                MessengerGuidancePolicy.previousStep(guidanceStore.currentStep()),
            )
            renderStep()
        }
        nextButton.setOnClickListener {
            val next = MessengerGuidancePolicy.nextStep(guidanceStore.currentStep())
            if (next == null) {
                if (!guidanceStore.isFirstUseComplete()) {
                    guidanceStore.completeFirstUse()
                } else {
                    guidanceStore.restartGuide()
                }
                dialog.dismiss()
                refreshContextualHint()
            } else {
                guidanceStore.setCurrentStep(next)
                renderStep()
            }
        }
        closeButton.setOnClickListener {
            guidanceStore.restartGuide()
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            if (guidanceDialog === dialog) {
                guidanceDialog = null
            }
        }
        dialog.setContentView(panel)
        renderStep()
        dialog.show()
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
    }

    private fun showGuidanceMenu() {
        guidanceDialog?.takeIf { it.isShowing }?.dismiss()

        val colors = palette()
        val dialog = Dialog(this)
        guidanceDialog = dialog
        dialog.setCancelable(true)
        dialog.setCanceledOnTouchOutside(true)

        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(20))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(GlazeClientTokens.SurfaceRadiusDp).toFloat()
                setColor(colors.surface)
                setStroke(dp(1), colors.border)
            }
        }
        val title = heading(getString(R.string.guidance_menu_title), 22f, colors.text)
        val body = text(
            getString(R.string.guidance_menu_body),
            15f,
            colors.muted,
            Typeface.NORMAL,
        ).apply {
            setPadding(0, dp(10), 0, dp(16))
        }
        val replayButton = Button(this).apply {
            text = getString(R.string.replay_startup_guide)
            setAllCaps(false)
        }
        val hintButton = Button(this).apply {
            setAllCaps(false)
        }
        val closeButton = Button(this).apply {
            text = getString(R.string.guide_close)
            setAllCaps(false)
        }

        fun renderHintButton() {
            hintButton.text = if (guidanceStore.areContextualHintsEnabled()) {
                getString(R.string.turn_contextual_hints_off)
            } else {
                getString(R.string.turn_contextual_hints_on)
            }
        }

        replayButton.setOnClickListener {
            dialog.dismiss()
            showStartupGuide(replay = true)
        }
        hintButton.setOnClickListener {
            guidanceStore.setContextualHintsEnabled(
                !guidanceStore.areContextualHintsEnabled(),
            )
            renderHintButton()
            refreshContextualHint()
        }
        closeButton.setOnClickListener { dialog.dismiss() }

        panel.addView(title)
        panel.addView(body)
        panel.addView(replayButton)
        panel.addView(hintButton)
        panel.addView(closeButton)

        dialog.setOnDismissListener {
            if (guidanceDialog === dialog) {
                guidanceDialog = null
            }
        }
        dialog.setContentView(panel)
        renderHintButton()
        dialog.show()
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        )
    }

    private fun refreshContextualHint() {
        if (!::contextualHintLabel.isInitialized || !::guidanceStore.isInitialized) return
        contextualHintLabel.visibility =
            if (
                guidanceStore.isFirstUseComplete() &&
                guidanceStore.areContextualHintsEnabled()
            ) {
                View.VISIBLE
            } else {
                View.GONE
            }
    }

    /**
     * This Development shell intentionally has no live authorities to supply these prerequisites.
     * Keep every value unknown rather than synthesizing readiness from the mere existence of client
     * code or from a future transport connection.
     */
    private fun disconnectedReadinessEvidence(): DataMessagingReadiness.Evidence =
        DataMessagingReadiness.Evidence(
            identity = DataMessagingReadiness.IdentityState.UNKNOWN,
            conversationAccess = DataMessagingReadiness.ConversationAccessState.UNKNOWN,
            transport = DataMessagingReadiness.DataTransportState.UNKNOWN,
            cryptography = DataMessagingReadiness.CryptographicState.UNKNOWN,
        )

    private fun readinessExplanation(
        result: DataMessagingReadiness.Result,
        evidence: DataMessagingReadiness.Evidence? = null,
        e2eeFailure: E2EEAcceptanceFailure? = null,
    ): String = DataMessagingReadinessPresentationPolicy.present(
        result = result,
        evidence = evidence,
        e2eeFailure = e2eeFailure,
    ).body()

    private fun surface(title: String, body: String, colors: Palette): View =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val padding = dp(18)
            setPadding(padding, padding, padding, padding)
            minimumHeight = dp(runtimePresentation.minimumInteractionTargetDp)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(GlazeClientTokens.SurfaceRadiusDp).toFloat()
                setColor(colors.surface)
                setStroke(dp(1), colors.border)
            }
            addView(text(title, 16f, colors.text, Typeface.BOLD))
            addView(spacer(6))
            addView(text(body, 14f, colors.muted, Typeface.NORMAL))
        }

    private fun heading(value: String, sizeSp: Float, color: Int): TextView =
        text(value, sizeSp, color, Typeface.BOLD).apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                isAccessibilityHeading = true
            }
        }

    private fun text(value: String, sizeSp: Float, color: Int, style: Int): TextView =
        TextView(this).apply {
            text = value
            textSize = sizeSp
            setTextColor(color)
            typeface = Typeface.create(Typeface.DEFAULT, style)
            setLineSpacing(0f, 1.08f)
        }

    private fun spacer(heightDp: Int): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(heightDp),
        )
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun dp(value: Float): Int = (value * resources.displayMetrics.density).toInt()

    private fun palette(): Palette = if (isDark) {
        Palette(
            canvas = GlazeClientTokens.DarkCanvas.toInt(),
            surface = GlazeClientTokens.DarkSurface.toInt(),
            text = GlazeClientTokens.DarkText.toInt(),
            muted = GlazeClientTokens.DarkMutedText.toInt(),
            border = GlazeClientTokens.DarkBorder.toInt(),
        )
    } else {
        Palette(
            canvas = GlazeClientTokens.LightCanvas.toInt(),
            surface = GlazeClientTokens.LightSurface.toInt(),
            text = GlazeClientTokens.LightText.toInt(),
            muted = GlazeClientTokens.LightMutedText.toInt(),
            border = GlazeClientTokens.LightBorder.toInt(),
        )
    }

    private data class Palette(
        val canvas: Int,
        val surface: Int,
        val text: Int,
        val muted: Int,
        val border: Int,
    )
}
