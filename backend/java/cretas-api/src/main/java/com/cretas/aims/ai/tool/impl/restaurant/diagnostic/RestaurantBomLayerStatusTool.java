package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantBomLayerStatusTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_bom_layer_status";
    }

    @Override
    public String getDescription() {
        return "BOM 数据精度状态 (Layer 0-3) - 报告当前 SKU 表单覆盖率和月度采购校准层级, 提示升级路径. 适用场景: 客户问'我能算多细的成本'/'还要上传什么数据才能看到真实毛利'.";
    }

    @Override
    protected String getSectionName() {
        return "bom_layer_status";
    }
}
