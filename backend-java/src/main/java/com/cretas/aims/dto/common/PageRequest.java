package com.cretas.aims.dto.common;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Min;

/**
 * 分页请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "分页请求对象")
public class PageRequest {

    @Schema(description = "页码", example = "1")
    @Min(value = 1, message = "页码必须大于0")
    private Integer page = 1;

    @Schema(description = "每页大小", example = "20")
    @Min(value = 1, message = "每页大小必须大于0")
    private Integer size = 20;

    @Schema(description = "排序字段", example = "createdAt")
    private String sortBy = "createdAt";

    @Schema(description = "排序方向 (ASC/DESC)", example = "DESC")
    private String sortDirection = "DESC";

    @Schema(description = "搜索关键词")
    private String keyword;

    public Integer getOffset() {
        return (page - 1) * size;
    }
}