package com.cretas.aims.controller.imagelibrary;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.imagelibrary.ImageLibrary.Category;
import com.cretas.aims.service.imagelibrary.ImageLibraryService;
import com.cretas.aims.service.imagelibrary.dto.CreateImageLibraryRequest;
import com.cretas.aims.service.imagelibrary.dto.ImageLibraryView;
import com.cretas.aims.service.imagelibrary.dto.UpdateImageLibraryRequest;
import com.cretas.aims.utils.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 公共图片库 REST API (P2 #80 C-IMAGE-LIB-1).
 *
 * <p>endpoint:
 * <ol>
 *   <li>GET    /api/mobile/{factoryId}/image-library                 — 列表 + 过滤 + 分页</li>
 *   <li>GET    /api/mobile/{factoryId}/image-library/{id}            — 详情</li>
 *   <li>POST   /api/mobile/{factoryId}/image-library                 — 收录 (引用现有 attachment)</li>
 *   <li>PUT    /api/mobile/{factoryId}/image-library/{id}            — 更新元数据</li>
 *   <li>DELETE /api/mobile/{factoryId}/image-library/{id}            — 软删</li>
 *   <li>POST   /api/mobile/{factoryId}/image-library/{id}/use        — 记录使用 (usageCount++)</li>
 * </ol>
 *
 * @author Cretas Team — P2 Backlog
 * @since 2026-05-18 (P2 #80)
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/mobile/{factoryId}/image-library")
@CrossOrigin(origins = {"https://www.cretaceousfuture.com", "http://139.196.165.140:8086", "http://localhost:5173"})
public class ImageLibraryController {

    private static final int MAX_PAGE_SIZE = 100;

    private final ImageLibraryService imageLibraryService;

    // ==================== 1. 列表 ====================

    @GetMapping
    @RequirePermission(value = {
            "system:read", "system:read_write",
            "sales:read", "sales:read_write",
            "production:read", "production:read_write",
            "rd:read", "rd:read_write",
            "restaurant:read", "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<Page<ImageLibraryView>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false, defaultValue = "false") boolean crossFactoryOnly,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<ImageLibraryView> result = imageLibraryService.search(
                factoryId, category, keyword, tag, crossFactoryOnly, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== 2. 详情 ====================

    @GetMapping("/{id}")
    @RequirePermission(value = {
            "system:read", "system:read_write",
            "sales:read", "sales:read_write",
            "production:read", "production:read_write",
            "rd:read", "rd:read_write",
            "restaurant:read", "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<ImageLibraryView>> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(imageLibraryService.getById(factoryId, id)));
    }

    // ==================== 3. 创建 ====================

    @PostMapping
    @RequirePermission(value = {
            "system:read_write",
            "sales:read_write",
            "production:read_write",
            "rd:read_write",
            "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<ImageLibraryView>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateImageLibraryRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        ImageLibraryView created = imageLibraryService.create(factoryId, req, userId);
        return ResponseEntity.ok(ApiResponse.success("已收录至图片库", created));
    }

    // ==================== 4. 更新 ====================

    @PutMapping("/{id}")
    @RequirePermission(value = {
            "system:read_write",
            "sales:read_write",
            "production:read_write",
            "rd:read_write",
            "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<ImageLibraryView>> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody UpdateImageLibraryRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasRole("factory_super_admin")
                || SecurityUtils.hasRole("platform_admin")
                || SecurityUtils.hasRole("permission_admin");
        ImageLibraryView updated = imageLibraryService.update(factoryId, id, req, userId, isAdmin);
        return ResponseEntity.ok(ApiResponse.success("更新成功", updated));
    }

    // ==================== 5. 软删 ====================

    @DeleteMapping("/{id}")
    @RequirePermission(value = {
            "system:read_write",
            "sales:read_write",
            "production:read_write",
            "rd:read_write",
            "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<Void>> softDelete(
            @PathVariable String factoryId,
            @PathVariable String id) {
        Long userId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasRole("factory_super_admin")
                || SecurityUtils.hasRole("platform_admin")
                || SecurityUtils.hasRole("permission_admin");
        imageLibraryService.softDelete(factoryId, id, userId, isAdmin);
        return ResponseEntity.ok(ApiResponse.successMessage("删除成功"));
    }

    // ==================== 6. 记录使用 ====================

    @PostMapping("/{id}/use")
    @RequirePermission(value = {
            "system:read", "system:read_write",
            "sales:read", "sales:read_write",
            "production:read", "production:read_write",
            "rd:read", "rd:read_write",
            "restaurant:read", "restaurant:read_write"
    })
    public ResponseEntity<ApiResponse<Void>> recordUsage(
            @PathVariable String factoryId,
            @PathVariable String id) {
        imageLibraryService.recordUsage(factoryId, id);
        return ResponseEntity.ok(ApiResponse.successMessage("使用已记录"));
    }
}
