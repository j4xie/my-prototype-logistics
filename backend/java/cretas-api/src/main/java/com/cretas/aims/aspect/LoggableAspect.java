package com.cretas.aims.aspect;

import com.cretas.aims.annotation.Loggable;
import com.cretas.aims.entity.datacenter.OperationLog;
import com.cretas.aims.service.datacenter.OperationLogService;
import com.cretas.aims.utils.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

/**
 * {@link Loggable} AOP 实现. 抄 {@link PerformanceMonitorAspect} 的 @Around 结构,
 * async 写 OperationLog. 异常隔离 — 审计写失败不能阻塞业务.
 *
 * <p>Sprint 4 Chat K C-LOG-AUDIT-1. 试点 5 controller (Customer/Material/PurchaseOrder/
 * SalesOrder/Equipment), 不全量 sweep — 标注由各业务方法显式选择.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class LoggableAspect {

    private final OperationLogService operationLogService;

    private static final ExpressionParser SPEL = new SpelExpressionParser();

    @Around("@annotation(loggable)")
    public Object around(ProceedingJoinPoint joinPoint, Loggable loggable) throws Throwable {
        long start = System.currentTimeMillis();
        Object result = null;
        Throwable thrown = null;
        try {
            result = joinPoint.proceed();
            return result;
        } catch (Throwable t) {
            thrown = t;
            throw t;
        } finally {
            try {
                MethodSignature sig = (MethodSignature) joinPoint.getSignature();
                Method method = sig.getMethod();
                Object[] args = joinPoint.getArgs();

                String factoryId = extractFactoryId(method, args);
                String entityId = extractParam(method, args, loggable.entityIdParam());
                String summary = evalSpEL(loggable.summary(), method, args, result);

                ServletRequestAttributes attrs =
                        (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
                HttpServletRequest req = attrs == null ? null : attrs.getRequest();

                OperationLog logEntity = OperationLog.builder()
                        .factoryId(factoryId)
                        .userId(SecurityUtils.getCurrentUserId())
                        .username(SecurityUtils.getCurrentUsername())
                        .module(loggable.module())
                        .action(loggable.action())
                        .entityType(emptyToNull(loggable.entityType()))
                        .entityId(emptyToNull(entityId))
                        .summary(emptyToNull(summary))
                        .ipAddress(req == null ? null : truncate(req.getRemoteAddr(), 64))
                        .userAgent(req == null ? null : truncate(req.getHeader("User-Agent"), 500))
                        .elapsedMs(System.currentTimeMillis() - start)
                        .success(thrown == null)
                        .errorMessage(thrown == null ? null : truncate(thrown.getMessage(), 1000))
                        .build();

                operationLogService.record(logEntity);
            } catch (Throwable auditFail) {
                log.error("[LoggableAspect] audit build failed for method {}: {}",
                        joinPoint.getSignature().toShortString(), auditFail.getMessage(), auditFail);
            }
        }
    }

    /**
     * 从方法参数提取 factoryId. 优先按参数名匹配 ("factoryId"), 否则返 null.
     * (业务方法签名约定 String factoryId 作为首个或近首个参数.)
     */
    static String extractFactoryId(Method method, Object[] args) {
        Object v = extractByName(method, args, "factoryId");
        return v == null ? null : String.valueOf(v);
    }

    static String extractParam(Method method, Object[] args, String paramName) {
        if (paramName == null || paramName.isEmpty()) return null;
        Object v = extractByName(method, args, paramName);
        return v == null ? null : String.valueOf(v);
    }

    static Object extractByName(Method method, Object[] args, String paramName) {
        Parameter[] params = method.getParameters();
        for (int i = 0; i < params.length; i++) {
            if (params[i].getName().equals(paramName)) {
                return args[i];
            }
        }
        return null;
    }

    static String evalSpEL(String expr, Method method, Object[] args, Object result) {
        if (expr == null || expr.isEmpty()) return null;
        try {
            StandardEvaluationContext ctx = new StandardEvaluationContext();
            Parameter[] params = method.getParameters();
            for (int i = 0; i < params.length; i++) {
                ctx.setVariable(params[i].getName(), args[i]);
            }
            ctx.setVariable("result", result);
            Expression e = SPEL.parseExpression(expr);
            Object v = e.getValue(ctx);
            return v == null ? null : String.valueOf(v);
        } catch (Throwable t) {
            log.warn("[LoggableAspect] SpEL eval failed for expr '{}': {}", expr, t.getMessage());
            return null;
        }
    }

    static String emptyToNull(String s) {
        return (s == null || s.isEmpty()) ? null : s;
    }

    static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
