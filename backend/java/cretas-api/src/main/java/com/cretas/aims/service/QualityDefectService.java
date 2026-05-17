package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.QualityDefect;
import com.cretas.aims.entity.enums.DefectStatus;
import com.cretas.aims.entity.enums.DefectType;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Sprint4-H Q-PROCESS-1: 工序质检不良业务接口.
 *
 * <p>闭环流程: recordDefect (OPEN) → assignDefect (OPEN→IN_PROGRESS) →
 * closeDefect (IN_PROGRESS→CLOSED).
 */
public interface QualityDefectService {

    /**
     * 登记不良 — 检验员发现质检不合格时调用.
     *
     * @param factoryId             工厂 ID
     * @param qualityInspectionId   关联质检记录 ID (必须存在)
     * @param materialId            物料 ID (可选)
     * @param defectType            缺陷类型 (必填)
     * @param quantity              不良数量
     * @param cause                 原因描述
     * @param createdBy             记录人 user_id
     * @return 新建的 QualityDefect (status=OPEN)
     */
    QualityDefect recordDefect(String factoryId, String qualityInspectionId, String materialId,
                                DefectType defectType, java.math.BigDecimal quantity,
                                String cause, Long createdBy);

    /**
     * 分派处理 — 质量经理 / 主管设定处置动作 + 分配处理人.
     * OPEN → IN_PROGRESS.
     */
    QualityDefect assignDefect(String factoryId, String defectId,
                                String handlingAction, Long assignedTo);

    /**
     * 闭环 — 处理人完成处置并验证通过.
     * IN_PROGRESS → CLOSED.
     */
    QualityDefect closeDefect(String factoryId, String defectId,
                               String closeNotes, Long closedBy);

    /** 详情. */
    QualityDefect getDefect(String factoryId, String defectId);

    /** 列表 (按多条件过滤). */
    PageResponse<QualityDefect> listDefects(String factoryId,
                                             DefectStatus status,
                                             DefectType defectType,
                                             String qualityInspectionId,
                                             String materialId,
                                             LocalDateTime fromDate,
                                             LocalDateTime toDate,
                                             int page, int size);

    /** 按 inspection 查所有不良 (用于 detail 页). */
    java.util.List<QualityDefect> listByInspection(String factoryId, String qualityInspectionId);

    /** 统计概览: 按 status / defectType 计数. */
    Map<String, Object> getDefectSummary(String factoryId);
}
