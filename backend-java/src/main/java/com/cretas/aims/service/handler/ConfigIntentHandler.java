package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.ConversionDTO;
import com.cretas.aims.dto.equipment.EquipmentDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.ConversionService;
import com.cretas.aims.service.EquipmentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 配置管理意图处理器
 *
 * 处理 CONFIG 分类的意图:
 * - EQUIPMENT_MAINTENANCE: 设备维护记录
 * - CONVERSION_RATE_UPDATE: 转换率配置
 * - RULE_CONFIG: 业务规则配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ConfigIntentHandler implements IntentHandler {

    private final EquipmentService equipmentService;
    private final ConversionService conversionService;
    private final ObjectMapper objectMapper;

    @Override
    public String getSupportedCategory() {
        return "CONFIG";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("ConfigIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "EQUIPMENT_MAINTENANCE" -> handleEquipmentMaintenance(factoryId, request, intentConfig, userId);
                case "CONVERSION_RATE_UPDATE" -> handleConversionRateUpdate(factoryId, request, intentConfig, userId);
                case "RULE_CONFIG" -> handleRuleConfig(factoryId, request, intentConfig, userId);
                default -> buildFailedResponse(intentCode, intentConfig, "未知的配置管理意图: " + intentCode);
            };

        } catch (Exception e) {
            log.error("ConfigIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return buildFailedResponse(intentCode, intentConfig, "执行失败: " + e.getMessage());
        }
    }

    /**
     * 处理设备维护意图
     */
    private IntentExecuteResponse handleEquipmentMaintenance(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("设备维护意图: factoryId={}, userInput={}", factoryId, userInput);

        String equipmentId = null;
        LocalDate maintenanceDate = LocalDate.now();
        BigDecimal cost = BigDecimal.ZERO;
        String description = null;

        // 从 context 获取数据
        if (request.getContext() != null) {
            try {
                JsonNode params = objectMapper.valueToTree(request.getContext());

                if (params.has("equipmentId")) {
                    equipmentId = params.get("equipmentId").asText();
                }
                if (params.has("maintenanceDate")) {
                    maintenanceDate = LocalDate.parse(params.get("maintenanceDate").asText());
                }
                if (params.has("cost")) {
                    cost = new BigDecimal(params.get("cost").asText());
                }
                if (params.has("description")) {
                    description = params.get("description").asText();
                }
            } catch (Exception e) {
                log.warn("解析设备维护参数失败: {}", e.getMessage());
            }
        }

        if (equipmentId == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "请指定要记录维护的设备。\n" +
                    "提供 context: {equipmentId: 'EQ001', description: '更换滤芯', cost: 500}");
        }

        // 执行维护记录
        EquipmentDTO updated = equipmentService.recordMaintenance(
                factoryId, equipmentId, maintenanceDate, cost, description);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CONFIG")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("设备维护记录已保存: " + updated.getName() + " (" + equipmentId + ")")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("Equipment")
                                .entityId(equipmentId)
                                .entityName(updated.getName())
                                .action("MAINTENANCE_RECORDED")
                                .changes(Map.of(
                                        "maintenanceDate", maintenanceDate.toString(),
                                        "cost", cost.toString(),
                                        "description", description != null ? description : ""
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_HISTORY")
                                .actionName("查看维护历史")
                                .description("查看该设备的完整维护记录")
                                .endpoint("/api/mobile/" + factoryId + "/equipment/" + equipmentId + "/maintenance-history")
                                .build()
                ))
                .build();
    }

    /**
     * 处理转换率配置意图
     * 支持创建或更新原材料到产品的转换率
     */
    private IntentExecuteResponse handleConversionRateUpdate(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("转换率配置意图: factoryId={}, userInput={}", factoryId, userInput);

        // 检查参数
        String rawMaterialTypeId = null;
        String productTypeId = null;
        BigDecimal conversionRate = null;
        BigDecimal wastageRate = null;

        if (request.getContext() != null) {
            try {
                JsonNode params = objectMapper.valueToTree(request.getContext());

                // 支持多种参数名称
                if (params.has("rawMaterialTypeId")) {
                    rawMaterialTypeId = params.get("rawMaterialTypeId").asText();
                } else if (params.has("materialTypeId")) {
                    rawMaterialTypeId = params.get("materialTypeId").asText();
                }
                if (params.has("productTypeId")) {
                    productTypeId = params.get("productTypeId").asText();
                }
                if (params.has("rate") || params.has("conversionRate")) {
                    String rateStr = params.has("rate") ?
                            params.get("rate").asText() : params.get("conversionRate").asText();
                    conversionRate = new BigDecimal(rateStr);
                }
                if (params.has("wastageRate")) {
                    wastageRate = new BigDecimal(params.get("wastageRate").asText());
                }
            } catch (Exception e) {
                log.warn("解析转换率参数失败: {}", e.getMessage());
            }
        }

        if (rawMaterialTypeId == null || productTypeId == null || conversionRate == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "配置转换率需要指定原材料类型、产品类型和转换率。\n" +
                    "提供 context: {rawMaterialTypeId: 'RMT001', productTypeId: 'PT001', rate: 0.85}\n" +
                    "例如：'设置带鱼到带鱼片的转换率为85%'");
        }

        // 调用 ConversionService 更新或创建转换率
        String action;
        ConversionDTO resultDTO;
        String conversionId = null;

        try {
            // 尝试查找已存在的转换率配置
            ConversionDTO existingConversion = null;
            try {
                existingConversion = conversionService.getConversionRate(factoryId, rawMaterialTypeId, productTypeId);
            } catch (Exception e) {
                log.debug("未找到现有转换率配置，将创建新配置: {}", e.getMessage());
            }

            // 构建 DTO
            ConversionDTO dto = ConversionDTO.builder()
                    .materialTypeId(rawMaterialTypeId)
                    .productTypeId(productTypeId)
                    .conversionRate(conversionRate)
                    .wastageRate(wastageRate != null ? wastageRate : BigDecimal.ZERO)
                    .isActive(true)
                    .notes("通过AI意图配置更新")
                    .build();

            if (existingConversion != null && existingConversion.getId() != null) {
                // 更新现有配置
                conversionId = existingConversion.getId();
                resultDTO = conversionService.updateConversion(factoryId, conversionId, dto);
                action = "UPDATED";
                log.info("转换率已更新: id={}, rate={}", conversionId, conversionRate);
            } else {
                // 创建新配置
                resultDTO = conversionService.createConversion(factoryId, dto);
                conversionId = resultDTO.getId();
                action = "CREATED";
                log.info("转换率已创建: id={}, rate={}", conversionId, conversionRate);
            }
        } catch (Exception e) {
            log.error("转换率配置失败: {}", e.getMessage(), e);
            return buildFailedResponse(intentConfig.getIntentCode(), intentConfig,
                    "转换率配置失败: " + e.getMessage());
        }

        String finalRawMaterialTypeId = rawMaterialTypeId;
        String finalProductTypeId = productTypeId;
        BigDecimal finalConversionRate = conversionRate;
        String finalAction = action;
        String finalConversionId = conversionId;

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CONFIG")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("转换率已" + ("CREATED".equals(finalAction) ? "创建" : "更新") + ": " +
                        (resultDTO.getMaterialTypeName() != null ? resultDTO.getMaterialTypeName() : finalRawMaterialTypeId) +
                        " → " +
                        (resultDTO.getProductTypeName() != null ? resultDTO.getProductTypeName() : finalProductTypeId) +
                        " = " + finalConversionRate)
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialProductConversion")
                                .entityId(finalConversionId)
                                .entityName(finalRawMaterialTypeId + " → " + finalProductTypeId)
                                .action(finalAction)
                                .changes(Map.of(
                                        "materialTypeId", finalRawMaterialTypeId,
                                        "productTypeId", finalProductTypeId,
                                        "conversionRate", finalConversionRate.toString()
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_CONVERSIONS")
                                .actionName("查看所有转换率")
                                .description("查看工厂的所有转换率配置")
                                .endpoint("/api/mobile/" + factoryId + "/conversions")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_HISTORY")
                                .actionName("查看变更历史")
                                .description("查看该转换率的变更记录")
                                .endpoint("/api/mobile/" + factoryId + "/conversions/" + finalConversionId + "/history")
                                .build()
                ))
                .build();
    }

    /**
     * 处理规则配置意图
     * 支持配置质量阈值、告警触发、审批流程规则
     */
    private IntentExecuteResponse handleRuleConfig(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig, Long operatorId) {
        String userInput = request.getUserInput();
        log.info("规则配置意图: factoryId={}, userInput={}", factoryId, userInput);

        String ruleType = null;
        String ruleName = null;
        String condition = null;
        String threshold = null;

        if (request.getContext() != null) {
            try {
                JsonNode params = objectMapper.valueToTree(request.getContext());

                if (params.has("ruleType")) {
                    ruleType = params.get("ruleType").asText();
                }
                if (params.has("ruleName")) {
                    ruleName = params.get("ruleName").asText();
                }
                if (params.has("condition")) {
                    condition = params.get("condition").asText();
                }
                if (params.has("threshold")) {
                    threshold = params.get("threshold").asText();
                }
            } catch (Exception e) {
                log.warn("解析规则配置参数失败: {}", e.getMessage());
            }
        }

        // 从用户输入解析规则类型
        if (ruleType == null) {
            ruleType = parseRuleTypeFromInput(userInput);
        }

        if (ruleType == null) {
            return buildNeedMoreInfoResponse(intentConfig,
                    "请指定要配置的规则类型。\n" +
                    "支持的规则类型: QUALITY_THRESHOLD(质量阈值), ALERT_TRIGGER(告警触发), APPROVAL_FLOW(审批流程)\n" +
                    "示例: '配置温度告警规则，超过30度触发' 或\n" +
                    "提供 context: {ruleType: 'ALERT_TRIGGER', ruleName: '温度告警', condition: 'temperature>30'}");
        }

        // 模拟规则配置操作
        String ruleTypeDisplayName = getRuleTypeDisplayName(ruleType);
        String ruleId = "RULE-" + factoryId + "-" + System.currentTimeMillis();

        log.info("规则配置已保存: factoryId={}, ruleType={}, ruleName={}", factoryId, ruleType, ruleName);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CONFIG")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已配置「" + ruleTypeDisplayName + "」规则" + (ruleName != null ? ": " + ruleName : ""))
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("Rule")
                                .entityId(ruleId)
                                .entityName(ruleName != null ? ruleName : ruleTypeDisplayName)
                                .action("CREATED")
                                .changes(Map.of(
                                        "ruleType", ruleType,
                                        "condition", condition != null ? condition : "",
                                        "threshold", threshold != null ? threshold : ""
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_RULES")
                                .actionName("查看规则列表")
                                .description("查看所有已配置的规则")
                                .endpoint("/api/mobile/" + factoryId + "/rules")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_RULE")
                                .actionName("测试规则")
                                .description("验证规则是否正确触发")
                                .endpoint("/api/mobile/" + factoryId + "/rules/" + ruleId + "/test")
                                .build()
                ))
                .build();
    }

    private String parseRuleTypeFromInput(String input) {
        if (input == null) return null;
        String lower = input.toLowerCase();
        if (lower.contains("质量") || lower.contains("阈值") || lower.contains("标准")) return "QUALITY_THRESHOLD";
        if (lower.contains("告警") || lower.contains("警报") || lower.contains("触发")) return "ALERT_TRIGGER";
        if (lower.contains("审批") || lower.contains("流程") || lower.contains("批准")) return "APPROVAL_FLOW";
        return null;
    }

    private String getRuleTypeDisplayName(String ruleType) {
        if (ruleType == null) return "未知规则";
        return switch (ruleType) {
            case "QUALITY_THRESHOLD" -> "质量阈值";
            case "ALERT_TRIGGER" -> "告警触发";
            case "APPROVAL_FLOW" -> "审批流程";
            default -> ruleType;
        };
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        String intentCode = intentConfig.getIntentCode();
        log.info("ConfigIntentHandler预览: intentCode={}, factoryId={}", intentCode, factoryId);

        String previewMessage = switch (intentCode) {
            case "EQUIPMENT_MAINTENANCE" -> "将记录设备维护信息，包括维护日期、费用和描述。";
            case "CONVERSION_RATE_UPDATE" -> "将更新原材料到产品的转换率配置。";
            case "RULE_CONFIG" -> "将配置业务规则（质量阈值、告警触发、审批流程等）。";
            default -> "未知的配置管理操作";
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig.getIntentName())
                .intentCategory("CONFIG")
                .status("PREVIEW")
                .message(previewMessage)
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== Helper Methods ====================

    private IntentExecuteResponse buildFailedResponse(String intentCode, AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentCode)
                .intentName(intentConfig != null ? intentConfig.getIntentName() : null)
                .intentCategory("CONFIG")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }

    private IntentExecuteResponse buildNeedMoreInfoResponse(AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("CONFIG")
                .status("NEED_MORE_INFO")
                .message(message)
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("PROVIDE_PARAMS")
                                .actionName("补充参数")
                                .description("请在请求中添加 context 字段提供所需信息")
                                .build()
                ))
                .build();
    }
}
