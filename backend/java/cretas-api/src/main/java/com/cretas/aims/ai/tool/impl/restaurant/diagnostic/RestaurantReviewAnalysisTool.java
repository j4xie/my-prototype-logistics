package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RestaurantReviewAnalysisTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_review_analysis";
    }

    @Override
    public String getDescription() {
        return "基于大众点评/美团评论的 SKU 情感抽取 (DeepSeek V3.2) - 识别正负面评论、抽取菜品提及、生成风险预警. 适用场景: 客户问'客户怎么说我的菜'/'差评主要在哪'/'评分为什么下降'.";
    }

    @Override
    protected String getSectionName() {
        return "review_analysis";
    }
}
