package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class BomVarianceTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_bom_variance";
    }

    @Override
    public String getDescription() {
        return "BOM 成本差异双维度归因 — 把成本偏差拆为供应链差异 (采购价变动) 和管理差异 (实际用量偏差), "
             + "按 SKU 明细 + 汇总. 客户说 [T43:00] '同样的销量, 因为采购价格差多少, 因为上面涨了'.";
    }

    @Override
    protected String getSectionName() {
        return "bom_variance";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>(super.getParametersSchema());
        @SuppressWarnings("unchecked")
        Map<String, Object> props = new HashMap<>((Map<String, Object>) schema.getOrDefault("properties", Collections.emptyMap()));

        Map<String, Object> items = new HashMap<>();
        items.put("type", "array");
        items.put("description", "SKU 明细列表, 每项需 sku/std_qty/std_price/actual_qty/actual_price");
        props.put("items", items);

        schema.put("properties", props);
        return schema;
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return Arrays.asList(
            "哪些 SKU 的供应链差异最大",
            "管理差异超标的原因追溯",
            "对比上月的 BOM 成本率变化"
        );
    }
}
