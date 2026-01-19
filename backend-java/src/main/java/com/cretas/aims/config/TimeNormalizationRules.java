package com.cretas.aims.config;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 时间表达归一化规则配置
 *
 * 将用户输入中的相对时间表达式（如"今天"、"上周"、"最近3天"）
 * 转换为具体的时间范围，用于查询预处理。
 *
 * 支持的时间表达式类型：
 * - 单日：今天、昨天、前天、大前天、明天
 * - 周：这周/本周、上周、上上周、下周
 * - 月：这个月/本月、上个月/上月、上上个月
 * - 模糊时间：最近N天、刚才/刚刚、最近
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Slf4j
@Component
public class TimeNormalizationRules {

    /**
     * 时间范围类
     */
    @Data
    @AllArgsConstructor(staticName = "of")
    public static class TimeRange {
        private LocalDateTime start;
        private LocalDateTime end;

        /**
         * 创建从指定时间到当前时间的范围
         */
        public static TimeRange until(LocalDateTime start, LocalDateTime now) {
            return of(start, now);
        }

        /**
         * 检查时间范围是否有效
         */
        public boolean isValid() {
            return start != null && end != null && !start.isAfter(end);
        }

        @Override
        public String toString() {
            return String.format("[%s ~ %s]", start, end);
        }
    }

    /**
     * 时间模式映射：正则表达式 -> 时间范围计算函数
     * 使用 BiFunction 支持动态参数提取
     */
    private static final Map<Pattern, BiFunction<LocalDateTime, Matcher, TimeRange>> TIME_PATTERNS = new LinkedHashMap<>();

