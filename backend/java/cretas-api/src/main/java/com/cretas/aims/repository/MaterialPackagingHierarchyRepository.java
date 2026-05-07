package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialPackagingHierarchy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 原料包装层级 Repository.
 *
 * @since 2026-05-06
 */
@Repository
public interface MaterialPackagingHierarchyRepository extends JpaRepository<MaterialPackagingHierarchy, String> {

    Optional<MaterialPackagingHierarchy> findByMaterialTypeId(String materialTypeId);

    List<MaterialPackagingHierarchy> findByFactoryId(String factoryId);

    void deleteByMaterialTypeId(String materialTypeId);

    boolean existsByMaterialTypeId(String materialTypeId);
}
