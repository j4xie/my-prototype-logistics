package com.cretas.aims.service.impl;

import com.cretas.aims.entity.config.EncodingRule;
import com.cretas.aims.repository.EncodingRuleRepository;
import com.cretas.aims.service.EncodingRuleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 编码规则服务实现
 *
 * 支持的占位符:
 * - {PREFIX} - 固定前缀
 * - {FACTORY} - 工厂代码
 * - {YYYY} - 4位年份
 * - {YY} - 2位年份
 * - {MM} - 2位月份
 * - {DD} - 2位日期
 * - {SEQ:N} - N位序列号（自动补零）
 * - {DEPT} - 部门代码（需上下文提供）
 * - {TYPE} - 类型代码（需上下文提供）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-29
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EncodingRuleServiceImpl implements EncodingRuleService {

    private final EncodingRuleRepository encodingRuleRepository;

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{([^}]+)\\}");
    private static final Pattern SEQ_PATTERN = Pattern.compile("SEQ:(\\d+)");

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateCode(String factoryId, String entityType) {
        return generateCode(factoryId, entityType, Collections.emptyMap());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateCode(String factoryId, String entityType, Map<String, String> context) {
        log.debug("生成编码 - factoryId={}, entityType={}", factoryId, entityType);

        Optional<EncodingRule> ruleOpt = encodingRuleRepository.findActiveByFactoryIdAndEntityType(factoryId, entityType);
        if (ruleOpt.isEmpty()) {
            // 没有配置规则，使用默认格式
            return generateDefaultCode(factoryId, entityType);
        }

        EncodingRule rule = ruleOpt.get();

        // 检查是否需要重置序列号
        checkAndResetSequence(rule);

        // 递增序列号
        encodingRuleRepository.incrementSequence(rule.getId());

        // 重新加载获取最新序列号
        rule = encodingRuleRepository.findById(rule.getId()).orElse(rule);

        // 生成编码
        return buildCode(rule, factoryId, context);
    }

    @Override
    public String previewCode(String factoryId, String entityType) {
        log.debug("预览编码 - factoryId={}, entityType={}", factoryId, entityType);

        Optional<EncodingRule> ruleOpt = encodingRuleRepository.findActiveByFactoryIdAndEntityType(factoryId, entityType);
        if (ruleOpt.isEmpty()) {
            return generateDefaultCode(factoryId, entityType);
        }

        EncodingRule rule = ruleOpt.get();
        Long nextSeq = (rule.getCurrentSequence() == null ? 0L : rule.getCurrentSequence()) + 1;

        // 临时设置预览序号
        rule.setCurrentSequence(nextSeq);
        return buildCode(rule, factoryId, Collections.emptyMap());
    }

    @Override
    public Optional<EncodingRule> getRule(String ruleId) {
        return encodingRuleRepository.findById(ruleId);
    }

    @Override
    public Optional<EncodingRule> getRule(String factoryId, String entityType) {
        return encodingRuleRepository.findActiveByFactoryIdAndEntityType(factoryId, entityType);
    }

    @Override
    public List<EncodingRule> getRules(String factoryId) {
        return encodingRuleRepository.findByFactoryIdAndEnabledTrue(factoryId);
    }

    @Override
    public Page<EncodingRule> getRules(String factoryId, Pageable pageable) {
        return encodingRuleRepository.findByFactoryId(factoryId, pageable);
    }

    @Override
    public List<EncodingRule> getSystemDefaultRules() {
        return encodingRuleRepository.findByFactoryIdIsNullAndEnabledTrue();
    }

    @Override
    @Transactional
    public EncodingRule createRule(EncodingRule rule, Long userId) {
        log.info("创建编码规则 - factoryId={}, entityType={}, ruleName={}",
                rule.getFactoryId(), rule.getEntityType(), rule.getRuleName());

        // 检查是否已存在
        if (encodingRuleRepository.existsByFactoryIdAndEntityType(rule.getFactoryId(), rule.getEntityType())) {
            throw new IllegalArgumentException("该实体类型的编码规则已存在");
        }

        // 验证模板格式
        Map<String, Object> validation = validatePattern(rule.getEncodingPattern());
        if (!(Boolean) validation.get("isValid")) {
            throw new IllegalArgumentException("编码模板格式错误: " + validation.get("errors"));
        }

        rule.setId(UUID.randomUUID().toString());
        rule.setCurrentSequence(0L);
        rule.setVersion(1);
        rule.setEnabled(true);
        rule.setCreatedBy(userId);

        return encodingRuleRepository.save(rule);
    }

    @Override
    @Transactional
    public EncodingRule updateRule(String ruleId, EncodingRule updatedRule, Long userId) {
        log.info("更新编码规则 - ruleId={}", ruleId);

        EncodingRule rule = encodingRuleRepository.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("编码规则不存在"));

        // 验证模板格式
        if (updatedRule.getEncodingPattern() != null) {
            Map<String, Object> validation = validatePattern(updatedRule.getEncodingPattern());
            if (!(Boolean) validation.get("isValid")) {
                throw new IllegalArgumentException("编码模板格式错误: " + validation.get("errors"));
            }
            rule.setEncodingPattern(updatedRule.getEncodingPattern());
        }

        if (updatedRule.getRuleName() != null) {
            rule.setRuleName(updatedRule.getRuleName());
        }
        if (updatedRule.getRuleDescription() != null) {
            rule.setRuleDescription(updatedRule.getRuleDescription());
        }
        if (updatedRule.getPrefix() != null) {
            rule.setPrefix(updatedRule.getPrefix());
        }
        if (updatedRule.getDateFormat() != null) {
            rule.setDateFormat(updatedRule.getDateFormat());
        }
        if (updatedRule.getSequenceLength() != null) {
            rule.setSequenceLength(updatedRule.getSequenceLength());
        }
        if (updatedRule.getResetCycle() != null) {
            rule.setResetCycle(updatedRule.getResetCycle());
        }
        if (updatedRule.getSeparator() != null) {
            rule.setSeparator(updatedRule.getSeparator());
        }
        if (updatedRule.getIncludeFactoryCode() != null) {
            rule.setIncludeFactoryCode(updatedRule.getIncludeFactoryCode());
        }

        rule.incrementVersion();
        return encodingRuleRepository.save(rule);
    }

    @Override
    @Transactional
    public EncodingRule toggleEnabled(String ruleId, boolean enabled) {
        log.info("切换编码规则状态 - ruleId={}, enabled={}", ruleId, enabled);

        EncodingRule rule = encodingRuleRepository.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("编码规则不存在"));

        rule.setEnabled(enabled);
        return encodingRuleRepository.save(rule);
    }

    @Override
    @Transactional
    public void deleteRule(String ruleId) {
        log.info("删除编码规则 - ruleId={}", ruleId);

        EncodingRule rule = encodingRuleRepository.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("编码规则不存在"));

        rule.softDelete();
        encodingRuleRepository.save(rule);
    }

    @Override
    @Transactional
    public void resetSequence(String ruleId) {
        log.info("重置编码规则序列号 - ruleId={}", ruleId);

        String today = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        encodingRuleRepository.resetSequence(ruleId, today);
    }

    @Override
    public Map<String, Object> validatePattern(String pattern) {
        Map<String, Object> result = new HashMap<>();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (pattern == null || pattern.isEmpty()) {
            errors.add("编码模板不能为空");
            result.put("isValid", false);
            result.put("errors", errors);
            return result;
        }

        Matcher matcher = PLACEHOLDER_PATTERN.matcher(pattern);
        Set<String> validPlaceholders = Set.of(
            "PREFIX", "FACTORY", "YYYY", "YY", "MM", "DD",
            "DEPT", "TYPE", "PRODUCT", "LINE"
        );

        boolean hasSeq = false;
        while (matcher.find()) {
            String placeholder = matcher.group(1);

            // 检查 SEQ:N 格式
            if (placeholder.startsWith("SEQ:")) {
                Matcher seqMatcher = SEQ_PATTERN.matcher(placeholder);
                if (!seqMatcher.matches()) {
                    errors.add("序列号格式错误: " + placeholder + "，应为 SEQ:N（N为位数）");
                } else {
                    int length = Integer.parseInt(seqMatcher.group(1));
                    if (length < 1 || length > 10) {
                        warnings.add("序列号位数建议在1-10之间");
                    }
                    hasSeq = true;
                }
            } else if (!validPlaceholders.contains(placeholder)) {
                warnings.add("未知占位符: " + placeholder);
            }
        }

        if (!hasSeq) {
            warnings.add("模板中没有序列号占位符 {SEQ:N}，编码可能重复");
        }

        result.put("isValid", errors.isEmpty());
        result.put("errors", errors);
        result.put("warnings", warnings);
        result.put("pattern", pattern);

        return result;
    }

    @Override
    public List<Map<String, String>> getSupportedPlaceholders() {
        List<Map<String, String>> placeholders = new ArrayList<>();

        placeholders.add(Map.of(
            "placeholder", "{PREFIX}",
            "description", "固定前缀，如 MB、PB、SH",
            "example", "MB"
        ));
        placeholders.add(Map.of(
            "placeholder", "{FACTORY}",
            "description", "工厂代码",
            "example", "F001"
        ));
        placeholders.add(Map.of(
            "placeholder", "{YYYY}",
            "description", "4位年份",
            "example", "2025"
        ));
        placeholders.add(Map.of(
            "placeholder", "{YY}",
            "description", "2位年份",
            "example", "25"
        ));
        placeholders.add(Map.of(
            "placeholder", "{MM}",
            "description", "2位月份",
            "example", "12"
        ));
        placeholders.add(Map.of(
            "placeholder", "{DD}",
            "description", "2位日期",
            "example", "29"
        ));
        placeholders.add(Map.of(
            "placeholder", "{SEQ:N}",
            "description", "N位序列号，自动补零",
            "example", "{SEQ:4} → 0001"
        ));
        placeholders.add(Map.of(
            "placeholder", "{DEPT}",
            "description", "部门代码（需上下文提供）",
            "example", "D01"
        ));
        placeholders.add(Map.of(
            "placeholder", "{TYPE}",
            "description", "类型代码（需上下文提供）",
            "example", "A"
        ));
        placeholders.add(Map.of(
            "placeholder", "{PRODUCT}",
            "description", "产品代码（需上下文提供）",
            "example", "P001"
        ));
        placeholders.add(Map.of(
            "placeholder", "{LINE}",
            "description", "生产线代码（需上下文提供）",
            "example", "L1"
        ));

        return placeholders;
    }

    @Override
    public Map<String, Object> getStatistics(String factoryId) {
        Map<String, Object> stats = new HashMap<>();

        long totalRules = encodingRuleRepository.countByFactoryIdAndEnabledTrue(factoryId);
        List<EncodingRule> rules = encodingRuleRepository.findByFactoryIdAndEnabledTrue(factoryId);

        Map<String, Long> rulesByEntityType = new HashMap<>();
        for (EncodingRule rule : rules) {
            rulesByEntityType.put(rule.getEntityType(), rule.getCurrentSequence());
        }

        stats.put("totalRules", totalRules);
        stats.put("rulesByEntityType", rulesByEntityType);
        stats.put("systemDefaultRules", encodingRuleRepository.findByFactoryIdIsNullAndEnabledTrue().size());

        return stats;
    }

    // ==================== 私有方法 ====================

    private String generateDefaultCode(String factoryId, String entityType) {
        // 默认格式: {ENTITY_PREFIX}-{FACTORY}-{YYYYMMDD}-{SEQ:4}
        String prefix = getDefaultPrefix(entityType);
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String seq = String.format("%04d", System.currentTimeMillis() % 10000);

        return prefix + "-" + factoryId + "-" + date + "-" + seq;
    }

    private String getDefaultPrefix(String entityType) {
        return switch (entityType.toUpperCase()) {
            case "MATERIAL_BATCH" -> "MB";
            case "PROCESSING_BATCH" -> "PB";
            case "SHIPMENT" -> "SH";
            case "QUALITY_INSPECTION" -> "QI";
            case "DISPOSAL_RECORD" -> "DR";
            case "EQUIPMENT" -> "EQ";
            case "PRODUCTION_PLAN" -> "PP";
            default -> entityType.substring(0, Math.min(2, entityType.length())).toUpperCase();
        };
    }

    private void checkAndResetSequence(EncodingRule rule) {
        String today = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String lastReset = rule.getLastResetDate();
        String resetCycle = rule.getResetCycle();

        if (resetCycle == null || "NEVER".equals(resetCycle)) {
            return;
        }

        boolean shouldReset = false;

        if (lastReset == null) {
            shouldReset = true;
        } else {
            switch (resetCycle) {
                case "DAILY" -> shouldReset = !today.equals(lastReset);
                case "MONTHLY" -> shouldReset = !today.substring(0, 6).equals(lastReset.substring(0, 6));
                case "YEARLY" -> shouldReset = !today.substring(0, 4).equals(lastReset.substring(0, 4));
            }
        }

        if (shouldReset) {
            encodingRuleRepository.resetSequence(rule.getId(), today);
            rule.setCurrentSequence(0L);
            rule.setLastResetDate(today);
        }
    }

    private String buildCode(EncodingRule rule, String factoryId, Map<String, String> context) {
        String pattern = rule.getEncodingPattern();
        LocalDate now = LocalDate.now();

        // 替换占位符
        String code = pattern
            .replace("{PREFIX}", rule.getPrefix() != null ? rule.getPrefix() : "")
            .replace("{FACTORY}", factoryId != null ? factoryId : "")
            .replace("{YYYY}", String.valueOf(now.getYear()))
            .replace("{YY}", String.valueOf(now.getYear()).substring(2))
            .replace("{MM}", String.format("%02d", now.getMonthValue()))
            .replace("{DD}", String.format("%02d", now.getDayOfMonth()));

        // 替换上下文变量
        for (Map.Entry<String, String> entry : context.entrySet()) {
            code = code.replace("{" + entry.getKey().toUpperCase() + "}", entry.getValue());
        }

        // 替换序列号
        Matcher seqMatcher = Pattern.compile("\\{SEQ:(\\d+)\\}").matcher(code);
        if (seqMatcher.find()) {
            int length = Integer.parseInt(seqMatcher.group(1));
            String seq = String.format("%0" + length + "d", rule.getCurrentSequence());
            code = seqMatcher.replaceFirst(seq);
        }

        return code;
    }
}
