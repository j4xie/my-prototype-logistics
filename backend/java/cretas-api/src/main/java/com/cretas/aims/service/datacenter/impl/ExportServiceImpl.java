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

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 导出规则服务 — v1 实现 Rule CRUD + Job 持久化骨架. 实际查询执行 + Excel 写入
 * (调 ExcelUtil + SpEL filter eval) 在 Day 3+ 由 follow-up commit 完成.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExportServiceImpl implements ExportService {

    private final ExportRuleRepository ruleRepo;
    private final ExportJobRepository jobRepo;

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
    public Map<String, Object> exportByRule(String factoryId, Long ruleId, Long triggeredBy,
                                            Map<String, Object> runtimeParams) {
        ExportRule rule = getRule(factoryId, ruleId);

        // v1 骨架: 创建 Job 占位. Day 3+ follow-up 接入 SpEL filter eval + ExcelUtil 写入.
        // 同步路径 (≤ rowThreshold) 不创建 Job, 直接返 base64.
        // 异步路径 (> rowThreshold or isAsync=true) 创建 Job + @Async 跑.
        ExportJob job = ExportJob.builder()
                .factoryId(factoryId)
                .ruleId(rule.getId())
                .triggeredBy(triggeredBy)
                .status("PENDING")
                .runtimeParams(runtimeParams)
                .startedAt(LocalDateTime.now())
                .build();
        job = jobRepo.save(job);

        Map<String, Object> response = new HashMap<>();
        response.put("mode", "ASYNC");
        response.put("jobId", job.getId());
        response.put("note", "v1 skeleton — actual export executor pending Day 3+ follow-up");
        log.info("[ExportService] exportByRule rule={} factory={} jobId={} (skeleton)",
                ruleId, factoryId, job.getId());
        return response;
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
