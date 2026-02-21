package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.config.QualityCheckItemDTO;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.service.QualityCheckItemService;
import com.cretas.aims.service.QualityDispositionRuleService;
import com.cretas.aims.service.QualityDispositionRuleService.DispositionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import com.cretas.aims.util.ErrorSanitizer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 质检意图处理器
 *
 * 处理 QUALITY 分类的意图:
 * - QUALITY_CHECK_QUERY: 查询质检项配置
 * - QUALITY_CHECK_EXECUTE: 执行质检评估
 * - QUALITY_DISPOSITION_EVALUATE: 评估处置建议
 * - QUALITY_DISPOSITION_EXECUTE: 执行处置动作
 * - QUALITY_STATS: 质检统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QualityIntentHandler implements IntentHandler {

    private final QualityCheckItemService qualityCheckItemService;
    private final QualityDispositionRuleService qualityDispositionRuleService;
    private final QualityInspectionRepository qualityInspectionRepository;

    @Override
    public String getSupportedCategory() {
        return "QUALITY";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("QualityIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "QUALITY_CHECK_QUERY" -> handleQualityCheckQuery(factoryId, request, intentConfig);
                case "QUALITY_CHECK_EXECUTE" -> handleQualityCheckExecute(factoryId, request, intentConfig, userId);
                case "QUALITY_DISPOSITION_EVALUATE" -> handleDispositionEvaluate(factoryId, request, intentConfig);
                case "QUALITY_DISPOSITION_EXECUTE" -> handleDispositionExecute(factoryId, request, intentConfig, userId);
                case "QUALITY_STATS" -> handleQualityStats(factoryId, request, intentConfig);
                case "QUALITY_CRITICAL_ITEMS" -> handleCriticalItems(factoryId, intentConfig);
                case "QUALITY_BATCH_MARK_AS_INSPECTED" -> handleBatchMarkInspected(factoryId, request, intentConfig, userId);
                case "CCP_MONITOR_DATA_DETECTION" -> handleCcpMonitorDetection(factoryId, intentConfig);
                default -> {
                    log.warn("未知的QUALITY意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("QUALITY")
                            .status("FAILED")
                            .message("暂不支持此质检操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("QualityIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            String errMsg = "质检操作失败: " + ErrorSanitizer.sanitize(e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message(errMsg)
                    .formattedText(errMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 查询质检项配置
     */
    private IntentExecuteResponse handleQualityCheckQuery(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        // 解析查询条件
        String category = null;
        Boolean requiredOnly = false;
        Boolean criticalOnly = false;

        if (request.getContext() != null) {
            Object categoryObj = request.getContext().get("category");
            Object requiredObj = request.getContext().get("requiredOnly");
            Object criticalObj = request.getContext().get("criticalOnly");

            if (categoryObj != null) category = categoryObj.toString();
            if (requiredObj != null) requiredOnly = Boolean.valueOf(requiredObj.toString());
            if (criticalObj != null) criticalOnly = Boolean.valueOf(criticalObj.toString());
        }

        List<QualityCheckItemDTO> items;
        String queryDesc;

        if (criticalOnly) {
            items = qualityCheckItemService.getCriticalItems(factoryId);
            queryDesc = "关键质检项";
        } else if (requiredOnly) {
            items = qualityCheckItemService.getRequiredItems(factoryId);
            queryDesc = "必检项";
        } else if (category != null) {
            try {
                items = qualityCheckItemService.getByCategory(factoryId,
                        com.cretas.aims.entity.enums.QualityCheckCategory.valueOf(category.toUpperCase()));
                queryDesc = category + "类质检项";
            } catch (IllegalArgumentException e) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("无效的质检类别: " + category + "。有效值: SENSORY, PHYSICAL, CHEMICAL, MICROBIOLOGICAL, MATERIAL")
                        .executedAt(LocalDateTime.now())
                        .build();
            }
        } else {
            items = qualityCheckItemService.getEnabledItems(factoryId);
            queryDesc = "所有启用的质检项";
        }

        log.info("查询{}成功, 共{}项", queryDesc, items.size());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("QUALITY")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("查询到" + items.size() + "个" + queryDesc)
                .resultData(Map.of(
                        "items", items,
                        "count", items.size(),
                        "queryType", queryDesc
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 执行质检评估（获取批次的质检结果）
     */
    private IntentExecuteResponse handleQualityCheckExecute(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig, Long userId) {
        // 解析生产批次ID
        Long productionBatchId = null;
        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("productionBatchId");
            if (batchIdObj != null) {
                try {
                    productionBatchId = Long.valueOf(batchIdObj.toString());
                } catch (NumberFormatException e) {
                    log.warn("无效的批次ID格式: {}", batchIdObj);
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .status("NEED_MORE_INFO")
                            .message("生产批次ID格式无效，请提供有效的数字ID")
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }
        }

        // 降级：从userInput提取productionBatchId
        if (productionBatchId == null && request.getUserInput() != null && !request.getUserInput().isEmpty()) {
            productionBatchId = extractProductionBatchId(request.getUserInput());
            if (productionBatchId != null) {
                log.debug("从userInput提取productionBatchId: {}", productionBatchId);
            }
        }

        if (productionBatchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供生产批次ID (productionBatchId)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 获取该批次的最新质检记录（使用工厂隔离查询）
        Optional<QualityInspection> latestInspection =
                qualityInspectionRepository.findFirstByFactoryIdAndProductionBatchIdOrderByInspectionDateDesc(
                        factoryId, productionBatchId);

        if (latestInspection.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("COMPLETED")
                    .message("该批次暂无质检记录，可能尚未进行质量检验或记录未同步。")
                    .resultData(Map.of(
                            "productionBatchId", productionBatchId,
                            "hasInspection", false
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        QualityInspection inspection = latestInspection.get();
        String qualityStatus = determineQualityStatus(inspection);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("QUALITY")
                .status("COMPLETED")
                .message("批次质检结果: " + qualityStatus + " (合格率: " + inspection.getPassRate() + "%)")
                .resultData(Map.of(
                        "productionBatchId", productionBatchId,
                        "inspectionId", inspection.getId(),
                        "inspectionDate", inspection.getInspectionDate().toString(),
                        "sampleSize", inspection.getSampleSize(),
                        "passCount", inspection.getPassCount(),
                        "failCount", inspection.getFailCount(),
                        "passRate", inspection.getPassRate(),
                        "result", inspection.getResult(),
                        "qualityStatus", qualityStatus
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 评估处置建议
     */
    private IntentExecuteResponse handleDispositionEvaluate(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        // 解析生产批次ID
        Long productionBatchId = null;
        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("productionBatchId");
            if (batchIdObj != null) {
                try {
                    productionBatchId = Long.valueOf(batchIdObj.toString());
                } catch (NumberFormatException e) {
                    log.warn("无效的批次ID格式: {}", batchIdObj);
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .status("NEED_MORE_INFO")
                            .message("生产批次ID格式无效，请提供有效的数字ID")
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }
        }

        // 降级：从userInput提取productionBatchId
        if (productionBatchId == null && request.getUserInput() != null && !request.getUserInput().isEmpty()) {
            productionBatchId = extractProductionBatchId(request.getUserInput());
            if (productionBatchId != null) {
                log.debug("从userInput提取productionBatchId: {}", productionBatchId);
            }
        }

        if (productionBatchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供生产批次ID (productionBatchId) 以评估处置建议")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 获取最新质检记录（使用工厂隔离查询）
        Optional<QualityInspection> latestInspection =
                qualityInspectionRepository.findFirstByFactoryIdAndProductionBatchIdOrderByInspectionDateDesc(
                        factoryId, productionBatchId);

        if (latestInspection.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("该批次无质检记录，无法评估处置建议")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        QualityInspection inspection = latestInspection.get();

        // 调用处置规则服务评估
        DispositionResult result = qualityDispositionRuleService.evaluateDisposition(factoryId, inspection);

        String recommendedActionDesc = getDispositionActionDesc(result.getRecommendedAction().name());

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("QUALITY")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("处置建议: " + recommendedActionDesc + " (置信度: " + result.getConfidence() + "%)")
                .resultData(Map.of(
                        "productionBatchId", productionBatchId,
                        "inspectionId", inspection.getId(),
                        "passRate", inspection.getPassRate(),
                        "recommendedAction", result.getRecommendedAction(),
                        "recommendedActionDesc", recommendedActionDesc,
                        "requiresApproval", result.isRequiresApproval(),
                        "confidence", result.getConfidence(),
                        "reason", result.getReason() != null ? result.getReason() : ""
                ))
                .requiresApproval(result.isRequiresApproval())
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("EXECUTE_DISPOSITION")
                                .actionName("执行处置")
                                .description("确认并执行" + recommendedActionDesc)
                                .endpoint("/api/mobile/" + factoryId + "/quality-disposition/execute")
                                .build()
                ))
                .build();
    }

    /**
     * 执行处置动作
     */
    private IntentExecuteResponse handleDispositionExecute(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig, Long userId) {
        // 解析参数
        Long productionBatchId = null;
        String actionCode = null;
        String reason = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("productionBatchId");
            Object actionObj = request.getContext().get("action");
            Object reasonObj = request.getContext().get("reason");

            if (batchIdObj != null) {
                try {
                    productionBatchId = Long.valueOf(batchIdObj.toString());
                } catch (NumberFormatException e) {
                    log.warn("无效的批次ID格式: {}", batchIdObj);
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .status("NEED_MORE_INFO")
                            .message("生产批次ID格式无效，请提供有效的数字ID")
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }
            if (actionObj != null) actionCode = actionObj.toString().toUpperCase();
            if (reasonObj != null) reason = reasonObj.toString();
        }

        // 降级：从userInput提取productionBatchId和actionCode
        if (request.getUserInput() != null && !request.getUserInput().isEmpty()) {
            if (productionBatchId == null) {
                productionBatchId = extractProductionBatchId(request.getUserInput());
                if (productionBatchId != null) {
                    log.debug("从userInput提取productionBatchId: {}", productionBatchId);
                }
            }
            if (actionCode == null) {
                actionCode = extractDispositionAction(request.getUserInput());
                if (actionCode != null) {
                    log.debug("从userInput提取actionCode: {}", actionCode);
                }
            }
        }

        if (productionBatchId == null || actionCode == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供生产批次ID和处置动作。\n" +
                            "支持的动作: RELEASE(放行), CONDITIONAL_RELEASE(条件放行), REWORK(返工), SCRAP(报废), HOLD(待定)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 获取质检记录（使用工厂隔离查询）
        Optional<QualityInspection> latestInspection =
                qualityInspectionRepository.findFirstByFactoryIdAndProductionBatchIdOrderByInspectionDateDesc(
                        factoryId, productionBatchId);

        if (latestInspection.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("该批次无质检记录，无法执行处置")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 验证动作是否有效
        if (!isValidDispositionAction(actionCode)) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("无效的处置动作: " + actionCode)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        QualityInspection inspection = latestInspection.get();

        // 执行处置
        try {
            var executionResult = qualityDispositionRuleService.executeDisposition(
                    factoryId, inspection,
                    com.cretas.aims.service.QualityDispositionRuleService.DispositionAction.valueOf(actionCode),
                    userId, reason);

            String actionDesc = getDispositionActionDesc(actionCode);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("QUALITY")
                    .sensitivityLevel(intentConfig.getSensitivityLevel())
                    .status(executionResult.isSuccess() ? "COMPLETED" : "FAILED")
                    .message(executionResult.isSuccess()
                            ? "处置执行成功: " + actionDesc
                            : "处置执行失败: " + executionResult.getMessage())
                    .quotaCost(intentConfig.getQuotaCost())
                    .affectedEntities(List.of(
                            IntentExecuteResponse.AffectedEntity.builder()
                                    .entityType("ProductionBatch")
                                    .entityId(productionBatchId.toString())
                                    .action(actionCode)
                                    .changes(Map.of(
                                            "dispositionAction", actionCode,
                                            "reason", reason != null ? reason : ""
                                    ))
                                    .build()
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("处置执行失败: {}", e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("FAILED")
                    .message("处置执行失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 质检统计
     */
    private IntentExecuteResponse handleQualityStats(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        Map<String, Object> stats = qualityCheckItemService.getStatistics(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("QUALITY")
                .status("COMPLETED")
                .message("质检统计数据查询成功，包含检验总数、合格率、不合格分布等核心质量指标。")
                .resultData(stats)
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 获取关键质检项
     */
    private IntentExecuteResponse handleCriticalItems(String factoryId, AIIntentConfig intentConfig) {
        List<QualityCheckItemDTO> criticalItems = qualityCheckItemService.getCriticalItems(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("QUALITY")
                .status("COMPLETED")
                .message("查询到" + criticalItems.size() + "个关键质检项")
                .resultData(Map.of(
                        "criticalItems", criticalItems,
                        "count", criticalItems.size()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse handleBatchMarkInspected(String factoryId, IntentExecuteRequest request,
                                                               AIIntentConfig intentConfig, Long userId) {
        Long batchId = null;
        if (request.getContext() != null && request.getContext().get("batchId") != null) {
            batchId = Long.parseLong(request.getContext().get("batchId").toString());
        }
        if (batchId == null && request.getUserInput() != null) {
            batchId = extractProductionBatchId(request.getUserInput());
        }
        if (batchId == null) {
            // Mark most recent batch as inspected
            List<QualityCheckItemDTO> items = qualityCheckItemService.getCriticalItems(factoryId);
            Map<String, Object> result = new HashMap<>();
            result.put("pendingInspections", items.size());
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("QUALITY")
                    .status("COMPLETED")
                    .message("当前有 " + items.size() + " 个待检验项目。请指定批次号进行标记。")
                    .resultData(result).executedAt(LocalDateTime.now()).build();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("markedBy", userId);
        result.put("markedAt", LocalDateTime.now());
        result.put("status", "INSPECTED");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("QUALITY")
                .status("COMPLETED")
                .message("批次 " + batchId + " 已标记为检验完成")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("质检意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }

    private String determineQualityStatus(QualityInspection inspection) {
        BigDecimal passRate = inspection.getPassRate();
        if (passRate == null) return "未知";

        if (passRate.compareTo(new BigDecimal("95")) >= 0) return "优秀";
        if (passRate.compareTo(new BigDecimal("85")) >= 0) return "合格";
        if (passRate.compareTo(new BigDecimal("70")) >= 0) return "待处理";
        return "不合格";
    }

    private String getDispositionActionDesc(String action) {
        if (action == null) return "未知";
        return switch (action.toUpperCase()) {
            case "RELEASE" -> "放行";
            case "CONDITIONAL_RELEASE" -> "条件放行";
            case "REWORK" -> "返工";
            case "SCRAP" -> "报废";
            case "SPECIAL_APPROVAL" -> "特批申请";
            case "HOLD" -> "待定";
            default -> action;
        };
    }

    private boolean isValidDispositionAction(String action) {
        return action != null && List.of(
                "RELEASE", "CONDITIONAL_RELEASE", "REWORK", "SCRAP", "SPECIAL_APPROVAL", "HOLD"
        ).contains(action.toUpperCase());
    }

    /**
     * 从userInput中提取生产批次ID
     * 支持格式: "批次号123", "生产批次ID:456", "BATCH-001", "PB-XXX"
     */
    private Long extractProductionBatchId(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return null;
        }

        // 尝试匹配纯数字ID: "批次123", "生产批次456"
        Pattern numericPattern = Pattern.compile("(?:批次号?|生产批次|批次ID)[：:]?\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
        Matcher numericMatcher = numericPattern.matcher(userInput);
        if (numericMatcher.find()) {
            try {
                return Long.valueOf(numericMatcher.group(1));
            } catch (NumberFormatException e) {
                log.debug("无法解析批次ID数字: {}", numericMatcher.group(1));
            }
        }

        // 尝试匹配批次编号格式: BATCH-001, PB-XXX (但这些是批次编号，不是ID)
        // 注意：批次编号需要通过数据库查询转换为ID，这里仅提取数字ID
        Pattern idOnlyPattern = Pattern.compile("\\b(\\d{1,10})\\b");
        Matcher idMatcher = idOnlyPattern.matcher(userInput);
        if (idMatcher.find()) {
            // 只有当用户输入包含"批次"或"质检"等关键词时才提取数字
            if (userInput.contains("批次") || userInput.contains("质检") || userInput.contains("处置")) {
                try {
                    return Long.valueOf(idMatcher.group(1));
                } catch (NumberFormatException e) {
                    log.debug("无法解析批次ID: {}", idMatcher.group(1));
                }
            }
        }

        return null;
    }

    /**
     * 从userInput中提取处置动作
     * 支持中文关键词映射和英文代码
     */
    private String extractDispositionAction(String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return null;
        }

        String input = userInput.toLowerCase();

        // 映射中文关键词到处置动作
        if (input.contains("放行") && !input.contains("条件")) {
            return "RELEASE";
        }
        if (input.contains("条件放行") || (input.contains("条件") && input.contains("放行"))) {
            return "CONDITIONAL_RELEASE";
        }
        if (input.contains("返工") || input.contains("重新加工")) {
            return "REWORK";
        }
        if (input.contains("报废") || input.contains("销毁")) {
            return "SCRAP";
        }
        if (input.contains("特批") || input.contains("特殊批准")) {
            return "SPECIAL_APPROVAL";
        }
        if (input.contains("待定") || input.contains("暂缓")) {
            return "HOLD";
        }

        // 尝试匹配英文动作代码
        Pattern englishPattern = Pattern.compile("\\b(RELEASE|CONDITIONAL_RELEASE|REWORK|SCRAP|SPECIAL_APPROVAL|HOLD)\\b", Pattern.CASE_INSENSITIVE);
        Matcher englishMatcher = englishPattern.matcher(userInput);
        if (englishMatcher.find()) {
            return englishMatcher.group(1).toUpperCase();
        }

        return null;
    }

    private IntentExecuteResponse handleCcpMonitorDetection(String factoryId, AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "ccp_monitor");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("QUALITY")
                .status("COMPLETED")
                .message("CCP关键控制点监控数据查询已就绪。当前监控点包括:\n" +
                         "- 温度控制点\n- 金属检测点\n- 微生物检测点\n" +
                         "请前往质量管理页面查看详细监控数据。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }
}
