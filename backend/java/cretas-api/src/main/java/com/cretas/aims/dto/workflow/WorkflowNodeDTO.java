package com.cretas.aims.dto.workflow;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 工作流节点 DTO — 跟前端 WorkflowNode (RN + Vue) 数据契约对齐.
 *
 * status 是显示色档 (PENDING=粉/橙, IN_PROGRESS=绿, DONE=蓝),
 * 不直接映射任何业务状态 enum — service 层做 status enum → 显示色档 的归类.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowNodeDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 节点 id (如 "pending" / "in_progress" / "done"), 前端用作 list filter 参数 */
    private String id;

    /** 显示文本 (如 "待审" / "进行中" / "已完成") */
    private String label;

    /** 显示色档: PENDING / IN_PROGRESS / DONE */
    private String status;

    /** 数量 */
    private long count;
}
