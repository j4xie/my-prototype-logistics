package com.cretas.aims.service.datacenter.impl;

import com.cretas.aims.entity.datacenter.ExportJob;
import com.cretas.aims.entity.datacenter.ExportRule;
import com.cretas.aims.repository.datacenter.ExportJobRepository;
import com.cretas.aims.repository.datacenter.ExportRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;

/**
 * Async Job runner — Spring @Async 通过此 component 触发以保证 proxy 生效 (跨 bean 调用,
 * 而非 self-invocation). ExportServiceImpl.exportByRule 决定 async 后调
 * {@link #runAsync(String)} 让 @Async 切面工作.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExportJobRunner {

    private final ExportJobRepository jobRepo;
    private final ExportRuleRepository ruleRepo;
    private final ExportExecutor executor;

    /** Async 执行入口. 任何异常都 catch 并写回 Job.status=FAILED, 不会泄漏到上层. */
    @Async
    @Transactional
    public void runAsync(String jobId) {
        ExportJob job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            log.error("[ExportJobRunner] job {} 不存在, 跳过", jobId);
            return;
        }
        try {
            job.setStatus("RUNNING");
            job.setStartedAt(LocalDateTime.now());
            jobRepo.save(job);

            ExportRule rule = ruleRepo.findById(job.getRuleId())
                    .orElseThrow(() -> new IllegalStateException(
                            "ExportRule " + job.getRuleId() + " 已被删除"));

            File outDir = new File(System.getProperty("java.io.tmpdir"), "cretas/export");
            File outFile = new File(outDir, jobId + extensionFor(rule.getFormat()));

            ExportExecutor.Result result = executor.run(rule, job.getRuntimeParams(), outFile);

            job.setStatus("SUCCESS");
            job.setRowCount(result.rowCount);
            job.setFileSizeBytes(result.fileSizeBytes);
            job.setFilePath(outFile.getAbsolutePath());
            job.setCompletedAt(LocalDateTime.now());
            jobRepo.save(job);
            log.info("[ExportJobRunner] jobId={} SUCCESS rows={} bytes={}",
                    jobId, result.rowCount, result.fileSizeBytes);
        } catch (Throwable t) {
            log.error("[ExportJobRunner] jobId={} FAILED: {}", jobId, t.getMessage(), t);
            job.setStatus("FAILED");
            job.setErrorMessage(truncate(t.getMessage(), 4000));
            job.setCompletedAt(LocalDateTime.now());
            try {
                jobRepo.save(job);
            } catch (Throwable persistFail) {
                log.error("[ExportJobRunner] 写回 FAILED 状态也失败 jobId={}: {}",
                        jobId, persistFail.getMessage());
            }
        }
    }

    private static String extensionFor(String format) {
        if (format == null) return ".xlsx";
        return switch (format.toUpperCase()) {
            case "CSV" -> ".csv";
            case "PDF" -> ".pdf";
            default -> ".xlsx";
        };
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
