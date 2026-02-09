package com.cretas.aims.service.simulator;

import com.cretas.aims.dto.scale.SimulatorStatus;
import com.cretas.aims.dto.scale.VirtualScaleConfig;

import java.math.BigDecimal;
import java.util.List;

/**
 * 虚拟秤模拟器接口
 * 用于无硬件开发和测试场景，模拟电子秤的称重过程
 *
 * 功能特性:
 * - 支持多种协议格式生成数据帧 (ASCII_FIXED, HEX_FIXED, MODBUS_RTU)
 * - 可配置波动->稳定的称重过程模拟
 * - 支持同时运行多个虚拟秤实例
 * - 线程安全设计
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
public interface VirtualScaleSimulator {

    /**
     * 启动虚拟秤模拟器
     *
     * @param protocolId 协议ID
     * @param config     模拟器配置
     * @return 模拟器唯一标识ID
     * @throws IllegalArgumentException 如果协议不存在或配置无效
     */
    String startSimulator(String protocolId, VirtualScaleConfig config);

    /**
     * 停止模拟器
     *
     * @param simulatorId 模拟器ID
     * @throws IllegalArgumentException 如果模拟器不存在
     */
    void stopSimulator(String simulatorId);

    /**
     * 暂停模拟器
     *
     * @param simulatorId 模拟器ID
     */
    void pauseSimulator(String simulatorId);

    /**
     * 恢复模拟器
     *
     * @param simulatorId 模拟器ID
     */
    void resumeSimulator(String simulatorId);

    /**
     * 获取所有运行中的模拟器列表
     *
     * @return 模拟器状态列表
     */
    List<SimulatorStatus> getRunningSimulators();

    /**
     * 获取指定模拟器的状态
     *
     * @param simulatorId 模拟器ID
     * @return 模拟器状态，不存在则返回null
     */
    SimulatorStatus getSimulatorStatus(String simulatorId);

    /**
     * 发送模拟称重数据
     * 根据配置的协议生成并返回数据帧
     *
     * @param simulatorId 模拟器ID
     * @param weight      重量值
     * @param stable      是否稳定
     * @return 生成的原始数据帧
     */
    byte[] sendWeight(String simulatorId, BigDecimal weight, boolean stable);

    /**
     * 模拟完整称重过程 (波动 -> 稳定)
     * 异步执行，按配置的步数和间隔逐步逼近目标重量
     *
     * @param simulatorId  模拟器ID
     * @param targetWeight 目标重量
     */
    void simulateWeighingProcess(String simulatorId, BigDecimal targetWeight);

    /**
     * 模拟完整称重过程 (波动 -> 稳定)
     * 同步执行，返回所有生成的数据帧
     *
     * @param simulatorId  模拟器ID
     * @param targetWeight 目标重量
     * @return 生成的所有数据帧列表
     */
    List<byte[]> simulateWeighingProcessSync(String simulatorId, BigDecimal targetWeight);

    /**
     * 生成指定协议格式的数据帧
     * 不需要启动模拟器，直接根据协议配置生成
     *
     * @param protocolId 协议ID
     * @param weight     重量值
     * @param unit       单位 (kg, g, lb, oz)
     * @param stable     是否稳定
     * @return 生成的原始数据帧
     */
    byte[] generateFrame(String protocolId, BigDecimal weight, String unit, boolean stable);

    /**
     * 批量生成测试数据
     * 生成指定数量的随机测试数据帧
     *
     * @param protocolId 协议ID
     * @param count      生成数量
     * @return 生成的数据帧列表
     */
    List<byte[]> generateTestDataset(String protocolId, int count);

    /**
     * 批量生成测试数据 (指定重量范围)
     *
     * @param protocolId 协议ID
     * @param count      生成数量
     * @param minWeight  最小重量
     * @param maxWeight  最大重量
     * @return 生成的数据帧列表
     */
    List<byte[]> generateTestDataset(String protocolId, int count, BigDecimal minWeight, BigDecimal maxWeight);

    /**
     * 获取数据帧的16进制字符串表示
     *
     * @param frame 原始数据帧
     * @return 16进制字符串
     */
    String frameToHex(byte[] frame);

    /**
     * 检查模拟器是否正在运行
     *
     * @param simulatorId 模拟器ID
     * @return true表示运行中
     */
    boolean isRunning(String simulatorId);

    /**
     * 停止所有模拟器
     */
    void stopAllSimulators();

    /**
     * 获取活跃模拟器数量
     *
     * @return 活跃模拟器数量
     */
    int getActiveSimulatorCount();
}
