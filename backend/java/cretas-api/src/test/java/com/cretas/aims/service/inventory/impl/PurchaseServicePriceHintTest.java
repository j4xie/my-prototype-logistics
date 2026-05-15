package com.cretas.aims.service.inventory.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Day 8-9 三价对比 bug 修复 — buildPriceDataSourceHint 测试.
 *
 * <p>业务场景: F006 客户新建采购单立即看三价对比, "三家对比没有 — 可能是数据 bug".
 * 实际是: 移动均价基于历次入库 (raw_material_types.moving_avg_price 来自入库累积),
 * BOM 标准价基于 BOM 配置. 新原料 / 未入库 / 未配 BOM → 必然 null. 修复方案是
 * 后端在 DTO 加 dataSourceHint 字段, 前端 UI 显示 banner + per-row tooltip.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15
 */
@DisplayName("PurchaseServiceImpl.buildPriceDataSourceHint — 三价对比数据源诊断")
class PurchaseServicePriceHintTest {

    @Nested
    @DisplayName("4 缺失场景 + 0 价边界")
    class MissingScenarios {

        @Test
        @DisplayName("✅ 双有 (BOM + 均价均存在) → 返 null (无 hint, 正常显示)")
        void bothPresent_returnsNull() {
            String hint = PurchaseServiceImpl.buildPriceDataSourceHint(
                    new BigDecimal("100"),
                    new BigDecimal("105"));
            assertNull(hint);
        }

        @Test
        @DisplayName("✅ 双 null (新原料首次采购) → 返 '业务正常' 文案, 含 'BOM' + '入库均价' + '不是 bug'")
        void bothMissing_returnsBusinessNormal() {
            String hint = PurchaseServiceImpl.buildPriceDataSourceHint(null, null);
            assertNotNull(hint);
            assertTrue(hint.contains("新原料首次采购"), "应明示业务正常状态");
            assertTrue(hint.contains("BOM 标准价"), "应解释 BOM 数据源");
            assertTrue(hint.contains("入库均价"), "应解释入库数据源");
            assertTrue(hint.contains("不是 bug"), "明确告诉客户这不是 bug — 这是 fix 的核心目的");
        }

        @Test
        @DisplayName("✅ BOM null + 均价 OK → 返 '未配 BOM' 文案, 含动作建议")
        void missingBomOnly_suggestsBomConfig() {
            String hint = PurchaseServiceImpl.buildPriceDataSourceHint(null, new BigDecimal("105"));
            assertNotNull(hint);
            assertTrue(hint.contains("未配置 BOM"));
            assertTrue(hint.contains("仅可对比历史入库均价"));
            assertTrue(hint.contains("BOM 模块"), "建议用户去 BOM 模块配置");
        }

        @Test
        @DisplayName("✅ BOM OK + 均价 null → 返 '尚无入库' 文案")
        void missingAvgOnly_suggestsFirstReceipt() {
            String hint = PurchaseServiceImpl.buildPriceDataSourceHint(new BigDecimal("100"), null);
            assertNotNull(hint);
            assertTrue(hint.contains("尚无该原料的入库记录"));
            assertTrue(hint.contains("仅可对比 BOM 标准价"));
            assertTrue(hint.contains("入库一次后即累积移动均价"));
        }

        @Test
        @DisplayName("✅ BOM = 0 (CHECK pass 但业务 0) 不被视为 missing — 仅 null 触发 hint")
        void zeroPriceNotTreatedAsMissing() {
            // 业务上 BOM 价 0 是有意义的 (赠品 / 公司内调拨), 不该 fall into "未配置" hint
            String hint = PurchaseServiceImpl.buildPriceDataSourceHint(BigDecimal.ZERO, BigDecimal.ZERO);
            assertNull(hint, "0 价 ≠ missing, 应显示正常对比");
        }
    }
}
