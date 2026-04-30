package com.cretas.aims.dto.intent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Byte-shape sanity tests for Python AI matcher request/response DTOs.
 *
 * Phase 2B-α task T16: verifies that
 *   1. PythonIntentMatchRequest serializes the fields and nested options
 *      that {@link com.cretas.aims.client.PythonAiMatcherClient} (T18)
 *      will be expected to send to /api/ai/intent/match.
 *   2. PythonIntentMatchResponse deserializes both success and error
 *      ApiResponse envelopes coming back from the Python service.
 *
 * Note: {@link IntentMatchResult} (the data payload) has its own coverage
 * elsewhere; this class only validates the wrapper envelope + outbound
 * request shape.
 */
class PythonIntentDtosTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void requestSerializesWithExpectedFields() throws Exception {
        PythonIntentMatchRequest req = PythonIntentMatchRequest.builder()
                .query("查库存")
                .factoryId("F001")
                .userId("22")
                .username("admin")
                .role("factory_super_admin")
                .businessType("FACTORY")
                .history(List.of())
                .options(PythonIntentMatchRequest.Options.builder()
                        .enableLlmFallback(true)
                        .timeoutMs(30000)
                        .minConfidence(0.7)
                        .intentConfigVersion(1)
                        .build())
                .build();

        String json = mapper.writeValueAsString(req);
        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = mapper.readValue(json, Map.class);

        assertEquals("查库存", parsed.get("query"));
        assertEquals("F001", parsed.get("factoryId"));
        assertEquals("FACTORY", parsed.get("businessType"));
        assertNotNull(parsed.get("options"));
        @SuppressWarnings("unchecked")
        Map<String, Object> opts = (Map<String, Object>) parsed.get("options");
        assertEquals(true, opts.get("enableLlmFallback"));
        assertEquals(30000, opts.get("timeoutMs"));
    }

    @Test
    void responseDeserializesEmptyEnvelope() throws Exception {
        String json = "{\"success\":true,\"data\":null,\"message\":\"OK\"}";
        PythonIntentMatchResponse resp = mapper.readValue(json, PythonIntentMatchResponse.class);
        assertTrue(resp.isSuccess());
        assertNull(resp.getData());
        assertEquals("OK", resp.getMessage());
    }

    @Test
    void responseDeserializesErrorEnvelope() throws Exception {
        String json = "{\"success\":false,\"data\":null,\"message\":\"err\",\"code\":\"AUTH_FACTORY_ID_MISMATCH\"}";
        PythonIntentMatchResponse resp = mapper.readValue(json, PythonIntentMatchResponse.class);
        assertFalse(resp.isSuccess());
        assertEquals("AUTH_FACTORY_ID_MISMATCH", resp.getCode());
    }
}
