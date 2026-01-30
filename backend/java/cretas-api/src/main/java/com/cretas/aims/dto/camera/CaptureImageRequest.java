package com.cretas.aims.dto.camera;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Min;
import javax.validation.constraints.Pattern;

/**
 * 拍照请求DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaptureImageRequest {
    /**
     * 设备索引（可选，默认使用第一个设备）
     */
    @Min(value = 0, message = "设备索引必须大于等于0")
    private Integer deviceIndex;

    /**
     * 图像格式（JPEG, BMP, PNG, TIFF）
     * 默认：JPEG
     */
    @Pattern(regexp = "^(JPEG|BMP|PNG|TIFF|RAW)$", message = "图像格式必须是JPEG、BMP、PNG、TIFF或RAW")
    private String format;

    /**
     * JPEG质量（50-99，仅JPEG格式有效）
     * 默认：90
     */
    @Min(value = 50, message = "JPEG质量必须在50-99之间")
    private Integer jpegQuality;

    /**
     * 超时时间（毫秒）
     * 默认：5000
     */
    @Min(value = 1000, message = "超时时间必须大于等于1000毫秒")
    private Integer timeout;
}

