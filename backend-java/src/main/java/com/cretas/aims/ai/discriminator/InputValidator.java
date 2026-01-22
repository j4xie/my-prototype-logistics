package com.cretas.aims.ai.discriminator;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Input validator for discriminator.
 * Pre-validates user input to detect problematic queries before LLM judgment.
 *
 * <p>Detects:
 * <ul>
 *   <li>Too short/vague queries that need clarification</li>
 *   <li>Write operations (CREATE, UPDATE, DELETE)</li>
 *   <li>Out-of-domain irrelevant queries</li>
 *   <li>Invalid input (only special characters, etc.)</li>
 * </ul>
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Slf4j
@Component
public class InputValidator {

    // Minimum meaningful input length (Chinese characters)
    private static final int MIN_INPUT_LENGTH = 2;

    // Words that are too vague without context
    private static final Set<String> VAGUE_WORDS = new HashSet<>(Arrays.asList(
            "数据", "报表", "情况", "查", "看", "给我", "帮我", "今天", "昨天",
            "上次", "那个", "这个", "继续", "再", "好", "行", "可以"
    ));

    // Write operation keywords
    private static final Set<String> WRITE_KEYWORDS = new HashSet<>(Arrays.asList(
            "删除", "删掉", "移除", "清空", "清除",
            "修改", "更新", "更改", "变更", "调整", "编辑",
            "添加", "新增", "创建", "新建", "录入", "增加",
            "保存", "提交", "确认", "执行", "操作",
            "导入", "导出", "上传", "下载"
    ));

    // Out-of-domain keywords (irrelevant to business)
    private static final Set<String> IRRELEVANT_KEYWORDS = new HashSet<>(Arrays.asList(
            "天气", "你好", "再见", "谢谢", "帮帮我", "几点", "什么时间",
            "你是谁", "介绍一下", "外卖", "点餐", "订餐", "打车", "导航",
            "音乐", "视频", "电影", "游戏", "新闻", "笑话", "故事"
    ));

    // Pattern for input that is mostly special characters
    private static final Pattern SPECIAL_CHARS_ONLY = Pattern.compile("^[^\\u4e00-\\u9fa5a-zA-Z0-9]+$");

    // Pattern to clean special characters from input
    private static final Pattern CLEAN_PATTERN = Pattern.compile("[!@#$%^&*()_+=\\[\\]{}|;:'\",.<>?/\\\\`~\\-\\s]+");

    /**
     * Validation result with reason and suggestions.
     */
    @Data
    public static class ValidationResult {
        private boolean valid;
        private InputQuality quality;
        private String reason;
        private String suggestion;
        private String cleanedInput;
        private boolean isWriteOperation;
        private boolean isIrrelevant;

        public static ValidationResult valid(String cleanedInput) {
            ValidationResult result = new ValidationResult();
            result.valid = true;
            result.quality = InputQuality.GOOD;
            result.cleanedInput = cleanedInput;
            result.isWriteOperation = false;
            result.isIrrelevant = false;
            return result;
        }

        public static ValidationResult invalid(InputQuality quality, String reason, String suggestion) {
            ValidationResult result = new ValidationResult();
            result.valid = false;
            result.quality = quality;
            result.reason = reason;
            result.suggestion = suggestion;
            return result;
        }
    }

    /**
     * Input quality levels.
     */
    public enum InputQuality {
        GOOD,           // Clear and specific
        VAGUE,          // Too vague, needs clarification
        TOO_SHORT,      // Input too short
        WRITE_OP,       // Write operation detected
        IRRELEVANT,     // Out of domain
        INVALID         // Invalid input (special chars only, etc.)
    }

