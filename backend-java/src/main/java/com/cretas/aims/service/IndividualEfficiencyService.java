package com.cretas.aims.service;

import com.cretas.aims.entity.enums.ProcessingStageType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 个人效率分解服务接口
 * 通过团队数据和最小二乘法求解个人效率贡献
 *
 * <p>核心算法说明:</p>
 * <pre>
 * 设 n 个工人，m 次团队记录
 *
 * 矩阵方程: A * x = b
 *
 * A[m×n] = 参与矩阵 (worker i 参与记录 j 时为 1)
 * x[n×1] = 个人效率向量 (待求解)
 * b[m×1] = 团队产出向量 (观测值)
 *
 * 解: x = (A^T * A)^(-1) * A^T * b (最小二乘解)
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface IndividualEfficiencyService {

    /**
     * 计算指定工厂、指定工艺的个人效率
     *
     * @param factoryId        工厂ID
     * @param stageType        工艺类型 (按工艺分开计算)
     * @param minObservations  最少需要多少次观测数据 (建议 >= 10)
     * @return 工人ID -> 个人效率值 的映射
     */
    Map<Long, BigDecimal> calculateIndividualEfficiency(
            String factoryId,
            ProcessingStageType stageType,
            int minObservations);

    /**
     * 计算指定工厂所有工艺的个人效率
     *
     * @param factoryId       工厂ID
     * @param minObservations 最少需要多少次观测数据
     * @return 工艺类型 -> (工人ID -> 效率值) 的映射
     */
    Map<ProcessingStageType, Map<Long, BigDecimal>> calculateAllStageEfficiencies(
            String factoryId,
            int minObservations);

    /**
     * 获取指定工人在所有工艺上的效率
     *
     * @param factoryId 工厂ID
     * @param workerId  工人ID
     * @return 工艺类型 -> 效率值 的映射
     */
    Map<ProcessingStageType, BigDecimal> getWorkerEfficiencyByStage(
            String factoryId,
            Long workerId);

    /**
     * 更新用户的技能等级 (基于效率计算结果)
     * 将效率值转换为技能等级 (1-5) 并存储到 User.skillLevels
     *
     * @param factoryId 工厂ID
     * @param stageType 工艺类型
     * @return 更新的用户数量
     */
    int updateUserSkillLevels(String factoryId, ProcessingStageType stageType);

    /**
     * 检查是否有足够的数据进行效率计算
     *
     * @param factoryId 工厂ID
     * @param stageType 工艺类型
     * @param minObservations 最少观测次数
     * @return 是否有足够数据
     */
    boolean hasEnoughData(String factoryId, ProcessingStageType stageType, int minObservations);

    /**
     * 获取工艺类型的观测数据统计
     *
     * @param factoryId 工厂ID
     * @param stageType 工艺类型
     * @return 统计信息 (总记录数、唯一工人数等)
     */
    EfficiencyDataStats getDataStats(String factoryId, ProcessingStageType stageType);

    /**
     * 效率数据统计信息
     */
    class EfficiencyDataStats {
        private int totalRecords;
        private int uniqueWorkers;
        private int uniqueTeams;
        private boolean sufficientData;

        public EfficiencyDataStats() {}

        public EfficiencyDataStats(int totalRecords, int uniqueWorkers, int uniqueTeams, boolean sufficientData) {
            this.totalRecords = totalRecords;
            this.uniqueWorkers = uniqueWorkers;
            this.uniqueTeams = uniqueTeams;
            this.sufficientData = sufficientData;
        }

        public int getTotalRecords() { return totalRecords; }
        public void setTotalRecords(int totalRecords) { this.totalRecords = totalRecords; }
        public int getUniqueWorkers() { return uniqueWorkers; }
        public void setUniqueWorkers(int uniqueWorkers) { this.uniqueWorkers = uniqueWorkers; }
        public int getUniqueTeams() { return uniqueTeams; }
        public void setUniqueTeams(int uniqueTeams) { this.uniqueTeams = uniqueTeams; }
        public boolean isSufficientData() { return sufficientData; }
        public void setSufficientData(boolean sufficientData) { this.sufficientData = sufficientData; }
    }
}
