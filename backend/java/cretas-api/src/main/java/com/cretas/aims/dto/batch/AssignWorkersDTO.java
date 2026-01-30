package com.cretas.aims.dto.batch;

import lombok.Data;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 分配员工到批次请求DTO
 */
@Data
public class AssignWorkersDTO {

    /**
     * 要分配的员工ID列表
     */
    @NotEmpty(message = "员工列表不能为空")
    private List<Long> workerIds;

    /**
     * 分配人ID（主管）
     */
    @NotNull(message = "分配人ID不能为空")
    private Long assignedBy;

    /**
     * 备注（可选）
     */
    private String notes;
}
