package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.workflow.WorkflowNodeRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workflow")
@RequiredArgsConstructor
public class WorkflowNodeController {

    private final WorkflowNodeRegistry workflowNodeRegistry;

    @GetMapping("/node-schemas")
    public ApiResponse<List<Map<String, Object>>> getNodeSchemas() {
        return ApiResponse.success(workflowNodeRegistry.getAllNodeSchemas());
    }

    @GetMapping("/node-schemas/by-category")
    public ApiResponse<List<Map<String, Object>>> getNodeSchemasByCategory(
            @RequestParam String category) {
        return ApiResponse.success(workflowNodeRegistry.getNodeSchemasByCategory(category));
    }
}
