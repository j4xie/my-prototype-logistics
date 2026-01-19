package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import com.cretas.aims.repository.calibration.CorrectionRecordRepository;
import com.cretas.aims.service.calibration.SelfCorrectionService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/**
 * 自我纠错服务实现
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准系统
 *
 * 核心实现:
 * 1. 错误分类 - 使用关键词匹配和模式识别进行错误分类
 * 2. 恢复策略 - 根据错误类型确定最佳恢复策略
 * 3. 纠错记录 - 使用数据库追踪纠错尝试和结果
 * 4. 部分重试 - 支持 RE_RETRIEVE, RE_ANALYZE, FORMAT_FIX 等部分重试策略
 * 5. 轮次限制 - 最多3轮纠错，超过后放弃重试
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SelfCorrectionServiceImpl implements SelfCorrectionService {

    private final CorrectionRecordRepository correctionRecordRepository;

    // ==================== 错误分类关键词映射 ====================

    /**
     * DATA_INSUFFICIENT 错误关键词
     */
    private static final List<Pattern> DATA_INSUFFICIENT_PATTERNS = Arrays.asList(
            Pattern.compile("数据不完整", Pattern.CASE_INSENSITIVE),
            Pattern.compile("信息不足", Pattern.CASE_INSENSITIVE),
            Pattern.compile("未找到.*数据", Pattern.CASE_INSENSITIVE),
            Pattern.compile("数据为空", Pattern.CASE_INSENSITIVE),
            Pattern.compile("没有.*记录", Pattern.CASE_INSENSITIVE),
            Pattern.compile("缺少.*信息", Pattern.CASE_INSENSITIVE),
            Pattern.compile("缺少.*参数", Pattern.CASE_INSENSITIVE),
            Pattern.compile("insufficient.*data", Pattern.CASE_INSENSITIVE),
            Pattern.compile("data.*not.*found", Pattern.CASE_INSENSITIVE),
            Pattern.compile("no.*results?", Pattern.CASE_INSENSITIVE),
            Pattern.compile("empty.*result", Pattern.CASE_INSENSITIVE),
            Pattern.compile("missing.*information", Pattern.CASE_INSENSITIVE),
            Pattern.compile("需要更多信息", Pattern.CASE_INSENSITIVE),
            Pattern.compile("参数不完整", Pattern.CASE_INSENSITIVE),
            Pattern.compile("检索失败", Pattern.CASE_INSENSITIVE)
    );

    /**
     * ANALYSIS_ERROR 错误关键词
     */
    private static final List<Pattern> ANALYSIS_ERROR_PATTERNS = Arrays.asList(
            Pattern.compile("分析错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("计算错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("统计失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("结果异常", Pattern.CASE_INSENSITIVE),
            Pattern.compile("分析.*失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("处理.*错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("聚合.*失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("analysis.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("calculation.*failed", Pattern.CASE_INSENSITIVE),
            Pattern.compile("processing.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("aggregation.*failed", Pattern.CASE_INSENSITIVE),
            Pattern.compile("统计.*异常", Pattern.CASE_INSENSITIVE),
            Pattern.compile("数值.*错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("结果.*不正确", Pattern.CASE_INSENSITIVE)
    );

    /**
     * FORMAT_ERROR 错误关键词
     */
    private static final List<Pattern> FORMAT_ERROR_PATTERNS = Arrays.asList(
            Pattern.compile("格式错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("解析失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("JSON.*错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("类型转换", Pattern.CASE_INSENSITIVE),
            Pattern.compile("格式.*不正确", Pattern.CASE_INSENSITIVE),
            Pattern.compile("序列化.*失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("反序列化.*失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("format.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("parse.*failed", Pattern.CASE_INSENSITIVE),
            Pattern.compile("json.*exception", Pattern.CASE_INSENSITIVE),
            Pattern.compile("type.*conversion", Pattern.CASE_INSENSITIVE),
            Pattern.compile("serialization.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("invalid.*format", Pattern.CASE_INSENSITIVE),
            Pattern.compile("编码错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("字符.*乱码", Pattern.CASE_INSENSITIVE)
    );

    /**
     * LOGIC_ERROR 错误关键词
     */
    private static final List<Pattern> LOGIC_ERROR_PATTERNS = Arrays.asList(
            Pattern.compile("逻辑错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("推理失败", Pattern.CASE_INSENSITIVE),
            Pattern.compile("条件.*不满足", Pattern.CASE_INSENSITIVE),
            Pattern.compile("规则冲突", Pattern.CASE_INSENSITIVE),
            Pattern.compile("业务.*错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("违反.*规则", Pattern.CASE_INSENSITIVE),
            Pattern.compile("不符合.*条件", Pattern.CASE_INSENSITIVE),
            Pattern.compile("logic.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("reasoning.*failed", Pattern.CASE_INSENSITIVE),
            Pattern.compile("rule.*conflict", Pattern.CASE_INSENSITIVE),
            Pattern.compile("business.*error", Pattern.CASE_INSENSITIVE),
            Pattern.compile("validation.*failed", Pattern.CASE_INSENSITIVE),
            Pattern.compile("constraint.*violation", Pattern.CASE_INSENSITIVE),
            Pattern.compile("状态.*错误", Pattern.CASE_INSENSITIVE),
            Pattern.compile("流程.*异常", Pattern.CASE_INSENSITIVE)
    );

    // ==================== 错误分类 ====================

    @Override
    public ErrorCategory classifyError(String errorMessage, String reviewFeedback) {
        if (errorMessage == null || errorMessage.trim().isEmpty()) {
            log.debug("错误信息为空，返回 UNKNOWN 分类");
            return ErrorCategory.UNKNOWN;
        }

        String combinedText = errorMessage;
        if (reviewFeedback != null && !reviewFeedback.trim().isEmpty()) {
            combinedText = errorMessage + " " + reviewFeedback;
        }

        log.debug("开始分类错误: {}", combinedText.substring(0, Math.min(100, combinedText.length())));

        // 按优先级检查各类错误模式
        // 1. 首先检查数据不足（最常见，恢复成本最低）
        if (matchesAnyPattern(combinedText, DATA_INSUFFICIENT_PATTERNS)) {
            log.debug("错误分类为: DATA_INSUFFICIENT");
            return ErrorCategory.DATA_INSUFFICIENT;
        }

        // 2. 检查格式错误（容易修复）
        if (matchesAnyPattern(combinedText, FORMAT_ERROR_PATTERNS)) {
            log.debug("错误分类为: FORMAT_ERROR");
            return ErrorCategory.FORMAT_ERROR;
        }

        // 3. 检查分析错误
        if (matchesAnyPattern(combinedText, ANALYSIS_ERROR_PATTERNS)) {
            log.debug("错误分类为: ANALYSIS_ERROR");
            return ErrorCategory.ANALYSIS_ERROR;
        }

        // 4. 检查逻辑错误
        if (matchesAnyPattern(combinedText, LOGIC_ERROR_PATTERNS)) {
            log.debug("错误分类为: LOGIC_ERROR");
            return ErrorCategory.LOGIC_ERROR;
        }

        // 5. 无法识别的错误
        log.debug("无法识别错误类型，返回 UNKNOWN");
        return ErrorCategory.UNKNOWN;
    }

    /**
     * 检查文本是否匹配任意一个模式
     */
    private boolean matchesAnyPattern(String text, List<Pattern> patterns) {
        return patterns.stream().anyMatch(pattern -> pattern.matcher(text).find());
    }

    // ==================== 恢复策略 ====================

    @Override
    public CorrectionStrategy determineStrategy(ErrorCategory category) {
        if (category == null) {
            return CorrectionStrategy.FULL_RETRY;
        }

        CorrectionStrategy strategy = CorrectionRecord.getRecommendedStrategy(category);
        log.debug("错误类型 {} 推荐策略: {}", category, strategy);
        return strategy;
    }

    // ==================== 纠错记录管理 ====================

    @Override
    @Transactional
    public CorrectionRecord createCorrectionRecord(Long toolCallId, String factoryId, String sessionId,
                                                   String errorType, String errorMessage) {
        return createCorrectionRecord(toolCallId, factoryId, sessionId, errorType, errorMessage, null);
    }

    @Override
    @Transactional
    public CorrectionRecord createCorrectionRecord(Long toolCallId, String factoryId, String sessionId,
                                                   String errorType, String errorMessage, String reviewFeedback) {
        log.info("创建纠错记录: toolCallId={}, factoryId={}, sessionId={}, errorType={}",
                toolCallId, factoryId, sessionId, errorType);

        // 分类错误并确定策略
        ErrorCategory category = classifyError(errorMessage, reviewFeedback);
        CorrectionStrategy strategy = determineStrategy(category);

        // 获取当前轮次
        int currentRound = getCurrentRound(toolCallId);

        // 生成纠正提示
        String injectedPrompt = generateCorrectionPrompt(category, errorMessage, reviewFeedback);

        CorrectionRecord record = CorrectionRecord.builder()
                .toolCallId(toolCallId)
                .factoryId(factoryId)
                .sessionId(sessionId)
                .errorType(errorType)
                .errorCategory(category)
                .originalErrorMessage(errorMessage)
                .correctionStrategy(strategy)
                .injectedPrompt(injectedPrompt)
                .correctionSuccess(false)
                .correctionRounds(currentRound + 1)
                .build();

        CorrectionRecord saved = correctionRecordRepository.save(record);
        log.info("纠错记录已创建: id={}, category={}, strategy={}, round={}",
                saved.getId(), category, strategy, saved.getCorrectionRounds());

        return saved;
    }

    @Override
    @Transactional
    public void recordCorrectionOutcome(Long correctionRecordId, boolean success, String finalStatus) {
        log.info("记录纠错结果: correctionRecordId={}, success={}, finalStatus={}",
                correctionRecordId, success, finalStatus);

        Optional<CorrectionRecord> optRecord = correctionRecordRepository.findById(correctionRecordId);
        if (optRecord.isEmpty()) {
            log.warn("纠错记录不存在: {}", correctionRecordId);
            return;
        }

        CorrectionRecord record = optRecord.get();
        if (success) {
            record.markSuccess(finalStatus);
        } else {
            record.markFailure(finalStatus);
        }

        correctionRecordRepository.save(record);
        log.info("纠错结果已更新: id={}, success={}", correctionRecordId, success);
    }

    @Override
    @Transactional
    public int incrementCorrectionRound(Long correctionRecordId) {
        Optional<CorrectionRecord> optRecord = correctionRecordRepository.findById(correctionRecordId);
        if (optRecord.isEmpty()) {
            log.warn("纠错记录不存在: {}", correctionRecordId);
            return 0;
        }

        CorrectionRecord record = optRecord.get();
        record.incrementRounds();
        correctionRecordRepository.save(record);

        log.debug("纠错轮次已增加: id={}, newRound={}", correctionRecordId, record.getCorrectionRounds());
        return record.getCorrectionRounds();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<CorrectionRecord> getCorrectionRecord(Long correctionRecordId) {
        return correctionRecordRepository.findById(correctionRecordId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRecord> getCorrectionRecordsByToolCall(Long toolCallId) {
        return correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CorrectionRecord> getCorrectionRecordsBySession(String sessionId) {
        return correctionRecordRepository.findBySessionIdOrderByCreatedAtDesc(sessionId);
    }

    // ==================== 重试控制 ====================

    @Override
    @Transactional(readOnly = true)
    public boolean shouldRetry(Long toolCallId) {
        int currentRound = getCurrentRound(toolCallId);
        boolean shouldRetry = currentRound < MAX_CORRECTION_ROUNDS;

        log.debug("检查是否应重试: toolCallId={}, currentRound={}, maxRounds={}, shouldRetry={}",
                toolCallId, currentRound, MAX_CORRECTION_ROUNDS, shouldRetry);

        return shouldRetry;
    }

    @Override
    @Transactional(readOnly = true)
    public int getCurrentRound(Long toolCallId) {
        List<CorrectionRecord> records = correctionRecordRepository.findByToolCallIdOrderByCreatedAtDesc(toolCallId);
        if (records.isEmpty()) {
            return 0;
        }

        // 返回最新记录的轮次
        return records.get(0).getCorrectionRounds() != null ? records.get(0).getCorrectionRounds() : 0;
    }

    // ==================== 纠正提示生成 ====================

    @Override
    public String generateCorrectionPrompt(ErrorCategory category, String originalError) {
        return generateCorrectionPrompt(category, originalError, null);
    }

    @Override
    public String generateCorrectionPrompt(ErrorCategory category, String originalError, String context) {
        if (category == null) {
            category = ErrorCategory.UNKNOWN;
        }

        StringBuilder prompt = new StringBuilder();
        prompt.append("## 纠错指令\n\n");

        switch (category) {
            case DATA_INSUFFICIENT:
                prompt.append("### 问题类型: 数据不足\n\n");
                prompt.append("上一次执行因数据不完整而失败。请执行以下操作:\n\n");
                prompt.append("1. **扩大检索范围**: 尝试使用更宽泛的查询条件\n");
                prompt.append("2. **检查数据源**: 确认数据源是否可用，是否有权限访问\n");
                prompt.append("3. **降级处理**: 如果精确数据不可用，考虑使用近似数据或说明数据缺失\n");
                prompt.append("4. **提示用户**: 如果无法自动补充数据，请明确告知用户缺少哪些信息\n\n");
                break;

            case ANALYSIS_ERROR:
                prompt.append("### 问题类型: 分析错误\n\n");
                prompt.append("上一次执行的分析过程出现错误。请注意:\n\n");
                prompt.append("1. **保留检索数据**: 不需要重新检索数据，直接使用已有数据\n");
                prompt.append("2. **修正分析逻辑**: 检查计算公式和聚合方法是否正确\n");
                prompt.append("3. **处理边界情况**: 注意空值、零值、极端值的处理\n");
                prompt.append("4. **验证结果**: 分析完成后进行合理性检查\n\n");
                break;

            case FORMAT_ERROR:
                prompt.append("### 问题类型: 格式错误\n\n");
                prompt.append("上一次执行的输出格式不正确。请修正:\n\n");
                prompt.append("1. **检查JSON结构**: 确保JSON格式正确，括号匹配\n");
                prompt.append("2. **类型匹配**: 确保字段类型与预期一致\n");
                prompt.append("3. **编码处理**: 注意中文等特殊字符的编码\n");
                prompt.append("4. **标准化输出**: 按照规定的响应格式返回结果\n\n");
                break;

            case LOGIC_ERROR:
                prompt.append("### 问题类型: 逻辑错误\n\n");
                prompt.append("上一次执行的业务逻辑存在问题。请注意:\n\n");
                prompt.append("1. **检查前置条件**: 确认所有业务条件是否满足\n");
                prompt.append("2. **验证规则**: 检查是否违反了业务规则约束\n");
                prompt.append("3. **状态检查**: 确认实体状态是否允许当前操作\n");
                prompt.append("4. **权限验证**: 确认用户是否有权执行该操作\n\n");
                break;

            case UNKNOWN:
            default:
                prompt.append("### 问题类型: 未知错误\n\n");
                prompt.append("上一次执行遇到未知错误。建议:\n\n");
                prompt.append("1. **完全重试**: 从头开始执行整个流程\n");
                prompt.append("2. **分步验证**: 逐步执行并验证每一步结果\n");
                prompt.append("3. **简化操作**: 尝试简化查询或操作条件\n");
                prompt.append("4. **记录详情**: 如果仍然失败，记录详细错误信息以便排查\n\n");
                break;
        }

        // 添加原始错误信息
        prompt.append("### 原始错误信息\n");
        prompt.append("```\n");
        prompt.append(originalError != null ? originalError : "无详细错误信息");
        prompt.append("\n```\n\n");

        // 添加额外上下文
        if (context != null && !context.trim().isEmpty()) {
            prompt.append("### 额外上下文\n");
            prompt.append(context);
            prompt.append("\n\n");
        }

        prompt.append("请根据以上指导重新执行操作。\n");

        return prompt.toString();
    }

    @Override
    public String generateCorrectionPromptForStrategy(CorrectionStrategy strategy, String originalError, int attemptNumber) {
        StringBuilder prompt = new StringBuilder();
        prompt.append(String.format("## 纠错尝试 #%d\n\n", attemptNumber));

        switch (strategy) {
            case RE_RETRIEVE:
                prompt.append("### 策略: 重新检索\n\n");
                prompt.append("请使用以下方法重新检索数据:\n");
                prompt.append("- 调整查询参数，尝试更宽泛的条件\n");
                prompt.append("- 检查时间范围是否合理\n");
                prompt.append("- 确认实体标识是否正确\n\n");
                break;

            case RE_ANALYZE:
                prompt.append("### 策略: 重新分析\n\n");
                prompt.append("使用已检索的数据重新进行分析:\n");
                prompt.append("- 不要重新检索数据\n");
                prompt.append("- 检查分析算法的正确性\n");
                prompt.append("- 处理空值和异常值\n\n");
                break;

            case FORMAT_FIX:
                prompt.append("### 策略: 格式修正\n\n");
                prompt.append("仅修正输出格式问题:\n");
                prompt.append("- 检查JSON结构\n");
                prompt.append("- 确保类型正确\n");
                prompt.append("- 处理特殊字符\n\n");
                break;

            case PROMPT_INJECTION:
                prompt.append("### 策略: 提示注入\n\n");
                prompt.append("根据以下纠正提示调整执行:\n");
                prompt.append("- 仔细阅读错误信息\n");
                prompt.append("- 按照业务规则要求执行\n");
                prompt.append("- 验证所有前置条件\n\n");
                break;

            case FULL_RETRY:
            default:
                prompt.append("### 策略: 完全重试\n\n");
                prompt.append("从头开始执行:\n");
                prompt.append("- 清除之前的中间状态\n");
                prompt.append("- 重新执行完整流程\n");
                prompt.append("- 注意之前出错的环节\n\n");
                break;
        }

        // 添加原始错误
        if (originalError != null) {
            prompt.append("### 需要解决的问题\n");
            prompt.append("```\n").append(originalError).append("\n```\n\n");
        }

        // 添加尝试提示
        if (attemptNumber >= 2) {
            prompt.append("**注意**: 这是第 " + attemptNumber + " 次尝试，");
            prompt.append("如果问题仍然无法解决，请考虑向用户说明情况。\n");
        }

        return prompt.toString();
    }

    // ==================== 统计与分析 ====================

    @Override
    @Transactional(readOnly = true)
    public double getCorrectionSuccessRate(String factoryId) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(30);
        LocalDateTime endTime = LocalDateTime.now();

        Long total = correctionRecordRepository.countByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        if (total == null || total == 0) {
            return 0.0;
        }

        Long successful = correctionRecordRepository.countSuccessfulByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        if (successful == null) {
            return 0.0;
        }

        return (double) successful / total;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<ErrorCategory, Long> getErrorCategoryDistribution(String factoryId) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(30);
        LocalDateTime endTime = LocalDateTime.now();

        List<Object[]> results = correctionRecordRepository.countByErrorCategoryAndFactoryIdAndTimeRange(
                factoryId, startTime, endTime);

        Map<ErrorCategory, Long> distribution = new EnumMap<>(ErrorCategory.class);
        for (Object[] row : results) {
            if (row[0] instanceof ErrorCategory && row[1] instanceof Long) {
                distribution.put((ErrorCategory) row[0], (Long) row[1]);
            }
        }

        return distribution;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<CorrectionStrategy, Long> getStrategyUsageStats(String factoryId) {
        LocalDateTime startTime = LocalDateTime.now().minusDays(30);
        LocalDateTime endTime = LocalDateTime.now();

        List<Object[]> results = correctionRecordRepository.countByCorrectionStrategyAndFactoryIdAndTimeRange(
                factoryId, startTime, endTime);

        Map<CorrectionStrategy, Long> stats = new EnumMap<>(CorrectionStrategy.class);
        for (Object[] row : results) {
            if (row[0] instanceof CorrectionStrategy && row[1] instanceof Long) {
                stats.put((CorrectionStrategy) row[0], (Long) row[1]);
            }
        }

        return stats;
    }

    // ==================== 纠错分析 ====================

    @Override
    @Transactional(readOnly = true)
    public CorrectionAnalysis analyzeAndSuggest(Long toolCallId, String errorMessage, String reviewFeedback) {
        log.info("分析错误并提供纠错建议: toolCallId={}", toolCallId);

        // 分类错误
        ErrorCategory category = classifyError(errorMessage, reviewFeedback);

        // 确定策略
        CorrectionStrategy strategy = determineStrategy(category);

        // 获取当前轮次
        int currentRound = getCurrentRound(toolCallId);

        // 判断是否可重试
        boolean retryable = currentRound < MAX_CORRECTION_ROUNDS;

        // 生成纠正提示
        String prompt = generateCorrectionPromptForStrategy(strategy, errorMessage, currentRound + 1);

        // 计算置信度（基于错误分类的确定性）
        double confidence = calculateClassificationConfidence(errorMessage, category);

        log.info("纠错分析完成: category={}, strategy={}, retryable={}, round={}, confidence={}",
                category, strategy, retryable, currentRound, confidence);

        return CorrectionAnalysisResult.builder()
                .errorCategory(category)
                .recommendedStrategy(strategy)
                .retryable(retryable)
                .correctionPrompt(prompt)
                .currentRound(currentRound)
                .confidence(confidence)
                .build();
    }

    /**
     * 计算分类置信度
     */
    private double calculateClassificationConfidence(String errorMessage, ErrorCategory category) {
        if (errorMessage == null || errorMessage.isEmpty()) {
            return 0.3;
        }

        if (category == ErrorCategory.UNKNOWN) {
            return 0.3;
        }

        // 统计匹配的模式数量
        List<Pattern> patterns = getPatternsForCategory(category);
        long matchCount = patterns.stream()
                .filter(p -> p.matcher(errorMessage).find())
                .count();

        // 基础置信度 0.5，每多匹配一个模式增加 0.1，最高 0.95
        double confidence = Math.min(0.95, 0.5 + (matchCount * 0.1));
        return confidence;
    }

    /**
     * 获取错误类别对应的模式列表
     */
    private List<Pattern> getPatternsForCategory(ErrorCategory category) {
        switch (category) {
            case DATA_INSUFFICIENT:
                return DATA_INSUFFICIENT_PATTERNS;
            case ANALYSIS_ERROR:
                return ANALYSIS_ERROR_PATTERNS;
            case FORMAT_ERROR:
                return FORMAT_ERROR_PATTERNS;
            case LOGIC_ERROR:
                return LOGIC_ERROR_PATTERNS;
            default:
                return Collections.emptyList();
        }
    }

    // ==================== 内部类 ====================

    /**
     * 纠错分析结果实现
     */
    @Data
    @Builder
    public static class CorrectionAnalysisResult implements CorrectionAnalysis {
        private ErrorCategory errorCategory;
        private CorrectionStrategy recommendedStrategy;
        private boolean retryable;
        private String correctionPrompt;
        private int currentRound;
        private double confidence;

        @Override
        public boolean isRetryable() {
            return retryable;
        }
    }
}
