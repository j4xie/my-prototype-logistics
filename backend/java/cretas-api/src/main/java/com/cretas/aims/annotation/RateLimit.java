package com.cretas.aims.annotation;

import java.lang.annotation.*;

/**
 * 接口限流注解
 *
 * 基于 Caffeine 缓存的固定窗口限流，支持按 IP、用户、全局三种维度。
 *
 * 使用示例:
 * <pre>
 * // 按 IP 限流：60秒内最多5次
 * @RateLimit(count = 5, period = 60, limitType = LimitType.IP)
 * public ApiResponse<?> login() { ... }
 *
 * // 按用户限流：60秒内最多20次
 * @RateLimit(count = 20, period = 60, limitType = LimitType.USER)
 * public ApiResponse<?> chat() { ... }
 *
 * // 全局限流：60秒内最多100次
 * @RateLimit(count = 100, period = 60, limitType = LimitType.GLOBAL)
 * public ApiResponse<?> publicEndpoint() { ... }
 * </pre>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-28
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RateLimit {

    /**
     * 窗口期内允许的最大请求数
     */
    int count() default 60;

    /**
     * 窗口期（秒）
     */
    int period() default 60;

    /**
     * 限流维度
     */
    LimitType limitType() default LimitType.IP;

    /**
     * 限流触发时的错误消息
     */
    String message() default "请求过于频繁，请稍后再试";

    /**
     * 限流维度枚举
     */
    enum LimitType {
        /** 按客户端 IP 限流 */
        IP,
        /** 按已认证用户 ID 限流（从 JWT 提取） */
        USER,
        /** 全局限流（所有请求共享计数） */
        GLOBAL
    }
}
