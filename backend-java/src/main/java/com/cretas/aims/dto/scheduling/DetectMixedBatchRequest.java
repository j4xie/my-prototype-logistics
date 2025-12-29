package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotEmpty;
import java.time.LocalDate;
import java.util.List;

/**
 * 检测可合批订单请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "检测可合批订单请求")
public class DetectMixedBatchRequest {

    @Schema(description = "待检测的订单ID列表")
    @NotEmpty(message = "订单列表不能为空")
    private List<String> orderIds;

    @Schema(description = "日期范围开始")
    private LocalDate startDate;

    @Schema(description = "日期范围结束")
    private LocalDate endDate;

    @Schema(description = "最小节省时间阈值 (分钟)")
    private Integer minSavingMinutes;

    @Schema(description = "是否只检测同原料类型")
    private Boolean sameMaterialOnly;

    @Schema(description = "是否只检测同工艺类型")
    private Boolean sameProcessOnly;

    @Schema(description = "最低推荐分数筛选")
    private Integer minRecommendScore;
}
