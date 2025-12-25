package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.*;
import com.joolun.mall.mapper.*;
import com.joolun.mall.service.TraceabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 溯源服务实现
 */
@Service
@RequiredArgsConstructor
public class TraceabilityServiceImpl extends ServiceImpl<TraceabilityBatchMapper, TraceabilityBatch> implements TraceabilityService {

    private final TraceabilityTimelineMapper timelineMapper;
    private final TraceabilityRawMaterialMapper rawMaterialMapper;
    private final TraceabilityQualityReportMapper qualityReportMapper;
    private final TraceabilityEvidenceMapper evidenceMapper;

    @Override
    public IPage<TraceabilityBatch> page1(IPage<TraceabilityBatch> page, TraceabilityBatch batch) {
        return baseMapper.selectPage1(page, batch);
    }

    @Override
    public TraceabilityBatch getByBatchNo(String batchNo) {
        LambdaQueryWrapper<TraceabilityBatch> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceabilityBatch::getBatchNo, batchNo);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public TraceabilityBatch getDetail(Long id) {
        TraceabilityBatch batch = baseMapper.selectById(id);
        if (batch != null) {
            fillBatchDetails(batch);
        }
        return batch;
    }

    @Override
    public TraceabilityBatch getDetailByBatchNo(String batchNo) {
        TraceabilityBatch batch = getByBatchNo(batchNo);
        if (batch != null) {
            fillBatchDetails(batch);
        }
        return batch;
    }

    private void fillBatchDetails(TraceabilityBatch batch) {
        batch.setTimeline(getTimeline(batch.getId()));
        batch.setRawMaterials(getRawMaterials(batch.getId()));
        batch.setQualityReports(getQualityReports(batch.getId()));
        batch.setEvidences(getEvidences(batch.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean createBatch(TraceabilityBatch batch) {
        batch.setCreateTime(LocalDateTime.now());
        return baseMapper.insert(batch) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateStatus(Long id, Integer status) {
        TraceabilityBatch batch = new TraceabilityBatch();
        batch.setId(id);
        batch.setStatus(status);
        batch.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(batch) > 0;
    }

    // ========== 时间线操作 ==========

    @Override
    public List<TraceabilityTimeline> getTimeline(Long batchId) {
        LambdaQueryWrapper<TraceabilityTimeline> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceabilityTimeline::getBatchId, batchId)
               .orderByAsc(TraceabilityTimeline::getSortOrder);
        return timelineMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addTimelineNode(TraceabilityTimeline node) {
        node.setCreateTime(LocalDateTime.now());
        return timelineMapper.insert(node) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateTimelineNode(TraceabilityTimeline node) {
        node.setUpdateTime(LocalDateTime.now());
        return timelineMapper.updateById(node) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteTimelineNode(Long nodeId) {
        return timelineMapper.deleteById(nodeId) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean batchSaveTimeline(Long batchId, List<TraceabilityTimeline> nodes) {
        // 1. 获取现有节点ID列表
        List<TraceabilityTimeline> existingNodes = getTimeline(batchId);
        java.util.Set<Long> existingIds = existingNodes.stream()
                .map(TraceabilityTimeline::getId)
                .collect(java.util.stream.Collectors.toSet());
        
        // 2. 收集本次提交的节点ID（已存在的）
        java.util.Set<Long> submittedIds = new java.util.HashSet<>();
        
        // 3. 遍历处理每个节点
        for (int i = 0; i < nodes.size(); i++) {
            TraceabilityTimeline node = nodes.get(i);
            node.setBatchId(batchId);
            node.setSortOrder(i + 1); // 按提交顺序设置排序
            
            if (node.getId() != null && existingIds.contains(node.getId())) {
                // 更新已存在的节点
                node.setUpdateTime(LocalDateTime.now());
                timelineMapper.updateById(node);
                submittedIds.add(node.getId());
            } else {
                // 新增节点（忽略前端传来的id，让数据库自动生成）
                node.setId(null);
                node.setCreateTime(LocalDateTime.now());
                timelineMapper.insert(node);
            }
        }
        
        // 4. 删除不在本次提交列表中的旧节点
        for (Long existingId : existingIds) {
            if (!submittedIds.contains(existingId)) {
                timelineMapper.deleteById(existingId);
            }
        }
        
        return true;
    }

    // ========== 原料操作 ==========

    @Override
    public List<TraceabilityRawMaterial> getRawMaterials(Long batchId) {
        LambdaQueryWrapper<TraceabilityRawMaterial> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceabilityRawMaterial::getBatchId, batchId);
        return rawMaterialMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addRawMaterial(TraceabilityRawMaterial material) {
        material.setCreateTime(LocalDateTime.now());
        return rawMaterialMapper.insert(material) > 0;
    }

    // ========== 质检报告操作 ==========

    @Override
    public List<TraceabilityQualityReport> getQualityReports(Long batchId) {
        LambdaQueryWrapper<TraceabilityQualityReport> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceabilityQualityReport::getBatchId, batchId);
        return qualityReportMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addQualityReport(TraceabilityQualityReport report) {
        report.setCreateTime(LocalDateTime.now());
        return qualityReportMapper.insert(report) > 0;
    }

    // ========== 证据操作 ==========

    @Override
    public List<TraceabilityEvidence> getEvidences(Long batchId) {
        LambdaQueryWrapper<TraceabilityEvidence> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TraceabilityEvidence::getBatchId, batchId);
        return evidenceMapper.selectList(wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean addEvidence(TraceabilityEvidence evidence) {
        evidence.setCreateTime(LocalDateTime.now());
        return evidenceMapper.insert(evidence) > 0;
    }
}
