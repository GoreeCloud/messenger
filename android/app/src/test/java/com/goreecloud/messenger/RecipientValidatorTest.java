package com.goreecloud.messenger;

import org.junit.Test;
import static org.junit.Assert.*;

public class RecipientValidatorTest {
    @Test public void internationalNumber() {
        assertEquals("+15550101234", RecipientValidator.normalize("+1 (555) 010-1234"));
    }
    @Test public void shortcode() {
        assertEquals("911", RecipientValidator.normalize("911"));
    }
    @Test public void localNumber() {
        assertEquals("5550101", RecipientValidator.normalize("555.0101"));
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsUriInjection() { RecipientValidator.normalize("123?body=malicious"); }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsSchemeInjection() { RecipientValidator.normalize("smsto:5551234"); }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsControlCharacters() { RecipientValidator.normalize("555\n0101"); }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsMissingDigits() { RecipientValidator.normalize("++"); }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsOversizedRecipient() {
        RecipientValidator.normalize("12345678901234567890");
    }
    @Test(expected = IllegalArgumentException.class)
    public void rejectsEmbeddedPlus() { RecipientValidator.normalize("555+0123"); }
}
