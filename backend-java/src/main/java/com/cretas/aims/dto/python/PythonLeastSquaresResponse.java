package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python 最小二乘法响应 DTO
 *
 * 从 Python SmartBI 服务接收最小二乘法计算结果。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonLeastSquaresResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 解向量 x
     *
     * 最小二乘问题 min ||Ax - b||^2 的解。
     * 在效率分解场景中，每个元素代表对应工人的个人效率贡献。
     */
    private List<Double> solution;

    /**
     * 诊断指标
     */
    private Metrics metrics;

    /**
     * 使用的求解方法
     */
    private String method;

    /**
     * 错误消息 (失败时)
     */
    private String error;

    /**
     * 诊断指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Metrics {

        /**
         * 均方根误差 (RMSE)
         *
         * 表示残差的标准偏差，越小说明拟合越好。
         */
        private Double rmse;

        /**
         * 条件数
         *
         * 表示矩阵的数值稳定性。
         * 条件数 > 1e10 通常表示矩阵接近奇异。
         */
        private Double conditionNumber;

        /**
         * 矩阵秩
         *
         * 如果秩小于列数，说明存在线性相关列。
         */
        private Integer rank;

        /**
         * 使用的正则化参数
         */
        private Double regularization;

        /**
         * 奇异值 (仅 lstsq/svd 方法)
         */
        private List<Double> singularValues;
    }

    /**
     * 将解向量转换为 double 数组
     *
     * @return double 数组形式的解向量，失败时返回 null
     */
    public double[] getSolutionAsArray() {
        if (!success || solution == null || solution.isEmpty()) {
            return null;
        }

        double[] result = new double[solution.size()];
        for (int i = 0; i < solution.size(); i++) {
            Double val = solution.get(i);
            result[i] = (val != null) ? val : 1.0; // 默认效率值
        }
        return result;
    }

    /**
     * 检查解是否有效
     */
    public boolean isValidSolution() {
        if (!success || solution == null || solution.isEmpty()) {
            return false;
        }

        // 检查是否包含 NaN 或 Infinity
        for (Double val : solution) {
            if (val == null || val.isNaN() || val.isInfinite()) {
                return false;
            }
        }

        return true;
    }

    /**
     * 获取条件数（用于判断数值稳定性）
     */
    public double getConditionNumber() {
        if (metrics != null && metrics.getConditionNumber() != null) {
            return metrics.getConditionNumber();
        }
        return Double.MAX_VALUE;
    }

    /**
     * 判断矩阵是否良好条件
     */
    public boolean isWellConditioned() {
        return getConditionNumber() < 1e10;
    }
}
