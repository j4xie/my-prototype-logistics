package com.cretas.aims.repository;

import com.cretas.aims.entity.Factory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
/**
 * 工厂数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface FactoryRepository extends JpaRepository<Factory, String> {
    /**
     * 根据工厂名称查找
     */
    Optional<Factory> findByName(String name);
     /**
     * 查找所有激活的工厂
      */
    List<Factory> findByIsActiveTrue();
     /**
     * 根据行业代码查找工厂
      */
    List<Factory> findByIndustryCode(String industryCode);
     /**
     * 根据地区代码查找工厂
      */
    List<Factory> findByRegionCode(String regionCode);
     /**
     * 模糊搜索工厂
      */
    @Query("SELECT f FROM Factory f WHERE " +
           "(LOWER(f.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(f.address) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(f.contactName) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND f.isActive = :isActive")
    Page<Factory> searchFactories(@Param("keyword") String keyword,
                                  @Param("isActive") Boolean isActive,
                                  Pageable pageable);
     /**
     * 统计工厂数量
      */
    @Query("SELECT COUNT(f) FROM Factory f WHERE f.isActive = true")
    Long countActiveFactories();
     /**
     * 根据订阅计划查找工厂
      */
    List<Factory> findBySubscriptionPlan(String subscriptionPlan);
     /**
     * 检查工厂ID是否存在
      */
    boolean existsById(String id);
     /**
     * 获取工厂的AI使用配额信息
      */
    @Query("SELECT f.aiWeeklyQuota FROM Factory f WHERE f.id = :factoryId")
    Integer getAiWeeklyQuota(@Param("factoryId") String factoryId);
}
