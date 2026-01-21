package com.joolun.mall.service;

import com.joolun.mall.entity.UserCluster;
import com.joolun.mall.entity.UserClusterAssignment;

import java.util.List;
import java.util.Map;

/**
 * 用户聚类服务接口
 *
 * 使用K-Means聚类算法将用户分为不同群组:
 * 1. 火锅店采购 - 肉类、火锅底料、蔬菜
 * 2. 快餐店采购 - 速食、调味品、粮油
 * 3. 烘焙店采购 - 烘焙原料、乳制品
 * 4. 高端餐厅 - 进口食材、海鲜
 * 5. 社区团购 - 蔬果、日用品
 * 6. 新用户群 - 默认聚类
 *
 * 特征向量 (48维) - 优化点8扩展:
 * [0-9]:   品类偏好 (Top 10品类归一化权重)
 * [10-14]: 价格偏好 (5维: 极低/低/中/高/极高)
 * [15-19]: 购买频率 (5维: 更细粒度)
 * [20-26]: 活跃时段 (7维: 凌晨/早晨/上午/中午/下午/晚间/深夜)
 * [27-31]: 商户偏好 (5维: Top5商户权重)
 * [32-36]: 行为模式 (5维: 复购率/篮子大小/浏览深度/决策速度/价格敏感度)
 * [37-41]: 客单价分布 (5维)
 * [42-44]: 新品接受度 (3维: 低/中/高)
 * [45-47]: 成熟度+活跃度+探索度 (3维)
 *
 * @author UserCluster Enhancement
 * @since 2026-01-19
 */
public interface UserClusterService {

    /**
     * 特征向量维度 (优化点8: 16→48)
     */
    int FEATURE_DIM = 48;

    /**
     * 默认聚类数
     */
    int DEFAULT_K = 6;

    // ==================== 聚类运行 ====================

    /**
     * 运行K-Means聚类
     * 使用K-Means++初始化，最大迭代100次，收敛阈值0.001
     *
     * @param k 聚类数量
     */
    void runKMeansClustering(int k);

    /**
     * 每周日凌晨3点自动运行聚类
     */
    void weeklyUserClustering();

    // ==================== 聚类查询 ====================

    /**
     * 获取用户聚类信息
     *
     * @param wxUserId 用户ID
     * @return 用户聚类分配信息，如果用户未分配则返回null
     */
    UserClusterAssignment getUserClusterAssignment(String wxUserId);

    /**
     * 获取所有激活的聚类
     *
     * @return 聚类列表
     */
    List<UserCluster> getAllClusters();

    /**
     * 获取聚类详情
     *
     * @param clusterId 聚类ID
     * @return 聚类信息
     */
    UserCluster getClusterById(Long clusterId);

    /**
     * 获取聚类成员列表
     *
     * @param clusterId 聚类ID
     * @param limit 返回数量限制
     * @return 成员分配列表
     */
    List<UserClusterAssignment> getClusterMembers(Long clusterId, int limit);

    // ==================== 用户分配 ====================

    /**
     * 为新用户分配聚类
     * 基于用户特征向量找到最近的聚类中心
     *
     * @param wxUserId 用户ID
     * @return 分配结果
     */
    UserClusterAssignment assignUserToCluster(String wxUserId);

    /**
     * 获取相似用户列表
     * 基于同聚类和特征距离
     *
     * @param wxUserId 用户ID
     * @param limit 返回数量
     * @return 相似用户ID列表
     */
    List<String> getSimilarUsers(String wxUserId, int limit);

    // ==================== 统计与监控 ====================

    /**
     * 获取聚类统计信息
     *
     * @return 统计数据，包括:
     *   - totalUsers: 总用户数
     *   - clusterCount: 聚类数量
     *   - avgClusterSize: 平均聚类大小
     *   - clusterDistribution: 各聚类分布
     *   - lastClusterTime: 最后聚类时间
     *   - avgIntraClusterDistance: 平均簇内距离
     */
    Map<String, Object> getClusterStats();
}
