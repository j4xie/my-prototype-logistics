package com.cretas.aims.dto.batch;

import lombok.Data;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 班组批量报工请求DTO
 * 车间主管为班组成员批量提交产出报工
 */
@Data
public class TeamBatchReportRequest {

    @NotNull(message = "批次ID不能为空")
    private Long batchId;

    @NotEmpty(message = "成员报工列表不能为空")
    private List<MemberReport> members;

    @Data
    public static class MemberReport {
        private Long userId;

        @NotNull(message = "产出数量不能为空")
        private Integer outputQuantity;

        /** 良品数量，为空时默认等于 outputQuantity */
        private Integer goodQuantity;

        /** 不良品数量，为空时默认 0 */
        private Integer defectQuantity;

        private String notes;
    }
}
