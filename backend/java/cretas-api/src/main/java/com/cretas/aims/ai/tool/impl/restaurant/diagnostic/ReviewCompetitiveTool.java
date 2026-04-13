package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class ReviewCompetitiveTool extends AbstractRestaurantDiagnosticTool {
    @Override public String getToolName() { return "restaurant_review_competitive"; }
    @Override public String getDescription() {
        return "评论竞品分析 — 对比自家与竞品在点评平台的评分/评论数/客单价, 生成竞争洞察.";
    }
    @Override protected String getSectionName() { return "review_competitive"; }
    @Override protected List<String> buildFollowUps(String sn, Map<String, Object> d) {
        return Arrays.asList("分析差评关键词差异", "竞品热销套餐结构", "提升评分具体建议");
    }
}
