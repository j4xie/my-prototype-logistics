package com.cretas.aims.dto.scheduling;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 员工任务历史 DTO
 * 用于展示员工近期的工作任务记录
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskHistoryDTO {

    /**
     * 任务ID（分配记录ID）
     */
    private String id;

    /**
     * 任务名称（批次号 + 产品名称）
     */
    private String name;

    /**
     * 任务日期（格式：MM-dd）
     */
    private String date;

    /**
     * 任务状态
     * completed - 已完成
     * in_progress - 进行中
     * cancelled - 已取消
     */
    private String status;

    /**
     * 工作时长（小时）
     */
    private Double hours;
}
