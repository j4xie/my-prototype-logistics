package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.service.QualityInspectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 质量检验服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QualityInspectionServiceImpl implements QualityInspectionService {

    private final QualityInspectionRepository qualityInspectionRepository;

    @Override
    public PageResponse<QualityInspection> getInspections(String factoryId, String productionBatchId, PageRequest pageRequest) {
        log.info("分页查询质量检验记录: factoryId={}, productionBatchId={}, page={}, size={}",
                factoryId, productionBatchId, pageRequest.getPage(), pageRequest.getSize());

        org.springframework.data.domain.PageRequest springPageRequest =
                org.springframework.data.domain.PageRequest.of(
                    pageRequest.getPage() - 1,
                    pageRequest.getSize()
                );

        Page<QualityInspection> page;
        if (productionBatchId != null && !productionBatchId.trim().isEmpty()) {
            page = qualityInspectionRepository.findByFactoryIdAndProductionBatchId(
                    factoryId, productionBatchId, springPageRequest);
        } else {
            page = qualityInspectionRepository.findByFactoryId(factoryId, springPageRequest);
        }

        PageResponse<QualityInspection> response = new PageResponse<>();
        response.setContent(page.getContent());
        response.setPage(pageRequest.getPage());
        response.setSize(pageRequest.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        response.setFirst(page.isFirst());
        response.setLast(page.isLast());

        log.info("查询成功: 共{}条记录", page.getTotalElements());
        return response;
    }

    @Override
    public QualityInspection getInspectionById(String factoryId, String inspectionId) {
        log.info("获取质量检验记录详情: factoryId={}, inspectionId={}", factoryId, inspectionId);

        return qualityInspectionRepository.findById(inspectionId)
                .filter(inspection -> inspection.getFactoryId().equals(factoryId))
                .orElseThrow(() -> new RuntimeException("质量检验记录不存在或无权访问"));
    }

    @Override
    @Transactional
    public QualityInspection createInspection(String factoryId, QualityInspection inspection) {
        log.info("创建质量检验记录: factoryId={}, productionBatchId={}",
                factoryId, inspection.getProductionBatchId());

        // 生成UUID作为ID
        if (inspection.getId() == null || inspection.getId().trim().isEmpty()) {
            inspection.setId(java.util.UUID.randomUUID().toString());
        }

        inspection.setFactoryId(factoryId);
        QualityInspection saved = qualityInspectionRepository.save(inspection);

        log.info("质量检验记录创建成功: inspectionId={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public QualityInspection updateInspection(String factoryId, String inspectionId, QualityInspection inspection) {
        log.info("更新质量检验记录: factoryId={}, inspectionId={}", factoryId, inspectionId);

        QualityInspection existing = getInspectionById(factoryId, inspectionId);

        // 更新允许修改的字段
        if (inspection.getInspectorId() != null) {
            existing.setInspectorId(inspection.getInspectorId());
        }
        if (inspection.getResult() != null) {
            existing.setResult(inspection.getResult());
        }
        if (inspection.getSampleSize() != null) {
            existing.setSampleSize(inspection.getSampleSize());
        }
        if (inspection.getPassCount() != null) {
            existing.setPassCount(inspection.getPassCount());
        }
        if (inspection.getFailCount() != null) {
            existing.setFailCount(inspection.getFailCount());
        }
        if (inspection.getPassRate() != null) {
            existing.setPassRate(inspection.getPassRate());
        }
        if (inspection.getNotes() != null) {
            existing.setNotes(inspection.getNotes());
        }

        QualityInspection updated = qualityInspectionRepository.save(existing);
        log.info("质量检验记录更新成功: inspectionId={}", updated.getId());

        return updated;
    }
}
