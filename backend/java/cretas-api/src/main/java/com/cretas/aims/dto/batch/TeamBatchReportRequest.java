package com.cretas.aims.dto.batch;

import lombok.Data;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * 班组批量报工请求DTO
 * 车间主管为班组提交产出报工：先报团队总产出，可选补充个人明细
 */
@Data
public class TeamBatchReportRequest {

    @NotNull(message = "批次ID不能为空")
    private Long batchId;

    @NotNull(message = "团队总产出不能为空")
    private Integer totalOutput;

    private Integer totalGoodQuantity;

    private Integer totalDefectQuantity;

    /** 报工时间（ISO datetime），为空时服务端自动填当前时间 */
    private String reportTime;

    private String notes;

    /** 个人产量明细（可选），仅当需要记录个人贡献时填写 */
    private List<MemberReport> members;

    @Data
    public static class MemberReport {
        @NotNull(message = "成员userId不能为空")
        private Long userId;

        /** 个人产量（可选） */
        private Integer outputQuantity;

        private Integer goodQuantity;

        private Integer defectQuantity;

        private String notes;
    }
}
