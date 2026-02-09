package com.cretas.aims.service.impl;

import com.cretas.aims.entity.BatchRelation;
import com.cretas.aims.repository.BatchRelationRepository;
import com.cretas.aims.service.BatchRelationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 批次关联服务实现类
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchRelationServiceImpl implements BatchRelationService {

    private final BatchRelationRepository batchRelationRepository;

    @Override
    public Page<BatchRelation> getBatchRelations(String factoryId, Pageable pageable) {
        return batchRelationRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
    }

    @Override
    public Optional<BatchRelation> getBatchRelationById(String factoryId, String id) {
        return batchRelationRepository.findByIdAndFactoryIdAndDeletedAtIsNull(id, factoryId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchRelation createBatchRelation(BatchRelation batchRelation) {
        // 检查是否已存在相同的关联
        if (existsRelation(batchRelation.getProductionBatchId(), batchRelation.getMaterialBatchId())) {
            throw new RuntimeException("批次关联已存在");
        }

        if (batchRelation.getId() == null || batchRelation.getId().isEmpty()) {
            batchRelation.setId(UUID.randomUUID().toString());
        }
        if (batchRelation.getRelationType() == null) {
            batchRelation.setRelationType("INPUT");
        }
        if (batchRelation.getVerified() == null) {
            batchRelation.setVerified(false);
        }
        if (batchRelation.getUsedAt() == null) {
            batchRelation.setUsedAt(LocalDateTime.now());
        }

        log.info("创建批次关联: productionBatchId={}, materialBatchId={}",
                batchRelation.getProductionBatchId(), batchRelation.getMaterialBatchId());
        return batchRelationRepository.save(batchRelation);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchRelation updateBatchRelation(String id, BatchRelation updateData) {
        BatchRelation existing = batchRelationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("批次关联不存在: " + id));

        if (updateData.getQuantityUsed() != null) existing.setQuantityUsed(updateData.getQuantityUsed());
        if (updateData.getUnit() != null) existing.setUnit(updateData.getUnit());
        if (updateData.getStage() != null) existing.setStage(updateData.getStage());
        if (updateData.getRemarks() != null) existing.setRemarks(updateData.getRemarks());

        return batchRelationRepository.save(existing);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteBatchRelation(String id) {
        BatchRelation relation = batchRelationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("批次关联不存在: " + id));
        relation.setDeletedAt(LocalDateTime.now());
        batchRelationRepository.save(relation);
        log.info("删除批次关联: id={}", id);
    }

    @Override
    public List<BatchRelation> getByProductionBatchId(Long productionBatchId) {
        return batchRelationRepository.findByProductionBatchIdAndDeletedAtIsNull(productionBatchId);
    }

    @Override
    public List<BatchRelation> getByMaterialBatchId(String materialBatchId) {
        return batchRelationRepository.findByMaterialBatchIdAndDeletedAtIsNull(materialBatchId);
    }

    @Override
    public List<BatchRelation> traceForward(String materialBatchId) {
        log.info("正向追溯: materialBatchId={}", materialBatchId);
        return batchRelationRepository.traceForward(materialBatchId);
    }

    @Override
    public List<BatchRelation> traceBackward(Long productionBatchId) {
        log.info("反向追溯: productionBatchId={}", productionBatchId);
        return batchRelationRepository.traceBackward(productionBatchId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchRelation verifyRelation(String id, Long verifiedBy) {
        BatchRelation relation = batchRelationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("批次关联不存在: " + id));
        relation.setVerified(true);
        relation.setVerifiedAt(LocalDateTime.now());
        relation.setVerifiedBy(verifiedBy);
        log.info("验证批次关联: id={}, verifiedBy={}", id, verifiedBy);
        return batchRelationRepository.save(relation);
    }

    @Override
    public boolean existsRelation(Long productionBatchId, String materialBatchId) {
        return batchRelationRepository.existsByProductionBatchIdAndMaterialBatchIdAndDeletedAtIsNull(
                productionBatchId, materialBatchId);
    }

    @Override
    public List<BatchRelation> getUnverifiedRelations(String factoryId) {
        return batchRelationRepository.findByFactoryIdAndVerifiedFalseAndDeletedAtIsNull(factoryId);
    }
}
