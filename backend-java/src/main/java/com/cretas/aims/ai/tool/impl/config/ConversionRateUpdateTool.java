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
        log.info("执行转化率配置更新 - 工厂ID: {}, 参数: {}", factoryId, params);

        // 获取必需参数
        String rawMaterialTypeId = getString(params, "rawMaterialTypeId");
        String productTypeId = getString(params, "productTypeId");
        BigDecimal conversionRate = getBigDecimal(params, "conversionRate");

        // 获取可选参数
        String effectiveDate = getString(params, "effectiveDate");
        String remark = getString(params, "remark");

        // 参数验证
        if (conversionRate == null || conversionRate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("转化率必须大于0");
        }

        // TODO: 调用实际服务更新转化率配置
        // ConversionRateConfig config = conversionRateConfigService.updateConversionRate(
        //     factoryId, rawMaterialTypeId, productTypeId, conversionRate, effectiveDate, remark);

        // 占位实现：返回模拟结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("configId", "CONFIG_" + System.currentTimeMillis());
        result.put("rawMaterialTypeId", rawMaterialTypeId);
        result.put("productTypeId", productTypeId);
        result.put("conversionRate", conversionRate);
        result.put("effectiveDate", effectiveDate != null ? effectiveDate : "立即生效");
        if (remark != null) {
            result.put("remark", remark);
        }
        result.put("message", "转化率配置已更新成功");
        result.put("notice", "请接入ConversionRateConfigService完成实际配置更新");

        log.info("转化率配置更新完成 - 原材料: {}, 产品: {}, 转化率: {}",
                rawMaterialTypeId, productTypeId, conversionRate);

        return result;
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
