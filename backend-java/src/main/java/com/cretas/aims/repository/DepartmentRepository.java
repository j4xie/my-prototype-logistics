package com.cretas.aims.repository;

import com.cretas.aims.entity.Department;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 部门数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-19
 */
@Repository
public interface DepartmentRepository extends JpaRepository<Department, Integer> {

    /**
     * 根据工厂ID查询所有部门
     */
    List<Department> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查询部门
     */
    Page<Department> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态查询部门
     */
    List<Department> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 根据工厂ID和编码查询部门
     */
    Optional<Department> findByFactoryIdAndCode(String factoryId, String code);

    /**
     * 检查部门编码是否存在
     */
    boolean existsByFactoryIdAndCode(String factoryId, String code);

    /**
     * 统计工厂的部门数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 根据工厂ID和父部门ID查询子部门
     */
    List<Department> findByFactoryIdAndParentDepartmentId(String factoryId, Integer parentDepartmentId);

    /**
     * 搜索部门（按名称或编码）
     * 注意：code使用右模糊（可使用索引），name使用双向模糊（无法使用索引）
     */
    @Query("SELECT d FROM Department d WHERE d.factoryId = :factoryId " +
           "AND (LOWER(d.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(d.code) LIKE LOWER(CONCAT(:keyword, '%')))")
    Page<Department> searchDepartments(@Param("factoryId") String factoryId,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);

    /**
     * 根据工厂ID和负责人ID查询部门
     */
    List<Department> findByFactoryIdAndManagerUserId(String factoryId, Integer managerUserId);
}
