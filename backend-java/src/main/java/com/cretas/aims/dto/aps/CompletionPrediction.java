package com.cretas.aims.dto.aps;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 完成概率预测结果 DTO
 *
 * 包含 12 维特征的逻辑回归预测结果
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompletionPrediction {

    /**
     * 任务ID
     */
    private String taskId;

    /**
     * 预测的完成概率 [0, 1]
     */
    private double probability;

    /**
     * 风险等级: low/medium/high/critical
     */
    private String riskLevel;

    /**
     * 预计完成时间
     */
    private LocalDateTime predictedEndTime;

    /**
     * 预计延迟分钟数 (负数表示提前)
     */
    private int estimatedDelayMinutes;

    /**
     * 建议的行动措施
     */
    private List<String> suggestedActions;

    /**
     * 12 维特征向量 (用于调试)
     * [0] 进度百分比 (0-1)
     * [1] 剩余时间紧迫度 (0=宽松, 1=紧迫)
     * [2] 产线效率因子 (相对1.0的偏差)
     * [3] 工人配置满足度
     * [4] 历史同类任务完成率
     * [5] 当前延迟程度
     * [6] 物料齐套率
     * [7] 是否紧急订单
     * [8] 时间窗口宽度
     * [9] 偏置项 (1.0)
     * [10] 效率趋势 (上升/下降)
     * [11] 已发生冲突数
     */
    private double[] featureVector;

    /**
     * 特征名称列表
     */
    public static final String[] FEATURE_NAMES = {
        "progress_percent",
        "time_urgency",
        "efficiency_deviation",
        "worker_config",
        "historical_completion_rate",
        "current_delay",
        "material_ready_rate",
        "is_urgent",
        "time_window_width",
        "bias",
        "efficiency_trend",
        "conflict_count"
    };

    /**
     * 默认权重向量
     * 基于逻辑回归模型
     */
    public static final double[] DEFAULT_WEIGHTS = {
        0.30,   // 进度百分比
        -0.20,  // 时间紧迫度 (负向影响)
        0.15,   // 效率偏差
        0.10,   // 工人配置
        0.10,   // 历史完成率
        -0.10,  // 当前延迟 (负向影响)
        0.05,   // 物料齐套率
        -0.05,  // 紧急订单 (负向影响)
        0.05,   // 时间窗口宽度
        0.00,   // 偏置项
        0.05,   // 效率趋势
        -0.05   // 冲突数 (负向影响)
    };
}
