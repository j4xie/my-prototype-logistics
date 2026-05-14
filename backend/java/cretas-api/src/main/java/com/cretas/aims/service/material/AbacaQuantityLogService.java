package com.cretas.aims.service.material;

import com.cretas.aims.dto.material.CreateAbacaQuantityLogRequest;
import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AbacaQuantityLogRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 抄码品称重日志 Service (W-ABA-1).
 *
 * <p>核心场景: 仓管员入库时, 每箱实际称重逐条录入. 1 批次 → N 条 abaca_quantity_log.</p>
 *
 * <p>不变量:</p>
 * <ul>
 *   <li>actualWeight > 0 (DB CHECK 兜底 + DTO 校验)</li>
 *   <li>boxIndex 不填则自动分配 = max(已有 boxIndex) + 1</li>
 *   <li>已复核的日志不可软删除 (防止改后历史不一致)</li>
 *   <li>所有读写按 factoryId 隔离</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AbacaQuantityLogService {

    private final AbacaQuantityLogRepository abacaRepo;
    private final RawMaterialTypeRepository rawMaterialTypeRepo;

    // ==================== 读取 ====================

    /** 列表 — 单批次全部称重 + 汇总. 返回 Map: {logs, batchTotalWeight, batchBoxCount}. */
    @Transactional(readOnly = true)
    public Map<String, Object> listByBatch(String factoryId, String materialBatchId) {
        List<AbacaQuantityLog> logs =
                abacaRepo.findByFactoryIdAndMaterialBatchIdOrderByBoxIndexAsc(factoryId, materialBatchId);
        return withSummary(factoryId, materialBatchId, logs);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getById(String factoryId, String id) {
        AbacaQuantityLog log = abacaRepo.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new BusinessException("称重记录不存在或无权访问"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("log", log);
        out.put("batchTotalWeight", abacaRepo.sumActualWeightByBatch(factoryId, log.getMaterialBatchId()));
        out.put("batchBoxCount", abacaRepo.countByFactoryIdAndMaterialBatchId(factoryId, log.getMaterialBatchId()));
        return out;
    }

    // ==================== 写入 ====================

    /** 单箱称重写入 + 返回新建记录 + 该批次累计汇总. */
    @Transactional
    public Map<String, Object> create(String factoryId, Long weighedBy, CreateAbacaQuantityLogRequest req) {
        validateMaterialTypeIsAbaca(factoryId, req.getRawMaterialTypeId());

        AbacaQuantityLog entity = toEntity(factoryId, weighedBy, req);
        AbacaQuantityLog saved = abacaRepo.save(entity);
        log.info("抄码称重写入 factory={} batch={} box={} weight={} {}",
                factoryId, saved.getMaterialBatchId(), saved.getBoxIndex(),
                saved.getActualWeight(), saved.getUnit());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("log", saved);
        result.put("batchTotalWeight", abacaRepo.sumActualWeightByBatch(factoryId, saved.getMaterialBatchId()));
        result.put("batchBoxCount", abacaRepo.countByFactoryIdAndMaterialBatchId(factoryId, saved.getMaterialBatchId()));
        return result;
    }

    /** 批量写入 — 同一批次 N 箱一次提交. */
    @Transactional
    public Map<String, Object> createBatch(String factoryId, Long weighedBy,
                                           List<CreateAbacaQuantityLogRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new BusinessException("批量称重请求不能为空");
        }
        String batchId = requests.get(0).getMaterialBatchId();
        if (batchId == null || batchId.isBlank()) {
            throw new BusinessException("批次 ID 不能为空");
        }

        List<AbacaQuantityLog> saved = new ArrayList<>(requests.size());
        for (CreateAbacaQuantityLogRequest req : requests) {
            if (!batchId.equals(req.getMaterialBatchId())) {
                throw new BusinessException("批量请求必须属于同一个 materialBatchId");
            }
            validateMaterialTypeIsAbaca(factoryId, req.getRawMaterialTypeId());
            saved.add(abacaRepo.save(toEntity(factoryId, weighedBy, req)));
        }

        log.info("抄码批量称重 factory={} batch={} 共 {} 箱", factoryId, batchId, saved.size());
        return withSummary(factoryId, batchId, saved);
    }

    /** 复核 (双签). */
    @Transactional
    public AbacaQuantityLog verify(String factoryId, String id, Long verifierUserId) {
        AbacaQuantityLog entry = abacaRepo.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new BusinessException("称重记录不存在或无权访问"));
        if (entry.isVerified()) {
            throw new BusinessException("该称重记录已复核, 不可重复复核");
        }
        if (entry.getWeighedBy() != null && entry.getWeighedBy().equals(verifierUserId)) {
            throw new BusinessException("不能由称重员自己复核 (双签机制)");
        }
        entry.setVerifiedBy(verifierUserId);
        entry.setVerifiedAt(LocalDateTime.now());
        return abacaRepo.save(entry);
    }

    /** 软删除 — 仅未复核可删. */
    @Transactional
    public void softDelete(String factoryId, String id) {
        AbacaQuantityLog entry = abacaRepo.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new BusinessException("称重记录不存在或无权访问"));
        if (entry.isVerified()) {
            throw new BusinessException("已复核的称重记录不可删除");
        }
        entry.softDelete();
        abacaRepo.save(entry);
    }

    // ==================== 内部辅助 ====================

    private AbacaQuantityLog toEntity(String factoryId, Long weighedBy,
                                     CreateAbacaQuantityLogRequest req) {
        Integer boxIdx = req.getBoxIndex();
        if (boxIdx == null) {
            Integer maxIdx = abacaRepo.maxBoxIndexByBatch(factoryId, req.getMaterialBatchId());
            boxIdx = (maxIdx == null ? 0 : maxIdx) + 1;
        }
        AbacaQuantityLog entity = new AbacaQuantityLog();
        entity.setFactoryId(factoryId);
        entity.setMaterialBatchId(req.getMaterialBatchId());
        entity.setRawMaterialTypeId(req.getRawMaterialTypeId());
        entity.setPurchaseOrderItemId(req.getPurchaseOrderItemId());
        entity.setBoxIndex(boxIdx);
        entity.setActualWeight(req.getActualWeight());
        entity.setUnit(req.getUnit());
        entity.setWeighingMethod(req.getWeighingMethod());
        entity.setScaleDeviceId(req.getScaleDeviceId());
        entity.setWeighedBy(weighedBy);
        entity.setNotes(req.getNotes());
        return entity;
    }

    private void validateMaterialTypeIsAbaca(String factoryId, String rawMaterialTypeId) {
        var type = rawMaterialTypeRepo.findById(rawMaterialTypeId)
                .orElseThrow(() -> new BusinessException("原料类型不存在: " + rawMaterialTypeId));
        if (!factoryId.equals(type.getFactoryId())) {
            throw new BusinessException("原料类型不属于当前工厂");
        }
        if (!Boolean.TRUE.equals(type.getIsAbacaPackaging())) {
            throw new BusinessException("该原料未标记为抄码品, 不允许录称重日志. " +
                    "请先通过 material_mark_abaca 标记 isAbacaPackaging=TRUE.");
        }
    }

    private Map<String, Object> withSummary(String factoryId, String batchId,
                                            List<AbacaQuantityLog> logs) {
        BigDecimal total = abacaRepo.sumActualWeightByBatch(factoryId, batchId);
        long boxCount = abacaRepo.countByFactoryIdAndMaterialBatchId(factoryId, batchId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("logs", logs);
        out.put("batchTotalWeight", total != null ? total : BigDecimal.ZERO);
        out.put("batchBoxCount", boxCount);
        return out;
    }
}
