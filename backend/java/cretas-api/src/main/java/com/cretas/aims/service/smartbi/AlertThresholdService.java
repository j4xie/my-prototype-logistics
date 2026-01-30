package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiAlertThreshold;

import java.math.BigDecimal;
import java.util.List;

/**
 * 告警阈值服务接口
 *
 * 提供告警阈值的管理和查询功能，支持：
 * - 获取全局或工厂级别的阈值配置
 * - 动态更新阈值
 * - 缓存热重载
 *
 * 配置优先级：工厂级别配置 > 全局配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
public interface AlertThresholdService {

    /**
     * 获取全局阈值配置
     *
     * @param thresholdType 阈值类型（如 SALES, FINANCE, DEPARTMENT）
     * @param metricCode    指标代码（如 SALES_AMOUNT, PROFIT_RATE）
     * @return 阈值配置，如果不存在返回 null
     */
    SmartBiAlertThreshold getThreshold(String thresholdType, String metricCode);

    /**
     * 获取阈值配置（支持工厂级别覆盖）
     *
     * 优先返回工厂级别配置，如果不存在则返回全局配置
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param factoryId     工厂ID
     * @return 阈值配置，如果不存在返回 null
     */
    SmartBiAlertThreshold getThreshold(String thresholdType, String metricCode, String factoryId);

    /**
     * 获取指定类型的所有阈值配置
     *
     * @param thresholdType 阈值类型
     * @return 该类型下所有启用的阈值配置列表
     */
    List<SmartBiAlertThreshold> getThresholdsByType(String thresholdType);

    /**
     * 获取指定类型和工厂的所有阈值配置
     *
     * @param thresholdType 阈值类型
     * @param factoryId     工厂ID
     * @return 阈值配置列表（包含工厂配置和全局配置）
     */
    List<SmartBiAlertThreshold> getThresholdsByType(String thresholdType, String factoryId);

    /**
     * 更新阈值配置
     *
     * @param id            阈值配置ID
     * @param warningValue  新的警告阈值
     * @param criticalValue 新的严重阈值
     */
    void updateThreshold(Long id, BigDecimal warningValue, BigDecimal criticalValue);

    /**
     * 创建或更新阈值配置
     *
     * @param threshold 阈值配置实体
     * @return 保存后的阈值配置
     */
    SmartBiAlertThreshold saveThreshold(SmartBiAlertThreshold threshold);

    /**
     * 检查值是否触发告警
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param value         待检查的值
     * @return 告警级别: CRITICAL, WARNING, NORMAL
     */
    String checkAlert(String thresholdType, String metricCode, BigDecimal value);

    /**
     * 检查值是否触发告警（支持工厂级别配置）
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param factoryId     工厂ID
     * @param value         待检查的值
     * @return 告警级别: CRITICAL, WARNING, NORMAL
     */
    String checkAlert(String thresholdType, String metricCode, String factoryId, BigDecimal value);

    /**
     * 重新加载缓存
     *
     * 清除所有缓存并从数据库重新加载阈值配置
     * 用于配置更新后的热重载
     */
    void reload();

    /**
     * 获取所有阈值类型
     *
     * @return 所有启用的阈值类型列表
     */
    List<String> getAllThresholdTypes();

    /**
     * 删除阈值配置（软删除）
     *
     * @param id 阈值配置ID
     */
    void deleteThreshold(Long id);
}
