package com.cretas.aims.service.datacenter;

import com.cretas.aims.entity.datacenter.ImportJob;
import com.cretas.aims.entity.datacenter.ImportRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

/**
 * 导入规则中心服务 — CRUD on rules + Excel parse / dryrun / commit.
 *
 * <p>Sprint 4 Chat K C-IMPORT-CENTER-1. 与现有 module-specific /import 端点并存,
 * 不替换.
 */
public interface ImportService {

    // ───── Rule CRUD ─────

    ImportRule createRule(ImportRule rule);

    ImportRule updateRule(String factoryId, Long ruleId, ImportRule patch);

    void deleteRule(String factoryId, Long ruleId);

    ImportRule getRule(String factoryId, Long ruleId);

    Page<ImportRule> listRules(String factoryId, String moduleCode, Pageable pageable);

    // ───── Dryrun + Commit ─────

    /**
     * 上传 Excel + 解析 + 行级 validate. 返 ImportJob (status=DRYRUN_DONE) 含 row-level errors.
     */
    ImportJob dryrun(String factoryId, Long ruleId, Long triggeredBy, MultipartFile file);

    /**
     * 确认提交. 仅 status=DRYRUN_DONE 的 job 可以 commit. 写入 target_entity, 失败行
     * 反向导出 Excel 落 error_file_path.
     */
    ImportJob commit(String factoryId, String jobId);

    ImportJob getJob(String factoryId, String jobId);

    Page<ImportJob> listJobs(String factoryId, String status, Pageable pageable);
}
