package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 多级 BOM 展开结果包装 — M-MATTREE-1, Sprint 4 W2.
 *
 * <p>包含树根 + 全局统计字段, 便于前端汇总展示。</p>
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class BomTreeResult {

    /** 根产品 ID */
    private String rootProductTypeId;

    /** 根产品计划数量 */
    private BigDecimal rootQuantity;

    /** 树最大深度 (0 = 仅根, 1 = 单层, 2+ = 多级) */
    private int maxDepth;

    /** 叶子节点总数 (即不同原料种类数) */
    private int leafCount;

    /** 累计短缺的叶子节点数 (shortfallQuantity > 0) */
    private int shortfallLeafCount;

    /** 是否检测到循环 (任意节点 cycleDetected=true) */
    private boolean cycleDetected;

    /** 检测到循环的 typeId 列表 (用于前端高亮) */
    @Builder.Default
    private List<String> cycleTypeIds = new ArrayList<>();

    /** 树根 */
    private BomTreeNode root;
}
