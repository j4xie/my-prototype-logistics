package com.cretas.aims.ai.tool.impl.config;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;

/**
 * 转化率配置更新工具
 *
 * 更新原材料到成品的转化率配置。
 * 用于设置特定原材料类型与产品类型之间的转化比例。
 *
 * Intent Code: CONVERSION_RATE_UPDATE
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-07
 */
@Slf4j
@Component
public class ConversionRateUpdateTool extends AbstractBusinessTool {

    // TODO: 注入实际的配置服务
    // @Autowired
    // private ConversionRateConfigService conversionRateConfigService;

    @Override
    public String getToolName() {
        return "conversion_rate_update";
    }

    @Override
    public String getDescription() {
        return "更新原材料到成品的转化率配置。设置特定原材料类型与产品类型之间的转化比例。" +
                "适用场景：调整生产转化率、配置新产品的原料消耗比例。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // rawMaterialTypeId: 原材料类型ID（必需）
        Map<String, Object> rawMaterialTypeId = new HashMap<>();
        rawMaterialTypeId.put("type", "string");
        rawMaterialTypeId.put("description", "原材料类型ID");
        properties.put("rawMaterialTypeId", rawMaterialTypeId);

        // productTypeId: 产品类型ID（必需）
        Map<String, Object> productTypeId = new HashMap<>();
        productTypeId.put("type", "string");
        productTypeId.put("description", "产品类型ID");
        properties.put("productTypeId", productTypeId);

        // conversionRate: 转化率（必需）
        Map<String, Object> conversionRate = new HashMap<>();
        conversionRate.put("type", "number");
        conversionRate.put("description", "转化率，表示生产1单位产品需要多少单位原材料");
        conversionRate.put("minimum", 0.001);
        conversionRate.put("maximum", 1000);
        properties.put("conversionRate", conversionRate);

        // effectiveDate: 生效日期（可选）
        Map<String, Object> effectiveDate = new HashMap<>();
        effectiveDate.put("type", "string");
        effectiveDate.put("description", "生效日期，格式 YYYY-MM-DD，默认立即生效");
        properties.put("effectiveDate", effectiveDate);

        // remark: 备注（可选）
        Map<String, Object> remark = new HashMap<>();
        remark.put("type", "string");
        remark.put("description", "配置变更备注");
        properties.put("remark", remark);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("rawMaterialTypeId", "productTypeId", "conversionRate"));

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Arrays.asList("rawMaterialTypeId", "productTypeId", "conversionRate");
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        // 转化率配置服务未接入 — 禁止降级处理，返回明确错误而非模拟数据
        return buildSimpleResult("error", java.util.Map.of(
                "success", false,
                "error", "转化率配置服务尚未接入，请联系管理员配置 ConversionRateConfigService",
                "code", "SERVICE_NOT_AVAILABLE"));
    }

    @Override
    protected String getParameterQuestion(String paramName) {
        Map<String, String> questions = Map.of(
            "rawMaterialTypeId", "请问要配置哪种原材料的转化率？请提供原材料类型ID。",
            "productTypeId", "请问是生产哪种产品？请提供产品类型ID。",
            "conversionRate", "请问转化率是多少？（即生产1单位产品需要多少单位原材料）"
        );
        return questions.getOrDefault(paramName, super.getParameterQuestion(paramName));
    }

    @Override
    protected String getParameterDisplayName(String paramName) {
        Map<String, String> displayNames = Map.of(
            "rawMaterialTypeId", "原材料类型ID",
            "productTypeId", "产品类型ID",
            "conversionRate", "转化率",
            "effectiveDate", "生效日期",
            "remark", "备注"
        );
        return displayNames.getOrDefault(paramName, super.getParameterDisplayName(paramName));
    }
}
