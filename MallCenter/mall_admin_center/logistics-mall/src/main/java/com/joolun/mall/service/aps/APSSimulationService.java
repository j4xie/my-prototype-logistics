package com.joolun.mall.service.aps;

import com.joolun.mall.entity.aps.*;

import java.util.List;
import java.util.Map;

/**
 * APS 模拟数据服务接口
 * 用于生成测试数据以验证排程算法
 *
 * 生成数据特点:
 * 1. 所有数据 isSimulated = true
 * 2. 使用 UUID 作为 ID
 * 3. 符合真实业务规律的数据分布
 *
 * @author APS Scheduling V1.0
 * @since 2026-01-21
 */
public interface APSSimulationService {

    /**
     * 生成模拟生产订单
     *
     * @param count 生成数量
     * @param days  订单交期跨度天数 (1-14天)
     * @return 生成的订单列表
     */
    List<ProductionOrder> generateSimulatedOrders(int count, int days);

    /**
     * 生成模拟生产线
     *
     * @param count 生成数量
     * @return 生成的产线列表
     */
    List<ProductionLine> generateSimulatedLines(int count);

    /**
     * 生成模拟工人
     *
     * @param count 生成数量
     * @return 生成的工人列表
     */
    List<ProductionWorker> generateSimulatedWorkers(int count);

    /**
     * 生成模拟设备
     *
     * @param count 生成数量
     * @return 生成的设备列表
     */
    List<ProductionEquipment> generateSimulatedEquipment(int count);

    /**
     * 生成模拟模具
     *
     * @param count 生成数量
     * @return 生成的模具列表
     */
    List<ProductionMold> generateSimulatedMolds(int count);

    /**
     * 生成换型时间矩阵
     *
     * 矩阵规则:
     * - 同类别产品: 10-20 分钟
     * - 不同类别产品: 30-60 分钟
     * - 需要清洁的换型: 90-120 分钟
     *
     * @return 生成的换型矩阵列表
     */
    List<ChangeoverMatrix> generateChangeoverMatrix();

    /**
     * 清除所有模拟数据
     * 删除 isSimulated = true 的所有记录
     *
     * @return 各实体删除数量的统计 Map
     */
    Map<String, Integer> clearSimulatedData();
}
