package com.cretas.aims.dto.blueprint;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;

/**
 * 发布版本请求
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "发布版本请求")
public class PublishVersionRequest {

    @Schema(description = "变更说明", required = true)
    @NotBlank(message = "变更说明不能为空")
    private String changeDescription;

    @Schema(description = "是否通知绑定的工厂", defaultValue = "true")
    private Boolean notifyFactories;

    @Schema(description = "发布人ID")
    private Long publishedBy;
}