    static {
        // === 单日 ===
        TIME_PATTERNS.put(
                Pattern.compile("今天|今日"),
                (now, m) -> dayRange(now, 0)
        );
        TIME_PATTERNS.put(
                Pattern.compile("昨天|昨日"),
                (now, m) -> dayRange(now, -1)
        );
        TIME_PATTERNS.put(
                Pattern.compile("前天"),
                (now, m) -> dayRange(now, -2)
        );
        TIME_PATTERNS.put(
                Pattern.compile("大前天"),
                (now, m) -> dayRange(now, -3)
        );
        TIME_PATTERNS.put(
                Pattern.compile("明天|明日"),
                (now, m) -> dayRange(now, 1)
        );
        TIME_PATTERNS.put(
                Pattern.compile("后天"),
                (now, m) -> dayRange(now, 2)
        );

        // === 周 ===
        TIME_PATTERNS.put(
                Pattern.compile("这周|本周|这个星期|这个礼拜"),
                (now, m) -> weekRange(now, 0)
        );
        TIME_PATTERNS.put(
                Pattern.compile("上周|上一周|上个星期|上个礼拜"),
                (now, m) -> weekRange(now, -1)
        );
        TIME_PATTERNS.put(
                Pattern.compile("上上周|上上个星期"),
                (now, m) -> weekRange(now, -2)
        );
        TIME_PATTERNS.put(
                Pattern.compile("下周|下一周|下个星期|下个礼拜"),
                (now, m) -> weekRange(now, 1)
        );

        // === 月 ===
        TIME_PATTERNS.put(
                Pattern.compile("这个月|本月|当月"),
                (now, m) -> monthRange(now, 0)
        );
        TIME_PATTERNS.put(
                Pattern.compile("上个月|上月"),
                (now, m) -> monthRange(now, -1)
        );
        TIME_PATTERNS.put(
                Pattern.compile("上上个月|上上月"),
                (now, m) -> monthRange(now, -2)
        );
        TIME_PATTERNS.put(
                Pattern.compile("下个月|下月"),
                (now, m) -> monthRange(now, 1)
        );

        // === 年 ===
        TIME_PATTERNS.put(
                Pattern.compile("今年|本年"),
                (now, m) -> yearRange(now, 0)
        );
        TIME_PATTERNS.put(
                Pattern.compile("去年|上一年"),
                (now, m) -> yearRange(now, -1)
        );
        TIME_PATTERNS.put(
                Pattern.compile("明年|下一年"),
                (now, m) -> yearRange(now, 1)
        );

        // === 动态模糊时间 (需要提取数字) ===
        TIME_PATTERNS.put(
                Pattern.compile("最近(\\d+)天"),
                (now, m) -> {
                    int days = Integer.parseInt(m.group(1));
                    return TimeRange.of(now.minusDays(days).with(LocalTime.MIN), now);
                }
        );
        TIME_PATTERNS.put(
                Pattern.compile("最近(\\d+)周"),
                (now, m) -> {
                    int weeks = Integer.parseInt(m.group(1));
                    return TimeRange.of(now.minusWeeks(weeks).with(LocalTime.MIN), now);
                }
        );
        TIME_PATTERNS.put(
                Pattern.compile("最近(\\d+)个月"),
                (now, m) -> {
                    int months = Integer.parseInt(m.group(1));
                    return TimeRange.of(now.minusMonths(months).with(LocalTime.MIN), now);
                }
        );
        TIME_PATTERNS.put(
                Pattern.compile("(\\d+)天前"),
                (now, m) -> {
                    int days = Integer.parseInt(m.group(1));
                    return dayRange(now, -days);
                }
        );
        TIME_PATTERNS.put(
                Pattern.compile("(\\d+)天内"),
                (now, m) -> {
                    int days = Integer.parseInt(m.group(1));
                    return TimeRange.of(now.minusDays(days).with(LocalTime.MIN), now);
                }
        );

        // === 固定模糊时间 ===
        TIME_PATTERNS.put(
                Pattern.compile("刚才|刚刚|刚"),
                (now, m) -> TimeRange.of(now.minusHours(2), now)
        );
        TIME_PATTERNS.put(
                Pattern.compile("最近"),
                (now, m) -> TimeRange.of(now.minusDays(7).with(LocalTime.MIN), now)
        );
        TIME_PATTERNS.put(
                Pattern.compile("近期"),
                (now, m) -> TimeRange.of(now.minusDays(14).with(LocalTime.MIN), now)
        );
        TIME_PATTERNS.put(
                Pattern.compile("早上|上午"),
                (now, m) -> TimeRange.of(
                        now.with(LocalTime.of(6, 0)),
                        now.with(LocalTime.of(12, 0))
                )
        );
        TIME_PATTERNS.put(
                Pattern.compile("下午"),
                (now, m) -> TimeRange.of(
                        now.with(LocalTime.of(12, 0)),
                        now.with(LocalTime.of(18, 0))
                )
        );
        TIME_PATTERNS.put(
                Pattern.compile("晚上"),
                (now, m) -> TimeRange.of(
                        now.with(LocalTime.of(18, 0)),
                        now.with(LocalTime.of(23, 59, 59))
                )
        );
    }

    /**
     * 将时间表达式归一化为具体时间范围
     *
     * @param expression 用户输入的时间表达式
     * @param now        当前时间（通常为 LocalDateTime.now()）
     * @return 归一化后的时间范围，如果无法识别则返回 Optional.empty()
     */
    public Optional<TimeRange> normalize(String expression, LocalDateTime now) {
        if (expression == null || expression.trim().isEmpty()) {
            return Optional.empty();
        }

        String input = expression.trim();

        for (Map.Entry<Pattern, BiFunction<LocalDateTime, Matcher, TimeRange>> entry : TIME_PATTERNS.entrySet()) {
            Matcher matcher = entry.getKey().matcher(input);
            if (matcher.find()) {
                try {
                    TimeRange range = entry.getValue().apply(now, matcher);
                    log.debug("时间归一化: '{}' -> {}", expression, range);
                    return Optional.of(range);
                } catch (Exception e) {
                    log.warn("时间归一化失败: expression={}, error={}", expression, e.getMessage());
                }
            }
        }

        return Optional.empty();
    }

