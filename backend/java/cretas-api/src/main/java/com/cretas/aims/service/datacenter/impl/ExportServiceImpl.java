package com.cretas.aims.service.datacenter.impl;

import com.cretas.aims.entity.datacenter.ExportJob;
import com.cretas.aims.entity.datacenter.ExportRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.datacenter.ExportJobRepository;
import com.cretas.aims.repository.datacenter.ExportRuleRepository;
import com.cretas.aims.service.datacenter.ExportService;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * 导出规则服务 — Rule CRUD + run (sync 直返 base64 / async 走 {@link ExportJobRunner}).
 * 实际 entity query / SpEL filter / EasyExcel 写入由 {@link ExportExecutor} 承担.
 *
 * <p>Sprint 4 Chat K C-EXPORT-CENTER-1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportServiceImpl implements ExportService {

    private final ExportRuleRepository ruleRepo;
    private final ExportJobRepository jobRepo;
    private final ExportExecutor executor;
    private final ExportJobRunner jobRunner;

    @Override
    @Transactional
    public ExportRule createRule(ExportRule rule) {
        if (rule.getFactoryId() == null || rule.getFactoryId().isEmpty()) {
            throw new BusinessException("factoryId 必填");
        }
        if (rule.getModuleCode() == null || rule.getModuleCode().isEmpty()) {
            throw new BusinessException("moduleCode 必填");
        }
        if (rule.getColumns() == null || rule.getColumns().isEmpty()) {
            throw new BusinessException("columns 必填");
        }
        if (rule.getTargetEntity() == null || rule.getTargetEntity().isEmpty()) {
            throw new BusinessException("targetEntity 必填 (fully-qualified entity class)");
        }
        if (rule.getFormat() == null) rule.setFormat("XLSX");
        if (rule.getIsAsync() == null) rule.setIsAsync(Boolean.FALSE);
        if (rule.getRowThreshold() == null) rule.setRowThreshold(10000);
        rule.setCreatedBy(SecurityUtils.getCurrentUserId());
        return ruleRepo.save(rule);
    }

    @Override
    @Transactional
    public ExportRule updateRule(String factoryId, Long ruleId, ExportRule patch) {
        ExportRule rule = ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
        if (patch.getRuleName() != null) rule.setRuleName(patch.getRuleName());
        if (patch.getDescription() != null) rule.setDescription(patch.getDescription());
        if (patch.getColumns() != null) rule.setColumns(patch.getColumns());
        if (patch.getFilterExpression() != null) rule.setFilterExpression(patch.getFilterExpression());
        if (patch.getFormat() != null) rule.setFormat(patch.getFormat());
        if (patch.getIsAsync() != null) rule.setIsAsync(patch.getIsAsync());
        if (patch.getRowThreshold() != null) rule.setRowThreshold(patch.getRowThreshold());
        if (patch.getTargetEntity() != null) rule.setTargetEntity(patch.getTargetEntity());
        return ruleRepo.save(rule);
    }

    @Override
    @Transactional
    public void deleteRule(String factoryId, Long ruleId) {
        ExportRule rule = ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
        ruleRepo.delete(rule);  // BaseEntity @SQLDelete → soft delete
    }

    @Override
    public ExportRule getRule(String factoryId, Long ruleId) {
        return ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
    }

    @Override
    public Page<ExportRule> listRules(String factoryId, String moduleCode, Pageable pageable) {
        if (moduleCode != null && !moduleCode.isEmpty()) {
            return ruleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode, pageable);
        }
        return ruleRepo.findByFactoryId(factoryId, pageable);
    }

    @Override
    @Transactional
    public Map<String, Object> exportByRule(String factoryId, Long ruleId, Long triggeredBy,
                                            Map<String, Object> runtimeParams) {
        ExportRule rule = getRule(factoryId, ruleId);

        // v1 路由策略: 仅按 rule.isAsync 标志决定. 行数估算 (用于自动 sync/async 切换)
        // 推迟到 Day 4+ 等 EntityManager 接入更稳定后做.
        if (Boolean.TRUE.equals(rule.getIsAsync())) {
            ExportJob job = ExportJob.builder()
                    .factoryId(factoryId)
                    .ruleId(rule.getId())
                    .triggeredBy(triggeredBy)
                    .status("PENDING")
                    .runtimeParams(runtimeParams)
                    .build();
            job = jobRepo.save(job);
            jobRunner.runAsync(job.getId());  // 跨 bean 调用确保 @Async proxy 生效
            Map<String, Object> response = new HashMap<>();
            response.put("mode", "ASYNC");
            response.put("jobId", job.getId());
            response.put("status", "PENDING");
            log.info("[ExportService] async exportByRule rule={} factory={} jobId={}",
                    ruleId, factoryId, job.getId());
            return response;
        }

        // SYNC 路径: 直接 invoke executor, 返 base64.
        try {
            ExportExecutor.Result result = executor.run(rule, runtimeParams, null);
            Map<String, Object> response = new HashMap<>();
            response.put("mode", "SYNC");
            response.put("filename", buildFilename(rule));
            response.put("rowCount", result.rowCount);
            response.put("fileSizeBytes", result.fileSizeBytes);
            response.put("fileBase64", result.bytes == null ? null : Base64.getEncoder().encodeToString(result.bytes));
            log.info("[ExportService] sync exportByRule rule={} factory={} rows={} bytes={}",
                    ruleId, factoryId, result.rowCount, result.fileSizeBytes);
            return response;
        } catch (Exception ex) {
            throw new BusinessException("导出失败: " + ex.getMessage());
        }
    }

    private static String buildFilename(ExportRule rule) {
        String name = rule.getRuleName() == null ? "export" : rule.getRuleName();
        String ext = switch (rule.getFormat() == null ? "XLSX" : rule.getFormat().toUpperCase()) {
            case "CSV" -> ".csv";
            case "PDF" -> ".pdf";
            default -> ".xlsx";
        };
        return name.replaceAll("[\\\\/?*\\[\\]:]", "_") + ext;
    }

    @Override
    public ExportJob getJob(String factoryId, String jobId) {
        return jobRepo.findByIdAndFactoryId(jobId, factoryId)
                .orElseThrow(() -> new BusinessException("Job 不存在或无权访问"));
    }

    @Override
    public Page<ExportJob> listJobs(String factoryId, String status, Pageable pageable) {
        if (status != null && !status.isEmpty()) {
            return jobRepo.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageable);
        }
        return jobRepo.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }
}
