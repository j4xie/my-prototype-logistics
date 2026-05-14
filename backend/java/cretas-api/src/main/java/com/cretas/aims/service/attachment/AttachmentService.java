package com.cretas.aims.service.attachment;

import com.cretas.aims.entity.Attachment;
import com.cretas.aims.entity.Attachment.EntityType;
import com.cretas.aims.service.attachment.dto.RegisterAttachmentRequest;
import com.cretas.aims.service.attachment.dto.UpdateAttachmentRequest;

import java.util.List;
import java.util.Map;

/**
 * 通用附件服务 — Track B/D 业务模块可直接 {@code @Autowired AttachmentService} 使用.
 *
 * <p><b>接口稳定性 (Day 1 commit)</b>: 本接口签名作为跨 Track 契约, Day 3 实现完成前不会
 * 改动. Track B/D 可在 Day 3 之后立即接入而无需等到 Day 5 PR 推出.
 *
 * <p>spec: {@code 宏见竞品分析/01-客户档案/SCHEMA_DESIGN.md §2.3}
 *
 * @author Cretas Team — Track C
 * @since 2026-05-15 (C-ATT-1)
 */
public interface AttachmentService {

    /**
     * 注册附件元数据 (前端通过 OSS pre-signed URL 直传完成后调用).
     *
     * <p>同 {@code factoryId} 下相同 {@code fileHash} 视为同一文件: 不再插入, 返回已有 Attachment.
     *
     * @param factoryId 工厂 ID (多租户隔离)
     * @param req       客户端上传后的元数据 (含 fileUrl / fileHash / entityType / entityId)
     * @param userId    上传者 ID (用于 uploadedBy + 后续软删权限校验)
     * @return 新注册或已存在的 Attachment
     */
    Attachment register(String factoryId, RegisterAttachmentRequest req, Long userId);

    /**
     * 查询某实体的全部未删除附件 (按 uploadedAt 倒序).
     *
     * @param factoryId 工厂 ID
     * @param type      实体类型
     * @param entityId  实体 ID (字符串兼容 UUID / Long.toString)
     */
    List<Attachment> queryByEntity(String factoryId, EntityType type, String entityId);

    /**
     * 批量计数 — 列表页徽章场景 (一次查 N 个实体的附件数, 避免 N+1).
     *
     * @param factoryId 工厂 ID
     * @param type      实体类型
     * @param ids       实体 ID 集合
     * @return key = entityId, value = 附件数; 未挂附件的 entityId 不出现在返回 Map 中
     */
    Map<String, Long> countByEntities(String factoryId, EntityType type, List<String> ids);

    /**
     * 详情 — 返回单条 Attachment (含元数据). 下载请改用 {@link #generateDownloadUrl}.
     *
     * @throws com.cretas.aims.exception.BusinessException 404 if not found / 跨 factory
     */
    Attachment getById(String factoryId, String id);

    /**
     * 生成 OSS pre-signed PUT URL — 前端直传 OSS, 不经 Java 后端字节流.
     *
     * <p>5 分钟有效. 客户端 PUT 完成后须调 {@link #register} 注册元数据.
     *
     * @param factoryId 工厂 ID
     * @param fileName  原文件名 (用于构造 OSS object key)
     * @param fileType  MIME type (用于校验 + Content-Type)
     * @return 前端可直接 PUT 的预签名 URL
     */
    String generateUploadUrl(String factoryId, String fileName, String fileType);

    /**
     * 生成 OSS pre-signed GET URL — 1 小时有效.
     *
     * <p>调用前会校验 attachment 属于 factoryId (多租户隔离).
     *
     * @throws com.cretas.aims.exception.BusinessException 404 if not found / 跨 factory
     */
    String generateDownloadUrl(String factoryId, String id);

    /**
     * 软删除 — 标记 deletedAt, 不物理删 OSS 文件 (审计追溯).
     *
     * <p>权限: 上传者本人 或 admin (具体由实现校验, 调用方可不预校验).
     *
     * @throws com.cretas.aims.exception.BusinessException 403 if 非上传者非 admin / 404 if not found
     */
    void softDelete(String factoryId, String id, Long userId);

    /**
     * 更新 — 仅允许改 {@code description} / {@code businessTag} / {@code fileCategory}.
     * 不允许改 fileUrl / entityType / entityId / uploadedBy.
     *
     * <p>权限: 同 {@link #softDelete}.
     */
    Attachment update(String factoryId, String id, UpdateAttachmentRequest req, Long userId);
}
