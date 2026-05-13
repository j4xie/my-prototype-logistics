package com.cretas.aims.util;

import java.nio.charset.StandardCharsets;

/**
 * Recover UTF-8 filenames that Tomcat decoded as ISO-8859-1.
 *
 * <p>RFC 7578 leaves multipart filename encoding under-specified; Tomcat
 * defaults to ISO-8859-1 unless the connector is configured otherwise. A
 * customer uploading {@code 销售数据_2026年5月.xlsx} ends up with a String of
 * high-byte Latin-1 characters that, once JDBC re-encodes it as UTF-8 for the
 * persistence column, surfaces as 12× U+FFFD replacement chars in the upload
 * history page (R5 audit §1 B2, 2026-05-12).
 *
 * <p>Detection: a filename whose code points all fall in the 0x80–0xFF range
 * (no real CJK above 0xFF) and that contains at least one high-byte char is
 * almost certainly Tomcat's ISO-8859-1 interpretation of a UTF-8 byte
 * sequence. Re-encoding to ISO-8859-1 bytes and re-decoding as UTF-8 recovers
 * the original.
 *
 * <p>Pure ASCII and already-correct UTF-8 (code points {@code > 0xFF}) are
 * passed through unchanged.
 */
public final class MultipartFilenameNormalizer {

    private MultipartFilenameNormalizer() {}

    public static String normalize(String name) {
        if (name == null || name.isEmpty()) return name;
        boolean hasHighIsoChar = false;
        for (int i = 0; i < name.length(); i++) {
            int cp = name.charAt(i);
            if (cp > 0xFF) {
                // Real Unicode (e.g. CJK) — definitely not Tomcat Latin-1 mojibake.
                return name;
            }
            if (cp >= 0x80) hasHighIsoChar = true;
        }
        if (!hasHighIsoChar) return name; // pure ASCII

        String recovered = new String(name.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
        if (recovered.indexOf('�') >= 0) {
            // Re-decoding produced replacement chars — bytes were not valid UTF-8;
            // leave the original alone rather than corrupt it further.
            return name;
        }
        return recovered;
    }
}
