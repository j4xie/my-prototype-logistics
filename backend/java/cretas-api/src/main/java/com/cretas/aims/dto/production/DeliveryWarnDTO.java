package com.cretas.aims.dto.production;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 生产计划交货预警 DTO — M-DELIVERY-WARN-1, Sprint 4 W2.
 *
 * <p>每条记录代表一个临近交期或已超期的生产计划。warnLevel 由 expectedCompletionDate
 * 与今日的差值决定:</p>
 * <ul>
 *   <li><b>OVERDUE</b> (超期): expectedCompletionDate &lt; today (已超过预期完工日)</li>
 *   <li><b>URGENT</b> (紧急): 0 &le; daysUntilDeadline &lt; 3</li>
 *   <li><b>WARN</b> (预警): 3 &le; daysUntilDeadline &lt; 7</li>
 *   <li><b>NORMAL</b> (正常): daysUntilDeadline &ge; 7</li>
 * </ul>
 *
 * <p>查询过滤: status NOT IN (COMPLETED, CANCELLED) — 已完成或取消的不参与预警。</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeliveryWarnDTO {

    /** 生产计划 ID */
    private String planId;

    /** 计划编号 */
    private String planNumber;

    /** 工厂 ID */
    private String factoryId;

    /** 产品类型 ID */
    private String productTypeId;

    /** 产品类型名称 (冗余, 减少前端查询) */
    private String productTypeName;

    /** 计划数量 */
    private BigDecimal plannedQuantity;

    /** 实际数量 */
    private BigDecimal actualQuantity;

    /** 预期完工日期 */
    private LocalDate expectedCompletionDate;

    /** 当前计划状态 (例如 PENDING / IN_PROGRESS / PAUSED) */
    private String status;

    /** 距交期天数 (负数表示已超期 — 仅 OVERDUE 等级时为负) */
    private Long daysUntilDeadline;

    /**
     * 预警等级: OVERDUE / URGENT / WARN / NORMAL.
     * 使用 String 以便 JSON 输出直接为 "URGENT" 而非 enum 命名空间。
     */
    private String warnLevel;

    /** 关联客户名 (若来源是客户订单), 便于前端显示 */
    private String sourceCustomerName;
}
