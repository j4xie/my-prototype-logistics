package com.cretas.aims.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Component
public class SpelConditionEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();
    // Round 5 Fix SEC-10: bounded cache with FIFO eviction to prevent unbounded growth
    // from malicious or buggy long-tail expressions.
    private static final int MAX_CACHE_SIZE = 500;
    private static final int MAX_EXPRESSION_LENGTH = 1000;
    private final Map<String, Expression> cache = new ConcurrentHashMap<>();
    private final AtomicInteger cacheClearCount = new AtomicInteger(0);

    /**
     * Round 5 Fix SEC-2: Use SimpleEvaluationContext instead of StandardEvaluationContext.
     * StandardEvaluationContext allows full Java reflection including T(Runtime).getRuntime().exec()
     * which would let anyone who can write a validation rule execute arbitrary shell commands.
     * SimpleEvaluationContext restricts to property reads + registered helper methods.
     */
    public boolean evaluateCondition(String expression, Map<String, Object> context) {
        if (isExpressionUnsafe(expression)) return false;
        try {
            Expression expr = getCachedExpression(expression);
            EvaluationContext ctx = buildContext(context);
            Boolean result = expr.getValue(ctx, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("SpEL condition evaluation failed: '{}' — {}", expression, e.getMessage());
            return false;
        }
    }

    public BigDecimal evaluateFormula(String expression, Map<String, Object> variables, int precision) {
        if (isExpressionUnsafe(expression)) return null;
        try {
            Expression expr = getCachedExpression(expression);
            EvaluationContext ctx = buildContext(variables);
            Object result = expr.getValue(ctx);
            if (result instanceof BigDecimal bd) return bd.setScale(precision, RoundingMode.HALF_UP);
            if (result instanceof Number num) return BigDecimal.valueOf(num.doubleValue()).setScale(precision, RoundingMode.HALF_UP);
            return null;
        } catch (Exception e) {
            log.warn("SpEL formula evaluation failed: '{}' — {}", expression, e.getMessage());
            return null;
        }
    }

    public Object evaluate(String expression, Map<String, Object> context) {
        if (isExpressionUnsafe(expression)) return null;
        try {
            Expression expr = getCachedExpression(expression);
            EvaluationContext ctx = buildContext(context);
            return expr.getValue(ctx);
        } catch (Exception e) {
            log.warn("SpEL evaluation failed: '{}' — {}", expression, e.getMessage());
            return null;
        }
    }

    /** Round 5 Fix SEC-10: reject suspiciously long or dangerous expressions before parsing. */
    private boolean isExpressionUnsafe(String expression) {
        if (expression == null || expression.isBlank()) return true;
        if (expression.length() > MAX_EXPRESSION_LENGTH) {
            log.warn("SpEL expression rejected: length {} exceeds max {}",
                     expression.length(), MAX_EXPRESSION_LENGTH);
            return true;
        }
        // Belt-and-braces: even with SimpleEvaluationContext, reject expressions containing
        // T(...) type references as extra protection in case evaluator is misconfigured.
        if (expression.contains("T(") || expression.contains("@")
                || expression.contains("new ") || expression.contains("Runtime")
                || expression.contains("ProcessBuilder") || expression.contains("Class.forName")) {
            log.warn("SpEL expression rejected: contains disallowed token — {}", expression);
            return true;
        }
        return false;
    }

    /** Cache with size cap + FIFO eviction via clear-all when exceeded. */
    private Expression getCachedExpression(String expression) {
        if (cache.size() >= MAX_CACHE_SIZE) {
            cache.clear();
            cacheClearCount.incrementAndGet();
            log.info("SpEL expression cache cleared (size exceeded {}). Cleared {} times total.",
                     MAX_CACHE_SIZE, cacheClearCount.get());
        }
        return cache.computeIfAbsent(expression, parser::parseExpression);
    }

    /**
     * Round 5 Fix SEC-2: SimpleEvaluationContext restricts expressions to data binding
     * (property reads + registered methods). Blocks T(...), new, @bean references,
     * and arbitrary constructor/method calls that StandardEvaluationContext allows.
     */
    private EvaluationContext buildContext(Map<String, Object> variables) {
        SimpleEvaluationContext.Builder builder = SimpleEvaluationContext
                .forReadOnlyDataBinding()
                .withInstanceMethods();  // allow calls like #myVar.length()

        // Round 4 Fix P1-8: register time helper functions via method registration.
        // SimpleEvaluationContext supports setVariable for static methods registered as functions.
        SimpleEvaluationContext ctx = builder.build();
        if (variables != null) {
            variables.forEach(ctx::setVariable);
        }
        try {
            ctx.setVariable("now", SpelConditionEvaluator.class.getDeclaredMethod("now"));
            ctx.setVariable("addHours",
                SpelConditionEvaluator.class.getDeclaredMethod("addHours", Object.class, Number.class));
            ctx.setVariable("addMinutes",
                SpelConditionEvaluator.class.getDeclaredMethod("addMinutes", Object.class, Number.class));
            ctx.setVariable("addDays",
                SpelConditionEvaluator.class.getDeclaredMethod("addDays", Object.class, Number.class));
            ctx.setVariable("daysBetween",
                SpelConditionEvaluator.class.getDeclaredMethod("daysBetween", Object.class, Object.class));
        } catch (NoSuchMethodException e) {
            log.warn("Failed to register SpEL time helper functions: {}", e.getMessage());
        }
        return ctx;
    }

    // --- SpEL helper functions (static so they can be registered via registerFunction) ---

    public static java.time.LocalDateTime now() {
        return java.time.LocalDateTime.now();
    }

    public static java.time.LocalDateTime addHours(Object base, Number hours) {
        java.time.LocalDateTime t = toLocalDateTime(base);
        return t == null ? null : t.plusHours(hours.longValue());
    }

    public static java.time.LocalDateTime addMinutes(Object base, Number minutes) {
        java.time.LocalDateTime t = toLocalDateTime(base);
        return t == null ? null : t.plusMinutes(minutes.longValue());
    }

    public static java.time.LocalDateTime addDays(Object base, Number days) {
        java.time.LocalDateTime t = toLocalDateTime(base);
        return t == null ? null : t.plusDays(days.longValue());
    }

    public static Long daysBetween(Object start, Object end) {
        java.time.LocalDateTime s = toLocalDateTime(start);
        java.time.LocalDateTime e = toLocalDateTime(end);
        if (s == null || e == null) return null;
        return java.time.Duration.between(s, e).toDays();
    }

    private static java.time.LocalDateTime toLocalDateTime(Object v) {
        if (v == null) return null;
        if (v instanceof java.time.LocalDateTime ldt) return ldt;
        if (v instanceof java.time.LocalDate ld) return ld.atStartOfDay();
        if (v instanceof CharSequence s) {
            try { return java.time.LocalDateTime.parse(s); } catch (Exception ignored) {}
            try { return java.time.LocalDate.parse(s).atStartOfDay(); } catch (Exception ignored) {}
        }
        return null;
    }
}
