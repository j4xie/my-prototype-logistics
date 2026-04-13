package com.cretas.aims.ai.tool.impl.restaurant.diagnostic;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Restaurant monthly PPT export tool — wraps the Python
 * monthly_ppt_export section (P3.5D P3). Generates a 19-slide .pptx
 * file matching 鼎鲜火锅's 5-year-old monthly analysis template,
 * auto-filled from store_pnl_one_pager + department_pnl + shrinkage +
 * expense_breakdown data.
 *
 * Returns path + download URL; actual file download happens via
 * GET /api/smartbi/restaurant/sections/ppt-export/download/{factory_id}/{period}.
 *
 * Activated by intents like "给我月度报告" / "出月度分析 PPT" /
 * "月度经营简报" / "月度报表".
 */
@Slf4j
@Component
public class RestaurantMonthlyPptExportTool extends AbstractRestaurantDiagnosticTool {

    @Override
    public String getToolName() {
        return "restaurant_monthly_ppt_export";
    }

    @Override
    public String getDescription() {
        return "生成月度经营分析 PPT (19 张幻灯片) — 匹配客户 5 年不变的固定模板结构, "
             + "含封面 / 月度简报 / 档口毛利率 / 损溢指标 / 25+ 费用科目预算达成 / "
             + "30 行部门人均产出 / 下月计划等章节. 返回 downloadUrl 给前端下载 .pptx "
             + "文件. 适用场景: 客户问'给我月度报告'/'出月度分析 PPT'/'月度经营简报'/"
             + "'月度总结'.";
    }

    @Override
    protected String getSectionName() {
        return "monthly_ppt_export";
    }
}
