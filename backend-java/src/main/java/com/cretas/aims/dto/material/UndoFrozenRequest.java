package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 撤销转冻品请求对象
 *
 * 支持两种请求格式:
 * 1. 标准格式: { operatorId, reason }
 * 2. 兼容格式: { convertedBy, convertedDate, storageLocation, notes }
 *
 * @author Cretas Team
 * @version 1.0.1
 * @since 2025-11-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "撤销转冻品请求")
public class UndoFrozenRequest {

    @Schema(description = "操作人员ID（与convertedBy二选一）", example = "1")
    private Integer operatorId;

    @Schema(description = "撤销原因（与notes二选一）", example = "误操作，需要撤回")
    @Size(max = 200, message = "撤销原因长度不能超过200个字符")
    private String reason;

    // ========== 兼容字段（用于前端测试脚本） ==========

    @Schema(description = "转换操作人ID（兼容字段，与operatorId等效）", example = "1")
    private Integer convertedBy;

    @Schema(description = "转换日期（兼容字段，可选）", example = "2025-11-20")
    private LocalDate convertedDate;

    @Schema(description = "恢复后的存储位置（兼容字段，可选）", example = "A区冷藏室3号")
    private String storageLocation;

    @Schema(description = "备注（兼容字段，与reason等效）", example = "准备使用")
    private String notes;

    /**
     * 获取有效的操作人ID（优先使用operatorId，其次使用convertedBy）
     */
    public Integer getEffectiveOperatorId() {
        return operatorId != null ? operatorId : convertedBy;
    }

    /**
     * 获取有效的原因/备注（优先使用reason，其次使用notes）
     */
    public String getEffectiveReason() {
        if (reason != null && !reason.isBlank()) {
            return reason;
        }
        return notes != null ? notes : "未提供原因";
    }
}
