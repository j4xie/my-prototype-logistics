package com.cretas.aims.service.impl;

import com.cretas.aims.dto.pack.*;
import com.cretas.aims.entity.rules.DroolsRule;
import com.cretas.aims.repository.DroolsRuleRepository;
import com.cretas.aims.service.RulePackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 规则包服务实现
 *
 * Sprint 3 任务:
 * - S3-4: 规则包导出
 * - S3-5: 规则包导入
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RulePackServiceImpl implements RulePackService {

    private final DroolsRuleRepository droolsRuleRepository;

    @Override
    public RulePackDTO exportRulePack(ExportRulePackRequest request) {
        log.info("导出规则包, 工厂: {}, 包名: {}", request.getFactoryId(), request.getPackName());

        String factoryId = request.getFactoryId();
        List<DroolsRule> rules;

        // 获取规则列表
        if (request.getRuleIds() != null && !request.getRuleIds().isEmpty()) {
            // 导出指定ID的规则
            rules = droolsRuleRepository.findAllById(request.getRuleIds())
                    .stream()
                    .filter(r -> factoryId.equals(r.getFactoryId()))
                    .collect(Collectors.toList());
        } else if (Boolean.TRUE.equals(request.getEnabledOnly())) {
            // 导出所有启用的规则
            rules = droolsRuleRepository.findByFactoryIdAndEnabledTrue(factoryId);
        } else {
            // 导出工厂所有规则
            rules = droolsRuleRepository.findAllEnabledByFactoryIdOrderByPriority(factoryId);
        }

        // 按规则组过滤
        if (request.getRuleGroups() != null && !request.getRuleGroups().isEmpty()) {
            Set<String> ruleGroupSet = new HashSet<>(request.getRuleGroups());
            rules = rules.stream()
                    .filter(r -> ruleGroupSet.contains(r.getRuleGroup()))
                    .collect(Collectors.toList());
        }

        // 构建规则包
        String packId = "RPACK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        List<RulePackDTO.RuleItemDTO> ruleItems = rules.stream()
                .map(this::convertToRuleItem)
                .collect(Collectors.toList());

        RulePackDTO pack = RulePackDTO.builder()
                .packId(packId)
                .packName(request.getPackName())
                .description(request.getDescription())
                .sourceFactoryId(factoryId)
                .version("1.0.0")
                .industryType(request.getIndustryType())
                .exportedAt(LocalDateTime.now())
                .exportedBy(request.getExportedBy())
                .rules(ruleItems)
                .build();

        log.info("成功导出 {} 条规则到包 {}", rules.size(), packId);
        return pack;
    }

    @Override
    @Transactional
    public ImportRulePackResult importRulePack(ImportRulePackRequest request) {
        log.info("导入规则包, 目标工厂: {}, 包: {}",
                request.getTargetFactoryId(), request.getPack().getPackName());

        return doImport(request, false);
    }

    @Override
    public ImportRulePackResult previewImport(ImportRulePackRequest request) {
        log.info("预览导入规则包, 目标工厂: {}, 包: {}",
                request.getTargetFactoryId(), request.getPack().getPackName());

        request.setPreview(true);
        return doImport(request, true);
    }

    @Override
    public String validatePack(RulePackDTO pack) {
        if (pack == null) {
            return "规则包不能为空";
        }
        if (pack.getPackId() == null || pack.getPackId().isEmpty()) {
            return "规则包ID不能为空";
        }
        if (pack.getPackName() == null || pack.getPackName().isEmpty()) {
            return "规则包名称不能为空";
        }
        if (pack.getRules() == null || pack.getRules().isEmpty()) {
            return "规则包内容不能为空";
        }

        // 验证每条规则
        for (RulePackDTO.RuleItemDTO item : pack.getRules()) {
            if (item.getRuleGroup() == null || item.getRuleGroup().isEmpty()) {
                return "规则组不能为空";
            }
            if (item.getRuleName() == null || item.getRuleName().isEmpty()) {
                return "规则名称不能为空";
            }
            if (item.getRuleContent() == null || item.getRuleContent().isEmpty()) {
                return "规则内容不能为空";
            }
        }

        return null; // 验证通过
    }

    /**
     * 执行导入
     */
    private ImportRulePackResult doImport(ImportRulePackRequest request, boolean isPreview) {
        RulePackDTO pack = request.getPack();
        String targetFactoryId = request.getTargetFactoryId();
        ImportRulePackRequest.ConflictStrategy strategy = request.getConflictStrategy();

        // 验证规则包
        String validationError = validatePack(pack);
        if (validationError != null) {
            return ImportRulePackResult.builder()
                    .success(false)
                    .isPreview(isPreview)
                    .targetFactoryId(targetFactoryId)
                    .packId(pack.getPackId())
                    .packName(pack.getPackName())
                    .summary("验证失败: " + validationError)
                    .errors(Collections.singletonList(validationError))
                    .build();
        }

        ImportRulePackResult result = ImportRulePackResult.builder()
                .success(true)
                .isPreview(isPreview)
                .targetFactoryId(targetFactoryId)
                .packId(pack.getPackId())
                .packName(pack.getPackName())
                .importedAt(LocalDateTime.now())
                .importedCount(0)
                .skippedCount(0)
                .overwrittenCount(0)
                .failedCount(0)
                .details(new ArrayList<>())
                .errors(new ArrayList<>())
                .build();

        // 获取目标工厂现有规则 (用于冲突检测)
        // 使用 ruleGroup + ruleName 作为唯一键
        Map<String, DroolsRule> existingRules = droolsRuleRepository
                .findByFactoryIdAndEnabledTrue(targetFactoryId)
                .stream()
                .collect(Collectors.toMap(
                        r -> r.getRuleGroup() + ":" + r.getRuleName(),
                        r -> r,
                        (a, b) -> a // 如果有重复，保留第一个
                ));

        // 处理每条规则
        for (RulePackDTO.RuleItemDTO item : pack.getRules()) {
            try {
                processRuleItem(item, targetFactoryId, strategy, existingRules,
                        result, request.getImportedBy(), pack.getPackId(),
                        request.getEnableImported(), isPreview);
            } catch (Exception e) {
                log.error("导入规则失败: {}", item.getRuleName(), e);
                result.addDetail(ImportRulePackResult.ImportItemDetail.builder()
                        .originalId(item.getOriginalId())
                        .ruleGroup(item.getRuleGroup())
                        .ruleName(item.getRuleName())
                        .status(ImportRulePackResult.ImportStatus.FAILED)
                        .note("导入失败: " + e.getMessage())
                        .build());
                result.setFailedCount(result.getFailedCount() + 1);
                result.addError("规则 " + item.getRuleName() + " 导入失败: " + e.getMessage());
            }
        }

        // 生成摘要
        result.setSummary(String.format(
                "%s导入规则包 '%s' 到工厂 %s。导入: %d, 跳过: %d, 覆盖: %d, 失败: %d",
                isPreview ? "[预览] " : "",
                pack.getPackName(),
                targetFactoryId,
                result.getImportedCount(),
                result.getSkippedCount(),
                result.getOverwrittenCount(),
                result.getFailedCount()
        ));

        result.setSuccess(result.getFailedCount() == 0);

        return result;
    }

    /**
     * 处理单个规则项
     */
    private void processRuleItem(
            RulePackDTO.RuleItemDTO item,
            String targetFactoryId,
            ImportRulePackRequest.ConflictStrategy strategy,
            Map<String, DroolsRule> existingRules,
            ImportRulePackResult result,
            Long importedBy,
            String packId,
            Boolean enableImported,
            boolean isPreview
    ) {
        String key = item.getRuleGroup() + ":" + item.getRuleName();
        DroolsRule existing = existingRules.get(key);

        ImportRulePackResult.ImportItemDetail detail = ImportRulePackResult.ImportItemDetail.builder()
                .originalId(item.getOriginalId())
                .ruleGroup(item.getRuleGroup())
                .ruleName(item.getRuleName())
                .build();

        if (existing != null) {
            // 存在冲突
            switch (strategy) {
                case SKIP:
                    detail.setStatus(ImportRulePackResult.ImportStatus.SKIPPED);
                    detail.setNote("已存在同名同组规则，已跳过");
                    result.setSkippedCount(result.getSkippedCount() + 1);
                    break;

                case OVERWRITE:
                    if (!isPreview) {
                        updateExistingRule(existing, item, importedBy);
                        droolsRuleRepository.save(existing);
                    }
                    detail.setStatus(ImportRulePackResult.ImportStatus.OVERWRITTEN);
                    detail.setNewRuleId(existing.getId());
                    detail.setNote("已覆盖现有规则");
                    result.setOverwrittenCount(result.getOverwrittenCount() + 1);
                    break;

                case RENAME:
                    String newName = generateUniqueName(item.getRuleName(), existingRules.keySet(), item.getRuleGroup());
                    if (!isPreview) {
                        DroolsRule newRule = createNewRule(item, targetFactoryId, importedBy, enableImported);
                        newRule.setRuleName(newName);
                        DroolsRule saved = droolsRuleRepository.save(newRule);
                        detail.setNewRuleId(saved.getId());
                    }
                    detail.setStatus(ImportRulePackResult.ImportStatus.IMPORTED);
                    detail.setNote("已重命名为: " + newName);
                    result.setImportedCount(result.getImportedCount() + 1);
                    break;
            }
        } else {
            // 无冲突，直接导入
            if (!isPreview) {
                DroolsRule newRule = createNewRule(item, targetFactoryId, importedBy, enableImported);
                DroolsRule saved = droolsRuleRepository.save(newRule);
                detail.setNewRuleId(saved.getId());
            }
            detail.setStatus(ImportRulePackResult.ImportStatus.IMPORTED);
            detail.setNote("成功导入");
            result.setImportedCount(result.getImportedCount() + 1);
        }

        result.addDetail(detail);
    }

    /**
     * 转换为规则项DTO
     */
    private RulePackDTO.RuleItemDTO convertToRuleItem(DroolsRule rule) {
        String decisionTableBase64 = null;
        if (rule.getDecisionTable() != null && rule.getDecisionTable().length > 0) {
            decisionTableBase64 = Base64.getEncoder().encodeToString(rule.getDecisionTable());
        }

        return RulePackDTO.RuleItemDTO.builder()
                .originalId(rule.getId())
                .ruleGroup(rule.getRuleGroup())
                .ruleName(rule.getRuleName())
                .ruleDescription(rule.getRuleDescription())
                .ruleContent(rule.getRuleContent())
                .decisionTableBase64(decisionTableBase64)
                .decisionTableType(rule.getDecisionTableType())
                .version(rule.getVersion())
                .priority(rule.getPriority())
                .enabled(rule.getEnabled())
                .build();
    }

    /**
     * 创建新规则
     */
    private DroolsRule createNewRule(
            RulePackDTO.RuleItemDTO item,
            String targetFactoryId,
            Long importedBy,
            Boolean enableImported
    ) {
        byte[] decisionTable = null;
        if (item.getDecisionTableBase64() != null && !item.getDecisionTableBase64().isEmpty()) {
            decisionTable = Base64.getDecoder().decode(item.getDecisionTableBase64());
        }

        return DroolsRule.builder()
                .id(UUID.randomUUID().toString())
                .factoryId(targetFactoryId)
                .ruleGroup(item.getRuleGroup())
                .ruleName(item.getRuleName())
                .ruleDescription(item.getRuleDescription())
                .ruleContent(item.getRuleContent())
                .decisionTable(decisionTable)
                .decisionTableType(item.getDecisionTableType())
                .version(1)
                .priority(item.getPriority() != null ? item.getPriority() : 0)
                .enabled(Boolean.TRUE.equals(enableImported))
                .createdBy(importedBy)
                .build();
    }

    /**
     * 更新现有规则
     */
    private void updateExistingRule(
            DroolsRule existing,
            RulePackDTO.RuleItemDTO item,
            Long importedBy
    ) {
        existing.setRuleDescription(item.getRuleDescription());
        existing.setRuleContent(item.getRuleContent());
        existing.setPriority(item.getPriority() != null ? item.getPriority() : existing.getPriority());

        if (item.getDecisionTableBase64() != null && !item.getDecisionTableBase64().isEmpty()) {
            existing.setDecisionTable(Base64.getDecoder().decode(item.getDecisionTableBase64()));
            existing.setDecisionTableType(item.getDecisionTableType());
        }

        existing.setVersion(existing.getVersion() + 1);
        existing.setUpdatedBy(importedBy);
    }

    /**
     * 生成唯一名称
     */
    private String generateUniqueName(String originalName, Set<String> existingKeys, String ruleGroup) {
        int suffix = 2;
        String newName = originalName + "_imported";
        String key = ruleGroup + ":" + newName;

        while (existingKeys.contains(key)) {
            newName = originalName + "_imported_" + suffix;
            key = ruleGroup + ":" + newName;
            suffix++;
        }

        return newName;
    }
}
