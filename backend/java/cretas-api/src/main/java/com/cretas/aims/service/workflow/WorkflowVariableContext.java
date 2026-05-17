package com.cretas.aims.service.workflow;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 工作流变量上下文 — Sprint 4 W2 Chat J C-WF-VAR-1.
 *
 * <p>暴露给 SpEL 求值器的<b>受控</b>变量集合. 设计三原则:
 * <ol>
 *   <li><b>命名空间隔离</b>: 顶层变量 (own / order / customer / businessEntity)
 *       是 SafeAccessor 包装, 仅能读 whitelisted 字段, 无方法调用。</li>
 *   <li><b>无反射</b>: SpEL Sandbox ({@link SandboxedSpelEvaluator}) 跟此 context
 *       配合, 禁止任何 {@code T(...)} / {@code new Object()} / {@code .getClass()}。</li>
 *   <li><b>动态扩展点</b>: {@code businessEntity} = 通用 Map, 兼容未来未注册的
 *       业务实体类型 (调用方传 {@code Map<String,Object>}); 但 SpEL 只能 get,
 *       无法 mutate。</li>
 * </ol>
 *
 * <p>SpEL 表达式 示例:
 * <pre>
 *   #own.role == 'factory_admin' && #order.amount > 10000
 *   #customer.level == 'VIP' || #businessEntity['priority'] == 'HIGH'
 * </pre>
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
public class WorkflowVariableContext {

    /** 当前用户上下文 (谁触发的审批). */
    private OwnContext own;
    /** 单据上下文 (订单/退货/发货/...). */
    private OrderContext order;
    /** 客户上下文 (订单关联客户). */
    private CustomerContext customer;
    /**
     * 通用业务实体 — 任何未在上面命名空间的字段挂这里.
     * SpEL 通过 {@code #businessEntity['key']} 访问.
     */
    @Builder.Default
    private Map<String, Object> businessEntity = new HashMap<>();

    public WorkflowVariableContext(
            OwnContext own,
            OrderContext order,
            CustomerContext customer,
            Map<String, Object> businessEntity) {
        this.own = own;
        this.order = order;
        this.customer = customer;
        this.businessEntity = businessEntity == null ? new HashMap<>() : businessEntity;
    }

    /**
     * 构建 SpEL evaluator 用的变量 map.
     * Key = SpEL {@code #key} reference, Value = sandbox-safe object.
     */
    public Map<String, Object> toSpelVariables() {
        Map<String, Object> vars = new LinkedHashMap<>();
        if (own != null) vars.put("own", own);
        if (order != null) vars.put("order", order);
        if (customer != null) vars.put("customer", customer);
        // businessEntity 是 Map<String,Object>, SpEL SimpleEvaluationContext 支持
        // map.get(key) via [] 语法
        vars.put("businessEntity", businessEntity == null ? Map.of() : businessEntity);
        return vars;
    }

    // ==================== Sub-contexts (POJO, getter only via @Data setters) ====================

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    public static class OwnContext {
        /** 当前用户 ID (Long → Number compat). */
        private Long userId;
        /** 用户名 (登录名). */
        private String username;
        /** 角色 code, e.g. "factory_admin" / "warehouse_manager". */
        private String role;
        /** 部门 code, e.g. "WAREHOUSE" / "FINANCE". */
        private String department;

        public OwnContext(Long userId, String username, String role, String department) {
            this.userId = userId;
            this.username = username;
            this.role = role;
            this.department = department;
        }
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    public static class OrderContext {
        /** 单号 (统一字段名, 任何单据都用). */
        private String orderNumber;
        /** 单据金额 (decimal, BigDecimal SpEL 自动转 number 比较). */
        private BigDecimal amount;
        /** 单据类型 (e.g. "SALES" / "PURCHASE" / "RETURN"). */
        private String type;
        /** 创建人 (审批 hierarchy 用). */
        private Long creatorId;
        /** 单据状态 (e.g. "PENDING_APPROVAL"). */
        private String status;

        public OrderContext(String orderNumber, BigDecimal amount, String type,
                            Long creatorId, String status) {
            this.orderNumber = orderNumber;
            this.amount = amount;
            this.type = type;
            this.creatorId = creatorId;
            this.status = status;
        }
    }

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    public static class CustomerContext {
        /** 客户 ID. */
        private String id;
        /** 客户名称 (中文 OK). */
        private String name;
        /** 客户等级 (e.g. "VIP" / "NORMAL" / "BLACKLIST"). */
        private String level;
        /** 信用额度 (decimal). */
        private BigDecimal creditLimit;

        public CustomerContext(String id, String name, String level, BigDecimal creditLimit) {
            this.id = id;
            this.name = name;
            this.level = level;
            this.creditLimit = creditLimit;
        }
    }
}
