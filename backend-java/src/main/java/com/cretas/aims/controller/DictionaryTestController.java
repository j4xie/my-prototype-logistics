package com.cretas.aims.controller;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.repository.smartbi.SmartBiDictionaryRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 字典工具测试控制器
 *
 * 用于测试 dictionary_add, dictionary_list, dictionary_batch_import 工具
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@RestController
@RequestMapping("/api/public/dictionary-test")
@RequiredArgsConstructor
@Tag(name = "字典工具测试", description = "测试动态字典工具的API")
@CrossOrigin(origins = "*")
public class DictionaryTestController {

    private final ToolRegistry toolRegistry;
    private final SmartBiDictionaryRepository dictionaryRepository;

    /**
     * 测试 dictionary_add 工具
     */
    @PostMapping("/add")
    @Operation(summary = "测试添加字典条目", description = "模拟 AI 调用 dictionary_add 工具")
    public ApiResponse<Object> testAdd(@RequestBody Map<String, Object> request) {
        log.info("测试 dictionary_add 工具: {}", request);

        try {
            Optional<ToolExecutor> executor = toolRegistry.getExecutor("dictionary_add");
            if (!executor.isPresent()) {
                return ApiResponse.error("工具 dictionary_add 未找到");
            }

            // 构建 ToolCall
            ToolCall toolCall = ToolCall.of(
                    "test-" + System.currentTimeMillis(),
                    "dictionary_add",
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request)
            );

            // 执行工具
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", request.getOrDefault("factoryId", null));

            String result = executor.get().execute(toolCall, context);
            log.info("dictionary_add 执行结果: {}", result);

            return ApiResponse.success(new com.fasterxml.jackson.databind.ObjectMapper().readValue(result, Map.class));

        } catch (Exception e) {
            log.error("dictionary_add 执行失败: {}", e.getMessage(), e);
            return ApiResponse.error("执行失败: " + e.getMessage());
        }
    }

    /**
     * 测试 dictionary_list 工具
     */
    @GetMapping("/list")
    @Operation(summary = "测试查询字典条目", description = "模拟 AI 调用 dictionary_list 工具")
    public ApiResponse<Object> testList(
            @RequestParam(required = false) String dictType,
            @RequestParam(required = false, defaultValue = "20") Integer limit) {

        log.info("测试 dictionary_list 工具: dictType={}, limit={}", dictType, limit);

        try {
            Optional<ToolExecutor> executor = toolRegistry.getExecutor("dictionary_list");
            if (!executor.isPresent()) {
                return ApiResponse.error("工具 dictionary_list 未找到");
            }

            // 构建参数
            Map<String, Object> args = new HashMap<>();
            if (dictType != null) {
                args.put("dictType", dictType);
            }
            args.put("limit", limit);

            // 构建 ToolCall
            ToolCall toolCall = ToolCall.of(
                    "test-" + System.currentTimeMillis(),
                    "dictionary_list",
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(args)
            );

            // 执行工具
            String result = executor.get().execute(toolCall, new HashMap<>());
            log.info("dictionary_list 执行结果: {}", result);

            return ApiResponse.success(new com.fasterxml.jackson.databind.ObjectMapper().readValue(result, Map.class));

        } catch (Exception e) {
            log.error("dictionary_list 执行失败: {}", e.getMessage(), e);
            return ApiResponse.error("执行失败: " + e.getMessage());
        }
    }

    /**
     * 测试 dictionary_batch_import 工具
     */
    @PostMapping("/batch-import")
    @Operation(summary = "测试批量导入字典条目", description = "模拟 AI 调用 dictionary_batch_import 工具")
    public ApiResponse<Object> testBatchImport(@RequestBody Map<String, Object> request) {
        log.info("测试 dictionary_batch_import 工具: {}", request);

        try {
            Optional<ToolExecutor> executor = toolRegistry.getExecutor("dictionary_batch_import");
            if (!executor.isPresent()) {
                return ApiResponse.error("工具 dictionary_batch_import 未找到");
            }

            // 构建 ToolCall
            ToolCall toolCall = ToolCall.of(
                    "test-" + System.currentTimeMillis(),
                    "dictionary_batch_import",
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(request)
            );

            // 执行工具
            Map<String, Object> context = new HashMap<>();
            context.put("factoryId", request.getOrDefault("factoryId", null));

            String result = executor.get().execute(toolCall, context);
            log.info("dictionary_batch_import 执行结果: {}", result);

            return ApiResponse.success(new com.fasterxml.jackson.databind.ObjectMapper().readValue(result, Map.class));

        } catch (Exception e) {
            log.error("dictionary_batch_import 执行失败: {}", e.getMessage(), e);
            return ApiResponse.error("执行失败: " + e.getMessage());
        }
    }

    /**
     * 直接查询数据库中的字典条目
     */
    @GetMapping("/db-list")
    @Operation(summary = "直接查询数据库", description = "查询数据库中的字典条目")
    public ApiResponse<List<SmartBiDictionary>> listFromDb(
            @RequestParam(required = false) String dictType) {

        List<SmartBiDictionary> entries;
        if (dictType != null) {
            entries = dictionaryRepository.findByDictTypeAndIsActiveTrueOrderByPriorityAsc(dictType);
        } else {
            entries = dictionaryRepository.findAll();
        }

        return ApiResponse.success(entries);
    }
}
