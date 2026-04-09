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
        return ctx;
    }
}
