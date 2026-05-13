package com.cretas.aims.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * T-R5-2: Tomcat default multipart filename charset is ISO-8859-1 (RFC 7578
 * ambiguity in legacy multipart). When a customer uploads "销售数据_2026年5月.xlsx"
 * the bytes for 销售数据/年/月 are re-decoded as Latin-1 high bytes, then later
 * converted to UTF-8 bytes by JDBC → PG column contains 12× U+FFFD where 4
 * Chinese chars lived (R5 audit §1 B2, 2026-05-12).
 *
 * MultipartFilenameNormalizer detects the ISO-8859-1 → UTF-8 mojibake at the
 * controller boundary and recovers the original UTF-8 string. Already-correct
 * UTF-8 names (code points > 0xFF, i.e. real CJK) are passed through unchanged.
 */
@DisplayName("MultipartFilenameNormalizer (T-R5-2)")
class MultipartFilenameNormalizerTest {

    @Test
    @DisplayName("ISO-8859-1 decoded UTF-8 bytes → recovered Chinese filename")
    void recoversMojibakeChineseFilename() {
        String original = "销售数据_2026年5月.xlsx";
        // Simulate Tomcat decoding the UTF-8 bytes as Latin-1 — the same path
        // that produces the live bug.
        String mojibake = new String(original.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);

        // Sanity-check the mojibake actually looks mojibake (high-byte Latin-1
        // chars only, no real CJK code points).
        assertTrue(mojibake.chars().anyMatch(c -> c >= 0x80 && c <= 0xFF),
                "mojibake fixture must contain high-byte Latin-1 chars");
        assertTrue(mojibake.codePoints().allMatch(c -> c <= 0xFF),
                "mojibake fixture must not contain real CJK code points");

        String recovered = MultipartFilenameNormalizer.normalize(mojibake);

        assertEquals(original, recovered);
    }

    @Test
    @DisplayName("Already-correct UTF-8 Chinese filename → unchanged")
    void leavesCorrectUtf8Unchanged() {
        String correct = "销售-Q1.xlsx";
        assertEquals(correct, MultipartFilenameNormalizer.normalize(correct));
    }

    @Test
    @DisplayName("Pure ASCII filename → unchanged")
    void leavesAsciiUnchanged() {
        assertEquals("sales-2026.xlsx", MultipartFilenameNormalizer.normalize("sales-2026.xlsx"));
    }

    @Test
    @DisplayName("null and empty → returned as-is (no NPE)")
    void handlesNullAndEmpty() {
        assertNull(MultipartFilenameNormalizer.normalize(null));
        assertEquals("", MultipartFilenameNormalizer.normalize(""));
    }
}
