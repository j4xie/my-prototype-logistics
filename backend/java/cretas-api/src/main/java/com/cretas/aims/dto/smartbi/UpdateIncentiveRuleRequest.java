package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 更新激励规则请求 DTO（Rule 17.1 anti-pattern fix）.
 *
 * <p>替代 {@code @RequestBody @Valid SmartBiIncentiveRule} 的实体直绑模式。
 *
 * <p>关键差异：所有字段全部 nullable，service 层使用 null-aware copy（缺失字段不写入），
 * 阻止 {@code @Builder.Default} 通过 Jackson {@code @NoArgsConstructor} 默认构造器
 * 把 {@code isActive=true} / {@code sortOrder=0} 静默写回实体。
 *
 * <p>不可变字段排除：
 * <ul>
 *   <li>{@code id}：URL path variable，不在 body 内</li>
 *   <li>{@code ruleCode}：业务标识，PUT 不允许变更（与现有
 *       {@code SmartBIConfigServiceImpl#updateIncentiveRuleFields} 一致）</li>
 *   <li>{@code factoryId}：跨工厂越权风险，禁止 PUT 改写</li>
 *   <li>{@code id} / {@code createdAt} / {@code updatedAt} / {@code deletedAt}：审计字段</li>
 * </ul>
 *
 * @see com.cretas.aims.entity.smartbi.SmartBiIncentiveRule
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/320">Issue #320 Rule 17.1</a>
 * @since 2026-05-12
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateIncentiveRuleRequest {

    @Size(max = 128)
    private String ruleName;

    @Size(max = 32)
    private String levelName;

    private BigDecimal minValue;

    private BigDecimal maxValue;

    private BigDecimal rewardRate;

    private BigDecimal rewardAmount;

    @Size(max = 255)
    private String description;

    private Boolean isActive;

    private Integer sortOrder;
}
