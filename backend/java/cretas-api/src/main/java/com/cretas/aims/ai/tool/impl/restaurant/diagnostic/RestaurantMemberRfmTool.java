package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class RestaurantMemberRfmTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_member_rfm";
    }

    @Override
    public String getDescription() {
        return "会员 RFM 分层 (Champions / Loyal / At Risk / Lost 等 6 段) - 基于 Recency/Frequency/Monetary 打分, 识别流失客户和核心贡献者. 适用场景: 客户问'流失客户有多少'/'怎么做定向召回'/'谁是冠军客户'.";
    }

    @Override
    protected String getSectionName() {
        return "member_rfm";
    }

    @Override
    protected List<String> buildFollowUps(String sectionName, Map<String, Object> data) {
        return List.of(
            "冠军客户贡献多少",
            "流失客户怎么召回",
            "储值卡兑付健康度"
        );
    }
}