    /**
     * Validate user input before discriminator judgment.
     *
     * @param userInput The raw user input
     * @return Validation result with quality assessment
     */
    public ValidationResult validate(String userInput) {
        if (userInput == null) {
            return ValidationResult.invalid(
                    InputQuality.INVALID,
                    "输入为空",
                    "请输入您想查询的内容"
            );
        }

        // Clean the input
        String cleaned = cleanInput(userInput);

        // Check if empty after cleaning
        if (cleaned.isEmpty()) {
            return ValidationResult.invalid(
                    InputQuality.INVALID,
                    "输入无效",
                    "请输入有效的查询内容"
            );
        }

        // Check minimum length
        if (cleaned.length() < MIN_INPUT_LENGTH) {
            return ValidationResult.invalid(
                    InputQuality.TOO_SHORT,
                    "输入过短",
                    "请提供更详细的描述，例如：查看今天的销售情况"
            );
        }

        // Check for vague single words
        if (isVagueInput(cleaned)) {
            ValidationResult result = ValidationResult.invalid(
                    InputQuality.VAGUE,
                    "输入过于模糊",
                    "请具体说明您想查询什么，例如：查看销售数据、查看库存情况"
            );
            result.setCleanedInput(cleaned);
            return result;
        }

        // Check for irrelevant queries
        if (isIrrelevant(cleaned)) {
            ValidationResult result = ValidationResult.invalid(
                    InputQuality.IRRELEVANT,
                    "查询内容不在服务范围内",
                    "我可以帮您查询销售、库存、生产、设备、质检等业务数据"
            );
            result.setCleanedInput(cleaned);
            result.setIrrelevant(true);
            return result;
        }

        // Check for write operations
        if (containsWriteKeyword(cleaned)) {
            ValidationResult result = ValidationResult.valid(cleaned);
            result.setQuality(InputQuality.WRITE_OP);
            result.setWriteOperation(true);
            result.setReason("检测到写操作");
            return result;
        }

        // Valid input
        return ValidationResult.valid(cleaned);
    }

    /**
     * Clean input by removing special characters and normalizing whitespace.
     */
    public String cleanInput(String input) {
        if (input == null) return "";

        // Remove leading/trailing whitespace
        String cleaned = input.trim();

        // Remove excessive special characters but keep Chinese and alphanumeric
        cleaned = cleaned.replaceAll("[!@#$%^&*()_+=\\[\\]{}|;'\",.<>?/\\\\`~]+", " ");

        // Normalize whitespace
        cleaned = cleaned.replaceAll("\\s+", " ").trim();

        return cleaned;
    }

    /**
     * Check if input is too vague.
     */
    private boolean isVagueInput(String input) {
        // Single character is always vague
        if (input.length() == 1) {
            return true;
        }

        // Check if input is just one vague word
        String normalized = input.toLowerCase();
        if (VAGUE_WORDS.contains(normalized)) {
            return true;
        }

        // Check if input consists only of vague words
        String[] words = normalized.split("\\s+");
        if (words.length <= 2) {
            boolean allVague = true;
            for (String word : words) {
                if (!VAGUE_WORDS.contains(word) && word.length() > 1) {
                    allVague = false;
                    break;
                }
            }
            if (allVague) return true;
        }

        return false;
    }

    /**
     * Check if input contains write operation keywords.
     */
    public boolean containsWriteKeyword(String input) {
        String normalized = input.toLowerCase();
        for (String keyword : WRITE_KEYWORDS) {
            if (normalized.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input is irrelevant to the business domain.
     */
    private boolean isIrrelevant(String input) {
        String normalized = input.toLowerCase();

        // Check for irrelevant keywords
        for (String keyword : IRRELEVANT_KEYWORDS) {
            if (normalized.contains(keyword)) {
                // Additional check: if it also contains business keywords, it's not irrelevant
                if (containsBusinessKeyword(normalized)) {
                    return false;
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Check if input contains business domain keywords.
     */
    private boolean containsBusinessKeyword(String input) {
        Set<String> businessKeywords = new HashSet<>(Arrays.asList(
                "销售", "销量", "营业", "收入", "业绩", "排名", "趋势",
                "库存", "存货", "仓库", "物料", "原料", "批次", "批号",
                "生产", "产量", "产线", "车间", "工单", "进度",
                "设备", "机台", "机器", "故障", "运行", "OEE",
                "质量", "质检", "合格", "不良", "检验",
                "考勤", "出勤", "缺勤", "打卡",
                "发货", "物流", "订单", "出货",
                "告警", "预警", "异常",
                "部门", "团队", "区域", "地区",
                "利润", "成本", "费用", "毛利",
                "同比", "环比", "对比", "预测"
        ));

        for (String keyword : businessKeywords) {
            if (input.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get confidence modifier based on input quality.
     * Used to adjust discriminator scores based on input quality.
     *
     * @param quality The input quality
     * @return Score modifier (0.0 to 1.0)
     */
    public double getConfidenceModifier(InputQuality quality) {
        switch (quality) {
            case GOOD:
                return 1.0;
            case WRITE_OP:
                return 0.8;  // Slightly lower confidence for write ops
            case VAGUE:
                return 0.5;  // Significantly lower for vague inputs
            case TOO_SHORT:
                return 0.3;
            case IRRELEVANT:
                return 0.0;
            case INVALID:
                return 0.0;
            default:
                return 0.5;
        }
    }
}
