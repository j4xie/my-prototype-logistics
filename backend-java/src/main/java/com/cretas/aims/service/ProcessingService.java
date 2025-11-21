package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
/**
 * 生产加工服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface ProcessingService {
    // ========== 批次管理 ==========
    /**
     * 创建生产批次
     */
    ProductionBatch createBatch(String factoryId, ProductionBatch batch);
     /**
     * 开始生产
      */
    ProductionBatch startProduction(String factoryId, String batchId, Integer supervisorId);
     /**
     * 暂停生产
      */
    ProductionBatch pauseProduction(String factoryId, String batchId, String reason);
     /**
     * 完成生产
      */
    ProductionBatch completeProduction(String factoryId, String batchId, BigDecimal actualQuantity,
                                       BigDecimal goodQuantity, BigDecimal defectQuantity);
     /**
     * 取消生产
      */
    ProductionBatch cancelProduction(String factoryId, String batchId, String reason);
     /**
     * 获取批次详情
      */
    ProductionBatch getBatchById(String factoryId, String batchId);
     /**
     * 获取批次列表
      */
    PageResponse<ProductionBatch> getBatches(String factoryId, String status, PageRequest pageRequest);
     /**
     * 获取批次时间线
      */
    List<Map<String, Object>> getBatchTimeline(String factoryId, String batchId);
    // ========== 原材料管理 ==========
     /**
     * 原材料接收
      */
    MaterialBatch createMaterialReceipt(String factoryId, MaterialBatch materialBatch);
     /**
     * 获取原材料列表
      */
    PageResponse<MaterialBatch> getMaterialReceipts(String factoryId, PageRequest pageRequest);
     /**
     * 更新原材料信息
      */
    MaterialBatch updateMaterialReceipt(String factoryId, String batchId, MaterialBatch updates);
     /**
     * 原材料消耗记录
      */
    void recordMaterialConsumption(String factoryId, String productionBatchId,
                                   List<Map<String, Object>> consumptions);
    // ========== 质量检验 ==========
     /**
     * 提交质检记录
      */
    Map<String, Object> submitInspection(String factoryId, String batchId, Map<String, Object> inspection);
     /**
     * 获取质检记录
      */
    PageResponse<Map<String, Object>> getInspections(String factoryId, String batchId, PageRequest pageRequest);
     /**
     * 获取质检统计
      */
    Map<String, Object> getQualityStatistics(String factoryId, LocalDate startDate, LocalDate endDate);
     /**
     * 获取质量趋势
      */
    List<Map<String, Object>> getQualityTrends(String factoryId, Integer days);
    // ========== 设备监控 ==========
     /**
     * 记录设备使用
      */
    void recordEquipmentUsage(String factoryId, String batchId, Integer equipmentId,
                             LocalDate startTime, LocalDate endTime);
     /**
     * 获取设备监控数据
      */
    List<Map<String, Object>> getEquipmentMonitoring(String factoryId);
     /**
     * 获取设备指标
      */
    Map<String, Object> getEquipmentMetrics(String factoryId, Integer equipmentId, Integer days);
     /**
     * 记录设备维护
      */
    void recordEquipmentMaintenance(String factoryId, Integer equipmentId, Map<String, Object> maintenance);
    // ========== 成本分析 ==========
     /**
     * 获取批次成本分析
      */
    Map<String, Object> getBatchCostAnalysis(String factoryId, String batchId);
     /**
     * 重新计算批次成本
      */
    ProductionBatch recalculateBatchCost(String factoryId, String batchId);
     /**
     * AI成本分析建议（旧版本，基于规则）
      */
    Map<String, Object> getAICostAnalysis(String factoryId, String batchId);

    /**
     * AI智能成本分析（新版本，调用AI服务）
     *
     * @param factoryId 工厂ID
     * @param batchId 批次ID
     * @param sessionId 会话ID（可选，用于多轮对话）
     * @param customMessage 自定义问题（可选）
     * @return AI分析结果
     */
    Map<String, Object> analyzeWithAI(String factoryId, String batchId,
                                      String sessionId, String customMessage);

    /**
     * 获取AI对话历史
     *
     * @param sessionId 会话ID
     * @return 对话历史
     */
    List<Map<String, Object>> getAISessionHistory(String sessionId);

    /**
     * AI服务健康检查
     *
     * @return 健康状态
     */
    Map<String, Object> checkAIServiceHealth();

    // ========== 时间范围分析 ==========

    /**
     * 获取指定时间范围内的批次成本摘要数据（用于周报告/月报告）
     * 返回轻量级的批次成本摘要，不包含详细的业务链数据
     *
     * @param factoryId 工厂ID
     * @param startDate 开始时间
     * @param endDate 结束时间
     * @return 批次成本摘要数据列表（包含基本信息、成本、指标等）
     */
    List<Map<String, Object>> getWeeklyBatchesCost(
            String factoryId,
            java.time.LocalDateTime startDate,
            java.time.LocalDateTime endDate);

    /**
     * 获取时间范围内的批次成本分析数据
     *
     * @param factoryId 工厂ID
     * @param startDate 开始时间
     * @param endDate 结束时间
     * @return 批次成本数据列表
     */
    List<Map<String, Object>> getTimeRangeBatchesCostAnalysis(
            String factoryId,
            java.time.LocalDateTime startDate,
            java.time.LocalDateTime endDate);

    // ========== 批次对比分析 ==========

    /**
     * 获取多个批次的对比分析数据
     *
     * @param factoryId 工厂ID
     * @param batchIds 批次ID列表（2-5个）
     * @return 批次对比数据列表
     */
    List<Map<String, Object>> getComparativeBatchesCostAnalysis(
            String factoryId,
            List<String> batchIds);

    // ========== 仪表盘 ==========
     /**
     * 生产概览
      */
    Map<String, Object> getDashboardOverview(String factoryId);
     /**
     * 生产统计
      */
    Map<String, Object> getProductionStatistics(String factoryId, String period);
     /**
     * 质量仪表盘
      */
    Map<String, Object> getQualityDashboard(String factoryId);
     /**
     * 设备仪表盘
      */
    Map<String, Object> getEquipmentDashboard(String factoryId);
     /**
     * 告警仪表盘
      */
    Map<String, Object> getAlertsDashboard(String factoryId);
     /**
     * 趋势分析
      */
    Map<String, Object> getTrendAnalysis(String factoryId, String metric, Integer days);
}
