package com.cretas.aims.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Tool Call DTO for tracking tool execution
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCallDTO {
    /** Tool call unique ID */
    private String id;

    /** Tool call type (always "function") */
    @Builder.Default
    private String type = "function";

    /** Function/tool name */
    private String name;

    /** Arguments as JSON string */
    private String arguments;

    /** Reference ID for results */
    private String toolCallId;

    /** When the call was created */
    private LocalDateTime createdAt;

    /** Execution status: PENDING, EXECUTING, COMPLETED, FAILED */
    private String status;
}
