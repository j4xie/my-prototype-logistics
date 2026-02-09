package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.service.calibration.ToolResultValidatorService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 工具执行结果验证器实现
 *
 * 核心功能：
 * 1. 空结果检测
 * 2. 用户意图与结果匹配度检测
 * 3. 查询条件被忽略检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolResultValidatorServiceImpl implements ToolResultValidatorService {

    private final ObjectMapper objectMapper;

    // 批次号模式：MB-xxxx, TEST-xxxx, INT-xxxx 等
    private static final Pattern BATCH_NUMBER_PATTERN = Pattern.compile(
            "(?i)(MB|TEST|INT|BATCH)[\\-_]?[A-Z0-9\\-_]+",
            Pattern.CASE_INSENSITIVE
    );

    // 日期模式：2026-01-19, 2026/01/19, 今天, 昨天, 本周, 本月
    private static final Pattern DATE_PATTERN = Pattern.compile(
            "(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|今天|昨天|前天|本周|本月|上周|上月)"
    );

    // 物料名称关键词
    private static final Set<String> MATERIAL_KEYWORDS = Set.of(
            "带鱼", "黄鱼", "墨鱼", "虾仁", "鲳鱼", "鱿鱼", "蟹", "贝",
            "猪肉", "牛肉", "羊肉", "鸡肉", "鸭肉",
            "面粉", "大米", "食盐", "白糖", "酱油"
    );

    // 状态关键词
    private static final Map<String, String> STATUS_KEYWORDS = Map.of(
            "可用", "AVAILABLE",
            "已用完", "EXHAUSTED",
            "已过期", "EXPIRED",
            "待检", "PENDING_QC"
    );

    @Override
    public ValidationResult validate(
            String userInput,
            String toolName,
            Map<String, Object> params,
            String resultJson
    ) {
        log.info("🔍 开始验证工具结果: tool={}, userInput={}", toolName, userInput);
        log.info("原始结果 JSON (前500字符): {}",
                resultJson != null && resultJson.length() > 500 ?
                        resultJson.substring(0, 500) + "..." : resultJson);

        try {
            // 1. 解析结果
            Map<String, Object> result = parseResult(resultJson);
            if (result == null) {
                log.warn("结果解析失败");
                return ValidationResult.invalid(
                        ValidationIssue.FORMAT_ERROR,
                        "无法解析工具执行结果",
                        "检查工具返回格式"
                );
            }
            log.info("结果解析成功, 字段: {}", result.keySet());

            // 1.5. 处理嵌套结构：如果结果包含 data 字段，解包
            if (result.containsKey("data") && result.get("data") instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> dataMap = (Map<String, Object>) result.get("data");
                result = dataMap;
                log.info("解包 data 字段, 实际字段: {}", result.keySet());
            }

            // 2. 检测空结果
            ValidationResult emptyCheck = checkEmptyResult(result, toolName);
            if (!emptyCheck.isValid()) {
                log.info("空结果检测: 结果为空");
                return emptyCheck;
            }

            // 3. 仅对查询类工具进行意图匹配检测
            if (isQueryTool(toolName)) {
                log.info("查询类工具，进行意图匹配检测");
                // 提取用户意图中的查询条件
                Map<String, Object> extractedConditions = extractQueryConditions(userInput);
                log.info("提取的条件: {}", extractedConditions);

                // 如果用户指定了具体条件，检查结果是否匹配
                if (!extractedConditions.isEmpty()) {
                    ValidationResult matchResult = checkIntentMatch(extractedConditions, result, userInput);
                    log.info("意图匹配检测结果: isValid={}, issue={}", matchResult.isValid(), matchResult.issue());
                    return matchResult;
                } else {
                    log.info("未提取到具体条件，跳过意图匹配检测");
                }
            } else {
                log.info("非查询类工具，跳过意图匹配检测");
            }

            log.info("✅ 验证通过");
            return ValidationResult.valid();

        } catch (Exception e) {
            log.warn("验证工具结果时出错: {}", e.getMessage());
            return ValidationResult.valid();  // 出错时默认有效，避免误触发
        }
    }

    /**
     * 解析结果 JSON
     */
    private Map<String, Object> parseResult(String resultJson) {
        try {
            return objectMapper.readValue(resultJson, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("解析结果 JSON 失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 检测空结果
     */
    private ValidationResult checkEmptyResult(Map<String, Object> result, String toolName) {
        // 检查 content 字段
        Object content = result.get("content");
        if (content instanceof List<?> list) {
            if (list.isEmpty()) {
                return ValidationResult.invalid(
                        ValidationIssue.EMPTY_RESULT,
                        "查询结果为空，未找到符合条件的数据",
                        "尝试扩大查询范围或调整查询条件"
                );
            }
        }

        // 检查 totalElements 字段
        Object totalElements = result.get("totalElements");
        if (totalElements instanceof Number num && num.intValue() == 0) {
            return ValidationResult.invalid(
                    ValidationIssue.EMPTY_RESULT,
                    "查询结果为空，totalElements=0",
                    "尝试扩大查询范围或调整查询条件"
            );
        }

        // 检查特定工具的空结果标识
        if ("material_batch_query".equals(toolName) || "inventory_query".equals(toolName)) {
            if (content == null && totalElements == null) {
                // 可能是单条查询返回 null
                Object data = result.get("data");
                if (data == null) {
                    return ValidationResult.invalid(
                            ValidationIssue.EMPTY_RESULT,
                            "未找到指定的数据记录",
                            "检查查询条件是否正确"
                    );
                }
            }
        }

        return ValidationResult.valid();
    }

    /**
     * 判断是否为查询类工具
     */
    private boolean isQueryTool(String toolName) {
        return toolName != null && (
                toolName.contains("query") ||
                toolName.contains("search") ||
                toolName.contains("list") ||
                toolName.contains("get") ||
                toolName.contains("find")
        );
    }

    /**
     * 从用户输入提取查询条件
     */
    private Map<String, Object> extractQueryConditions(String userInput) {
        Map<String, Object> conditions = new HashMap<>();

        if (userInput == null || userInput.isBlank()) {
            return conditions;
        }

        // 1. 提取批次号
        Matcher batchMatcher = BATCH_NUMBER_PATTERN.matcher(userInput);
        if (batchMatcher.find()) {
            conditions.put("batchNumber", batchMatcher.group());
            log.debug("提取到批次号: {}", batchMatcher.group());
        }

        // 2. 提取日期
        Matcher dateMatcher = DATE_PATTERN.matcher(userInput);
        if (dateMatcher.find()) {
            conditions.put("date", dateMatcher.group());
            log.debug("提取到日期: {}", dateMatcher.group());
        }

        // 3. 提取物料名称
        for (String material : MATERIAL_KEYWORDS) {
            if (userInput.contains(material)) {
                conditions.put("materialName", material);
                log.debug("提取到物料名称: {}", material);
                break;
            }
        }

        // 4. 提取状态
        for (Map.Entry<String, String> entry : STATUS_KEYWORDS.entrySet()) {
            if (userInput.contains(entry.getKey())) {
                conditions.put("status", entry.getValue());
                log.debug("提取到状态: {}", entry.getKey());
                break;
            }
        }

        // 5. 提取供应商关键词
        if (userInput.contains("供应商") || userInput.contains("供货商")) {
            // 尝试提取供应商名称（引号内或"供应商"后面的内容）
            Pattern supplierPattern = Pattern.compile("(?:供应商|供货商)[是为：:]*[\"']?([\\u4e00-\\u9fa5A-Za-z0-9]+)[\"']?");
            Matcher supplierMatcher = supplierPattern.matcher(userInput);
            if (supplierMatcher.find()) {
                conditions.put("supplierName", supplierMatcher.group(1));
            }
        }

        log.debug("从用户输入提取的条件: {}", conditions);
        return conditions;
    }

    /**
     * 检查意图匹配度
     */
    private ValidationResult checkIntentMatch(
            Map<String, Object> extractedConditions,
            Map<String, Object> result,
            String userInput
    ) {
        // 获取结果列表
        Object content = result.get("content");
        log.info("检查 content 字段: type={}, isNull={}",
                content != null ? content.getClass().getSimpleName() : "null",
                content == null);

        if (!(content instanceof List<?> list) || list.isEmpty()) {
            log.info("content 不是 List 或为空，返回 valid");
            return ValidationResult.valid();
        }

        int totalResults = list.size();
        int matchedResults = 0;
        boolean conditionIgnored = false;
        String ignoredCondition = null;

        log.info("结果列表大小: {}", totalResults);

        // 检查批次号匹配
        String targetBatchNumber = (String) extractedConditions.get("batchNumber");
        if (targetBatchNumber != null) {
            log.info("目标批次号: {}", targetBatchNumber);
            boolean foundExactMatch = false;
            for (Object item : list) {
                if (item instanceof Map<?, ?> record) {
                    String batchNumber = (String) record.get("batchNumber");
                    log.debug("比较批次号: {} vs {}", batchNumber, targetBatchNumber);
                    if (batchNumber != null && batchNumber.equalsIgnoreCase(targetBatchNumber)) {
                        foundExactMatch = true;
                        matchedResults++;
                        log.info("找到精确匹配: {}", batchNumber);
                    } else if (batchNumber != null && batchNumber.toUpperCase().contains(targetBatchNumber.toUpperCase())) {
                        matchedResults++;
                        log.info("找到部分匹配: {}", batchNumber);
                    }
                }
            }

            log.info("批次号匹配结果: foundExactMatch={}, matchedResults={}, totalResults={}",
                    foundExactMatch, matchedResults, totalResults);

            // 用户指定了批次号，但结果中没有精确匹配
            if (!foundExactMatch && totalResults > 1) {
                conditionIgnored = true;
                ignoredCondition = "batchNumber=" + targetBatchNumber;
                log.info("🚨 批次号条件被忽略: 用户查询 {}, 但返回了 {} 条不匹配的记录",
                        targetBatchNumber, totalResults);
            }
        }

        // 检查物料名称匹配
        String targetMaterial = (String) extractedConditions.get("materialName");
        if (targetMaterial != null) {
            int materialMatched = 0;
            for (Object item : list) {
                if (item instanceof Map<?, ?> record) {
                    String materialName = (String) record.get("materialName");
                    if (materialName != null && materialName.contains(targetMaterial)) {
                        materialMatched++;
                    }
                }
            }
            if (materialMatched == 0 && totalResults > 0) {
                conditionIgnored = true;
                ignoredCondition = "materialName=" + targetMaterial;
            }
            matchedResults = Math.max(matchedResults, materialMatched);
        }

        // 计算匹配度
        double matchScore = totalResults > 0 ? (double) matchedResults / totalResults : 0.0;

        // 判断结果
        if (conditionIgnored) {
            Map<String, Object> actualResults = Map.of(
                    "totalResults", totalResults,
                    "matchedResults", matchedResults,
                    "firstFewBatches", extractFirstFewBatches(list, 3)
            );

            return ValidationResult.withMatchScore(
                    ValidationIssue.CONDITION_IGNORED,
                    String.format("用户指定了条件 %s，但查询结果未按条件过滤（返回 %d 条记录，仅 %d 条匹配）",
                            ignoredCondition, totalResults, matchedResults),
                    matchScore,
                    extractedConditions,
                    actualResults,
                    "重新提取用户意图中的具体条件，并将其作为查询参数"
            );
        }

        // 匹配度较低
        if (matchScore < 0.5 && totalResults > 3) {
            return ValidationResult.withMatchScore(
                    ValidationIssue.PARTIAL_MATCH,
                    String.format("查询结果与用户意图匹配度较低 (%.0f%%)", matchScore * 100),
                    matchScore,
                    extractedConditions,
                    Map.of("totalResults", totalResults, "matchedResults", matchedResults),
                    "尝试更精确地提取用户查询条件"
            );
        }

        return ValidationResult.valid();
    }

    /**
     * 提取前几个批次号用于日志
     */
    private List<String> extractFirstFewBatches(List<?> list, int count) {
        List<String> batches = new ArrayList<>();
        for (int i = 0; i < Math.min(list.size(), count); i++) {
            Object item = list.get(i);
            if (item instanceof Map<?, ?> record) {
                String batchNumber = (String) record.get("batchNumber");
                if (batchNumber != null) {
                    batches.add(batchNumber);
                }
            }
        }
        return batches;
    }
}
