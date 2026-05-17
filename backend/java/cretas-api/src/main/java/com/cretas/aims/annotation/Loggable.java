package com.cretas.aims.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 标注被审计的业务方法. {@code LoggableAspect} 用 @Around 拦截, async 写
 * {@code operation_logs} 表. 异常不阻塞业务方法.
 *
 * <p>Sprint 4 Chat K C-LOG-AUDIT-1 (2026-05-16). 与 AIAuditLog (AI 专用) /
 * DecisionAuditLog 并存, 覆盖 entity-level CRUD/EXPORT/IMPORT 操作.
 *
 * <p>用法 — 业务 Service 方法上标注:
 * <pre>{@code
 * @Loggable(module = "CUSTOMER", action = "UPDATE", entityType = "Customer",
 *          entityIdParam = "id")
 * public Customer update(Long id, CustomerUpdateDTO dto) { ... }
 * }</pre>
 *
 * <p>old/new 字段级 diff: v1 不在 AOP 层做 (call site 通过
 * {@link com.cretas.aims.service.datacenter.OperationLogService#recordDiff} 显式记录).
 */
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Loggable {

    /** 业务模块, e.g. CUSTOMER / MATERIAL / PURCHASE_ORDER. */
    String module();

    /** CREATE | UPDATE | DELETE | EXPORT | IMPORT | OTHER. */
    String action();

    /** Entity 简单类名, e.g. Customer / MaterialBatch. 可空 (非 entity-bound 操作). */
    String entityType() default "";

    /** 从方法参数名取 entityId; 空则不记录. e.g. {@code "id"} or {@code "customerId"}. */
    String entityIdParam() default "";

    /** 业务级摘要 (SpEL 表达式, 可访问方法参数). e.g. {@code "'客户 ' + #dto.name + ' 状态变更'"}. */
    String summary() default "";
}
