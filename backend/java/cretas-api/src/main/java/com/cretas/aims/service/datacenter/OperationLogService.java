package com.cretas.aims.service.datacenter;

import com.cretas.aims.entity.datacenter.OperationLog;

import java.util.Map;

/**
 * OperationLog 写入与查询服务. AOP 层调用 {@link #record}, 业务 Service 显式 diff 调用
 * {@link #recordDiff}. 实现层负责 async + exception isolation (失败不阻塞业务).
 *
 * <p>Sprint 4 Chat K C-LOG-AUDIT-1.
 */
public interface OperationLogService {

    /**
     * AOP 调用入口. 记录元数据 (factoryId/userId/module/action/entity/elapsed/success).
     * 实现层 async 写库, 写失败 log.error 但不抛.
     */
    void record(OperationLog logEntity);

    /**
     * 业务 Service 显式调用 — 记录字段级 diff. 适用于 UPDATE 场景, oldEntity 在 method 内
     * 已经 load 出来, 调用方传入 before/after Map.
     *
     * @param factoryId   工厂 ID
     * @param module      业务模块
     * @param entityType  Entity 简单类名
     * @param entityId    Entity 主键
     * @param oldValue    变更前 snapshot (CREATE 时 null)
     * @param newValue    变更后 snapshot (DELETE 时 null)
     * @param summary     业务级说明 (可空)
     */
    void recordDiff(String factoryId, String module, String entityType, String entityId,
                    Map<String, Object> oldValue, Map<String, Object> newValue, String summary);
}
