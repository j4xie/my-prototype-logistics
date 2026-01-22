package com.cretas.aims.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

/**
 * 性能监控切面
 * 监控子服务方法执行时间
 */
@Slf4j
@Aspect
@Component
public class PerformanceMonitorAspect {

    // 监控 scheduling 子服务
    @Pointcut("execution(* com.cretas.aims.service.scheduling.impl.*.*(..))")
    public void schedulingServiceMethods() {}

    // 监控 intent 子服务
    @Pointcut("execution(* com.cretas.aims.service.intent.impl.*.*(..))")
    public void intentServiceMethods() {}

    // 监控 executor 子服务
    @Pointcut("execution(* com.cretas.aims.service.executor.impl.*.*(..))")
    public void executorServiceMethods() {}

    @Around("schedulingServiceMethods() || intentServiceMethods() || executorServiceMethods()")
    public Object monitorPerformance(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long startTime = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - startTime;

            // 只记录超过 100ms 的慢方法
            if (duration > 100) {
                log.warn("[性能监控] {} 执行耗时 {}ms (超过阈值)", methodName, duration);
            } else if (log.isDebugEnabled()) {
                log.debug("[性能监控] {} 执行耗时 {}ms", methodName, duration);
            }

            return result;
        } catch (Throwable e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("[性能监控] {} 执行失败，耗时 {}ms，错误: {}",
                     methodName, duration, e.getMessage());
            throw e;
        }
    }
}
