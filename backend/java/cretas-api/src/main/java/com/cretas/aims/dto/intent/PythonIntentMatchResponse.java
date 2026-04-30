package com.cretas.aims.dto.intent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ApiResponse envelope wrapper for Python's <code>IntentMatchResult</code>
 * (Phase 2B-α).
 *
 * <p>Python returns the project-standard envelope per
 * <code>.claude/rules/api-response-handling.md</code>:
 * <pre>{ success, data, message, code? }</pre>
 *
 * <p>The <code>data</code> field deserializes into the existing
 * {@link IntentMatchResult} class. Per spec §6.2 / Python {@code IntentMatchResultDto}
 * docstring, the Pydantic JSON shape is byte-shape compatible with Java's
 * Jackson output for {@link IntentMatchResult}, so direct deserialization
 * works without a custom mixin.
 *
 * <p>{@link JsonIgnoreProperties}({@code ignoreUnknown = true}) defends against
 * future Python-side fields (e.g. timing metadata, debug info) that Java
 * hasn't yet declared — keeps the wire decoupled from version-skew failures.
 *
 * @see PythonIntentMatchRequest
 * @see IntentMatchResult
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PythonIntentMatchResponse {

    private boolean success;
    private IntentMatchResult data;
    private String message;
    private String code;
}
