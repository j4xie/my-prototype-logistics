package com.cretas.aims.service.datacenter.impl;

import com.cretas.aims.entity.datacenter.ImportJob;
import com.cretas.aims.entity.datacenter.ImportRule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.datacenter.ImportJobRepository;
import com.cretas.aims.repository.datacenter.ImportRuleRepository;
import com.cretas.aims.service.datacenter.ImportService;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

/**
 * 导入规则服务 — v1 实现 Rule CRUD + Job 持久化骨架. Excel 解析 + validator engine +
 * commit 写 target_entity 在 Day 5+ follow-up 完成 (依赖 ExcelUtil 双向 + entity reflection).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImportServiceImpl implements ImportService {

    private final ImportRuleRepository ruleRepo;
    private final ImportJobRepository jobRepo;

    @Override
    @Transactional
    public ImportRule createRule(ImportRule rule) {
        if (rule.getFactoryId() == null || rule.getFactoryId().isEmpty()) {
            throw new BusinessException("factoryId 必填");
        }
        if (rule.getModuleCode() == null || rule.getModuleCode().isEmpty()) {
            throw new BusinessException("moduleCode 必填");
        }
        if (rule.getMapping() == null || rule.getMapping().isEmpty()) {
            throw new BusinessException("mapping 必填");
        }
        if (rule.getTargetEntity() == null || rule.getTargetEntity().isEmpty()) {
            throw new BusinessException("targetEntity 必填 (fully-qualified class name)");
        }
        if (rule.getDedupStrategy() == null) rule.setDedupStrategy("ERROR");
        rule.setCreatedBy(SecurityUtils.getCurrentUserId());
        return ruleRepo.save(rule);
    }

    @Override
    @Transactional
    public ImportRule updateRule(String factoryId, Long ruleId, ImportRule patch) {
        ImportRule rule = ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
        if (patch.getRuleName() != null) rule.setRuleName(patch.getRuleName());
        if (patch.getDescription() != null) rule.setDescription(patch.getDescription());
        if (patch.getMapping() != null) rule.setMapping(patch.getMapping());
        if (patch.getDedupStrategy() != null) rule.setDedupStrategy(patch.getDedupStrategy());
        if (patch.getDedupKeyField() != null) rule.setDedupKeyField(patch.getDedupKeyField());
        if (patch.getTargetEntity() != null) rule.setTargetEntity(patch.getTargetEntity());
        return ruleRepo.save(rule);
    }

    @Override
    @Transactional
    public void deleteRule(String factoryId, Long ruleId) {
        ImportRule rule = ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
        ruleRepo.delete(rule);
    }

    @Override
    public ImportRule getRule(String factoryId, Long ruleId) {
        return ruleRepo.findByIdAndFactoryId(ruleId, factoryId)
                .orElseThrow(() -> new BusinessException("规则不存在或无权访问"));
    }

    @Override
    public Page<ImportRule> listRules(String factoryId, String moduleCode, Pageable pageable) {
        if (moduleCode != null && !moduleCode.isEmpty()) {
            return ruleRepo.findByFactoryIdAndModuleCode(factoryId, moduleCode, pageable);
        }
        return ruleRepo.findByFactoryId(factoryId, pageable);
    }

    @Override
    @Transactional
    public ImportJob dryrun(String factoryId, Long ruleId, Long triggeredBy, MultipartFile file) {
        ImportRule rule = getRule(factoryId, ruleId);
        ImportJob job = ImportJob.builder()
                .factoryId(factoryId)
                .ruleId(rule.getId())
                .triggeredBy(triggeredBy)
                .status("PENDING")
                .sourceFilename(file == null ? null : file.getOriginalFilename())
                .startedAt(LocalDateTime.now())
                .build();
        job = jobRepo.save(job);
        log.info("[ImportService] dryrun rule={} factory={} jobId={} (skeleton — Day 5+ to parse Excel)",
                ruleId, factoryId, job.getId());
        return job;
    }

    @Override
    @Transactional
    public ImportJob commit(String factoryId, String jobId) {
        ImportJob job = getJob(factoryId, jobId);
        if (!"DRYRUN_DONE".equals(job.getStatus())) {
            throw new BusinessException("仅 DRYRUN_DONE 状态的 Job 可提交, 当前状态: " + job.getStatus());
        }
        // v1 skeleton — Day 5+ follow-up: 写 target_entity 表 + 反向导出失败行.
        job.setStatus("COMMITTED");
        job.setCompletedAt(LocalDateTime.now());
        return jobRepo.save(job);
    }

    @Override
    public ImportJob getJob(String factoryId, String jobId) {
        return jobRepo.findByIdAndFactoryId(jobId, factoryId)
                .orElseThrow(() -> new BusinessException("Job 不存在或无权访问"));
    }

    @Override
    public Page<ImportJob> listJobs(String factoryId, String status, Pageable pageable) {
        if (status != null && !status.isEmpty()) {
            return jobRepo.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageable);
        }
        return jobRepo.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
    }
}
