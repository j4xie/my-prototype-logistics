package com.cretas.aims.service.imagelibrary;

import com.cretas.aims.entity.imagelibrary.ImageLibrary;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import com.cretas.aims.service.imagelibrary.dto.CreateImageLibraryRequest;
import com.cretas.aims.service.imagelibrary.dto.ImageLibraryView;
import com.cretas.aims.service.imagelibrary.dto.UpdateImageLibraryRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * 公共图片库服务 (P2 #80 C-IMAGE-LIB-1).
 *
 * <p>构建在 {@link com.cretas.aims.service.attachment.AttachmentService} 之上的策划层.
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
public interface ImageLibraryService {

    /**
     * 收录已上传 Attachment 至图片库.
     *
     * @param factoryId 工厂 ID
     * @param req       创建请求
     * @param userId    上传用户 ID (审计)
     * @return 创建后的 view
     */
    ImageLibraryView create(String factoryId, CreateImageLibraryRequest req, Long userId);

    /**
     * 更新元数据 (title / description / tags / category / isPublic).
     *
     * <p>权限: 上传者本人 或 admin (调用方负责传 isAdmin); 不允许跨工厂修改私有图片.
     */
    ImageLibraryView update(String factoryId, String id, UpdateImageLibraryRequest req, Long userId, boolean isAdmin);

    /**
     * 软删除.
     *
     * <p>权限: 同 {@link #update}.
     */
    void softDelete(String factoryId, String id, Long userId, boolean isAdmin);

    /**
     * 详情 — 应用跨工厂可见规则.
     *
     * @throws com.cretas.aims.exception.BusinessException 404 if not found / 不可见
     */
    ImageLibraryView getById(String factoryId, String id);

    /**
     * 列表搜索 — 多条件 + 分页.
     *
     * @param factoryId        调用工厂 ID
     * @param category         可选分类过滤
     * @param keyword          可选关键词 (title/description 模糊)
     * @param tag              可选单一标签精确过滤 (Java 内存过滤; tag 选择性低时 OK)
     * @param crossFactoryOnly true 时仅返回跨工厂图片
     */
    Page<ImageLibraryView> search(String factoryId, Category category, String keyword,
                                  String tag, boolean crossFactoryOnly, Pageable pageable);

    /**
     * 记录使用 — 原子自增 usageCount. 调用方在引用图片时调 (例: SKU 选图后).
     *
     * @throws com.cretas.aims.exception.BusinessException 404 if not visible
     */
    void recordUsage(String factoryId, String id);

    /**
     * 内部 API — 给单元测试用 (绕过 view 转换).
     */
    ImageLibrary requireVisibleEntity(String factoryId, String id);
}
