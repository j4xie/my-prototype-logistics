package com.cretas.aims.service.workflow;

import lombok.extern.slf4j.Slf4j;
import org.springframework.expression.EvaluationException;
import org.springframework.expression.Expression;
import org.springframework.expression.ParseException;
import org.springframework.expression.spel.SpelEvaluationException;
import org.springframework.expression.spel.SpelParseException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Objects;

/**
 * 沙箱化 SpEL 求值器 — Sprint 4 W2 Chat J C-WF-VAR-1.
 *
 * <p>替换 Sprint 3 I {@code ApprovalWorkflowExecutorImpl} 直接使用的
 * {@link org.springframework.expression.spel.support.StandardEvaluationContext} —
 * StandardEvaluationContext 默认开放 <b>反射 / Type / 构造器 / 静态方法</b> 调用,
 * 任何能编辑 workflow edge condition 的用户都能 RCE (e.g.
 * {@code T(java.lang.Runtime).getRuntime().exec('rm -rf /')}).
 *
 * <p>本实现用 {@link SimpleEvaluationContext#forReadOnlyDataBinding()}, 仅允许:
 * <ul>
 *   <li>变量引用 ({@code #own}, {@code #order})</li>
 *   <li>属性读取 ({@code .userId}, {@code .amount})</li>
 *   <li>Map 索引 ({@code ['key']})</li>
 *   <li>字面量 + 比较 + 逻辑运算符 (== / != / > / < / && / ||)</li>
 * </ul>
 * 自动 <b>禁止</b>:
 * <ul>
 *   <li>{@code T(...)} type 引用</li>
 *   <li>静态方法 ({@code Runtime.getRuntime})</li>
 *   <li>构造器 ({@code new java.lang.ProcessBuilder()})</li>
 *   <li>反射 ({@code obj.getClass().getMethods()})</li>
 *   <li>property 写入 (read-only)</li>
 * </ul>
 *
 * <p>错误处理: parse/eval 失败抛 {@link SpelEvaluationFailure} 而非 silent false,
 * 让 caller 决定 fallback (per .claude/rules/fool-proof-design.md R5 友好错误).
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
@Slf4j
@Component
public class SandboxedSpelEvaluator {

    private final SpelExpressionParser parser = new SpelExpressionParser();

    /**
     * 求值 SpEL 表达式, 返 boolean.
     *
     * @param spel SpEL 字符串 (e.g. {@code "#order.amount > 10000"})
     * @param variables 变量 map (e.g. {@code {"order": OrderContext, ...}})
     * @return {@code true} 当且仅当结果是 boolean {@code true}; 其他全部 {@code false}
     * @throws SpelEvaluationFailure 当 parse / eval 失败时, 携带 user-friendly hint
     */
    public boolean evaluateBoolean(String spel, Map<String, Object> variables)
            throws SpelEvaluationFailure {
        Objects.requireNonNull(spel, "spel must not be null");
        Object result = evaluate(spel, variables);
        if (result == null) return false;
        if (result instanceof Boolean b) return b;
        // 容忍 truthy-y: e.g. "#own != null" 实际后端可能返非 boolean.
        // 为防误判, 仅 Boolean 视为 true, 其他统一 false.
        log.warn("SpEL 求值结果非 boolean - spel={}, result type={}", spel, result.getClass().getSimpleName());
        return false;
    }

    /**
     * 求值 SpEL 表达式, 返原始 Object (供 AIChat workflow_variable_test Tool 用).
     *
     * @throws SpelEvaluationFailure 见 above
     */
    public Object evaluate(String spel, Map<String, Object> variables) throws SpelEvaluationFailure {
        Objects.requireNonNull(spel, "spel must not be null");
        SimpleEvaluationContext ctx = SimpleEvaluationContext
                .forReadOnlyDataBinding()
                .withInstanceMethods()   // 允许 String.length() 等无害实例方法
                .build();
        // forReadOnlyDataBinding() 已经内置 DataBindingPropertyAccessor (read-only).
        // SimpleEvaluationContext 不允许 addPropertyAccessor(), 配置走 builder.
        if (variables != null) {
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                ctx.setVariable(entry.getKey(), entry.getValue());
            }
        }
        try {
            Expression expression = parser.parseExpression(spel);
            return expression.getValue(ctx);
        } catch (SpelParseException pe) {
            throw new SpelEvaluationFailure(spel,
                    "SpEL 语法错误: " + pe.getSimpleMessage(),
                    "请检查表达式拼写, 例: #own.role == 'admin'",
                    pe);
        } catch (SpelEvaluationException ee) {
            // SimpleEvaluationContext 拒绝 T()/反射时抛此异常.
            throw new SpelEvaluationFailure(spel,
                    "SpEL 求值失败: " + ee.getSimpleMessage(),
                    nextActionHint(ee),
                    ee);
        } catch (ParseException | EvaluationException ge) {
            throw new SpelEvaluationFailure(spel,
                    "SpEL 错误: " + ge.getMessage(),
                    "请联系平台管理员排查",
                    ge);
        }
    }

    private String nextActionHint(SpelEvaluationException ee) {
        String msg = ee.getMessage() == null ? "" : ee.getMessage();
        if (msg.contains("Property or field") && msg.contains("cannot be found")) {
            return "变量或字段不存在 — 请在变量库 (/api/mobile/{factoryId}/workflow-variables) 查看可用列表";
        }
        if (msg.contains("Type") || msg.contains("class")) {
            return "禁止访问 Java 类型 — 表达式只能引用注册变量 (#own / #order / #customer / #businessEntity)";
        }
        if (msg.contains("not assignable") || msg.contains("immutable")) {
            return "禁止赋值操作 — 工作流条件只能读取变量, 不能 modify";
        }
        return "请检查表达式语法, 或在变量库测试器试运行";
    }

    // ==================== Custom exception ====================

    /**
     * SpEL 求值失败的 user-friendly exception.
     *
     * <p>跟普通 RuntimeException 区别: 携带 user-facing message + actionHint,
     * 调用方可直接 throw 到 GlobalExceptionHandler / 透传到 AIChat Tool result.
     */
    public static class SpelEvaluationFailure extends RuntimeException {
        private final String spel;
        private final String userMessage;
        private final String actionHint;

        public SpelEvaluationFailure(String spel, String userMessage, String actionHint, Throwable cause) {
            super(userMessage + " (expression=" + spel + ")", cause);
            this.spel = spel;
            this.userMessage = userMessage;
            this.actionHint = actionHint;
        }

        public String getSpel() { return spel; }
        public String getUserMessage() { return userMessage; }
        public String getActionHint() { return actionHint; }
    }
}
