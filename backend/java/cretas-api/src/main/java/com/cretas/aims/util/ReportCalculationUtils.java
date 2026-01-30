package com.cretas.aims.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 报表计算工具类
 *
 * 提供 BigDecimal 百分比计算、安全除法、比率计算等通用方法，
 * 减少 ReportServiceImpl 中的重复代码。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
public final class ReportCalculationUtils {

    /** 百分比乘数 */
    public static final BigDecimal HUNDRED = new BigDecimal("100");

    /** 默认小数位数 */
    public static final int DEFAULT_SCALE = 2;

    /** 高精度小数位数（用于中间计算） */
    public static final int HIGH_PRECISION_SCALE = 4;

    private ReportCalculationUtils() {
        // 工具类禁止实例化
    }

    // ==================== 百分比计算 ====================

    /**
     * 计算百分比 (numerator / denominator * 100)
     *
     * @param numerator   分子
     * @param denominator 分母
     * @return 百分比值，分母为零时返回 BigDecimal.ZERO
     */
    public static BigDecimal calculatePercentage(BigDecimal numerator, BigDecimal denominator) {
        return calculatePercentage(numerator, denominator, BigDecimal.ZERO, DEFAULT_SCALE);
    }

    /**
     * 计算百分比，支持自定义默认值和精度
     *
     * @param numerator    分子
     * @param denominator  分母
     * @param defaultValue 分母为零时的默认值
     * @param scale        小数位数
     * @return 百分比值
     */
    public static BigDecimal calculatePercentage(BigDecimal numerator, BigDecimal denominator,
                                                  BigDecimal defaultValue, int scale) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return defaultValue;
        }
        if (numerator == null) {
            return defaultValue;
        }
        return numerator
                .divide(denominator, HIGH_PRECISION_SCALE, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(scale, RoundingMode.HALF_UP);
    }

    /**
     * 计算百分比并返回 double 类型
     *
     * @param numerator   分子
     * @param denominator 分母
     * @return 百分比值 (double)
     */
    public static double calculatePercentageAsDouble(BigDecimal numerator, BigDecimal denominator) {
        return calculatePercentage(numerator, denominator).doubleValue();
    }

    /**
     * 计算百分比并返回 double 类型，支持默认值
     *
     * @param numerator    分子
     * @param denominator  分母
     * @param defaultValue 分母为零时的默认值
     * @return 百分比值 (double)
     */
    public static double calculatePercentageAsDouble(BigDecimal numerator, BigDecimal denominator,
                                                      double defaultValue) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return defaultValue;
        }
        return calculatePercentage(numerator, denominator).doubleValue();
    }

    // ==================== 比率计算 ====================

    /**
     * 计算比率 (count / total)，不乘以100
     *
     * @param count 计数
     * @param total 总数
     * @return 比率值
     */
    public static BigDecimal calculateRate(long count, long total) {
        return calculateRate(count, total, DEFAULT_SCALE);
    }

    /**
     * 计算比率，支持自定义精度
     *
     * @param count 计数
     * @param total 总数
     * @param scale 小数位数
     * @return 比率值
     */
    public static BigDecimal calculateRate(long count, long total, int scale) {
        if (total == 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(count)
                .divide(BigDecimal.valueOf(total), scale, RoundingMode.HALF_UP);
    }

    /**
     * 计算比率百分比 (count / total * 100)
     *
     * @param count 计数
     * @param total 总数
     * @return 百分比值
     */
    public static BigDecimal calculateRatePercentage(long count, long total) {
        return calculateRate(count, total, HIGH_PRECISION_SCALE).multiply(HUNDRED)
                .setScale(DEFAULT_SCALE, RoundingMode.HALF_UP);
    }

    // ==================== 安全除法 ====================

    /**
     * 安全除法，分母为零时返回默认值
     *
     * @param dividend     被除数
     * @param divisor      除数
     * @param defaultValue 除数为零时的默认值
     * @return 商
     */
    public static BigDecimal safeDivide(BigDecimal dividend, BigDecimal divisor, BigDecimal defaultValue) {
        return safeDivide(dividend, divisor, defaultValue, DEFAULT_SCALE);
    }

    /**
     * 安全除法，支持自定义精度
     *
     * @param dividend     被除数
     * @param divisor      除数
     * @param defaultValue 除数为零时的默认值
     * @param scale        小数位数
     * @return 商
     */
    public static BigDecimal safeDivide(BigDecimal dividend, BigDecimal divisor,
                                         BigDecimal defaultValue, int scale) {
        if (divisor == null || divisor.compareTo(BigDecimal.ZERO) == 0) {
            return defaultValue;
        }
        if (dividend == null) {
            return defaultValue;
        }
        return dividend.divide(divisor, scale, RoundingMode.HALF_UP);
    }

    // ==================== Null 安全操作 ====================

    /**
     * 获取非空的 BigDecimal，null 时返回 ZERO
     *
     * @param value 原始值
     * @return 非空值
     */
    public static BigDecimal safeValue(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    /**
     * 获取非空的 BigDecimal，null 时返回指定默认值
     *
     * @param value        原始值
     * @param defaultValue 默认值
     * @return 非空值
     */
    public static BigDecimal safeValue(BigDecimal value, BigDecimal defaultValue) {
        return value != null ? value : defaultValue;
    }

    /**
     * 安全加法，处理 null 值
     *
     * @param a 加数1
     * @param b 加数2
     * @return 和
     */
    public static BigDecimal safeAdd(BigDecimal a, BigDecimal b) {
        return safeValue(a).add(safeValue(b));
    }

    /**
     * 安全减法，处理 null 值
     *
     * @param a 被减数
     * @param b 减数
     * @return 差
     */
    public static BigDecimal safeSubtract(BigDecimal a, BigDecimal b) {
        return safeValue(a).subtract(safeValue(b));
    }

    /**
     * 安全乘法，处理 null 值
     *
     * @param a 乘数1
     * @param b 乘数2
     * @return 积
     */
    public static BigDecimal safeMultiply(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return BigDecimal.ZERO;
        }
        return a.multiply(b);
    }

    // ==================== 差异计算 ====================

    /**
     * 计算差异率 ((actual - expected) / expected * 100)
     *
     * @param actual   实际值
     * @param expected 期望值
     * @return 差异率百分比（正数表示超支，负数表示节省）
     */
    public static BigDecimal calculateVarianceRate(BigDecimal actual, BigDecimal expected) {
        if (expected == null || expected.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal variance = safeValue(actual).subtract(expected);
        return variance.divide(expected, HIGH_PRECISION_SCALE, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(DEFAULT_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * 判断差异状态
     *
     * @param varianceRate 差异率
     * @param threshold    阈值（如 5.0 表示 5%）
     * @return 状态：FAVORABLE（有利）、UNFAVORABLE（不利）、NORMAL（正常）
     */
    public static String getVarianceStatus(BigDecimal varianceRate, double threshold) {
        if (varianceRate == null) {
            return "NORMAL";
        }
        double rate = varianceRate.doubleValue();
        if (rate < -threshold) {
            return "FAVORABLE";  // 实际低于预期，有利
        } else if (rate > threshold) {
            return "UNFAVORABLE";  // 实际高于预期，不利
        }
        return "NORMAL";
    }

    // ==================== OEE 计算 ====================

    /**
     * 计算 OEE (Overall Equipment Effectiveness)
     * OEE = 可用性 × 表现性 × 质量率
     *
     * @param availability 可用性 (0-100)
     * @param performance  表现性 (0-100)
     * @param quality      质量率 (0-100)
     * @return OEE 值 (0-100)
     */
    public static BigDecimal calculateOee(BigDecimal availability, BigDecimal performance, BigDecimal quality) {
        BigDecimal a = safeValue(availability).divide(HUNDRED, HIGH_PRECISION_SCALE, RoundingMode.HALF_UP);
        BigDecimal p = safeValue(performance).divide(HUNDRED, HIGH_PRECISION_SCALE, RoundingMode.HALF_UP);
        BigDecimal q = safeValue(quality).divide(HUNDRED, HIGH_PRECISION_SCALE, RoundingMode.HALF_UP);

        return a.multiply(p).multiply(q).multiply(HUNDRED)
                .setScale(DEFAULT_SCALE, RoundingMode.HALF_UP);
    }

    // ==================== 格式化 ====================

    /**
     * 格式化为指定小数位数
     *
     * @param value 原始值
     * @param scale 小数位数
     * @return 格式化后的值
     */
    public static BigDecimal format(BigDecimal value, int scale) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(scale, RoundingMode.HALF_UP);
        }
        return value.setScale(scale, RoundingMode.HALF_UP);
    }
}
