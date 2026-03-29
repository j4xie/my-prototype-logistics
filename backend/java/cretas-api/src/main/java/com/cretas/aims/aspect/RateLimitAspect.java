package com.cretas.aims.aspect;

import com.cretas.aims.annotation.RateLimit;
import com.cretas.aims.annotation.RateLimit.LimitType;
import com.cretas.aims.exception.RateLimitExceededException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 限流切面
 *
 * 基于 Caffeine 缓存实现固定窗口限流（无 Redis 依赖）。
 *
 * 工作原理:
 * 1. 按 {@link RateLimit#period()} 分桶创建 Caffeine Cache（每个 period 值对应一个 Cache 实例）
 * 2. Cache key = "ratelimit:{limitType}:{class.method}:{identifier}"
 * 3. Cache value = AtomicInteger 计数器
 * 4. Caffeine expireAfterWrite 自动清理过期窗口
 *
 * 线程安全: AtomicInteger.incrementAndGet() 保证原子递增。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-03-28
 */
@Slf4j
@Aspect
@Component
public class RateLimitAspect {

    /**
     * 按 period 值缓存 Caffeine 实例，避免重复创建。
     * Key = period (秒), Value = Caffeine cache instance。
     */
    private final ConcurrentHashMap<Integer, Cache<String, AtomicInteger>> cacheMap = new ConcurrentHashMap<>();

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint point, RateLimit rateLimit) throws Throwable {
        String key = buildKey(rateLimit, point);
        Cache<String, AtomicInteger> cache = getCache(rateLimit.period());

        AtomicInteger counter = cache.get(key, k -> new AtomicInteger(0));
        int currentCount = counter.incrementAndGet();

        if (currentCount > rateLimit.count()) {
            log.warn("限流触发: key={}, count={}/{}, period={}s",
                    key, currentCount, rateLimit.count(), rateLimit.period());
            throw new RateLimitExceededException(rateLimit.message());
        }

        if (log.isDebugEnabled()) {
            log.debug("限流计数: key={}, count={}/{}", key, currentCount, rateLimit.count());
        }

        return point.proceed();
    }

    /**
     * 获取或创建指定 period 的 Caffeine Cache。
     */
    private Cache<String, AtomicInteger> getCache(int periodSeconds) {
        return cacheMap.computeIfAbsent(periodSeconds, p ->
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofSeconds(p))
                        .maximumSize(10_000)
                        .build());
    }

    /**
     * 构建限流 key。
     *
     * 格式: ratelimit:{limitType}:{class.method}:{identifier}
     */
    private String buildKey(RateLimit rateLimit, ProceedingJoinPoint point) {
        MethodSignature signature = (MethodSignature) point.getSignature();
        Method method = signature.getMethod();
        String endpoint = method.getDeclaringClass().getSimpleName() + "." + method.getName();

        StringBuilder sb = new StringBuilder("ratelimit:");

        switch (rateLimit.limitType()) {
            case IP:
                sb.append("ip:").append(endpoint).append(":").append(getClientIp());
                break;
            case USER:
                sb.append("user:").append(endpoint).append(":").append(getUserId());
                break;
            case GLOBAL:
                sb.append("global:").append(endpoint);
                break;
        }

        return sb.toString();
    }

    /**
     * 获取客户端真实 IP，支持反向代理。
     *
     * 检查顺序: X-Forwarded-For > X-Real-IP > remoteAddr
     */
    private String getClientIp() {
        HttpServletRequest request = getRequest();
        if (request == null) {
            return "unknown";
        }

        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            // X-Forwarded-For may contain multiple IPs: client, proxy1, proxy2
            // Take the first one (original client)
            int commaIdx = ip.indexOf(',');
            return commaIdx > 0 ? ip.substring(0, commaIdx).trim() : ip.trim();
        }

        ip = request.getHeader("X-Real-IP");
        if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.trim();
        }

        return request.getRemoteAddr();
    }

    /**
     * 获取当前已认证用户 ID（由 JwtAuthInterceptor 设置到 request attribute）。
     *
     * 如果无法获取 userId（未登录、token 无效等），回退到 IP 限流。
     */
    private String getUserId() {
        HttpServletRequest request = getRequest();
        if (request != null) {
            Object userId = request.getAttribute("userId");
            if (userId != null) {
                return userId.toString();
            }
        }
        // Fallback to IP if userId not available
        log.debug("userId 不可用，回退到 IP 限流");
        return "ip:" + getClientIp();
    }

    private HttpServletRequest getRequest() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest() : null;
    }
}
