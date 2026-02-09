package com.cretas.aims.dto.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import java.util.Map;

/**
 * 参数确认请求 DTO
 *
 * 用于用户确认 LLM 提取的参数是否正确，
 * 确认后系统会学习提取规则，下次可以直接使用规则提取。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-17
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "参数确认请求")
public class ParameterConfirmationRequest {

    /**
     * 意图代码
     */
    @NotBlank(message = "意图代码不能为空")
    @Schema(description = "意图代码", example = "USER_CREATE")
    private String intentCode;

    /**
     * 原始用户输入
     */
    @NotBlank(message = "原始输入不能为空")
    @Schema(description = "原始用户输入", example = "创建新用户,用户名zhangsan,姓名张三,角色为操作员")
    private String userInput;

    /**
     * 确认后的参数映射
     * 可能与 LLM 提取的结果相同，也可能经过用户修改
     */
    @Schema(description = "确认后的参数映射")
    private Map<String, Object> confirmedParams;

    /**
     * 是否直接执行
     * true = 确认参数后直接执行操作
     * false = 只确认参数并学习规则，不执行
     */
    @Schema(description = "是否直接执行", defaultValue = "true")
    @Builder.Default
    private Boolean executeAfterConfirm = true;
}
