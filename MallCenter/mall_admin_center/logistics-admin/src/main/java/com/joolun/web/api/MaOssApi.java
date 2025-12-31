package com.joolun.web.api;

import com.joolun.common.core.domain.AjaxResult;
import com.joolun.mall.service.OssService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * OSS上传服务 API - 小程序端
 *
 * 用于小程序直传图片到阿里云OSS
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/weixin/api/ma/oss")
@Tag(name = "OSS上传服务", description = "小程序端OSS直传接口")
public class MaOssApi {

    private final OssService ossService;

    /**
     * 获取OSS配置信息
     */
    @GetMapping("/config")
    @Operation(summary = "获取OSS配置信息", description = "返回OSS的bucket、endpoint等配置")
    public AjaxResult getConfig() {
        try {
            Map<String, Object> config = ossService.getOssConfig();
            return AjaxResult.success(config);
        } catch (Exception e) {
            log.error("获取OSS配置失败", e);
            return AjaxResult.error("获取配置失败");
        }
    }

    /**
     * 获取上传签名 (PostObject方式)
     *
     * 小程序使用此接口获取签名后，直接上传到OSS
     *
     * @param type 文件类型 (product=商品图片, avatar=头像, feedback=反馈)
     * @param filename 原始文件名 (可选，用于提取扩展名)
     */
    @GetMapping("/signature")
    @Operation(summary = "获取上传签名", description = "生成OSS直传签名，有效期30分钟")
    public AjaxResult getUploadSignature(
            @Parameter(description = "文件类型: product/avatar/feedback")
            @RequestParam(defaultValue = "product") String type,
            @Parameter(description = "原始文件名")
            @RequestParam(required = false) String filename) {
        try {
            // 生成唯一文件名
            String extension = getFileExtension(filename);
            String uniqueFilename = UUID.randomUUID().toString().replace("-", "") + extension;

            // 根据类型确定目录
            String prefix = getUploadPrefix(type);

            // 生成完整的objectKey (带日期目录)
            String objectKey = generateObjectKey(prefix, uniqueFilename);

            // 获取签名
            Map<String, Object> signature = ossService.generateUploadSignature(objectKey);

            log.info("生成上传签名成功: type={}, objectKey={}", type, objectKey);
            return AjaxResult.success(signature);

        } catch (Exception e) {
            log.error("获取上传签名失败", e);
            return AjaxResult.error("获取上传签名失败: " + e.getMessage());
        }
    }

    /**
     * 获取STS临时凭证 (高级用法，需要配置RAM角色)
     */
    @GetMapping("/sts-token")
    @Operation(summary = "获取STS临时凭证", description = "生成STS临时凭证，用于SDK直传")
    public AjaxResult getStsToken() {
        try {
            Map<String, Object> stsToken = ossService.generateStsToken();
            return AjaxResult.success(stsToken);
        } catch (Exception e) {
            log.error("获取STS凭证失败", e);
            return AjaxResult.error("获取凭证失败: " + e.getMessage());
        }
    }

    /**
     * 批量获取上传签名
     *
     * @param type 文件类型
     * @param count 需要的签名数量 (最多10个)
     */
    @GetMapping("/signatures")
    @Operation(summary = "批量获取上传签名", description = "一次获取多个上传签名")
    public AjaxResult getBatchSignatures(
            @RequestParam(defaultValue = "product") String type,
            @RequestParam(defaultValue = "1") int count) {
        try {
            // 限制数量
            count = Math.min(count, 10);

            String prefix = getUploadPrefix(type);
            java.util.List<Map<String, Object>> signatures = new java.util.ArrayList<>();

            for (int i = 0; i < count; i++) {
                String uniqueFilename = UUID.randomUUID().toString().replace("-", "") + ".jpg";
                String objectKey = generateObjectKey(prefix, uniqueFilename);
                Map<String, Object> signature = ossService.generateUploadSignature(objectKey);
                signatures.add(signature);
            }

            log.info("批量生成上传签名成功: type={}, count={}", type, count);
            return AjaxResult.success(signatures);

        } catch (Exception e) {
            log.error("批量获取上传签名失败", e);
            return AjaxResult.error("获取签名失败");
        }
    }

    /**
     * 根据类型获取上传目录前缀
     */
    private String getUploadPrefix(String type) {
        return switch (type.toLowerCase()) {
            case "product" -> "products";
            case "avatar" -> "avatars";
            case "feedback" -> "feedback";
            case "merchant" -> "merchants";
            default -> "uploads";
        };
    }

    /**
     * 从文件名提取扩展名
     */
    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".jpg"; // 默认jpg
        }
        return filename.substring(filename.lastIndexOf(".")).toLowerCase();
    }

    /**
     * 生成带日期目录的objectKey
     */
    private String generateObjectKey(String prefix, String filename) {
        java.time.format.DateTimeFormatter formatter =
            java.time.format.DateTimeFormatter.ofPattern("yyyy/MM");
        String datePath = formatter.format(
            java.time.Instant.now().atZone(java.time.ZoneId.of("Asia/Shanghai"))
        );
        return prefix + "/" + datePath + "/" + filename;
    }
}
