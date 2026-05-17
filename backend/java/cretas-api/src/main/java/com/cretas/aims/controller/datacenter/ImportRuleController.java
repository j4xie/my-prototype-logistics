package com.cretas.aims.controller.datacenter;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.datacenter.ImportJob;
import com.cretas.aims.entity.datacenter.ImportRule;
import com.cretas.aims.service.datacenter.ImportService;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 导入规则中心 — Rule CRUD + dryrun + commit + error 文件下载.
 *
 * <p>Sprint 4 Chat K C-IMPORT-CENTER-1.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/import-rules")
@RequiredArgsConstructor
public class ImportRuleController {

    private final ImportService importService;

    // ───── Rule CRUD ─────

    @GetMapping
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<ApiResponse<Page<ImportRule>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String moduleCode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<ImportRule> result = importService.listRules(factoryId, moduleCode,
                PageRequest.of(Math.max(page, 0), safeSize));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{ruleId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<ApiResponse<ImportRule>> get(
            @PathVariable String factoryId,
            @PathVariable Long ruleId) {
        return ResponseEntity.ok(ApiResponse.success(importService.getRule(factoryId, ruleId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN')")
    public ResponseEntity<ApiResponse<ImportRule>> create(
            @PathVariable String factoryId,
            @RequestBody ImportRule rule) {
        rule.setFactoryId(factoryId);
        return ResponseEntity.ok(ApiResponse.success("规则创建成功", importService.createRule(rule)));
    }

    @PutMapping("/{ruleId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN')")
    public ResponseEntity<ApiResponse<ImportRule>> update(
            @PathVariable String factoryId,
            @PathVariable Long ruleId,
            @RequestBody ImportRule patch) {
        return ResponseEntity.ok(ApiResponse.success("规则更新成功",
                importService.updateRule(factoryId, ruleId, patch)));
    }

    @DeleteMapping("/{ruleId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String factoryId,
            @PathVariable Long ruleId) {
        importService.deleteRule(factoryId, ruleId);
        return ResponseEntity.ok(ApiResponse.success("规则删除成功", null));
    }

    // ───── Dryrun + Commit ─────

    /**
     * 上传 Excel + 解析 + 行级 validate. 返 ImportJob 含 row-level errors. 不写库.
     */
    @PostMapping(value = "/{ruleId}/dryrun", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<ApiResponse<ImportJob>> dryrun(
            @PathVariable String factoryId,
            @PathVariable Long ruleId,
            @RequestParam("file") MultipartFile file) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success("dryrun 完成",
                importService.dryrun(factoryId, ruleId, userId, file)));
    }

    /** 确认提交 dryrun 通过的 Job. 仅 status=DRYRUN_DONE 可 commit. */
    @PostMapping("/jobs/{jobId}/commit")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN')")
    public ResponseEntity<ApiResponse<ImportJob>> commit(
            @PathVariable String factoryId,
            @PathVariable String jobId) {
        return ResponseEntity.ok(ApiResponse.success("提交完成", importService.commit(factoryId, jobId)));
    }

    // ───── Job tracking ─────

    @GetMapping("/jobs")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<ApiResponse<Page<ImportJob>>> listJobs(
            @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        return ResponseEntity.ok(ApiResponse.success(
                importService.listJobs(factoryId, status, PageRequest.of(Math.max(page, 0), safeSize))));
    }

    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<ApiResponse<ImportJob>> getJob(
            @PathVariable String factoryId,
            @PathVariable String jobId) {
        return ResponseEntity.ok(ApiResponse.success(importService.getJob(factoryId, jobId)));
    }

    /** 下载失败行反向导出的 Excel. */
    @GetMapping("/jobs/{jobId}/errors/download")
    @PreAuthorize("hasAnyRole('FACTORY_SUPER_ADMIN', 'PERMISSION_ADMIN', 'FACTORY_ADMIN', 'DATA_ANALYST')")
    public ResponseEntity<Resource> downloadErrors(
            @PathVariable String factoryId,
            @PathVariable String jobId) {
        ImportJob job = importService.getJob(factoryId, jobId);
        if (job.getErrorFilePath() == null) {
            return ResponseEntity.status(409).build();
        }
        File file = new File(job.getErrorFilePath());
        if (!file.exists()) {
            return ResponseEntity.status(410).build();
        }
        String filename = "import-errors-" + jobId + ".xlsx";
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.length())
                .body(new FileSystemResource(file));
    }
}