    /**
     * 从文本中提取并替换所有时间表达式
     *
     * @param text 原始文本
     * @param now  当前时间
     * @return 替换结果（包含替换后文本和提取的时间范围列表）
     */
    public NormalizationResult extractAndReplace(String text, LocalDateTime now) {
        if (text == null || text.trim().isEmpty()) {
            return new NormalizationResult(text, java.util.Collections.emptyList());
        }

        String result = text;
        java.util.List<TimeRange> extractedRanges = new java.util.ArrayList<>();

        for (Map.Entry<Pattern, BiFunction<LocalDateTime, Matcher, TimeRange>> entry : TIME_PATTERNS.entrySet()) {
            Matcher matcher = entry.getKey().matcher(result);
            while (matcher.find()) {
                try {
                    TimeRange range = entry.getValue().apply(now, matcher);
                    extractedRanges.add(range);
                    // 替换为标准化时间范围描述
                    String replacement = formatTimeRange(range);
                    result = result.substring(0, matcher.start()) + replacement + result.substring(matcher.end());
                    // 重新匹配（因为文本已变化）
                    matcher = entry.getKey().matcher(result);
                } catch (Exception e) {
                    log.warn("时间提取失败: pattern={}, error={}", entry.getKey().pattern(), e.getMessage());
                }
            }
        }

        return new NormalizationResult(result, extractedRanges);
    }

    /**
     * 检查文本是否包含时间表达式
     */
    public boolean containsTimeExpression(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        for (Pattern pattern : TIME_PATTERNS.keySet()) {
            if (pattern.matcher(text).find()) {
                return true;
            }
        }
        return false;
    }

    // ==================== 时间范围计算辅助方法 ====================

    /**
     * 计算指定偏移天数的日期范围
     */
    private static TimeRange dayRange(LocalDateTime now, int daysOffset) {
        LocalDateTime targetDay = now.plusDays(daysOffset);
        return TimeRange.of(
                targetDay.with(LocalTime.MIN),
                targetDay.with(LocalTime.MAX)
        );
    }

    /**
     * 计算指定偏移周数的周范围（周一到周日）
     */
    private static TimeRange weekRange(LocalDateTime now, int weeksOffset) {
        LocalDateTime targetWeek = now.plusWeeks(weeksOffset);
        LocalDateTime startOfWeek = targetWeek.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .with(LocalTime.MIN);
        LocalDateTime endOfWeek = targetWeek.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))
                .with(LocalTime.MAX);
        return TimeRange.of(startOfWeek, endOfWeek);
    }

    /**
     * 计算指定偏移月数的月范围
     */
    private static TimeRange monthRange(LocalDateTime now, int monthsOffset) {
        LocalDateTime targetMonth = now.plusMonths(monthsOffset);
        LocalDateTime startOfMonth = targetMonth.with(TemporalAdjusters.firstDayOfMonth())
                .with(LocalTime.MIN);
        LocalDateTime endOfMonth = targetMonth.with(TemporalAdjusters.lastDayOfMonth())
                .with(LocalTime.MAX);
        return TimeRange.of(startOfMonth, endOfMonth);
    }

    /**
     * 计算指定偏移年数的年范围
     */
    private static TimeRange yearRange(LocalDateTime now, int yearsOffset) {
        LocalDateTime targetYear = now.plusYears(yearsOffset);
        LocalDateTime startOfYear = targetYear.with(TemporalAdjusters.firstDayOfYear())
                .with(LocalTime.MIN);
        LocalDateTime endOfYear = targetYear.with(TemporalAdjusters.lastDayOfYear())
                .with(LocalTime.MAX);
        return TimeRange.of(startOfYear, endOfYear);
    }

    /**
     * 格式化时间范围为标准描述
     */
    private String formatTimeRange(TimeRange range) {
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        return String.format("[%s 至 %s]",
                range.getStart().format(formatter),
                range.getEnd().format(formatter));
    }

    // ==================== 结果类 ====================

    /**
     * 归一化结果
     */
    @Data
    @AllArgsConstructor
    public static class NormalizationResult {
        /** 处理后的文本 */
        private String processedText;
        /** 提取出的时间范围列表 */
        private java.util.List<TimeRange> extractedRanges;

        /**
         * 获取第一个时间范围（如果存在）
         */
        public Optional<TimeRange> getFirstRange() {
            return extractedRanges != null && !extractedRanges.isEmpty()
                    ? Optional.of(extractedRanges.get(0))
                    : Optional.empty();
        }

        /**
         * 是否提取到时间范围
         */
        public boolean hasTimeRange() {
            return extractedRanges != null && !extractedRanges.isEmpty();
        }
    }
}
