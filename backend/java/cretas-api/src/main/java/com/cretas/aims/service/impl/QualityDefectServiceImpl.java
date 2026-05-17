package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityDefect;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.enums.DefectStatus;
import com.cretas.aims.entity.enums.DefectType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.QualityDefectRepository;
import com.cretas.aims.repository.QualityInspectionRepository;
import com.cretas.aims.service.QualityDefectService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Sprint4-H Q-PROCESS-1: 工序质检不良业务实现.
 *
 * <p>状态机:
 * <pre>
 *   recordDefect()  → OPEN
 *   assignDefect()  OPEN          → IN_PROGRESS
 *   closeDefect()   IN_PROGRESS   → CLOSED (也允许 OPEN→CLOSED, 简单 case 直接闭环)
 * </pre>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QualityDefectServiceImpl implements QualityDefectService {

    private final QualityDefectRepository defectRepository;
    private final QualityInspectionRepository inspectionRepository;

    @Override
    @Transactional
    public QualityDefect recordDefect(String factoryId, String qualityInspectionId,
                                       String materialId, DefectType defectType,
                                       BigDecimal quantity, String cause, Long createdBy) {
        if (defectType == null) {
            throw new BusinessException(400, "缺陷类型 defectType 必填");
        }
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(400, "不良数量 quantity 必须 > 0");
        }
        // 验证 inspection 存在且属于本工厂
        QualityInspection inspection = inspectionRepository.findById(qualityInspectionId)
                .orElseThrow(() -> new ResourceNotFoundException("质检记录不存在"));
        if (!factoryId.equals(inspection.getFactoryId())) {
            throw new ResourceNotFoundException("质检记录不属于当前工厂");
        }

        QualityDefect defect = QualityDefect.builder()
                .factoryId(factoryId)
                .qualityInspectionId(qualityInspectionId)
                .materialId(materialId)
                .defectType(defectType)
                .quantity(quantity)
                .cause(cause)
                .status(DefectStatus.OPEN)
                .createdBy(createdBy)
                .build();
        QualityDefect saved = defectRepository.save(defect);
        log.info("登记质检不良: defectId={}, inspectionId={}, type={}, qty={}",
                saved.getId(), qualityInspectionId, defectType, quantity);
        return saved;
    }

    @Override
    @Transactional
    public QualityDefect assignDefect(String factoryId, String defectId,
                                       String handlingAction, Long assignedTo) {
        QualityDefect defect = getDefect(factoryId, defectId);
        if (defect.getStatus() == DefectStatus.CLOSED) {
            throw new BusinessException(409, "已闭环的不良不可重新分派")
                    .withHint("请新建不良记录或撤销闭环");
        }
        if (handlingAction == null || handlingAction.trim().isEmpty()) {
            throw new BusinessException(400, "处置动作 handlingAction 必填");
        }
        defect.setHandlingAction(handlingAction);
        defect.setAssignedTo(assignedTo);
        defect.setStatus(DefectStatus.IN_PROGRESS);
        QualityDefect saved = defectRepository.save(defect);
        log.info("分派质检不良: defectId={}, assignedTo={}, action={}",
                defectId, assignedTo, handlingAction);
        return saved;
    }

    @Override
    @Transactional
    public QualityDefect closeDefect(String factoryId, String defectId,
                                      String closeNotes, Long closedBy) {
        QualityDefect defect = getDefect(factoryId, defectId);
        if (defect.getStatus() == DefectStatus.CLOSED) {
            throw new BusinessException(409, "已闭环的不良不可重复闭环")
                    .withHint("请刷新列表查看最新状态");
        }
        defect.setStatus(DefectStatus.CLOSED);
        defect.setClosedAt(LocalDateTime.now());
        defect.setClosedBy(closedBy);
        defect.setCloseNotes(closeNotes);
        QualityDefect saved = defectRepository.save(defect);
        log.info("闭环质检不良: defectId={}, closedBy={}", defectId, closedBy);
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public QualityDefect getDefect(String factoryId, String defectId) {
        return defectRepository.findByIdAndFactoryId(defectId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("不良记录不存在或不属于当前工厂"));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<QualityDefect> listDefects(String factoryId,
                                                    DefectStatus status,
                                                    DefectType defectType,
                                                    String qualityInspectionId,
                                                    String materialId,
                                                    LocalDateTime fromDate,
                                                    LocalDateTime toDate,
                                                    int page, int size) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page - 1),
                Math.max(1, Math.min(size, 200)),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<QualityDefect> result = defectRepository.findByFilters(
                factoryId, status, defectType, qualityInspectionId, materialId,
                fromDate, toDate, pageable);
        return PageResponse.of(result.getContent(), result.getNumber() + 1,
                result.getSize(), result.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public List<QualityDefect> listByInspection(String factoryId, String qualityInspectionId) {
        return defectRepository.findByFactoryIdAndQualityInspectionId(
                factoryId, qualityInspectionId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getDefectSummary(String factoryId) {
        Map<String, Object> summary = new HashMap<>();
        Map<String, Long> byStatus = new HashMap<>();
        for (DefectStatus s : DefectStatus.values()) {
            byStatus.put(s.name(), defectRepository.countByFactoryIdAndStatus(factoryId, s));
        }
        Map<String, Long> byType = new HashMap<>();
        for (DefectType t : DefectType.values()) {
            byType.put(t.name(), defectRepository.countByFactoryIdAndDefectType(factoryId, t));
        }
        summary.put("byStatus", byStatus);
        summary.put("byType", byType);
        return summary;
    }
}
