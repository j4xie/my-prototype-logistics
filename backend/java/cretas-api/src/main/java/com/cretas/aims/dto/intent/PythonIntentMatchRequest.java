package com.cretas.aims.dto.intent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request body to Python <code>POST /api/ai/intent/match</code> (Phase 2B-α).
 *
 * <p>Mirrors the Python Pydantic <code>IntentMatchRequest</code> declared in
 * <code>backend/python/ai/dto.py</code>. JSON serialization uses Jackson
 * defaults — {@link JsonInclude.Include#NON_NULL} drops absent optional
 * fields so Python's <code>extra='ignore'</code> Pydantic config receives a
 * minimal payload.
 *
 * <h3>Java ↔ Python type mismatches</h3>
 * <ul>
 *   <li><b>userId:</b> Java type is {@code String} per spec, but Python's
 *       Pydantic model declares {@code userId: int}. Callers (T18 client) must
 *       ensure JWT-extracted userId is numeric-castable before sending — the
 *       JSON value will be a string and Pydantic will reject it. T18 should
 *       either change this field to {@code Long} OR convert at marshal time.
 *   </li>
 *   <li><b>history:</b> Python's request shape does NOT declare a
 *       {@code history} field. With <code>extra='ignore'</code> Pydantic
 *       silently drops it. Spec includes the field for forward compatibility;
 *       it currently round-trips as a no-op on the Python side.
 *   </li>
 *   <li><b>options.timeoutMs / enableLlmFallback / intentConfigVersion:</b>
 *       Python's {@code IntentMatchOptions} declares different fields
 *       ({@code enableSemantic}, {@code enableClassifier}, {@code enableLlm},
 *       {@code topK}, {@code minConfidence}). All Java-declared option fields
 *       except {@code minConfidence} are silently dropped by Pydantic. Either
 *       Python's options shape needs widening, or these Java fields must be
 *       remapped before send. Flagged for T18.
 *   </li>
 * </ul>
 *
 * @see PythonIntentMatchResponse
 * @see <code>backend/python/ai/dto.py</code> for the Pydantic source of truth
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PythonIntentMatchRequest {

    private String query;
    private String factoryId;
    private String userId;
    private String username;
    private String role;
    private String businessType;
    private List<Map<String, String>> history;
    private Options options;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Options {
        private Boolean enableLlmFallback;
        private Integer timeoutMs;
        private Double minConfidence;
        private Integer intentConfigVersion;
    }
}
