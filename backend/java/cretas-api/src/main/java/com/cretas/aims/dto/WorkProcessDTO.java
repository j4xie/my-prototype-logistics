package com.cretas.aims.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkProcessDTO {

    private String id;

    @NotBlank(message = "工序名称不能为空")
    @Size(max = 100, message = "工序名称不能超过100个字符")
    private String processName;

    @Size(max = 50, message = "工序类别不能超过50个字符")
    private String processCategory;

    @Size(max = 500, message = "描述不能超过500个字符")
    private String description;

    @Size(max = 20, message = "单位不能超过20个字符")
    private String unit;

    private Integer estimatedMinutes;

    private Integer sortOrder;

    private Boolean isActive;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SortOrderUpdate {
        private String id;
        private Integer sortOrder;
    }
}
