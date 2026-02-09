package com.cretas.aims.dto.material;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 转冻品请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "转冻品请求")
public class ConvertToFrozenRequest {

    @Schema(description = "操作人员ID", required = true, example = "1")
    @NotNull(message = "操作人员ID不能为空")
    private Integer convertedBy;

    @Schema(description = "转换日期", required = true, example = "2025-11-20")
    @NotNull(message = "转换日期不能为空")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate convertedDate;

    @Schema(description = "存储位置", required = true, example = "冷库A区")
    @NotBlank(message = "存储位置不能为空")
    @Size(max = 100, message = "存储位置不能超过100个字符")
    private String storageLocation;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注不能超过500个字符")
    private String notes;
}
