package com.cretas.aims.dto.decoration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.List;

/**
 * AI布局生成响应DTO
 *
 * <p>字段集对齐前端 {@code AILayoutGenerateResponse} (types/decoration.ts:297-313)：
 * 扁平 {@code layout: ModuleConfig[]} + 顶层 {@code theme} + {@code suggestions: String[]}。
 * 旧的嵌套 {@code HomeLayoutDTO} 形态会让前端 {@code aiResponse.layout.length} 检查永远 falsy
 * (AILayoutAssistant.tsx:449)，导致预览卡永远不显示——这就是为什么原 rule-based 路径
 * 即使返回 200 也无法落地到 UI。
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "AI布局生成响应")
public class AILayoutResponse {

    @Schema(description = "生成的模块布局 (扁平数组，对齐前端 HomeModule[])")
    private List<HomeLayoutDTO.ModuleConfig> layout;

    @Schema(description = "生成的主题配置")
    private HomeLayoutDTO.ThemeConfig theme;

    @Schema(description = "AI生成说明")
    private String explanation;

    @Schema(description = "生成耗时(毫秒)", example = "1500")
    private Long generationTimeMs;

    @Schema(description = "使用的AI模型 (来自 PythonLLMClient slot 路由)", example = "qwen-flash")
    private String modelUsed;

    @Schema(description = "后续指令建议 (字符串数组，对齐前端 suggestions: string[])")
    private List<String> suggestions;

    @Schema(description = "是否需要澄清", example = "false")
    private Boolean needsClarification;

    @Schema(description = "澄清问题列表 (当 needsClarification=true 时)")
    private List<String> clarificationQuestions;

    @Schema(description = "网格列数 (透传请求 / 默认值)", example = "2")
    private Integer gridColumns;
}
