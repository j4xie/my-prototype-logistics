package com.cretas.aims.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * T-R5-2: integration of the filename normalizer with the MultipartFile
 * contract. All non-filename behavior must flow through to the delegate.
 */
@DisplayName("NormalizedFilenameMultipartFile (T-R5-2)")
class NormalizedFilenameMultipartFileTest {

    @Test
    @DisplayName("getOriginalFilename() recovers ISO-8859-1 mojibake; bytes/size unchanged")
    void recoversFilenameAndDelegatesOtherFields() throws IOException {
        String chinese = "销售数据_2026年5月.xlsx";
        String mojibake = new String(chinese.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
        byte[] payload = "row1,row2".getBytes(StandardCharsets.UTF_8);

        MockMultipartFile delegate = new MockMultipartFile(
                "file", mojibake, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", payload);
        MultipartFile wrapped = new NormalizedFilenameMultipartFile(delegate);

        assertEquals(chinese, wrapped.getOriginalFilename(), "filename must be recovered");
        assertEquals("file", wrapped.getName());
        assertEquals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", wrapped.getContentType());
        assertEquals(payload.length, wrapped.getSize());
        assertArrayEquals(payload, wrapped.getBytes());
        assertFalse(wrapped.isEmpty());
    }

    @Test
    @DisplayName("ASCII filename → passes through untouched")
    void asciiPassesThrough() {
        MockMultipartFile delegate = new MockMultipartFile(
                "file", "sales.xlsx", "application/octet-stream", new byte[0]);
        MultipartFile wrapped = new NormalizedFilenameMultipartFile(delegate);
        assertEquals("sales.xlsx", wrapped.getOriginalFilename());
    }
}
