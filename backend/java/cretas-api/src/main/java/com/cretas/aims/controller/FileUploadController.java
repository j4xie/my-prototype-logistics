package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.service.OssService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;

/**
 * 文件上传 Controller — 通用文件/图片 OSS 上传入口
 *
 * <p>P0-NEW-1 配套: 出库签收照片上传端点。
 * 复用 {@link OssService#uploadImage} 实现,上传到 media bucket。
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/upload")
@RequiredArgsConstructor
@Tag(name = "文件上传", description = "通用 OSS 文件上传接口")
public class FileUploadController {

    private final OssService ossService;

    private static final long MAX_SIGNATURE_PHOTO_SIZE = 5L * 1024 * 1024; // 5MB
    private static final Set<String> ALLOWED_PHOTO_TYPES = Set.of("image/jpeg", "image/jpg", "image/png");

    /**
     * 上传签收照片 (出库签收配套)
     *
     * <p>文件限制: ≤5MB,仅支持 image/jpeg, image/png。
     * 上传成功后返回公网 URL,前端拿到 URL 后调用
     * {@code POST /sales/deliveries/{id}/signature} 提交签收。
     */
    @PostMapping(value = "/signature-photo", consumes = "multipart/form-data")
    @Operation(summary = "上传签收照片", description = "出库签收配套;≤5MB,仅 JPEG/PNG")
    public ApiResponse<Map<String, String>> uploadSignaturePhoto(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "签收照片(JPEG/PNG,≤5MB)", required = true)
            @RequestParam("file") MultipartFile file) {

        log.info("上传签收照片: factoryId={}, filename={}, size={}, contentType={}",
                factoryId, file.getOriginalFilename(), file.getSize(), file.getContentType());

        if (file.isEmpty()) {
            return ApiResponse.error("文件不能为空");
        }
        if (file.getSize() > MAX_SIGNATURE_PHOTO_SIZE) {
            return ApiResponse.error("签收照片不能超过 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_PHOTO_TYPES.contains(contentType.toLowerCase())) {
            return ApiResponse.error("仅支持 JPEG/PNG 格式,当前: " + contentType);
        }

        try {
            // category = "signatures" → OSS 路径: {factoryId}/images/signatures/yyyy/MM/dd/{uuid}_{filename}
            String url = ossService.uploadImage(file, "signatures", factoryId);
            log.info("签收照片上传成功: factoryId={}, url={}", factoryId, url);
            return ApiResponse.success("上传成功", Map.of("url", url));
        } catch (IllegalArgumentException e) {
            log.warn("签收照片上传失败(参数错误): {}", e.getMessage());
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            log.error("签收照片上传失败: factoryId={}", factoryId, e);
            return ApiResponse.error("上传失败: " + e.getMessage());
        }
    }
}
