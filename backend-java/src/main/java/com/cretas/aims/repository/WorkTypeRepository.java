package com.cretas.aims.repository;

import com.cretas.aims.entity.WorkType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
/**
 * 工作类型数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface WorkTypeRepository extends JpaRepository<WorkType, String> {
    /**
     * 根据工厂ID查询工作类型（分页）
     */
    Page<WorkType> findByFactoryId(String factoryId, Pageable pageable);
     /**
     * 根据工厂ID查询所有工作类型
      */
    List<WorkType> findByFactoryId(String factoryId);
     /**
     * 根据工厂ID查询活跃的工作类型
      */
    List<WorkType> findByFactoryIdAndIsActiveTrue(String factoryId);
     /**
     * 根据工厂ID和名称查询
      */
    Optional<WorkType> findByFactoryIdAndName(String factoryId, String name);
     /**
     * 根据工厂ID和代码查询
      */
    Optional<WorkType> findByFactoryIdAndCode(String factoryId, String code);
     /**
     * 检查名称是否存在
      */
    boolean existsByFactoryIdAndName(String factoryId, String name);
     /**
     * 检查代码是否存在
      */
    boolean existsByFactoryIdAndCode(String factoryId, String code);
     /**
     * 统计工厂的工作类型数量
      */
    long countByFactoryId(String factoryId);
     /**
     * 统计工厂活跃的工作类型数量
      */
    long countByFactoryIdAndIsActiveTrue(String factoryId);
     /**
     * 根据部门查询工作类型
      */
    List<WorkType> findByFactoryIdAndDepartment(String factoryId, String department);
     /**
     * 根据计费类型查询工作类型
      */
    List<WorkType> findByFactoryIdAndBillingType(String factoryId, String billingType);
     /**
     * 查询默认工作类型
      */
    List<WorkType> findByFactoryIdAndIsDefaultTrue(String factoryId);
     /**
     * 根据危险等级查询工作类型
      */
    @Query("SELECT w FROM WorkType w WHERE w.factoryId = :factoryId AND w.hazardLevel >= :minLevel")
    List<WorkType> findByHazardLevel(@Param("factoryId") String factoryId, @Param("minLevel") Integer minLevel);
     /**
     * 查询需要认证的工作类型
      */
    List<WorkType> findByFactoryIdAndCertificationRequiredTrue(String factoryId);
     /**
     * 按显示顺序查询
      */
    List<WorkType> findByFactoryIdOrderByDisplayOrderAsc(String factoryId);
     /**
     * 获取最大显示顺序
      */
    @Query("SELECT COALESCE(MAX(w.displayOrder), 0) FROM WorkType w WHERE w.factoryId = :factoryId")
    Integer getMaxDisplayOrder(@Param("factoryId") String factoryId);
     /**
     * 批量更新状态
      */
    @Query("UPDATE WorkType w SET w.isActive = :status WHERE w.factoryId = :factoryId AND w.id IN :ids")
    void updateStatusBatch(@Param("factoryId") String factoryId, @Param("ids") List<String> ids, @Param("status") Boolean status);
}
