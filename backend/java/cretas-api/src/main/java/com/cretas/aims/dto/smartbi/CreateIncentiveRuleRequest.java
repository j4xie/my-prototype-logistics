package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 创建激励规则请求 DTO（Rule 17.1 anti-pattern fix）.
 *
 * <p>替代 {@code @RequestBody @Valid SmartBiIncentiveRule} 的实体直绑模式，
 * 避免 {@code @Builder.Default} 字段（{@code isActive=true}、{@code sortOrder=0}）
 * 在 Jackson 反序列化时通过 {@code @NoArgsConstructor} 字段初始化器静默写入。
 *
 * <p>必填字段对齐实体 {@code @Column(nullable=false)} 约束：
 * ruleCode、ruleName、levelName、minValue。其余字段 nullable，由 service 层显式应用默认值。
 *
 * @see com.cretas.aims.entity.smartbi.SmartBiIncentiveRule
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/320">Issue #320 Rule 17.1</a>
 * @since 2026-05-12
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateIncentiveRuleRequest {

    @NotBlank
    @Size(max = 64)
    private String ruleCode;

    @NotBlank
    @Size(max = 128)
    private String ruleName;

    @NotBlank
    @Size(max = 32)
    private String levelName;

    @NotNull
    private BigDecimal minValue;

    private BigDecimal maxValue;

    private BigDecimal rewardRate;

    private BigDecimal rewardAmount;

    @Size(max = 255)
    private String description;

    @Size(max = 32)
    private String factoryId;

    private Boolean isActive;

    private Integer sortOrder;
}
