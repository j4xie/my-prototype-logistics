package com.cretas.aims.service;

import com.cretas.aims.dto.material.MaterialPackagingHierarchyDTO;

import java.util.List;
import java.util.Optional;

/**
 * 原料包装层级 Service.
 *
 * @since 2026-05-06
 */
public interface MaterialPackagingHierarchyService {

    /** 列出工厂全部包装层级配置. */
    List<MaterialPackagingHierarchyDTO> listByFactory(String factoryId);

    /** 按原料 ID 获取层级配置 (无则空). */
    Optional<MaterialPackagingHierarchyDTO> getByMaterialTypeId(String factoryId, String materialTypeId);

    /** Upsert: 一个原料一条记录, 已存在则更新. */
    MaterialPackagingHierarchyDTO upsert(String factoryId, String materialTypeId,
                                         MaterialPackagingHierarchyDTO dto, Long createdBy);

    /** 软删除 (BaseEntity @SQLDelete). */
    void deleteByMaterialTypeId(String factoryId, String materialTypeId);
}
