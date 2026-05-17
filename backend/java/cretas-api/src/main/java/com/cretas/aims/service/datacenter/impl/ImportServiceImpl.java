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

import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 导入规则服务 — Rule CRUD + dryrun (Excel 解析 + validator) + commit 骨架.
 * Excel 解析与 validation 由 {@link ImportExecutor} 承担; commit 写 target_entity
 * (reflection + dedup + 失败反向 export) 推迟到下一轮.
 *
 * <p>Sprint 4 Chat K C-IMPORT-CENTER-1.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImportServiceImpl implements ImportService {

    private final ImportRuleRepository ruleRepo;
    private final ImportJobRepository jobRepo;
    private final ImportExecutor importExecutor;
    private final ImportCommitter importCommitter;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

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
        if (file == null || file.isEmpty()) {
            throw new BusinessException("请上传 Excel 文件");
        }
        ImportRule rule = getRule(factoryId, ruleId);
        ImportJob job = ImportJob.builder()
                .factoryId(factoryId)
                .ruleId(rule.getId())
                .triggeredBy(triggeredBy)
                .status("PENDING")
                .sourceFilename(file.getOriginalFilename())
                .startedAt(LocalDateTime.now())
                .build();
        job = jobRepo.save(job);

        try {
            // 文件落盘到 tmp 以便 commit 阶段重读. UUID-prefixed 避免冲突.
            File tmpDir = new File(System.getProperty("java.io.tmpdir"), "cretas/import");
            if (!tmpDir.exists() && !tmpDir.mkdirs()) {
                throw new IllegalStateException("无法创建上传缓存目录: " + tmpDir.getAbsolutePath());
            }
            File saved = new File(tmpDir, job.getId() + "-" + safeName(file.getOriginalFilename()));
            file.transferTo(saved);
            job.setSourceFilePath(saved.getAbsolutePath());

            try (InputStream in = Files.newInputStream(saved.toPath())) {
                ImportExecutor.DryrunResult result = importExecutor.parseAndValidate(rule, in);
                job.setTotalRows(result.totalRows);
                job.setValidRows(result.validRows);
                job.setErrorRows(result.totalRows - result.validRows);
                job.setErrors(result.errors);
                job.setStatus("DRYRUN_DONE");
                job.setCompletedAt(LocalDateTime.now());
                jobRepo.save(job);
                log.info("[ImportService] dryrun rule={} factory={} jobId={} total={} valid={} errors={}",
                        ruleId, factoryId, job.getId(), result.totalRows, result.validRows, result.errors.size());
                return job;
            }
        } catch (Exception ex) {
            log.error("[ImportService] dryrun jobId={} failed: {}", job.getId(), ex.getMessage(), ex);
            job.setStatus("FAILED");
            job.setCompletedAt(LocalDateTime.now());
            jobRepo.save(job);
            throw new BusinessException("Dryrun 失败: " + ex.getMessage());
        }
    }

    private static String safeName(String name) {
        if (name == null || name.isEmpty()) return "upload.xlsx";
        return name.replaceAll("[\\\\/?*\\[\\]:]", "_");
    }

    @Override
    @Transactional
    public ImportJob commit(String factoryId, String jobId) {
        ImportJob job = getJob(factoryId, jobId);
        if (!"DRYRUN_DONE".equals(job.getStatus())) {
            throw new BusinessException("仅 DRYRUN_DONE 状态的 Job 可提交, 当前状态: " + job.getStatus());
        }
        if (job.getErrorRows() != null && job.getErrorRows() > 0) {
            throw new BusinessException(
                    "存在 " + job.getErrorRows() + " 行错误未修正, 请下载修正后重新 dryrun");
        }
        if (job.getSourceFilePath() == null) {
            throw new BusinessException("源文件已被清理, 请重新 dryrun");
        }
        File excelFile = new File(job.getSourceFilePath());
        if (!excelFile.exists()) {
            throw new BusinessException("源文件不存在: " + job.getSourceFilePath());
        }

        ImportRule rule = getRule(factoryId, job.getRuleId());
        try {
            ImportCommitter.CommitResult result =
                    importCommitter.commit(rule, excelFile, factoryId);
            job.setCommittedRows(result.committedRows);
            if (!result.commitErrors.isEmpty()) {
                // 部分失败 — 反向导出错误行
                String errorFile = importCommitter.exportErrorRows(result.commitErrors, jobId);
                job.setErrorFilePath(errorFile);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> existingErrors = job.getErrors() == null
                        ? new ArrayList<>() : new ArrayList<>(job.getErrors());
                existingErrors.addAll(result.commitErrors);
                job.setErrors(existingErrors);
                job.setStatus("FAILED");
                log.warn("[ImportService] commit jobId={} 部分失败: {} 行成功, {} 行失败",
                        jobId, result.committedRows, result.commitErrors.size());
            } else {
                job.setStatus("COMMITTED");
                log.info("[ImportService] commit jobId={} SUCCESS rows={}", jobId, result.committedRows);
            }
            job.setCompletedAt(LocalDateTime.now());
            return jobRepo.save(job);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception ex) {
            log.error("[ImportService] commit jobId={} 异常: {}", jobId, ex.getMessage(), ex);
            job.setStatus("FAILED");
            job.setCompletedAt(LocalDateTime.now());
            jobRepo.save(job);
            throw new BusinessException("提交失败: " + ex.getMessage());
        }
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
