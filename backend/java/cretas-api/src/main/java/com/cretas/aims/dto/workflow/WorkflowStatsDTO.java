package com.cretas.aims.dto.workflow;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.List;

/**
 * 工作流统计响应 — 一次返回某个 module 的全部节点 + 数据刷新时间.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStatsDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 模块: sales / purchase / production / finance / inventory */
    private String module;

    /** 节点列表 (顺序固定, 按工作流顺序 PENDING → IN_PROGRESS → DONE) */
    private List<WorkflowNodeDTO> nodes;

    /** 数据生成时间 (ISO-8601 UTC), 客户端可用于显示 "5 分钟前刷新" */
    private Instant lastRefreshedAt;
}
