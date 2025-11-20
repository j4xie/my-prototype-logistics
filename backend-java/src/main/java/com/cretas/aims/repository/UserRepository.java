package com.cretas.aims.repository;

import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.Department;
import com.cretas.aims.entity.enums.FactoryUserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
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
public interface UserRepository extends JpaRepository<User, Integer> {
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
     * 模糊搜索用户
     */
    @Query("SELECT u FROM User u WHERE u.factoryId = :factoryId AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "u.phone LIKE CONCAT('%', :keyword, '%'))")
    Page<User> searchUsers(@Param("factoryId") String factoryId,
                          @Param("keyword") String keyword,
                          Pageable pageable);
    /**
     * 更新用户最后登录时间
     */
    @Modifying
    @Query("UPDATE User u SET u.lastLogin = :lastLogin WHERE u.id = :userId")
    void updateLastLogin(@Param("userId") Integer userId, @Param("lastLogin") LocalDateTime lastLogin);
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
}
