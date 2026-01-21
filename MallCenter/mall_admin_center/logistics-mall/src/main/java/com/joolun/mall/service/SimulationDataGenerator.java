package com.joolun.mall.service;

import java.util.Map;

/**
 * 模拟数据生成服务接口
 *
 * 用于生成测试推荐系统的模拟数据:
 * - 500个模拟用户画像 (9种用户类型)
 * - 50000+行为事件 (6种事件类型)
 *
 * 用户类型分布:
 * - 火锅店采购 (60): 肉类、火锅底料、蔬菜，中等价格，高频
 * - 快餐店采购 (70): 速食、调味品、粮油，低价，高频
 * - 烘焙店采购 (50): 烘焙原料、乳制品，中高价，中频
 * - 高端餐厅 (40): 进口食材、海鲜，高价，低频大单
 * - 社区团购 (60): 蔬果、日用品，低价，高频小单
 * - 食堂采购 (50): 粮油、肉类，中等价格，周期稳定
 * - 便利店 (40): 零食、饮料，中低价，高频
 * - 茶饮店 (50): 茶叶、水果、乳制品，中等价格，中频
 * - 新用户(冷启动) (80): 随机，随机，低频
 *
 * 事件类型分布:
 * - view: 55% (~27500)
 * - click: 15% (~7500)
 * - cart_add: 12% (~6000)
 * - favorite: 5% (~2500)
 * - search: 8% (~4000)
 * - purchase: 5% (~2500)
 */
public interface SimulationDataGenerator {

    /**
     * 生成模拟用户画像
     *
     * 创建500个模拟用户，每个用户包含:
     * - 用户ID (sim_user_001 ~ sim_user_500)
     * - 画像状态 (cold_start/warming/mature)
     * - 品类偏好
     * - 价格偏好
     * - 购买模式
     *
     * @param count 用户数量
     * @return 实际生成的用户数量
     */
    int generateSimulatedUsers(int count);

    /**
     * 生成模拟行为事件
     *
     * 为模拟用户生成行为事件，包含:
     * - 事件类型 (view/click/cart_add/favorite/search/purchase)
     * - 事件时间 (过去90天内，符合真实时间分布)
     * - 目标商品 (根据用户画像偏好选择)
     * - 行为序列 (符合真实购买路径)
     *
     * @param count 事件数量
     * @return 实际生成的事件数量
     */
    int generateSimulatedEvents(int count);

    /**
     * 生成完整模拟数据
     *
     * 一次性生成所有测试数据:
     * - 500个模拟用户
     * - 50000+行为事件
     * - 用户兴趣标签
     *
     * @return 生成统计 {users: 500, events: 50000, tags: xxx}
     */
    Map<String, Integer> generateFullSimulation();

    /**
     * 清理模拟数据
     *
     * 删除所有以 "sim_user_" 为前缀的模拟数据:
     * - 用户画像
     * - 行为事件
     * - 兴趣标签
     */
    void clearSimulatedData();

    /**
     * 获取生成统计
     *
     * @return 统计数据 {
     *   totalUsers: 500,
     *   usersByType: {火锅店: 60, 快餐店: 70, ...},
     *   totalEvents: 50000,
     *   eventsByType: {view: 27500, click: 7500, ...},
     *   dateRange: {start: "2024-10-20", end: "2025-01-18"},
     *   generationTime: "2025-01-18 10:30:00"
     * }
     */
    Map<String, Object> getGenerationStats();
}
