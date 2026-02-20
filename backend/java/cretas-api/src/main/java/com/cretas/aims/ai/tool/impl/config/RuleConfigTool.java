package com.cretas.aims.ai.tool.impl.config;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 规则配置工具
 *
 * 管理业务规则配置，包括质检规则、库存规则、生产规则等。
 * 支持规则的创建、更新、启用/禁用等操作。
 *
 * Intent Code: RULE_CONFIG
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class RuleConfigTool extends AbstractBusinessTool {

    // TODO: 注入实际的规则配置服务
    // @Autowired
    // private RuleConfigService ruleConfigService;

    @Override
    public String getToolName() {
        return "rule_config";
    }

    @Override
    public String getDescription() {
        return "管理业务规则配置。支持质检规则、库存规则、生产规则等的创建和更新。" +
                "适用场景：配置质检标准、设置库存预警阈值、调整生产参数规则。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // ruleId: 规则ID（更新时必需，新建时可选）
        Map<String, Object> ruleId = new HashMap<>();
        ruleId.put("type", "string");
        ruleId.put("description", "规则ID，更新现有规则时提供");
        properties.put("ruleId", ruleId);

        // ruleCode: 规则编码（新建时必需）
        Map<String, Object> ruleCode = new HashMap<>();
        ruleCode.put("type", "string");
        ruleCode.put("description", "规则编码，唯一标识符");
        properties.put("ruleCode", ruleCode);

        // ruleConfig: 规则配置（必需）
        Map<String, Object> ruleConfig = new HashMap<>();
        ruleConfig.put("type", "object");
        ruleConfig.put("description", "规则配置内容，JSON格式");
        properties.put("ruleConfig", ruleConfig);

        // ruleName: 规则名称（可选）
        Map<String, Object> ruleName = new HashMap<>();
        ruleName.put("type", "string");
        ruleName.put("description", "规则名称");
        properties.put("ruleName", ruleName);

        // ruleType: 规则类型（可选）
        Map<String, Object> ruleType = new HashMap<>();
        ruleType.put("type", "string");
        ruleType.put("description", "规则类型");
        ruleType.put("enum", Arrays.asList(
                "QUALITY_CHECK",     // 质检规则
                "INVENTORY_ALERT",   // 库存预警规则
                "PRODUCTION",        // 生产规则
                "EXPIRY_ALERT",      // 过期预警规则
                "APPROVAL_FLOW",     // 审批流程规则
                "NOTIFICATION"       // 通知规则
        ));
        properties.put("ruleType", ruleType);

        // enabled: 是否启用（可选）
        Map<String, Object> enabled = new HashMap<>();
        enabled.put("type", "boolean");
        enabled.put("description", "是否启用规则");
        enabled.put("default", true);
        properties.put("enabled", enabled);

        // description: 规则描述（可选）
        Map<String, Object> description = new HashMap<>();
        description.put("type", "string");
        description.put("description", "规则描述");
        properties.put("description", description);

        schema.put("properties", properties);
        // ruleId或ruleCode至少需要一个，ruleConfig必需
        schema.put("required", Arrays.asList("ruleConfig"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        // ruleId或ruleCode至少需要一个，但这里只能指定必需的ruleConfig
        // 实际校验在doExecute中进行
        return Arrays.asList("ruleConfig");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行规则配置操作 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取参数
        String ruleId = getString(params, "ruleId");
        String ruleCode = getString(params, "ruleCode");
        Object ruleConfig = params.get("ruleConfig");
        String ruleName = getString(params, "ruleName");
        String ruleType = getString(params, "ruleType");
        Boolean enabled = getBoolean(params, "enabled", true);
        String description = getString(params, "description");

        // 验证：ruleId或ruleCode至少需要一个
        if ((ruleId == null || ruleId.trim().isEmpty()) &&
            (ruleCode == null || ruleCode.trim().isEmpty())) {
            throw new IllegalArgumentException("ruleId或ruleCode至少需要提供一个");
        }

        // 验证ruleConfig
        if (ruleConfig == null) {
            throw new IllegalArgumentException("ruleConfig不能为空");
        }

        LocalDateTime now = LocalDateTime.now();
        String timestamp = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        boolean isUpdate = ruleId != null && !ruleId.trim().isEmpty();

        // TODO: 调用实际服务保存规则配置
        // if (isUpdate) {
        //     RuleConfig config = ruleConfigService.updateRule(factoryId, ruleId, ruleConfig, enabled);
        // } else {
        //     RuleConfig config = ruleConfigService.createRule(factoryId, ruleCode, ruleConfig, ruleName, ruleType, enabled);
        // }

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("operation", isUpdate ? "UPDATE" : "CREATE");
        result.put("ruleId", ruleId != null ? ruleId : "RULE_" + System.currentTimeMillis());
        result.put("ruleCode", ruleCode);
        result.put("ruleConfig", ruleConfig);
        result.put("enabled", enabled);
        result.put("updatedAt", timestamp);

        if (ruleName != null) {
            result.put("ruleName", ruleName);
        }
        if (ruleType != null) {
            result.put("ruleType", ruleType);
            result.put("ruleTypeName", getRuleTypeName(ruleType));
        }
        if (description != null) {
            result.put("description", description);
        }

        result.put("message", isUpdate ? "规则配置已更新成功" : "规则配置已创建成功");
        result.put("notice", "请接入RuleConfigService完成实际规则配置");

        log.info("规则配置操作完成 - 操作: {}, 规则: {}",
                isUpdate ? "更新" : "创建",
                ruleId != null ? ruleId : ruleCode);

        return result;
    }

    /**
     * 获取规则类型的中文名称
     */
    private String getRuleTypeName(String type) {
        Map<String, String> typeNames = Map.of(
            "QUALITY_CHECK", "质检规则",
            "INVENTORY_ALERT", "库存预警规则",
            "PRODUCTION", "生产规则",
            "EXPIRY_ALERT", "过期预警规则",
            "APPROVAL_FLOW", "审批流程规则",
            "NOTIFICATION", "通知规则"
        );
        return typeNames.getOrDefault(type.toUpperCase(), type);
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "ruleId", "请问要更新哪个规则？请提供规则ID。",
            "ruleCode", "请问新规则的编码是什么？",
            "ruleConfig", "请问规则的具体配置内容是什么？"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "ruleId", "规则ID",
            "ruleCode", "规则编码",
            "ruleConfig", "规则配置",
            "ruleName", "规则名称",
            "ruleType", "规则类型",
            "enabled", "是否启用",
            "description", "规则描述"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
