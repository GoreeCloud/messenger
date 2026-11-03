package com.goreecloud.messenger;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Native Android preview with a consent-based ACTION_SENDTO handoff.
 * GoreeCloud NEVER sends or receives SMS/MMS in this build. We intentionally
 * do not request the default SMS role or dangerous telephony permissions.
 */
public final class MainActivity extends Activity {
    private static final int SURFACE = Color.rgb(16, 25, 47);
    private static final int BACKGROUND = Color.rgb(7, 13, 29);
    private static final int ACCENT = Color.rgb(57, 142, 241);
    private static final int PALE = Color.rgb(233, 241, 254);
    private static final int MUTED = Color.rgb(171, 188, 212);
    private EditText recipient;
    private EditText message;

    private int dp(float value) {
        return Math.round(getResources().getDisplayMetrics().density * value);
    }

    private GradientDrawable panel(int fill, int radius, int stroke) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(fill);
        shape.setCornerRadius(dp(radius));
        if (stroke != Color.TRANSPARENT) shape.setStroke(dp(1), stroke);
        return shape;
    }

    private TextView text(String content, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(content);
        view.setTextColor(color);
        view.setTextSize(sizeSp);
        view.setTypeface(Typeface.create(bold ? "sans-serif-medium" : "sans-serif", Typeface.NORMAL));
        view.setLineSpacing(dp(2), 1.05f);
        return view;
    }

    private void add(LinearLayout parent, View child, int topDp) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(topDp);
        parent.addView(child, params);
    }

    private void protocol(LinearLayout parent, String title, String description, int tint) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(14));
        card.setBackground(panel(SURFACE, 16, 0xFF293955));

        TextView mark = text(title, 16, tint, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(panel(0xFF1B2D4B, 12, Color.TRANSPARENT));
        card.addView(mark, new LinearLayout.LayoutParams(dp(45), dp(45)));

        TextView line = text(description, 13, PALE, false);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(14);
        card.addView(line, params);
        add(parent, card, 9);
    }

    private EditText field(String label, String hint, int inputType, int minLines) {
        EditText input = new EditText(this);
        input.setSingleLine(minLines == 1);
        input.setMinLines(minLines);
        input.setTextColor(PALE);
        input.setHintTextColor(MUTED);
        input.setTextSize(16);
        input.setInputType(inputType);
        input.setHint(hint);
        input.setContentDescription(label);
        input.setPadding(dp(17), dp(14), dp(17), dp(14));
        input.setBackground(panel(0xFF101B33, 14, 0xFF324765));
        return input;
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BACKGROUND);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(19), dp(22), dp(19), dp(28));
        scroll.addView(content);
        setContentView(scroll);

        if (Build.VERSION.SDK_INT >= 35) {
            content.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(dp(19) + safe.left, dp(22) + safe.top,
                    dp(19) + safe.right, dp(28) + safe.bottom);
                return insets;
            });
        }

        TextView eyebrow = text(getString(R.string.preview), 12, 0xFF76D6FF, true);
        eyebrow.setLetterSpacing(0.12f);
        add(content, eyebrow, 6);
        add(content, text(getString(R.string.headline), 29, PALE, true), 13);
        add(content, text(getString(R.string.intro), 14, MUTED, false), 10);

        TextView protocolHeading = text(getString(R.string.protocol_heading), 12, MUTED, true);
        protocolHeading.setLetterSpacing(0.11f);
        add(content, protocolHeading, 29);
        protocol(content, "S", getString(R.string.sms_status), 0xFF7CC7FF);
        protocol(content, "M", getString(R.string.mms_status), 0xFFFFC180);
        protocol(content, "R", getString(R.string.rcs_status), 0xFFAB9FFB);
        protocol(content, "D", getString(R.string.data_status), 0xFF81E2C2);

        LinearLayout composer = new LinearLayout(this);
        composer.setOrientation(LinearLayout.VERTICAL);
        composer.setPadding(dp(17), dp(19), dp(17), dp(19));
        composer.setBackground(panel(0xFF13223C, 23, 0xFF304869));
        add(content, composer, 24);

        add(composer, text(getString(R.string.compose_heading), 21, PALE, true), 0);
        add(composer, text(getString(R.string.recipient_label), 14, MUTED, true), 17);
        recipient = field(getString(R.string.recipient_label),
            getString(R.string.recipient_hint), InputType.TYPE_CLASS_PHONE, 1);
        add(composer, recipient, 6);
        add(composer, text(getString(R.string.body_label), 14, MUTED, true), 16);
        message = field(getString(R.string.body_label),
            getString(R.string.body_hint),
            InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE |
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES, 3);
        message.setMaxLines(9);
        add(composer, message, 6);

        Button handoff = new Button(this);
        handoff.setText(getString(R.string.handoff));
        handoff.setAllCaps(false);
        handoff.setTextSize(16);
        handoff.setTextColor(Color.WHITE);
        handoff.setMinHeight(dp(52));
        handoff.setBackground(panel(ACCENT, 16, Color.TRANSPARENT));
        handoff.setOnClickListener(v -> openSystemComposer());
        add(composer, handoff, 18);
        add(composer, text(getString(R.string.handoff_note), 13, MUTED, false), 12);
        add(content, text(getString(R.string.footnote), 12, MUTED, false), 24);
    }

    private void openSystemComposer() {
        final String number;
        try {
            number = RecipientValidator.normalize(recipient.getText().toString().trim());
        } catch (IllegalArgumentException error) {
            recipient.setError(getString(R.string.invalid_recipient));
            recipient.requestFocus();
            return;
        }
        String body = message.getText().toString();
        if (body.length() > 16000) {
            message.setError("Message is too long");
            return;
        }
        // Uri.fromParts encodes the address and cannot append a query or URI scheme.
        // A different installed messaging app remains responsible for transmission,
        // protocol negotiation, SIM selection, confirmation and persistence.
        Intent intent = new Intent(Intent.ACTION_SENDTO);
        intent.setData(Uri.fromParts("smsto", number, null));
        intent.putExtra("sms_body", body);
        try {
            startActivity(intent);
            Toast.makeText(this, R.string.ready, Toast.LENGTH_SHORT).show();
        } catch (ActivityNotFoundException | SecurityException error) {
            Toast.makeText(this, R.string.no_handler, Toast.LENGTH_LONG).show();
        }
    }
}
