package com.cretas.aims.dto.material;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

/**
 * 撤销转冻品请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "撤销转冻品请求")
public class UndoFrozenRequest {

    @Schema(description = "操作人员ID", required = true, example = "1")
    @NotNull(message = "操作人员ID不能为空")
    private Integer operatorId;

    @Schema(description = "撤销原因", required = true, example = "误操作，需要撤回")
    @NotBlank(message = "撤销原因不能为空")
    @Size(min = 2, max = 200, message = "撤销原因长度必须在2-200个字符之间")
    private String reason;
}
