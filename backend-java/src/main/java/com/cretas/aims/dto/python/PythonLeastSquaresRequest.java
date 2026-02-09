package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python 最小二乘法请求 DTO
 *
 * 用于将最小二乘法计算请求发送到 Python SmartBI 服务。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonLeastSquaresRequest {

    /**
     * 系数矩阵 A (m x n)
     *
     * 表示参与矩阵，每行代表一次观测，每列代表一个变量（工人）。
     * 元素值为 1.0 表示该工人参与了该次观测，0.0 表示未参与。
     */
    private List<List<Double>> matrixA;

    /**
     * 目标向量 b (m x 1)
     *
     * 表示每次观测的产出值（如效率、奖励等）。
     */
    private List<Double> vectorB;

    /**
     * 正则化参数 (lambda)
     *
     * 用于岭回归，防止矩阵奇异。
     * 默认值: 0.001
     * 取值范围: [0, 1]
     */
    @Builder.Default
    private Double regularization = 0.001;

    /**
     * 求解方法
     *
     * - ridge: 岭回归（Tikhonov正则化），最稳定
     * - lstsq: 标准最小二乘（LAPACK），最快
     * - svd: SVD伪逆，适合病态矩阵
     *
     * 默认: ridge
     */
    @Builder.Default
    private String method = "ridge";

    /**
     * 便捷构造方法：从二维数组创建请求
     */
    public static PythonLeastSquaresRequest fromArrays(double[][] matrixA, double[] vectorB) {
        List<List<Double>> matrix = new java.util.ArrayList<>();
        for (double[] row : matrixA) {
            List<Double> rowList = new java.util.ArrayList<>();
            for (double val : row) {
                rowList.add(val);
            }
            matrix.add(rowList);
        }

        List<Double> vector = new java.util.ArrayList<>();
        for (double val : vectorB) {
            vector.add(val);
        }

        return PythonLeastSquaresRequest.builder()
                .matrixA(matrix)
                .vectorB(vector)
                .build();
    }

    /**
     * 便捷构造方法：带正则化参数
     */
    public static PythonLeastSquaresRequest fromArrays(double[][] matrixA, double[] vectorB, double regularization) {
        PythonLeastSquaresRequest request = fromArrays(matrixA, vectorB);
        request.setRegularization(regularization);
        return request;
    }
}
