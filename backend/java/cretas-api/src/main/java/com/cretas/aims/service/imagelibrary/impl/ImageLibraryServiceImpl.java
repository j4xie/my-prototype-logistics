package com.cretas.aims.service.imagelibrary.impl;

import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.imagelibrary.ImageLibrary;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.AttachmentRepository;
import com.cretas.aims.repository.imagelibrary.ImageLibraryRepository;
import com.cretas.aims.service.imagelibrary.ImageLibraryService;
import com.cretas.aims.service.imagelibrary.dto.CreateImageLibraryRequest;
import com.cretas.aims.service.imagelibrary.dto.ImageLibraryView;
import com.cretas.aims.service.imagelibrary.dto.UpdateImageLibraryRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ImageLibraryService 实现 (P2 #80).
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageLibraryServiceImpl implements ImageLibraryService {

    /** 单次 fetch attachment id 上限 (防 IN-list 失控). */
    private static final int MAX_ATTACHMENT_BATCH = 200;

    private final ImageLibraryRepository imageLibraryRepository;
    private final AttachmentRepository attachmentRepository;

    // ==================== create ====================

    @Override
    @Transactional
    public ImageLibraryView create(String factoryId, CreateImageLibraryRequest req, Long userId) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法创建图片库条目");
        }

        // 1. 校验 attachmentId 存在 + 属于本工厂 (跨工厂 attachment 无法收录, 防越权)
        Attachment att = attachmentRepository.findByFactoryIdAndId(factoryId, req.getAttachmentId())
                .orElseThrow(() -> new BusinessException(404,
                        "Attachment 不存在或不属于本工厂: " + req.getAttachmentId()));

        // 2. 校验 attachment 是图片类型 (file_type 以 image/ 开头)
        if (att.getFileType() == null || !att.getFileType().toLowerCase().startsWith("image/")) {
            throw new BusinessException(400,
                    "仅图片类型 attachment 可收录至图片库, 当前 fileType=" + att.getFileType());
        }

        // 3. 防重复 — 同一 attachment 不允许重复收录
        Optional<ImageLibrary> existing = imageLibraryRepository.findByAttachmentId(req.getAttachmentId());
        if (existing.isPresent()) {
            throw new BusinessException(409,
                    "该图片已收录至图片库 (id=" + existing.get().getId() + "), 请勿重复添加")
                    .withHint("可前往图片库查看或编辑现有条目");
        }

        ImageLibrary entity = new ImageLibrary();
        entity.setAttachmentId(req.getAttachmentId());
        entity.setFactoryId(factoryId);
        entity.setTitle(req.getTitle().trim());
        entity.setDescription(req.getDescription());
        entity.setTags(cleanTags(req.getTags()));
        entity.setCategory(req.getCategory());
        entity.setUploaderUserId(userId);
        entity.setIsPublic(Boolean.TRUE.equals(req.getIsPublic()));
        entity.setUsageCount(0L);

        ImageLibrary saved = imageLibraryRepository.save(entity);
        log.info("ImageLibrary 创建成功: id={} factory={} title='{}' category={} public={}",
                saved.getId(), factoryId, saved.getTitle(), saved.getCategory(), saved.getIsPublic());

        return enrich(saved, att);
    }

    // ==================== update ====================

    @Override
    @Transactional
    public ImageLibraryView update(String factoryId, String id, UpdateImageLibraryRequest req,
                                   Long userId, boolean isAdmin) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法更新图片库条目");
        }
        ImageLibrary entity = requireVisibleEntity(factoryId, id);

        // 权限: 上传者本人 或 admin; 跨工厂图片仅 admin 可改
        if (!Objects.equals(entity.getUploaderUserId(), userId) && !isAdmin) {
            throw new BusinessException(403, "无权修改: 仅上传者或管理员可编辑");
        }
        if (!Objects.equals(entity.getFactoryId(), factoryId) && !isAdmin) {
            throw new BusinessException(403, "无权修改其他工厂的图片库条目, 请联系平台管理员");
        }

        if (req.getTitle() != null && !req.getTitle().trim().isEmpty()) {
            entity.setTitle(req.getTitle().trim());
        }
        if (req.getDescription() != null) {
            entity.setDescription(req.getDescription());
        }
        if (req.getTags() != null) {
            entity.setTags(cleanTags(req.getTags()));
        }
        if (req.getCategory() != null) {
            entity.setCategory(req.getCategory());
        }
        if (req.getIsPublic() != null) {
            entity.setIsPublic(req.getIsPublic());
        }

        ImageLibrary saved = imageLibraryRepository.save(entity);
        log.info("ImageLibrary 更新: id={} factory={} title='{}'", id, factoryId, saved.getTitle());

        Attachment att = attachmentRepository.findById(saved.getAttachmentId()).orElse(null);
        return enrich(saved, att);
    }

    // ==================== softDelete ====================

    @Override
    @Transactional
    public void softDelete(String factoryId, String id, Long userId, boolean isAdmin) {
        if (userId == null) {
            throw new BusinessException(401, "未登录 — 无法删除");
        }
        ImageLibrary entity = requireVisibleEntity(factoryId, id);

        if (!Objects.equals(entity.getUploaderUserId(), userId) && !isAdmin) {
            throw new BusinessException(403, "无权删除: 仅上传者或管理员可删除");
        }
        if (!Objects.equals(entity.getFactoryId(), factoryId) && !isAdmin) {
            throw new BusinessException(403, "无权删除其他工厂的图片库条目");
        }

        imageLibraryRepository.delete(entity);  // BaseEntity.@SQLDelete 软删
        log.info("ImageLibrary 软删: id={} factory={} by user={}", id, factoryId, userId);
    }

    // ==================== getById ====================

    @Override
    @Transactional(readOnly = true)
    public ImageLibraryView getById(String factoryId, String id) {
        ImageLibrary entity = requireVisibleEntity(factoryId, id);
        Attachment att = attachmentRepository.findById(entity.getAttachmentId()).orElse(null);
        return enrich(entity, att);
    }

    // ==================== search ====================

    @Override
    @Transactional(readOnly = true)
    public Page<ImageLibraryView> search(String factoryId, Category category, String keyword,
                                         String tag, boolean crossFactoryOnly, Pageable pageable) {
        String normalizedKeyword = (keyword == null || keyword.trim().isEmpty()) ? null : keyword.trim();
        Page<ImageLibrary> page = imageLibraryRepository.search(
                factoryId, category, normalizedKeyword, crossFactoryOnly, pageable);

        // tag 单标签精确过滤 — Java 内存层做, jsonb 数组操作符跨数据库兼容性差
        List<ImageLibrary> content = page.getContent();
        if (tag != null && !tag.trim().isEmpty()) {
            String t = tag.trim();
            content = content.stream()
                    .filter(i -> i.getTags() != null && i.getTags().stream().anyMatch(t::equalsIgnoreCase))
                    .collect(Collectors.toList());
        }

        // 批量 fetch attachments 避免 N+1
        Set<String> attIds = content.stream()
                .map(ImageLibrary::getAttachmentId)
                .filter(Objects::nonNull)
                .limit(MAX_ATTACHMENT_BATCH)
                .collect(Collectors.toSet());
        Map<String, Attachment> attMap = attIds.isEmpty()
                ? Collections.emptyMap()
                : attachmentRepository.findAllById(attIds).stream()
                        .collect(Collectors.toMap(Attachment::getId, a -> a));

        List<ImageLibraryView> views = content.stream()
                .map(i -> enrich(i, attMap.get(i.getAttachmentId())))
                .collect(Collectors.toList());

        return new PageImpl<>(views, pageable, page.getTotalElements());
    }

    // ==================== recordUsage ====================

    @Override
    @Transactional
    public void recordUsage(String factoryId, String id) {
        // 先校验可见 (拦截跨工厂越权)
        requireVisibleEntity(factoryId, id);
        int updated = imageLibraryRepository.incrementUsageCount(id);
        if (updated == 0) {
            log.warn("ImageLibrary.incrementUsageCount 未命中: id={}", id);
        }
    }

    // ==================== requireVisibleEntity ====================

    @Override
    @Transactional(readOnly = true)
    public ImageLibrary requireVisibleEntity(String factoryId, String id) {
        return imageLibraryRepository.findVisibleById(factoryId, id)
                .orElseThrow(() -> new BusinessException(404,
                        "图片库条目不存在或对本工厂不可见: " + id));
    }

    // ==================== helpers ====================

    /**
     * 清理 tag 列表 — 去 null / 去空 / trim / 去重 (大小写敏感保留原始展示).
     */
    static List<String> cleanTags(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            return new ArrayList<>();
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (String t : raw) {
            if (t == null) continue;
            String trimmed = t.trim();
            if (trimmed.isEmpty()) continue;
            seen.add(trimmed);
        }
        return new ArrayList<>(seen);
    }

    private ImageLibraryView enrich(ImageLibrary entity, Attachment attachment) {
        ImageLibraryView view = ImageLibraryView.fromEntity(entity);
        if (attachment != null) {
            view.setFileUrl(attachment.getFileUrl());
            view.setThumbnailUrl(attachment.getThumbnailUrl());
            view.setFileName(attachment.getFileName());
            view.setFileSize(attachment.getFileSize());
        }
        return view;
    }
}
