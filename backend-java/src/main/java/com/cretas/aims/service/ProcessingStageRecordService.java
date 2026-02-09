package com.cretas.aims.service;

import com.cretas.aims.dto.processing.ProcessingStageRecordDTO;
import com.cretas.aims.entity.enums.ProcessingStageType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 加工环节记录服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-23
 */
public interface ProcessingStageRecordService {

    /**
     * 创建加工环节记录
     */
    ProcessingStageRecordDTO create(String factoryId, ProcessingStageRecordDTO dto);

    /**
     * 更新加工环节记录
     */
    ProcessingStageRecordDTO update(String factoryId, Long id, ProcessingStageRecordDTO dto);

    /**
     * 获取单个记录
     */
    ProcessingStageRecordDTO getById(String factoryId, Long id);

    /**
     * 获取批次的所有环节记录
     */
    List<ProcessingStageRecordDTO> getByBatchId(String factoryId, Long productionBatchId);

    /**
     * 获取批次的所有环节记录 (带平均值对比数据)
     */
    List<ProcessingStageRecordDTO> getByBatchIdWithComparison(String factoryId, Long productionBatchId);

    /**
     * 根据时间范围查询
     */
    List<ProcessingStageRecordDTO> getByTimeRange(String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 根据环节类型查询
     */
    List<ProcessingStageRecordDTO> getByStageType(String factoryId, ProcessingStageType stageType);

    /**
     * 删除记录
     */
    void delete(String factoryId, Long id);

    /**
     * 删除批次的所有环节记录
     */
    void deleteByBatchId(String factoryId, Long productionBatchId);

    /**
     * 批量创建环节记录
     */
    List<ProcessingStageRecordDTO> batchCreate(String factoryId, Long productionBatchId, List<ProcessingStageRecordDTO> dtos);

    /**
     * 获取环节统计数据 (用于AI分析)
     * 返回各环节的平均数据，用于对比分析
     */
    Map<ProcessingStageType, Map<String, Object>> getStageStatistics(String factoryId);

    /**
     * 将批次环节数据格式化为AI分析所需的Map格式
     */
    Map<String, String> formatForAIAnalysis(String factoryId, Long productionBatchId);
}
