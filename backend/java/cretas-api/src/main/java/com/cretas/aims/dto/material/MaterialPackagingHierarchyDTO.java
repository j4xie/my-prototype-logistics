package com.cretas.aims.dto.material;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 原料包装层级 DTO.
 * 一级必填; 二/三级可选 (DB CHECK 约束保证配对完整性).
 *
 * @since 2026-05-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaterialPackagingHierarchyDTO {
    private String id;
    private String factoryId;
    private String materialTypeId;

    @NotBlank(message = "一级单位不能为空")
    private String level1Unit;

    private BigDecimal level1PerLevel2;
    private String level2Unit;

    private BigDecimal level2PerLevel3;
    private String level3Unit;

    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
