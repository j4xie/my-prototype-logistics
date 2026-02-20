package com.cretas.aims.util;

import java.util.regex.Pattern;

/**
 * 错误信息脱敏工具类
 *
 * 用于在返回给前端的错误信息中移除敏感信息：
 * - 堆栈跟踪
 * - 内部类名
 * - 数据库连接信息
 * - 文件路径
 * - SQL 语句细节
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public final class ErrorSanitizer {

    private ErrorSanitizer() {
        // 私有构造函数，防止实例化
    }

    // ==================== 敏感信息匹配模式 ====================

    /**
     * SQL 相关错误信息模式
     */
    private static final Pattern SQL_ERROR_PATTERN = Pattern.compile(
            "(SQL|jdbc|mysql|postgresql|oracle|sql\\s*syntax|query|statement)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 数据库连接信息模式
     */
    private static final Pattern DB_CONNECTION_PATTERN = Pattern.compile(
            "(jdbc:[^\\s]+|host=[^\\s]+|port=[^\\s]+|password=[^\\s]+|username=[^\\s]+)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 文件路径模式
     */
    private static final Pattern FILE_PATH_PATTERN = Pattern.compile(
            "(/[a-zA-Z0-9_./]+|[A-Z]:\\\\[^\\s]+)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 堆栈跟踪模式
     */
    private static final Pattern STACK_TRACE_PATTERN = Pattern.compile(
            "(at\\s+[a-zA-Z0-9_.]+\\([^)]+\\)|caused\\s+by:\\s*|Caused\\s+by:\\s*)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 内部类名模式 (如 com.cretas.aims.xxx)
     */
    private static final Pattern INTERNAL_CLASS_PATTERN = Pattern.compile(
            "(com\\.cretas\\.[a-zA-Z0-9_.]+|org\\.springframework\\.[a-zA-Z0-9_.]+|java\\.[a-zA-Z0-9_.]+)",
            Pattern.CASE_INSENSITIVE);

    /**
     * 敏感异常类型
     */
    private static final Pattern SENSITIVE_EXCEPTION_PATTERN = Pattern.compile(
            "(NullPointerException|ArrayIndexOutOfBoundsException|ClassCastException|" +
                    "IllegalArgumentException|IllegalStateException|NumberFormatException)",
            Pattern.CASE_INSENSITIVE);

    // ==================== 脱敏映射 ====================

    /**
     * 默认脱敏后的错误消息
     */
    private static final String DEFAULT_ERROR_MESSAGE = "操作失败，请稍后重试";

    /**
     * SQL 错误的脱敏消息
     */
    private static final String SQL_ERROR_MESSAGE = "数据处理失败，请联系管理员";

    /**
     * 连接错误的脱敏消息
     */
    private static final String CONNECTION_ERROR_MESSAGE = "服务暂时不可用，请稍后重试";

    // ==================== 公共方法 ====================

    /**
     * 对错误消息进行脱敏处理
     *
     * @param message 原始错误消息
     * @return 脱敏后的消息
     */
    public static String sanitize(String message) {
        if (message == null || message.isEmpty()) {
            return DEFAULT_ERROR_MESSAGE;
        }

        // 1. 检查是否包含敏感信息，直接返回通用消息
        if (containsSensitiveInfo(message)) {
            return getSafeMessage(message);
        }

        // 2. 移除可能的堆栈跟踪和内部类名
        String sanitized = message;
        sanitized = STACK_TRACE_PATTERN.matcher(sanitized).replaceAll("");
        sanitized = INTERNAL_CLASS_PATTERN.matcher(sanitized).replaceAll("[内部错误]");
        sanitized = FILE_PATH_PATTERN.matcher(sanitized).replaceAll("[路径]");
        sanitized = DB_CONNECTION_PATTERN.matcher(sanitized).replaceAll("[连接信息]");

        // 3. 清理多余空格和换行
        sanitized = sanitized.replaceAll("\\s+", " ").trim();

        // 4. 如果脱敏后消息为空或太短，返回默认消息
        if (sanitized.isEmpty() || sanitized.length() < 3) {
            return DEFAULT_ERROR_MESSAGE;
        }

        return sanitized;
    }

    /**
     * 对异常进行脱敏处理
     *
     * @param e 异常对象
     * @return 脱敏后的消息
     */
    public static String sanitize(Throwable e) {
        if (e == null) {
            return DEFAULT_ERROR_MESSAGE;
        }

        String message = e.getMessage();
        String className = e.getClass().getSimpleName();

        // 检查是否是敏感异常类型
        if (SENSITIVE_EXCEPTION_PATTERN.matcher(className).find()) {
            return DEFAULT_ERROR_MESSAGE;
        }

        return sanitize(message);
    }

    /**
     * 安全地获取异常类型名称
     *
     * @param e 异常对象
     * @return 安全的类型名称
     */
    public static String getSafeTypeName(Throwable e) {
        if (e == null) {
            return "UnknownError";
        }

        String className = e.getClass().getSimpleName();

        // 映射到用户友好的名称
        if (className.contains("Validation")) {
            return "ValidationError";
        }
        if (className.contains("Auth") || className.contains("Access")) {
            return "AuthError";
        }
        if (className.contains("Timeout")) {
            return "TimeoutError";
        }
        if (className.contains("Connection") || className.contains("Network")) {
            return "ConnectionError";
        }
        if (className.contains("NotFound") || className.contains("NoSuch")) {
            return "NotFoundError";
        }

        // 对于其他类型，返回通用错误类型
        return "ProcessError";
    }

    // ==================== 私有方法 ====================

    /**
     * 检查消息是否包含敏感信息
     */
    private static boolean containsSensitiveInfo(String message) {
        return SQL_ERROR_PATTERN.matcher(message).find()
                || DB_CONNECTION_PATTERN.matcher(message).find()
                || STACK_TRACE_PATTERN.matcher(message).find();
    }

    /**
     * 根据消息内容返回安全的替代消息
     */
    private static String getSafeMessage(String message) {
        if (SQL_ERROR_PATTERN.matcher(message).find()) {
            return SQL_ERROR_MESSAGE;
        }
        if (DB_CONNECTION_PATTERN.matcher(message).find()) {
            return CONNECTION_ERROR_MESSAGE;
        }
        return DEFAULT_ERROR_MESSAGE;
    }
}
