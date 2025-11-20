package com.cretas.aims.repository;

import com.cretas.aims.entity.RawMaterialType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
/**
 * 原材料类型数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface RawMaterialTypeRepository extends JpaRepository<RawMaterialType, Integer> {
    /**
     * 根据工厂ID和代码查找
     */
    Optional<RawMaterialType> findByFactoryIdAndCode(String factoryId, String code);
     /**
     * 查找工厂的所有原材料类型
      */
    List<RawMaterialType> findByFactoryId(String factoryId);
     /**
     * 查找工厂的激活原材料类型
      */
    List<RawMaterialType> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);
     /**
     * 分页查找工厂的原材料类型
      */
    Page<RawMaterialType> findByFactoryId(String factoryId, Pageable pageable);
     /**
     * 根据类别查找原材料类型
      */
    List<RawMaterialType> findByFactoryIdAndCategory(String factoryId, String category);
     /**
     * 根据存储类型查找
      */
    List<RawMaterialType> findByFactoryIdAndStorageType(String factoryId, String storageType);
     /**
     * 搜索原材料类型
      */
    @Query("SELECT r FROM RawMaterialType r WHERE r.factoryId = :factoryId AND " +
           "(LOWER(r.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(r.code) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(r.category) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<RawMaterialType> searchMaterialTypes(@Param("factoryId") String factoryId,
                                              @Param("keyword") String keyword,
                                              Pageable pageable);
     /**
     * 检查代码是否存在
      */
    boolean existsByFactoryIdAndCode(String factoryId, String code);
     /**
     * 统计原材料类型数量
      */
    @Query("SELECT COUNT(r) FROM RawMaterialType r WHERE r.factoryId = :factoryId AND r.isActive = true")
    Long countActiveMaterialTypes(@Param("factoryId") String factoryId);
     /**
     * 获取有库存预警的原材料类型
      */
    @Query("SELECT r FROM RawMaterialType r WHERE r.factoryId = :factoryId " +
           "AND r.minStock IS NOT NULL AND r.minStock > 0")
    List<RawMaterialType> findMaterialTypesWithStockWarning(@Param("factoryId") String factoryId);
}
