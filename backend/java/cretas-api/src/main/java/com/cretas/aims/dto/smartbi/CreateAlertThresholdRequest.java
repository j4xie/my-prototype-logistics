package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 创建告警阈值请求 DTO（Rule 17.1 anti-pattern fix）.
 *
 * <p>替代 {@code @RequestBody @Valid SmartBiAlertThreshold} 的实体直绑模式，
 * 避免 {@code @Builder.Default} 字段（{@code comparisonOperator="GT"}、{@code isActive=true}）
 * 在 Jackson 反序列化时通过 {@code @NoArgsConstructor} 字段初始化器静默写入，
 * 进而隐式覆盖客户端意图。
 *
 * <p>设计点：
 * <ul>
 *   <li>必填字段对齐实体 {@code @Column(nullable=false)} 约束（thresholdType、metricCode）。</li>
 *   <li>其余字段全部 nullable，由 service 层显式应用业务默认值（{@code comparisonOperator="GT"}、{@code isActive=true}）。</li>
 *   <li>不暴露 {@code id}/{@code createdAt}/{@code updatedAt}/{@code deletedAt} 等审计字段，杜绝客户端越权改写。</li>
 * </ul>
 *
 * @see com.cretas.aims.entity.smartbi.SmartBiAlertThreshold
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/320">Issue #320 Rule 17.1</a>
 * @since 2026-05-12
 */
@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateAlertThresholdRequest {

    @NotBlank
    @Size(max = 64)
    private String thresholdType;

    @NotBlank
    @Size(max = 64)
    private String metricCode;

    private BigDecimal warningValue;

    private BigDecimal criticalValue;

    @Size(max = 16)
    private String comparisonOperator;

    @Size(max = 32)
    private String unit;

    @Size(max = 255)
    private String description;

    @Size(max = 32)
    private String factoryId;

    private Boolean isActive;
}
