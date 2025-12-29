package com.cretas.aims.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 更新用户技能请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "更新用户技能请求")
public class UpdateSkillsRequest {

    /**
     * 技能等级映射
     * key: 技能名称 (如 "切片", "质检", "包装")
     * value: 技能等级 1-5
     */
    @NotNull(message = "技能等级不能为空")
    @Schema(description = "技能等级映射", example = "{\"切片\": 3, \"质检\": 2, \"包装\": 4}")
    private Map<String, Integer> skillLevels;
}
