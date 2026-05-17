package com.cretas.aims.service.datacenter;

import com.cretas.aims.entity.datacenter.ExportJob;
import com.cretas.aims.entity.datacenter.ExportRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Map;

/**
 * 导出规则中心服务 — CRUD on rules + run-by-rule.
 *
 * <p>Sprint 4 Chat K C-EXPORT-CENTER-1.
 */
public interface ExportService {

    // ───── Rule CRUD ─────

    ExportRule createRule(ExportRule rule);

    ExportRule updateRule(String factoryId, Long ruleId, ExportRule patch);

    void deleteRule(String factoryId, Long ruleId);

    ExportRule getRule(String factoryId, Long ruleId);

    Page<ExportRule> listRules(String factoryId, String moduleCode, Pageable pageable);

    // ───── Run ─────

    /**
     * 按规则导出. 行数估算 ≤ rowThreshold 同步返 byte[], > rowThreshold 入 queue 返 jobId.
     *
     * @return 同步路径返 {@code {"mode":"SYNC","fileBytes":<base64>,"filename":"..."}};
     *         异步路径返 {@code {"mode":"ASYNC","jobId":"..."}}.
     */
    Map<String, Object> exportByRule(String factoryId, Long ruleId, Long triggeredBy,
                                     Map<String, Object> runtimeParams);

    /** 查询异步任务状态. Vue 轮询此接口. */
    ExportJob getJob(String factoryId, String jobId);

    Page<ExportJob> listJobs(String factoryId, String status, Pageable pageable);
}
