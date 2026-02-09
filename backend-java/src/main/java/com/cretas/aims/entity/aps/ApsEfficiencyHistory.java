package com.cretas.aims.entity.aps;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * APS 效率历史记录实体
 *
 * <p>记录产线和任务的效率数据，用于：
 * <ul>
 *   <li>效率趋势分析</li>
 *   <li>AI模型训练数据</li>
 *   <li>产能预测优化</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "aps_efficiency_history",
       indexes = {
           @Index(name = "idx_aps_eff_line", columnList = "line_id"),
           @Index(name = "idx_aps_eff_task", columnList = "task_id"),
           @Index(name = "idx_aps_eff_recorded", columnList = "recorded_at")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ApsEfficiencyHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 产线ID
     */
    @Column(name = "line_id", nullable = false, length = 36)
    private String lineId;

    /**
     * 任务ID
     */
    @Column(name = "task_id", length = 36)
    private String taskId;

    /**
     * 记录时间
     */
    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    /**
     * 实际产出
     */
    @Column(name = "actual_output", precision = 12, scale = 2)
    private BigDecimal actualOutput;

    /**
     * 预期产出
     */
    @Column(name = "expected_output", precision = 12, scale = 2)
    private BigDecimal expectedOutput;

    /**
     * 效率比率 (actual / expected)
     */
    @Column(name = "efficiency_ratio", precision = 5, scale = 4)
    private BigDecimal efficiencyRatio;

    /**
     * 工人数量
     */
    @Column(name = "worker_count")
    private Integer workerCount;

    /**
     * 计算效率比率
     */
    public void calculateEfficiencyRatio() {
        if (expectedOutput != null && expectedOutput.compareTo(BigDecimal.ZERO) > 0 && actualOutput != null) {
            this.efficiencyRatio = actualOutput.divide(expectedOutput, 4, BigDecimal.ROUND_HALF_UP);
        }
    }
}
