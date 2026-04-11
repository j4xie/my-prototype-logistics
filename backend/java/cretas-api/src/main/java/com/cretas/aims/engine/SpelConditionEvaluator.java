package com.cretas.aims.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class SpelConditionEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> cache = new ConcurrentHashMap<>();

    public boolean evaluateCondition(String expression, Map<String, Object> context) {
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            EvaluationContext ctx = buildContext(context);
            Boolean result = expr.getValue(ctx, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.warn("SpEL condition evaluation failed: '{}' — {}", expression, e.getMessage());
            return false;
        }
    }

    public BigDecimal evaluateFormula(String expression, Map<String, Object> variables, int precision) {
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
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
        try {
            Expression expr = cache.computeIfAbsent(expression, parser::parseExpression);
            EvaluationContext ctx = buildContext(context);
            return expr.getValue(ctx);
        } catch (Exception e) {
            log.warn("SpEL evaluation failed: '{}' — {}", expression, e.getMessage());
            return null;
        }
    }

    private EvaluationContext buildContext(Map<String, Object> variables) {
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        if (variables != null) {
            variables.forEach(ctx::setVariable);
        }
        // Round 4 Fix P1-8: register time/date helper functions so computedWhen can do
        //   cf_expire_at = #addHours(#cf_start_time, 4)
        //   valid_for_days = #daysBetween(#start_date, #end_date)
        try {
            ctx.registerFunction("now",
                SpelConditionEvaluator.class.getDeclaredMethod("now"));
            ctx.registerFunction("addHours",
                SpelConditionEvaluator.class.getDeclaredMethod("addHours", Object.class, Number.class));
            ctx.registerFunction("addMinutes",
                SpelConditionEvaluator.class.getDeclaredMethod("addMinutes", Object.class, Number.class));
            ctx.registerFunction("addDays",
                SpelConditionEvaluator.class.getDeclaredMethod("addDays", Object.class, Number.class));
            ctx.registerFunction("daysBetween",
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
