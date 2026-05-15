package com.cretas.aims.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * UnitConversionService — 物料计量单位换算 (Track D1 Bug-3 refactor).
 *
 * <p>客户原话 (六扇门第四次 May10 line 263):
 *   "我在这写的克, 那我做调包的时候会自动折换成公斤"
 *
 * <p>原 implementation 是 {@code ProductionWorkflowOrchestrator.convertUnit()}
 * 的 private method (D3 2026-05-10 客户对接会议落地). 该 method 被反射测试
 * (ProductionWorkflowOrchestratorUnitConversionTest), 但 only available 给
 * orchestration 路径. BOM 配方 + 库存出库 + 采购入库 都需要同一逻辑 — 提到
 * 公共 Spring service 避免重复实现 / drift.
 *
 * <p>支持的换算 (per 客户 May10 确认, 六腾门 BOM 只需 g↔kg, 餐饮历史数据有 ml↔L):
 * <ul>
 *   <li>g ↔ kg (1:1000)</li>
 *   <li>ml ↔ L (1:1000)</li>
 *   <li>同单位透传</li>
 * </ul>
 *
 * <p>不支持的换算 (e.g. g → ml, 个 → kg) 返回 {@code null} —
 * caller 应回退到原值 + 原单位 (per ProductionWorkflowOrchestrator line 137-145 既有逻辑).
 *
 * <p>Java→Python parity 规则: HALF_UP scale 6 (per python-java-port.md Rule 10).
 * 输出 BigDecimal 保留 setScale 让 caller 决定显示精度.
 *
 * @author Cretas Team / Track D1
 * @since 2026-05-14
 */
@Slf4j
@Service
public class UnitConversionService {

    private static final BigDecimal THOUSAND = new BigDecimal("1000");

    /**
     * 单位换算.
     *
     * @param value     原值, null → null
     * @param fromUnit  源单位 (case-insensitive, trimmed)
     * @param toUnit    目标单位
     * @return 换算后的值, scale=6 HALF_UP; 不支持的换算返 null; 同单位透传原值
     */
    public BigDecimal convert(BigDecimal value, String fromUnit, String toUnit) {
        if (value == null || fromUnit == null || toUnit == null) return null;

        String from = fromUnit.trim().toLowerCase();
        String to = toUnit.trim().toLowerCase();

        if (from.equals(to)) return value;

        // 质量: g ↔ kg
        if ("g".equals(from) && "kg".equals(to)) {
            return value.divide(THOUSAND, 6, RoundingMode.HALF_UP);
        }
        if ("kg".equals(from) && "g".equals(to)) {
            return value.multiply(THOUSAND);
        }

        // 体积: ml ↔ L
        if ("ml".equals(from) && "l".equals(to)) {
            return value.divide(THOUSAND, 6, RoundingMode.HALF_UP);
        }
        if ("l".equals(from) && "ml".equals(to)) {
            return value.multiply(THOUSAND);
        }

        // 不支持的换算 (跨维度 / 离散单位): null 表示沿用原值
        log.debug("UnitConversionService: unsupported conversion {}→{}, returning null", fromUnit, toUnit);
        return null;
    }

    /**
     * 便捷方法: 不支持的换算回退到原值 (而非 null).
     *
     * <p>BOM 配方编辑 UI / 显示场景: 用户输入 200g, 想 preview "0.2kg",
     * 当 unit 是 '个' 这种不支持换算时, 应返回 200 个 (原值原单位) 而不是 null.
     */
    public BigDecimal convertOrSame(BigDecimal value, String fromUnit, String toUnit) {
        BigDecimal converted = convert(value, fromUnit, toUnit);
        return converted != null ? converted : value;
    }

    /**
     * 检查换算是否支持 (e.g. UI 决定是否显示 "= 0.2kg" 提示).
     */
    public boolean isSupported(String fromUnit, String toUnit) {
        if (fromUnit == null || toUnit == null) return false;
        String from = fromUnit.trim().toLowerCase();
        String to = toUnit.trim().toLowerCase();
        if (from.equals(to)) return true;
        return ("g".equals(from) && "kg".equals(to))
            || ("kg".equals(from) && "g".equals(to))
            || ("ml".equals(from) && "l".equals(to))
            || ("l".equals(from) && "ml".equals(to));
    }
}
