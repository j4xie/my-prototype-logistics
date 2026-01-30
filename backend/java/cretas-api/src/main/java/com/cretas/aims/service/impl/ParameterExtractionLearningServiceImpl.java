package com.cretas.aims.service.impl;

import com.cretas.aims.entity.learning.ParameterExtractionRule;
import com.cretas.aims.repository.ParameterExtractionRuleRepository;
import com.cretas.aims.service.ParameterExtractionLearningService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 参数提取规则学习服务实现
 *
 * 核心功能：
 * 1. 使用已学习的规则提取参数（不调用 LLM）
 * 2. 从 LLM 提取结果中学习规则
 * 3. 用户确认后提升规则置信度
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-17
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParameterExtractionLearningServiceImpl implements ParameterExtractionLearningService {

    private final ParameterExtractionRuleRepository ruleRepository;

    /**
     * 最低置信度阈值，低于此值的规则不会被使用
     */
    @Value("${cretas.ai.parameter-extraction.min-confidence:0.80}")
    private double minConfidenceThreshold;

    /**
     * 是否启用参数提取规则学习
     */
    @Value("${cretas.ai.parameter-extraction.learning-enabled:true}")
    private boolean learningEnabled;

    // ==================== 常用关键词模式 ====================

    /**
     * "关键词+值" 模式的常见关键词
     * 如: 用户名zhangsan, 姓名张三, 密码123456
     */
    private static final Set<String> KEYWORD_AFTER_PATTERNS = Set.of(
            "用户名", "账号", "账户", "姓名", "名字", "真实姓名",
            "密码", "手机", "手机号", "电话", "邮箱", "地址",
            "编号", "批号", "批次号", "供应商", "数量", "重量",
            "产品名", "品名", "规格", "单位", "价格", "金额"
    );

    /**
     * "关键词为/是+值" 模式的常见关键词
     * 如: 角色为操作员, 状态是启用, 类型是原材料
     */
    private static final Set<String> KEYWORD_IS_PATTERNS = Set.of(
            "角色", "状态", "类型", "权限", "级别", "等级",
            "部门", "岗位", "职位", "分类", "品类"
    );

    /**
     * "为/是" 连接词
     */
    private static final Set<String> IS_CONNECTORS = Set.of("为", "是", "=", "：", ":");

    @Override
    @Transactional
    public Map<String, Object> extractWithLearnedRules(
            String factoryId, String intentCode, String userInput, List<String> requiredParams) {

        Map<String, Object> extractedParams = new HashMap<>();

        if (!learningEnabled || requiredParams == null || requiredParams.isEmpty()) {
            return extractedParams;
        }

        // 获取高置信度规则
        List<ParameterExtractionRule> rules = ruleRepository.findHighConfidenceRules(
                factoryId, intentCode, BigDecimal.valueOf(minConfidenceThreshold));

        if (rules.isEmpty()) {
            log.debug("意图 {} 没有高置信度的提取规则", intentCode);
            return extractedParams;
        }

        log.info("使用 {} 条学习规则尝试提取参数: {}", rules.size(), requiredParams);

        // 按参数名分组规则
        Map<String, List<ParameterExtractionRule>> rulesByParam = new HashMap<>();
        for (ParameterExtractionRule rule : rules) {
            rulesByParam.computeIfAbsent(rule.getParamName(), k -> new ArrayList<>()).add(rule);
        }

        // 尝试提取每个必需参数
        for (String paramName : requiredParams) {
            List<ParameterExtractionRule> paramRules = rulesByParam.get(paramName);
            if (paramRules == null || paramRules.isEmpty()) {
                continue;
            }

            // 按置信度排序，优先使用高置信度规则
            paramRules.sort((a, b) -> b.getConfidence().compareTo(a.getConfidence()));

            for (ParameterExtractionRule rule : paramRules) {
                String extractedValue = applyRule(rule, userInput);
                if (extractedValue != null && !extractedValue.isEmpty()) {
                    extractedParams.put(paramName, extractedValue);
                    // 记录规则命中
                    updateRuleSuccess(rule.getId());
                    log.info("规则提取成功: param={}, value={}, ruleId={}, pattern={}",
                            paramName, extractedValue, rule.getId(), rule.getPatternType());
                    break;
                }
            }
        }

        return extractedParams;
    }

    @Override
    @Transactional
    public void learnFromLLMExtraction(
            String factoryId, String intentCode, String userInput, Map<String, Object> extractedParams) {

        if (!learningEnabled || extractedParams == null || extractedParams.isEmpty()) {
            return;
        }

        log.info("开始从 LLM 提取结果学习规则: intent={}, params={}", intentCode, extractedParams.keySet());

        for (Map.Entry<String, Object> entry : extractedParams.entrySet()) {
            String paramName = entry.getKey();
            Object value = entry.getValue();

            if (value == null) {
                continue;
            }

            String valueStr = value.toString();
            if (valueStr.isEmpty()) {
                continue;
            }

            // 尝试推断提取规则
            ParameterExtractionRule rule = inferExtractionRule(
                    factoryId, intentCode, paramName, userInput, valueStr);

            if (rule != null) {
                // 检查是否已存在相同规则
                Optional<ParameterExtractionRule> existingRule = ruleRepository.findSimilarRule(
                        factoryId, intentCode, paramName, rule.getPatternType(), rule.getExtractionPattern());

                if (existingRule.isPresent()) {
                    // 更新现有规则的命中统计
                    ParameterExtractionRule existing = existingRule.get();
                    existing.recordHit();
                    ruleRepository.save(existing);
                    log.debug("更新现有规则: id={}, hitCount={}", existing.getId(), existing.getHitCount());
                } else {
                    // 保存新规则
                    ruleRepository.save(rule);
                    log.info("学习新规则: intent={}, param={}, pattern={}, keyword={}",
                            intentCode, paramName, rule.getPatternType(), rule.getExtractionPattern());
                }
            }
        }
    }

    @Override
    @Transactional
    public void confirmRules(List<String> ruleIds) {
        if (ruleIds == null || ruleIds.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        for (String ruleId : ruleIds) {
            ruleRepository.confirmRule(ruleId, now);
            log.info("确认规则: id={}", ruleId);
        }
    }

    @Override
    @Transactional
    public void learnAndConfirm(
            String factoryId, String intentCode, String userInput, Map<String, Object> confirmedParams) {

        if (!learningEnabled || confirmedParams == null || confirmedParams.isEmpty()) {
            return;
        }

        log.info("用户确认参数，学习规则: intent={}, params={}", intentCode, confirmedParams.keySet());

        List<String> learnedRuleIds = new ArrayList<>();

        for (Map.Entry<String, Object> entry : confirmedParams.entrySet()) {
            String paramName = entry.getKey();
            Object value = entry.getValue();

            if (value == null) {
                continue;
            }

            String valueStr = value.toString();
            if (valueStr.isEmpty()) {
                continue;
            }

            // 推断规则
            ParameterExtractionRule rule = inferExtractionRule(
                    factoryId, intentCode, paramName, userInput, valueStr);

            if (rule != null) {
                // 用户确认的规则置信度更高
                rule.setConfidence(new BigDecimal("0.95"));
                rule.setSourceType(ParameterExtractionRule.SourceType.USER_CONFIRMED);
                rule.setIsVerified(true);

                // 检查是否已存在相同规则
                Optional<ParameterExtractionRule> existingRule = ruleRepository.findSimilarRule(
                        factoryId, intentCode, paramName, rule.getPatternType(), rule.getExtractionPattern());

                if (existingRule.isPresent()) {
                    ParameterExtractionRule existing = existingRule.get();
                    existing.confirm();
                    existing.recordSuccess();
                    ruleRepository.save(existing);
                    learnedRuleIds.add(existing.getId());
                } else {
                    ruleRepository.save(rule);
                    learnedRuleIds.add(rule.getId());
                }

                log.info("用户确认规则: intent={}, param={}, pattern={}, keyword={}",
                        intentCode, paramName, rule.getPatternType(), rule.getExtractionPattern());
            }
        }
    }

    @Override
    public List<ParameterExtractionRule> getActiveRules(String factoryId, String intentCode) {
        return ruleRepository.findActiveRulesByFactoryAndIntent(factoryId, intentCode);
    }

    @Override
    @Transactional
    public void deleteRule(String ruleId) {
        ruleRepository.softDelete(ruleId, LocalDateTime.now());
        log.info("删除规则: id={}", ruleId);
    }

    @Override
    @Transactional
    public int cleanupLowSuccessRules(int minHitCount, double maxSuccessRate) {
        int count = ruleRepository.deactivateLowSuccessRules(minHitCount, maxSuccessRate);
        log.info("清理低成功率规则: 停用 {} 条", count);
        return count;
    }

    // ==================== 私有方法 ====================

    /**
     * 应用规则提取参数值
     */
    private String applyRule(ParameterExtractionRule rule, String userInput) {
        if (userInput == null || userInput.isEmpty()) {
            return null;
        }

        try {
            switch (rule.getPatternType()) {
                case KEYWORD_AFTER:
                    return extractKeywordAfter(rule.getExtractionPattern(), userInput);
                case KEYWORD_IS:
                    return extractKeywordIs(rule.getExtractionPattern(), userInput);
                case REGEX:
                    return extractWithRegex(rule.getExtractionPattern(), userInput);
                case POSITION:
                    return extractByPosition(rule.getExtractionPattern(), userInput);
                default:
                    return null;
            }
        } catch (Exception e) {
            log.warn("应用规则失败: ruleId={}, error={}", rule.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * KEYWORD_AFTER: 关键词后取值
     * 如: "用户名zhangsan" → zhangsan
     */
    private String extractKeywordAfter(String keyword, String userInput) {
        int idx = userInput.indexOf(keyword);
        if (idx == -1) {
            return null;
        }

        int startIdx = idx + keyword.length();
        if (startIdx >= userInput.length()) {
            return null;
        }

        // 提取关键词后的值，直到遇到分隔符
        StringBuilder value = new StringBuilder();
        for (int i = startIdx; i < userInput.length(); i++) {
            char c = userInput.charAt(i);
            // 遇到分隔符或空白停止
            if (c == ',' || c == '，' || c == ';' || c == '；' ||
                c == ' ' || c == '\t' || c == '\n') {
                break;
            }
            value.append(c);
        }

        String result = value.toString().trim();
        return result.isEmpty() ? null : result;
    }

    /**
     * KEYWORD_IS: "关键词为/是+值" 模式
     * 如: "角色为操作员" → 操作员
     */
    private String extractKeywordIs(String keyword, String userInput) {
        // 构建匹配模式: 关键词 + (为|是|=|：|:) + 值
        String patternStr = Pattern.quote(keyword) + "[为是=：:]\\s*([^,，;；\\s]+)";
        Pattern pattern = Pattern.compile(patternStr);
        Matcher matcher = pattern.matcher(userInput);

        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        return null;
    }

    /**
     * REGEX: 正则表达式提取
     */
    private String extractWithRegex(String regex, String userInput) {
        try {
            Pattern pattern = Pattern.compile(regex);
            Matcher matcher = pattern.matcher(userInput);

            if (matcher.find()) {
                // 如果有捕获组，返回第一个捕获组
                if (matcher.groupCount() > 0) {
                    return matcher.group(1);
                }
                // 否则返回整个匹配
                return matcher.group(0);
            }
        } catch (Exception e) {
            log.warn("正则提取失败: regex={}, error={}", regex, e.getMessage());
        }

        return null;
    }

    /**
     * POSITION: 位置提取
     * pattern 格式: "index,separator" 如 "2,,"
     */
    private String extractByPosition(String pattern, String userInput) {
        try {
            String[] parts = pattern.split(",", 2);
            int index = Integer.parseInt(parts[0]);
            String separator = parts.length > 1 ? parts[1] : ",";

            String[] values = userInput.split(separator);
            if (index >= 0 && index < values.length) {
                return values[index].trim();
            }
        } catch (Exception e) {
            log.warn("位置提取失败: pattern={}, error={}", pattern, e.getMessage());
        }

        return null;
    }

    /**
     * 从 LLM 提取结果推断提取规则
     */
    private ParameterExtractionRule inferExtractionRule(
            String factoryId, String intentCode, String paramName,
            String userInput, String extractedValue) {

        // 1. 尝试 KEYWORD_AFTER 模式
        ParameterExtractionRule keywordAfterRule = tryInferKeywordAfter(
                factoryId, intentCode, paramName, userInput, extractedValue);
        if (keywordAfterRule != null) {
            return keywordAfterRule;
        }

        // 2. 尝试 KEYWORD_IS 模式
        ParameterExtractionRule keywordIsRule = tryInferKeywordIs(
                factoryId, intentCode, paramName, userInput, extractedValue);
        if (keywordIsRule != null) {
            return keywordIsRule;
        }

        // 3. 如果值在输入中直接出现，尝试生成 REGEX 规则
        if (userInput.contains(extractedValue)) {
            return tryInferRegex(factoryId, intentCode, paramName, userInput, extractedValue);
        }

        return null;
    }

    /**
     * 尝试推断 KEYWORD_AFTER 规则
     */
    private ParameterExtractionRule tryInferKeywordAfter(
            String factoryId, String intentCode, String paramName,
            String userInput, String extractedValue) {

        // 查找值在输入中的位置
        int valueIdx = userInput.indexOf(extractedValue);
        if (valueIdx <= 0) {
            return null;
        }

        // 检查值前面是否是已知的关键词
        for (String keyword : KEYWORD_AFTER_PATTERNS) {
            int keywordIdx = userInput.indexOf(keyword);
            if (keywordIdx != -1 && keywordIdx + keyword.length() == valueIdx) {
                return ParameterExtractionRule.createKeywordAfterRule(
                        factoryId, intentCode, paramName,
                        keyword, userInput, extractedValue);
            }
        }

        // 尝试从参数名推断关键词 (如 paramName=username → 用户名)
        String inferredKeyword = inferKeywordFromParamName(paramName);
        if (inferredKeyword != null) {
            int keywordIdx = userInput.indexOf(inferredKeyword);
            if (keywordIdx != -1 && keywordIdx + inferredKeyword.length() == valueIdx) {
                return ParameterExtractionRule.createKeywordAfterRule(
                        factoryId, intentCode, paramName,
                        inferredKeyword, userInput, extractedValue);
            }
        }

        // 尝试提取值前面的字符作为关键词 (最多10个字符)
        int keywordStartIdx = Math.max(0, valueIdx - 10);
        String potentialKeyword = userInput.substring(keywordStartIdx, valueIdx).trim();

        // 检查是否是有效的关键词（至少2个字符，不包含标点）
        if (potentialKeyword.length() >= 2 && potentialKeyword.matches("^[\\u4e00-\\u9fa5a-zA-Z]+$")) {
            // 提取最后的连续中文或英文作为关键词
            Matcher matcher = Pattern.compile("([\\u4e00-\\u9fa5a-zA-Z]+)$").matcher(potentialKeyword);
            if (matcher.find()) {
                String keyword = matcher.group(1);
                if (keyword.length() >= 2) {
                    return ParameterExtractionRule.createKeywordAfterRule(
                            factoryId, intentCode, paramName,
                            keyword, userInput, extractedValue);
                }
            }
        }

        return null;
    }

    /**
     * 尝试推断 KEYWORD_IS 规则
     */
    private ParameterExtractionRule tryInferKeywordIs(
            String factoryId, String intentCode, String paramName,
            String userInput, String extractedValue) {

        for (String keyword : KEYWORD_IS_PATTERNS) {
            for (String connector : IS_CONNECTORS) {
                String pattern = keyword + connector;
                int idx = userInput.indexOf(pattern);
                if (idx != -1) {
                    // 检查模式后面是否是提取的值
                    int valueStartIdx = idx + pattern.length();
                    while (valueStartIdx < userInput.length() &&
                           Character.isWhitespace(userInput.charAt(valueStartIdx))) {
                        valueStartIdx++;
                    }

                    if (userInput.indexOf(extractedValue, valueStartIdx) == valueStartIdx) {
                        return ParameterExtractionRule.createKeywordIsRule(
                                factoryId, intentCode, paramName,
                                keyword, userInput, extractedValue);
                    }
                }
            }
        }

        // 尝试从参数名推断关键词
        String inferredKeyword = inferKeywordFromParamName(paramName);
        if (inferredKeyword != null) {
            for (String connector : IS_CONNECTORS) {
                String pattern = inferredKeyword + connector;
                int idx = userInput.indexOf(pattern);
                if (idx != -1) {
                    int valueStartIdx = idx + pattern.length();
                    while (valueStartIdx < userInput.length() &&
                           Character.isWhitespace(userInput.charAt(valueStartIdx))) {
                        valueStartIdx++;
                    }

                    if (userInput.indexOf(extractedValue, valueStartIdx) == valueStartIdx) {
                        return ParameterExtractionRule.createKeywordIsRule(
                                factoryId, intentCode, paramName,
                                inferredKeyword, userInput, extractedValue);
                    }
                }
            }
        }

        return null;
    }

    /**
     * 尝试推断 REGEX 规则
     */
    private ParameterExtractionRule tryInferRegex(
            String factoryId, String intentCode, String paramName,
            String userInput, String extractedValue) {

        // 简单规则：直接匹配值
        // 更复杂的规则可以后续扩展
        String escapedValue = Pattern.quote(extractedValue);

        return ParameterExtractionRule.createRegexRule(
                factoryId, intentCode, paramName,
                escapedValue, userInput, extractedValue);
    }

    /**
     * 从参数名推断中文关键词
     */
    private String inferKeywordFromParamName(String paramName) {
        if (paramName == null) {
            return null;
        }

        // 常见参数名到中文关键词的映射
        Map<String, String> paramToKeyword = Map.ofEntries(
                Map.entry("username", "用户名"),
                Map.entry("account", "账号"),
                Map.entry("realName", "姓名"),
                Map.entry("name", "名称"),
                Map.entry("password", "密码"),
                Map.entry("phone", "手机"),
                Map.entry("mobile", "手机号"),
                Map.entry("email", "邮箱"),
                Map.entry("address", "地址"),
                Map.entry("role", "角色"),
                Map.entry("department", "部门"),
                Map.entry("status", "状态"),
                Map.entry("type", "类型"),
                Map.entry("quantity", "数量"),
                Map.entry("weight", "重量"),
                Map.entry("price", "价格"),
                Map.entry("amount", "金额"),
                Map.entry("batchNumber", "批号"),
                Map.entry("batchId", "批次"),
                Map.entry("supplierId", "供应商"),
                Map.entry("supplier", "供应商"),
                Map.entry("productName", "产品名"),
                Map.entry("spec", "规格"),
                Map.entry("unit", "单位")
        );

        return paramToKeyword.get(paramName);
    }

    /**
     * 更新规则成功统计
     * 注意：此方法由外层带有 @Transactional 的方法调用，事务由外层管理
     */
    private void updateRuleSuccess(String ruleId) {
        ruleRepository.incrementSuccessCount(ruleId, LocalDateTime.now());
    }
}
