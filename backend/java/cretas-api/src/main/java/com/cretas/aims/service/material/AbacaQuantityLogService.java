package com.cretas.aims.service.material;

import com.cretas.aims.dto.material.CreateAbacaQuantityLogRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AbacaQuantityLogRepository;
import com.cretas.aims.repository.MaterialBatchRepository;
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
    private final MaterialBatchRepository materialBatchRepo;

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
        AbacaQuantityLog entity = toEntity(factoryId, weighedBy, req);
        validateMaterialTypeIsAbaca(factoryId, entity.getRawMaterialTypeId());
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

        List<AbacaQuantityLog> saved = new ArrayList<>(requests.size());
        String firstBatchId = null;
        for (CreateAbacaQuantityLogRequest req : requests) {
            AbacaQuantityLog entity = toEntity(factoryId, weighedBy, req);
            if (firstBatchId == null) {
                firstBatchId = entity.getMaterialBatchId();
            } else if (!firstBatchId.equals(entity.getMaterialBatchId())) {
                throw new BusinessException("批量请求必须属于同一个批次 (materialBatchId 或 batchNumber 等价)");
            }
            validateMaterialTypeIsAbaca(factoryId, entity.getRawMaterialTypeId());
            saved.add(abacaRepo.save(entity));
        }

        log.info("抄码批量称重 factory={} batch={} 共 {} 箱", factoryId, firstBatchId, saved.size());
        return withSummary(factoryId, firstBatchId, saved);
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
        // 解析 batchId — 支持 materialBatchId 或 batchNumber 二选一 (PDF 扫码场景 RN 端常拿 batchNumber)
        String batchId = resolveBatchId(factoryId, req);
        String materialTypeId = req.getRawMaterialTypeId();
        if (materialTypeId == null || materialTypeId.isBlank()) {
            // 自动从 batch 取 (避免 caller 重复传)
            MaterialBatch batch = materialBatchRepo.findById(batchId)
                    .orElseThrow(() -> new BusinessException("批次不存在: " + batchId));
            materialTypeId = batch.getMaterialTypeId();
        }

        Integer boxIdx = req.getBoxIndex();
        if (boxIdx == null) {
            Integer maxIdx = abacaRepo.maxBoxIndexByBatch(factoryId, batchId);
            boxIdx = (maxIdx == null ? 0 : maxIdx) + 1;
        }
        AbacaQuantityLog entity = new AbacaQuantityLog();
        entity.setFactoryId(factoryId);
        entity.setMaterialBatchId(batchId);
        entity.setRawMaterialTypeId(materialTypeId);
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

    /** materialBatchId 优先; 否则按 batchNumber + factoryId lookup; 二者皆空抛 400. */
    private String resolveBatchId(String factoryId, CreateAbacaQuantityLogRequest req) {
        if (req.getMaterialBatchId() != null && !req.getMaterialBatchId().isBlank()) {
            return req.getMaterialBatchId();
        }
        if (req.getBatchNumber() != null && !req.getBatchNumber().isBlank()) {
            return materialBatchRepo.findByFactoryIdAndBatchNumber(factoryId, req.getBatchNumber())
                    .orElseThrow(() -> new BusinessException(
                            "批次号不存在 (工厂 " + factoryId + "): " + req.getBatchNumber()))
                    .getId();
        }
        throw new BusinessException("必须提供 materialBatchId 或 batchNumber 之一");
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
