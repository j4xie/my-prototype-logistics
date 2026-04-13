package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantCalibrationHistoryTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_calibration_history";
    }

    @Override
    public String getDescription() {
        return "BOM 月度校准历史 + 异常时间线 - 追溯食材成本率的月度偏移曲线, 识别异常时间点. 适用场景: 客户问'大丸店什么时候开始掉的'/'食材成本是不是在偏移'/'哪个月异常'.";
    }

    @Override
    protected String getSectionName() {
        return "calibration_history";
    }
}
