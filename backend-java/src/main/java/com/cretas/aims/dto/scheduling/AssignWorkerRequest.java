package com.cretas.aims.dto.scheduling;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 分配工人请求
 */
@Data
public class AssignWorkerRequest {
    @NotNull(message = "排程ID不能为空")
    private String scheduleId;

    @NotEmpty(message = "工人ID列表不能为空")
    private List<Long> workerIds;

    private Boolean isTemporary = false;
}
