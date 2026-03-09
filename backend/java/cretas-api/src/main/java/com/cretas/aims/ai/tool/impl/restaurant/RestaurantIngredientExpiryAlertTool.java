package com.cretas.aims.ai.tool.impl.restaurant;

import com.cretas.aims.ai.tool.AbstractBusinessTool;
import com.cretas.aims.repository.MaterialBatchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 食材保质期预警工具（默认7天内到期）
 *
 * 对应意图: RESTAURANT_INGREDIENT_EXPIRY_ALERT
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-07
 */
@Slf4j
@Component
public class RestaurantIngredientExpiryAlertTool extends AbstractBusinessTool {

    @Autowired
    private MaterialBatchRepository materialBatchRepository;

    @Override
    public String getToolName() {
        return "restaurant_ingredient_expiry_alert";
    }

    @Override
    public String getDescription() {
        return "食材保质期预警，查询即将到期的食材批次。默认预警7天内到期，可自定义天数。" +
                "适用场景：食材安全管理、临期食材处理、先进先出提醒。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        Map<String, Object> days = new HashMap<>();
        days.put("type", "integer");
        days.put("description", "预警天数，默认7天");
        days.put("default", 7);
        days.put("minimum", 1);
        properties.put("days", days);

        schema.put("properties", properties);
        schema.put("required", Collections.emptyList());

        return schema;
    }

    @Override
    protected List<String> getRequiredParameters() {
        return Collections.emptyList();
    }

    @Override
    protected Map<String, Object> doExecute(String factoryId, Map<String, Object> params, Map<String, Object> context) throws Exception {
        log.info("执行食材保质期预警 - 工厂ID: {}, 参数: {}", factoryId, params);

        int alertDays = getInteger(params, "days", 7);

        LocalDate warningDate = LocalDate.now().plusDays(alertDays);
        var expiringBatches = materialBatchRepository.findExpiringBatches(factoryId, warningDate);

        if (expiringBatches.isEmpty()) {
            return buildSimpleResult(
                    String.format("当前 %d 天内无临期食材，库存状态良好。", alertDays), null);
        }

        List<Map<String, Object>> alerts = expiringBatches.stream().map(b -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("食材", b.getMaterialType() != null ? b.getMaterialType().getName() : "未知");
            row.put("批次号", b.getBatchNumber());
            row.put("到期日期", b.getExpireDate() != null ? b.getExpireDate().toString() : "-");
            row.put("可用数量", String.format("%.2f %s", b.getRemainingQuantity(), b.getQuantityUnit()));
            long daysLeft = b.getExpireDate() != null ?
                    LocalDate.now().until(b.getExpireDate()).getDays() : 0;
            row.put("剩余天数", daysLeft + " 天");
            row.put("紧急程度", daysLeft <= 2 ? "紧急" : daysLeft <= 5 ? "警告" : "提醒");
            return row;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("预警天数", alertDays);
        result.put("临期食材数", alerts.size());
        result.put("临期列表", alerts);

        log.info("食材保质期预警完成 - 发现 {} 批临期食材", alerts.size());
        return result;
    }
}
