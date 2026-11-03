package com.goreecloud.messenger;

/** Input boundary for SMS handoff. Never allow URI/query fragment injection. */
public final class RecipientValidator {
    private RecipientValidator() {}

    public static String normalize(String input) {
        if (input == null || input.isEmpty() || input.length() > 32) {
            throw new IllegalArgumentException("Invalid recipient");
        }
        StringBuilder normalized = new StringBuilder();
        int digits = 0;
        for (int i = 0; i < input.length(); i++) {
            char ch = input.charAt(i);
            if (ch >= '0' && ch <= '9') {
                normalized.append(ch);
                digits++;
            } else if (ch == '+' && i == 0) {
                normalized.append(ch);
            } else if (ch == ' ' || ch == '-' || ch == '.' || ch == '(' || ch == ')') {
                // Formatting is harmless; strip it before building a URI.
            } else {
                throw new IllegalArgumentException("Invalid recipient");
            }
        }
        if (digits < 3 || digits > 15) throw new IllegalArgumentException("Invalid recipient");
        return normalized.toString();
    }
}
