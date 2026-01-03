package com.cretas.aims.repository;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.HireType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
/**
 * 用户数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    /**
     * 根据用户名查找用户（统一登录）
     */
    Optional<User> findByUsername(String username);

    /**
     * 根据用户名查找所有用户（用于智能推断factoryId）
     */
    List<User> findAllByUsername(String username);

    /**
     * 根据工厂ID和用户名查找用户
     */
    Optional<User> findByFactoryIdAndUsername(String factoryId, String username);
    /**
     * 根据工厂ID和手机号查找用户
     */
    Optional<User> findByFactoryIdAndPhone(String factoryId, String phone);
    /**
     * 根据手机号查找用户（用于忘记密码功能）
     */
    Optional<User> findByPhone(String phone);

    /**
     * 根据手机号查找所有用户（用于忘记密码时更新多个账户）
     */
    List<User> findAllByPhone(String phone);

    /**
     * 查找工厂的所有用户
     */
    List<User> findByFactoryId(String factoryId);
    /**
     * 分页查找工厂的用户
     */
    Page<User> findByFactoryId(String factoryId, Pageable pageable);
    /**
     * 查找工厂的激活用户
     */
    List<User> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);
    /**
     * 根据职位查找用户
     */
    List<User> findByFactoryIdAndPosition(String factoryId, String position);

    /**
     * 根据角色代码查找用户
     */
    List<User> findByFactoryIdAndRoleCode(String factoryId, String roleCode);
    /**
     * 模糊搜索用户
     * 注意：username/phone使用右模糊（可使用索引），fullName使用双向模糊（无法使用索引）
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT(:keyword, '%')) OR " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "u.phone LIKE CONCAT(:keyword, '%'))")
    Page<User> searchUsers(@Param("factoryId") String factoryId,
                          @Param("keyword") String keyword,
                          Pageable pageable);
    /**
     * 更新用户最后登录时间
     */
    @Modifying
    @Query("UPDATE User u SET u.lastLogin = :lastLogin WHERE u.id = :userId")
    void updateLastLogin(@Param("userId") Long userId, @Param("lastLogin") LocalDateTime lastLogin);
    /**
     * 统计工厂用户数量
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.factoryId = :factoryId AND u.isActive = true")
    Long countActiveUsersByFactory(@Param("factoryId") String factoryId);
    /**
     * 检查用户名是否存在（全局唯一，不区分工厂）
     */
    boolean existsByUsername(String username);

    /**
     * 获取有薪资信息的用户
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId AND u.monthlySalary IS NOT NULL")
    List<User> findUsersWithSalary(@Param("factoryId") String factoryId);
    /**
     * 统计工厂的用户总数
     */
    long countByFactoryId(String factoryId);
    /**
     * 统计工厂的激活用户数
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.factoryId = :factoryId AND u.isActive = true")
    long countActiveUsers(@Param("factoryId") String factoryId);
    /**
     * 按部门统计用户数量
     */
    @Query("SELECT u.department, COUNT(u) FROM User u WHERE u.factoryId = :factoryId GROUP BY u.department")
    List<Object[]> countByDepartment(@Param("factoryId") String factoryId);

    /**
     * 统计指定工厂和部门的用户数量
     */
    long countByFactoryIdAndDepartment(String factoryId, String department);

    /**
     * 统计指定激活状态的用户总数（跨所有工厂）
     *
     * @param isActive 是否激活
     * @return 用户数量
     * @since 2025-11-20
     */
    long countByIsActive(Boolean isActive);

    /**
     * 根据入职日期范围查询用户（分页）
     * 使用 createdAt 字段作为入职日期
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param pageable  分页参数
     * @return 用户分页数据
     * @since 2025-12-27
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId " +
           "AND u.createdAt >= :startDate AND u.createdAt < :endDate " +
           "ORDER BY u.createdAt DESC")
    Page<User> findByFactoryIdAndCreatedAtBetween(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);

    /**
     * 统计指定日期范围内入职的用户数量
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 用户数量
     * @since 2025-12-27
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.factoryId = :factoryId " +
           "AND u.createdAt >= :startDate AND u.createdAt < :endDate")
    long countByFactoryIdAndCreatedAtBetween(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);

    // ==================== 调度员模块扩展方法 ====================

    /**
     * 根据工厂ID和工号查找用户
     *
     * @param factoryId 工厂ID
     * @param employeeCode 工号
     * @return 用户
     * @since 2025-12-28
     */
    Optional<User> findByFactoryIdAndEmployeeCode(String factoryId, String employeeCode);

    /**
     * 根据工号查找用户 (全局唯一)
     *
     * @param employeeCode 工号
     * @return 用户
     * @since 2025-12-28
     */
    Optional<User> findByEmployeeCode(String employeeCode);

    /**
     * 查找合同即将到期的员工
     *
     * @param factoryId 工厂ID
     * @param warningDate 预警日期
     * @return 用户列表
     * @since 2025-12-28
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId " +
           "AND u.contractEndDate IS NOT NULL " +
           "AND u.contractEndDate <= :warningDate " +
           "ORDER BY u.contractEndDate ASC")
    List<User> findByFactoryIdAndContractEndDateBefore(
            @Param("factoryId") String factoryId,
            @Param("warningDate") LocalDate warningDate);

    /**
     * 根据雇用类型查找用户
     *
     * @param factoryId 工厂ID
     * @param hireType 雇用类型
     * @return 用户列表
     * @since 2025-12-28
     */
    List<User> findByFactoryIdAndHireType(String factoryId, HireType hireType);

    /**
     * 根据多个雇用类型查找用户
     *
     * @param factoryId 工厂ID
     * @param hireTypes 雇用类型列表
     * @return 用户列表
     * @since 2025-12-28
     */
    List<User> findByFactoryIdAndHireTypeIn(String factoryId, List<HireType> hireTypes);

    /**
     * 获取工厂最大的工号
     *
     * @param factoryId 工厂ID
     * @return 最大工号
     * @since 2025-12-28
     */
    @Query("SELECT MAX(u.employeeCode) FROM User u WHERE u.factoryId = :factoryId AND u.employeeCode IS NOT NULL")
    String findMaxEmployeeCodeByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 统计工厂临时工数量
     *
     * @param factoryId 工厂ID
     * @param hireTypes 临时性质的雇用类型列表
     * @return 临时工数量
     * @since 2025-12-28
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.factoryId = :factoryId " +
           "AND u.hireType IN :hireTypes AND u.isActive = true")
    long countTemporaryWorkers(
            @Param("factoryId") String factoryId,
            @Param("hireTypes") List<HireType> hireTypes);

    /**
     * 模糊搜索用户（支持工号搜索）
     *
     * @param factoryId 工厂ID
     * @param keyword 关键词
     * @param pageable 分页参数
     * @return 用户分页数据
     * @since 2025-12-28
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT(:keyword, '%')) OR " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "u.phone LIKE CONCAT(:keyword, '%') OR " +
           "u.employeeCode LIKE CONCAT(:keyword, '%'))")
    Page<User> searchUsersWithEmployeeCode(@Param("factoryId") String factoryId,
                                           @Param("keyword") String keyword,
                                           Pageable pageable);

    /**
     * 批量查询多个用户 - 解决 N+1 查询问题
     * @param ids 用户ID集合
     * @return 用户列表
     */
    List<User> findByIdIn(Collection<Long> ids);
}
