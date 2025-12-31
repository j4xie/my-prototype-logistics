package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.ConfigChangeSet;
import com.cretas.aims.entity.config.ConfigChangeSet.ChangeStatus;
import com.cretas.aims.entity.config.ConfigChangeSet.ConfigType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.config.ConfigChangeSetRepository;
import com.cretas.aims.service.ConfigChangeSetService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 配置变更集服务实现
 *
 * @author Cretas Team
 * @since 2025-12-30
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConfigChangeSetServiceImpl implements ConfigChangeSetService {

    private final ConfigChangeSetRepository changeSetRepository;
    private final ObjectMapper objectMapper;

    // ========== 创建与查询 ==========

    @Override
    @Transactional
    public ConfigChangeSet createChangeSet(
            String factoryId,
            ConfigType configType,
            String configId,
            String configName,
            String beforeSnapshot,
            String afterSnapshot,
            Long createdBy,
            String createdByName) {

        // 检查是否有未完成的变更
        if (changeSetRepository.existsPendingChangeForConfig(configId)) {
            throw new BusinessException("该配置存在待审批的变更，请先处理");
        }

        // 计算版本号
        Integer currentVersion = changeSetRepository.findLatestAppliedVersion(configId).orElse(0);
        Integer newVersion = currentVersion + 1;

        // 计算差异
        String diffJson = computeDiff(beforeSnapshot, afterSnapshot);
        String changeSummary = generateChangeSummary(diffJson, configType);

        // 创建变更集
        ConfigChangeSet changeSet = ConfigChangeSet.builder()
                .factoryId(factoryId)
                .configType(configType)
                .configId(configId)
                .configName(configName)
                .fromVersion(currentVersion)
                .toVersion(newVersion)
                .beforeSnapshot(beforeSnapshot)
                .afterSnapshot(afterSnapshot)
                .diffJson(diffJson)
                .changeSummary(changeSummary)
                .status(ChangeStatus.PENDING)
                .createdBy(createdBy)
                .createdByName(createdByName)
                .isRollbackable(true)
                .build();

        ConfigChangeSet saved = changeSetRepository.save(changeSet);
        log.info("创建配置变更集: id={}, type={}, configId={}", saved.getId(), configType, configId);

        return saved;
    }

    @Override
    public ConfigChangeSet getChangeSetById(String changeSetId) {
        return changeSetRepository.findById(changeSetId)
                .orElseThrow(() -> new BusinessException("变更集不存在: " + changeSetId));
    }

    @Override
    public Page<ConfigChangeSet> getChangeSets(String factoryId, Pageable pageable) {
        return changeSetRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }

    @Override
    public Page<ConfigChangeSet> getChangeSetsByStatus(
            String factoryId, ChangeStatus status, Pageable pageable) {
        return changeSetRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageable);
    }

    @Override
    public List<ConfigChangeSet> getPendingChangeSets(String factoryId) {
        return changeSetRepository.findPendingChangeSets(factoryId);
    }

    @Override
    public long countPendingChangeSets(String factoryId) {
        return changeSetRepository.countPendingByFactoryId(factoryId);
    }

    @Override
    public List<ConfigChangeSet> getChangeHistory(ConfigType configType, String configId) {
        return changeSetRepository.findByConfigTypeAndConfigIdOrderByCreatedAtDesc(configType, configId);
    }

    // ========== 差异预览 ==========

    @Override
    public Map<String, Object> previewDiff(String changeSetId) {
        ConfigChangeSet changeSet = getChangeSetById(changeSetId);

        Map<String, Object> result = new HashMap<>();
        result.put("id", changeSet.getId());
        result.put("configType", changeSet.getConfigType());
        result.put("configName", changeSet.getConfigName());
        result.put("fromVersion", changeSet.getFromVersion());
        result.put("toVersion", changeSet.getToVersion());
        result.put("status", changeSet.getStatus());
        result.put("createdBy", changeSet.getCreatedByName());
        result.put("createdAt", changeSet.getCreatedAt());
        result.put("changeSummary", changeSet.getChangeSummary());

        // 解析 JSON 以便前端展示
        try {
            if (changeSet.getBeforeSnapshot() != null) {
                result.put("beforeSnapshot", objectMapper.readTree(changeSet.getBeforeSnapshot()));
            }
            if (changeSet.getAfterSnapshot() != null) {
                result.put("afterSnapshot", objectMapper.readTree(changeSet.getAfterSnapshot()));
            }
            if (changeSet.getDiffJson() != null) {
                result.put("diff", objectMapper.readTree(changeSet.getDiffJson()));
            }
        } catch (JsonProcessingException e) {
            log.warn("解析变更集JSON失败: {}", e.getMessage());
            // 返回原始字符串
            result.put("beforeSnapshot", changeSet.getBeforeSnapshot());
            result.put("afterSnapshot", changeSet.getAfterSnapshot());
            result.put("diff", changeSet.getDiffJson());
        }

        return result;
    }

    @Override
    public String computeDiff(String beforeJson, String afterJson) {
        try {
            JsonNode beforeNode = beforeJson != null ? objectMapper.readTree(beforeJson) : objectMapper.createObjectNode();
            JsonNode afterNode = afterJson != null ? objectMapper.readTree(afterJson) : objectMapper.createObjectNode();

            ObjectNode diff = objectMapper.createObjectNode();
            ArrayNode added = objectMapper.createArrayNode();
            ArrayNode removed = objectMapper.createArrayNode();
            ArrayNode modified = objectMapper.createArrayNode();

            // 获取所有字段名
            Set<String> allFields = new HashSet<>();
            beforeNode.fieldNames().forEachRemaining(allFields::add);
            afterNode.fieldNames().forEachRemaining(allFields::add);

            for (String field : allFields) {
                JsonNode beforeValue = beforeNode.get(field);
                JsonNode afterValue = afterNode.get(field);

                if (beforeValue == null && afterValue != null) {
                    // 新增字段
                    ObjectNode change = objectMapper.createObjectNode();
                    change.put("field", field);
                    change.set("value", afterValue);
                    added.add(change);
                } else if (beforeValue != null && afterValue == null) {
                    // 删除字段
                    ObjectNode change = objectMapper.createObjectNode();
                    change.put("field", field);
                    change.set("value", beforeValue);
                    removed.add(change);
                } else if (beforeValue != null && !beforeValue.equals(afterValue)) {
                    // 修改字段
                    ObjectNode change = objectMapper.createObjectNode();
                    change.put("field", field);
                    change.set("oldValue", beforeValue);
                    change.set("newValue", afterValue);
                    modified.add(change);
                }
            }

            diff.set("added", added);
            diff.set("removed", removed);
            diff.set("modified", modified);

            return objectMapper.writeValueAsString(diff);
        } catch (JsonProcessingException e) {
            log.error("计算配置差异失败", e);
            // 返回简单的差异表示
            return "{\"error\":\"无法计算差异\",\"before\":\"" +
                    (beforeJson != null ? "有数据" : "空") + "\",\"after\":\"" +
                    (afterJson != null ? "有数据" : "空") + "\"}";
        }
    }

    @Override
    public String generateChangeSummary(String diffJson, ConfigType configType) {
        try {
            JsonNode diff = objectMapper.readTree(diffJson);

            int addedCount = diff.has("added") ? diff.get("added").size() : 0;
            int removedCount = diff.has("removed") ? diff.get("removed").size() : 0;
            int modifiedCount = diff.has("modified") ? diff.get("modified").size() : 0;

            StringBuilder summary = new StringBuilder();
            summary.append(getConfigTypeName(configType)).append("变更: ");

            List<String> changes = new ArrayList<>();
            if (addedCount > 0) {
                changes.add("新增 " + addedCount + " 项");
            }
            if (removedCount > 0) {
                changes.add("删除 " + removedCount + " 项");
            }
            if (modifiedCount > 0) {
                changes.add("修改 " + modifiedCount + " 项");
            }

            if (changes.isEmpty()) {
                return "无实质性变更";
            }

            summary.append(String.join("，", changes));
            return summary.toString();
        } catch (JsonProcessingException e) {
            return "配置变更";
        }
    }

    private String getConfigTypeName(ConfigType configType) {
        switch (configType) {
            case FORM_TEMPLATE:
                return "表单模板";
            case DROOLS_RULE:
                return "业务规则";
            case APPROVAL_CHAIN:
                return "审批链";
            case QUALITY_RULE:
                return "质检规则";
            case CONVERSION_RATE:
                return "转换率";
            case FACTORY_CAPACITY:
                return "产能配置";
            default:
                return "配置";
        }
    }

    // ========== 审批流程 ==========

    @Override
    @Transactional
    public ConfigChangeSet approveChangeSet(
            String changeSetId,
            Long approverId,
            String approverName,
            String comment) {

        ConfigChangeSet changeSet = getChangeSetById(changeSetId);

        if (!changeSet.canApprove()) {
            throw new BusinessException("该变更集无法审批，当前状态: " + changeSet.getStatus());
        }

        changeSet.approve(approverId, approverName, comment);
        ConfigChangeSet saved = changeSetRepository.save(changeSet);

        log.info("变更集已审批通过: id={}, approver={}", changeSetId, approverName);
        return saved;
    }

    @Override
    @Transactional
    public ConfigChangeSet rejectChangeSet(
            String changeSetId,
            Long approverId,
            String approverName,
            String reason) {

        ConfigChangeSet changeSet = getChangeSetById(changeSetId);

        if (!changeSet.canApprove()) {
            throw new BusinessException("该变更集无法拒绝，当前状态: " + changeSet.getStatus());
        }

        changeSet.reject(approverId, approverName, reason);
        ConfigChangeSet saved = changeSetRepository.save(changeSet);

        log.info("变更集已拒绝: id={}, approver={}, reason={}", changeSetId, approverName, reason);
        return saved;
    }

    // ========== 应用与回滚 ==========

    @Override
    @Transactional
    public ConfigChangeSet applyChangeSet(String changeSetId) {
        ConfigChangeSet changeSet = getChangeSetById(changeSetId);

        if (changeSet.getStatus() != ChangeStatus.APPROVED) {
            throw new BusinessException("只有已审批的变更集才能应用，当前状态: " + changeSet.getStatus());
        }

        // 标记之前的变更为不可回滚 (因为有新变更了)
        changeSetRepository.findFirstByConfigIdAndStatusOrderByAppliedAtDesc(
                changeSet.getConfigId(), ChangeStatus.APPLIED)
                .ifPresent(previous -> {
                    previous.setIsRollbackable(false);
                    changeSetRepository.save(previous);
                });

        changeSet.apply();
        ConfigChangeSet saved = changeSetRepository.save(changeSet);

        log.info("变更集已应用: id={}, configId={}", changeSetId, changeSet.getConfigId());

        // 注意: 实际的配置更新由调用方负责
        // 这里只更新变更集状态

        return saved;
    }

    @Override
    @Transactional
    public ConfigChangeSet rollbackChangeSet(String changeSetId, Long userId, String reason) {
        ConfigChangeSet changeSet = getChangeSetById(changeSetId);

        if (!changeSet.canRollback()) {
            throw new BusinessException("该变更集无法回滚，当前状态: " + changeSet.getStatus() +
                    ", 可回滚: " + changeSet.getIsRollbackable());
        }

        changeSet.rollback(userId, reason);
        ConfigChangeSet saved = changeSetRepository.save(changeSet);

        log.info("变更集已回滚: id={}, userId={}, reason={}", changeSetId, userId, reason);

        // 注意: 实际的配置回滚由调用方负责
        // 这里只更新变更集状态

        return saved;
    }

    @Override
    public List<ConfigChangeSet> getRollbackableChangeSets(String factoryId) {
        return changeSetRepository.findRollbackableChangeSets(factoryId);
    }

    // ========== 辅助方法 ==========

    @Override
    public boolean hasPendingChange(String configId) {
        return changeSetRepository.existsPendingChangeForConfig(configId);
    }

    @Override
    public Integer getCurrentVersion(String configId) {
        return changeSetRepository.findLatestAppliedVersion(configId).orElse(0);
    }

    @Override
    public Map<String, Long> getStatusStatistics(String factoryId, ConfigType configType) {
        List<Object[]> results = changeSetRepository.countByStatusAndConfigType(factoryId, configType);
        Map<String, Long> stats = new HashMap<>();

        for (Object[] row : results) {
            ChangeStatus status = (ChangeStatus) row[0];
            Long count = (Long) row[1];
            stats.put(status.name(), count);
        }

        return stats;
    }

    // ========== Dry-Run 预览 ==========

    @Override
    public Map<String, Object> dryRun(
            ConfigType configType,
            String configId,
            String configName,
            String beforeSnapshot,
            String afterSnapshot) {

        Map<String, Object> result = new HashMap<>();

        // 1. 计算版本号
        Integer currentVersion = getCurrentVersion(configId);
        Integer newVersion = currentVersion + 1;
        result.put("fromVersion", currentVersion);
        result.put("toVersion", newVersion);

        // 2. 检查是否有待处理的变更
        boolean hasPendingChange = hasPendingChange(configId);
        result.put("hasPendingChange", hasPendingChange);

        // 3. 计算差异
        String diffJson = computeDiff(beforeSnapshot, afterSnapshot);
        result.put("diffJson", diffJson);

        // 4. 解析差异为结构化对象 (便于前端展示)
        try {
            result.put("diff", objectMapper.readTree(diffJson));
        } catch (JsonProcessingException e) {
            log.warn("解析差异JSON失败: {}", e.getMessage());
            result.put("diff", diffJson);
        }

        // 5. 生成变更摘要
        String changeSummary = generateChangeSummary(diffJson, configType);
        result.put("changeSummary", changeSummary);

        // 6. 生成警告列表
        List<String> warnings = new ArrayList<>();

        if (hasPendingChange) {
            warnings.add("该配置存在待审批的变更，需先处理后才能创建新变更");
        }

        // 检查差异内容
        try {
            JsonNode diff = objectMapper.readTree(diffJson);

            int removedCount = diff.has("removed") ? diff.get("removed").size() : 0;
            if (removedCount > 0) {
                warnings.add("此变更将删除 " + removedCount + " 个配置项，请确认是否正确");
            }

            // 检查是否是空变更
            int addedCount = diff.has("added") ? diff.get("added").size() : 0;
            int modifiedCount = diff.has("modified") ? diff.get("modified").size() : 0;
            if (addedCount == 0 && removedCount == 0 && modifiedCount == 0) {
                warnings.add("未检测到任何变更，当前配置与提交内容相同");
            }

        } catch (JsonProcessingException e) {
            warnings.add("无法解析差异内容进行验证");
        }

        result.put("warnings", warnings);

        // 7. 其他元数据
        result.put("configType", configType);
        result.put("configTypeName", getConfigTypeName(configType));
        result.put("configId", configId);
        result.put("configName", configName);
        result.put("canCreate", !hasPendingChange && warnings.stream()
                .noneMatch(w -> w.contains("待审批")));

        log.debug("Dry-run 预览完成: configType={}, configId={}, warnings={}",
                configType, configId, warnings.size());

        return result;
    }
}
