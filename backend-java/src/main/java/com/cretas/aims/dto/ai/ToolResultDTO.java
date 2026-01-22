package com.cretas.aims.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Tool Result DTO for encapsulating tool execution results
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolResultDTO {
    /** Reference to original ToolCall */
    private String toolCallId;

    /** Whether execution was successful */
    private Boolean success;

    /** JSON result from tool executor */
    private String result;

    /** Error message if failed */
    private String error;

    /** When the tool was executed */
    private LocalDateTime executedAt;

    /** Execution duration in milliseconds */
    private Long executionTimeMs;

    /** Additional context metadata */
    private Map<String, Object> metadata;
}
