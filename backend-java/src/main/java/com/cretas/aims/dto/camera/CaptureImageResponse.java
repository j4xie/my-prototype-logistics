package com.cretas.aims.dto.camera;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 拍照响应DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaptureImageResponse {
    /**
     * 图像文件路径（本地保存路径）
     */
    private String imagePath;

    /**
     * 图像URL（如果已上传到服务器）
     */
    private String imageUrl;

    /**
     * 图像格式
     */
    private String format;

    /**
     * 图像宽度（像素）
     */
    private Integer width;

    /**
     * 图像高度（像素）
     */
    private Integer height;

    /**
     * 图像文件大小（字节）
     */
    private Long fileSize;
}

