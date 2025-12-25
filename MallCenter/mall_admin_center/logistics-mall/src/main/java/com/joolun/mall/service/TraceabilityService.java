package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.*;

import java.util.List;

/**
 * 溯源服务接口
 */
public interface TraceabilityService extends IService<TraceabilityBatch> {

    /**
     * 分页查询批次
     */
    IPage<TraceabilityBatch> page1(IPage<TraceabilityBatch> page, TraceabilityBatch batch);

    /**
     * 根据批次号查询
     */
    TraceabilityBatch getByBatchNo(String batchNo);

    /**
     * 获取批次完整详情（含时间线、原料、质检、证据）
     */
    TraceabilityBatch getDetail(Long id);

    /**
     * 根据批次号获取完整详情
     */
    TraceabilityBatch getDetailByBatchNo(String batchNo);

    /**
     * 创建批次
     */
    boolean createBatch(TraceabilityBatch batch);

    /**
     * 更新批次状态
     */
    boolean updateStatus(Long id, Integer status);

    // ========== 时间线操作 ==========

    /**
     * 获取批次时间线
     */
    List<TraceabilityTimeline> getTimeline(Long batchId);

    /**
     * 添加时间线节点
     */
    boolean addTimelineNode(TraceabilityTimeline node);

    /**
     * 更新时间线节点
     */
    boolean updateTimelineNode(TraceabilityTimeline node);

    /**
     * 删除时间线节点
     */
    boolean deleteTimelineNode(Long nodeId);

    /**
     * 批量保存时间线节点（upsert + 删除缺失）
     * @param batchId 批次ID
     * @param nodes 节点列表
     * @return 成功标志
     */
    boolean batchSaveTimeline(Long batchId, List<TraceabilityTimeline> nodes);

    // ========== 原料操作 ==========

    /**
     * 获取批次原料列表
     */
    List<TraceabilityRawMaterial> getRawMaterials(Long batchId);

    /**
     * 添加原料
     */
    boolean addRawMaterial(TraceabilityRawMaterial material);

    // ========== 质检报告操作 ==========

    /**
     * 获取批次质检报告
     */
    List<TraceabilityQualityReport> getQualityReports(Long batchId);

    /**
     * 添加质检报告
     */
    boolean addQualityReport(TraceabilityQualityReport report);

    // ========== 证据操作 ==========

    /**
     * 获取批次证据
     */
    List<TraceabilityEvidence> getEvidences(Long batchId);

    /**
     * 添加证据
     */
    boolean addEvidence(TraceabilityEvidence evidence);
}
