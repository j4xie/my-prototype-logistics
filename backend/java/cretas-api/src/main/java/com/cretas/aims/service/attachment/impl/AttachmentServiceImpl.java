package com.cretas.aims.service.attachment.impl;

import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.cretas.aims.config.OssConfig;
import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.Attachment.EntityType;
import com.cretas.aims.entity.Attachment.FileCategory;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AttachmentRepository;
import com.cretas.aims.service.OssService;
import com.cretas.aims.service.attachment.AttachmentService;
import com.cretas.aims.service.attachment.dto.RegisterAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UpdateAttachmentRequest;
import com.cretas.aims.utils.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AttachmentService 实现 — C-ATT-1 Day 3.
 *
 * <p>OSS pre-signed URL 策略:
 * <ul>
 *   <li>PUT (上传): 5 分钟有效, 前端直传不经 Java 字节流</li>
 *   <li>GET (下载): 1 小时有效, 跟随 entity 权限</li>
 * </ul>
 *
 * <p>OSS bean 在 dev / test 环境 conditional 关闭 ({@code aliyun.oss.enabled=false}),
 * 此时 {@link #ossClient} 为 null, upload/download URL 方法会返回明确错误.
 * Day 5 集成测试时启用真实 OSS.
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    private static final int UPLOAD_URL_TTL_SECONDS = 300;     // 5 分钟
    private static final int DOWNLOAD_URL_TTL_SECONDS = 3600;  // 1 小时

    private final AttachmentRepository attachmentRepository;
    private final OssService ossService;
    private final OssConfig ossConfig;

    /** OSS 直接客户端 — pre-signed PUT 用; {@code aliyun.oss.enabled=false} 时为 null. */
    @Autowired(required = false)
    private OSS ossClient;

    // ==================== register ====================

    @Override
    @Transactional
    public Attachment register(String factoryId, RegisterAttachmentRequest req, Long userId) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法注册附件");
        }

        // 去重: 同 factory 同 hash 视为同一文件
        if (req.getFileHash() != null && !req.getFileHash().isBlank()) {
            Optional<Attachment> existing = attachmentRepository
                    .findByFactoryIdAndFileHash(factoryId, req.getFileHash());
            if (existing.isPresent()) {
                log.info("Attachment 去重命中: factory={} hash={} existingId={}",
                        factoryId, req.getFileHash(), existing.get().getId());
                return existing.get();
            }
        }

        Attachment a = new Attachment();
        a.setFactoryId(factoryId);
        a.setEntityType(req.getEntityType());
        a.setEntityId(req.getEntityId());
        a.setFileName(req.getFileName());
        a.setFileUrl(req.getFileUrl());
        a.setThumbnailUrl(req.getThumbnailUrl());
        a.setFileSize(req.getFileSize());
        a.setFileType(req.getFileType());
        a.setFileCategory(req.getFileCategory() != null ? req.getFileCategory() : inferCategory(req.getFileType()));
        a.setFileStorage(req.getFileStorage() != null ? req.getFileStorage() : "OSS");
        a.setFileHash(req.getFileHash());
        a.setBusinessTag(req.getBusinessTag());
        a.setDescription(req.getDescription());
        a.setUploadedBy(userId);
        a.setUploadedAt(LocalDateTime.now());
        a.setUploadSource(req.getUploadSource() != null ? req.getUploadSource() : "WEB");

        Attachment saved = attachmentRepository.save(a);
        log.info("Attachment 注册: factory={} entityType={} entityId={} id={} fileName={}",
                factoryId, req.getEntityType(), req.getEntityId(), saved.getId(), req.getFileName());
        return saved;
    }

    // ==================== query / count ====================

    @Override
    @Transactional(readOnly = true)
    public List<Attachment> queryByEntity(String factoryId, EntityType type, String entityId) {
        return attachmentRepository
                .findByFactoryIdAndEntityTypeAndEntityIdOrderByUploadedAtDesc(factoryId, type, entityId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> countByEntities(String factoryId, EntityType type, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyMap();
        }
        List<Object[]> rows = attachmentRepository.countByEntities(factoryId, type, ids);
        return rows.stream().collect(Collectors.toMap(
                row -> (String) row[0],
                row -> ((Number) row[1]).longValue()
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public Attachment getById(String factoryId, String id) {
        return attachmentRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new BusinessException(404, "附件不存在或无权访问"));
    }

    // ==================== OSS URLs ====================

    @Override
    public String generateUploadUrl(String factoryId, String fileName, String fileType) {
        if (ossClient == null) {
            throw new BusinessException(503, "OSS 服务未启用 — 请联系管理员配置 aliyun.oss.enabled=true");
        }
        String objectKey = buildObjectKey(factoryId, fileName);
        Date expiration = new Date(System.currentTimeMillis() + UPLOAD_URL_TTL_SECONDS * 1000L);
        String url = ossClient.generatePresignedUrl(
                ossConfig.getMediaBucket(), objectKey, expiration, HttpMethod.PUT).toString();
        log.debug("Generated upload URL: factory={} key={} ttl={}s", factoryId, objectKey, UPLOAD_URL_TTL_SECONDS);
        return url;
    }

    @Override
    public String generateDownloadUrl(String factoryId, String id) {
        Attachment a = getById(factoryId, id);
        String signed = ossService.generatePresignedUrl(a.getFileUrl(), DOWNLOAD_URL_TTL_SECONDS);
        if (signed == null) {
            throw new BusinessException(503, "下载 URL 生成失败 — OSS 不可用");
        }
        return signed;
    }

    // ==================== delete / update ====================

    @Override
    @Transactional
    public void softDelete(String factoryId, String id, Long userId) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法删除附件");
        }
        Attachment a = getById(factoryId, id);
        if (!a.getUploadedBy().equals(userId) && !isAdmin()) {
            throw new BusinessException(403, "仅上传者本人或管理员可删除");
        }
        a.softDelete();
        attachmentRepository.save(a);
        log.info("Attachment 软删: factory={} id={} byUser={}", factoryId, id, userId);
    }

    @Override
    @Transactional
    public Attachment update(String factoryId, String id, UpdateAttachmentRequest req, Long userId) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法更新附件");
        }
        Attachment a = getById(factoryId, id);
        if (!a.getUploadedBy().equals(userId) && !isAdmin()) {
            throw new BusinessException(403, "仅上传者本人或管理员可更新");
        }
        if (req.getDescription() != null) {
            a.setDescription(req.getDescription());
        }
        if (req.getBusinessTag() != null) {
            a.setBusinessTag(req.getBusinessTag());
        }
        if (req.getFileCategory() != null) {
            a.setFileCategory(req.getFileCategory());
        }
        return attachmentRepository.save(a);
    }

    // ==================== helpers ====================

    /**
     * 推断 file_category 从 MIME type — register 时未提供 fileCategory 时调用.
     */
    private FileCategory inferCategory(String mimeType) {
        if (mimeType == null) return FileCategory.OTHER;
        String lower = mimeType.toLowerCase();
        if (lower.startsWith("image/")) return FileCategory.PHOTO;
        if (lower.startsWith("video/")) return FileCategory.VIDEO;
        if (lower.equals("application/pdf") || lower.startsWith("application/vnd.")
                || lower.equals("application/msword") || lower.startsWith("text/")) {
            return FileCategory.DOCUMENT;
        }
        return FileCategory.OTHER;
    }

    /**
     * 构造 OSS object key: {factoryId}/attachments/{yyyy}/{MM}/{dd}/{uuid}_{fileName}
     */
    private String buildObjectKey(String factoryId, String fileName) {
        String dateDir = LocalDate.now().format(DATE_FORMAT);
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String safeName = fileName != null ? fileName.replaceAll("[^a-zA-Z0-9._\\-\\u4e00-\\u9fa5]", "_") : "file";
        return String.format("%s/attachments/%s/%s_%s", factoryId, dateDir, uuid, safeName);
    }

    /**
     * 从 pre-signed PUT URL 提取最终 fileUrl (脱去查询串).
     * Controller 在调 {@link #generateUploadUrl} 后用本方法把 fileUrl 一起返回给前端.
     */
    public static String stripQuery(String presignedUrl) {
        if (presignedUrl == null) return null;
        try {
            URI uri = URI.create(presignedUrl);
            return uri.getScheme() + "://" + uri.getHost() + uri.getRawPath();
        } catch (Exception e) {
            return presignedUrl;
        }
    }

    private boolean isAdmin() {
        return SecurityUtils.hasRole("FACTORY_SUPER_ADMIN")
                || SecurityUtils.hasRole("PLATFORM_ADMIN")
                || SecurityUtils.hasRole("FACTORY_ADMIN");
    }
}
