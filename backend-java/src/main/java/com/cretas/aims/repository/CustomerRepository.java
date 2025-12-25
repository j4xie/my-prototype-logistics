package com.cretas.aims.repository;

import com.cretas.aims.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 客户数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface CustomerRepository extends JpaRepository<Customer, String> {

    /**
     * 根据ID和工厂ID查找客户
     */
    Optional<Customer> findByIdAndFactoryId(String id, String factoryId);

    /**
     * 根据工厂ID查找客户（分页）
     */
    Page<Customer> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID查找所有客户（不分页）
     */
    List<Customer> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID和激活状态查找客户
     */
    List<Customer> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 根据名称搜索客户
     * 注意：name使用双向模糊匹配（无法使用索引），customerCode使用右模糊（可使用索引）
     */
    @Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
           "AND (c.name LIKE CONCAT('%', :keyword, '%') OR c.customerCode LIKE CONCAT(:keyword, '%'))")
    List<Customer> searchByName(@Param("factoryId") String factoryId, @Param("keyword") String keyword);

    /**
     * 根据客户类型查找客户
     */
    List<Customer> findByFactoryIdAndType(String factoryId, String type);

    /**
     * 根据行业查找客户
     */
    List<Customer> findByFactoryIdAndIndustry(String factoryId, String industry);

    /**
     * 检查客户名称是否存在
     */
    boolean existsByFactoryIdAndName(String factoryId, String name);

    /**
     * 检查客户名称是否存在（排除指定ID）
     */
    boolean existsByFactoryIdAndNameAndIdNot(String factoryId, String name, String id);

    /**
     * 检查客户代码是否存在
     */
    boolean existsByCustomerCode(String customerCode);

    /**
     * 检查客户代码是否存在（在指定工厂）
     */
    boolean existsByFactoryIdAndCustomerCode(String factoryId, String customerCode);

    /**
     * 检查客户是否有关联的订单
     */
    @Query("SELECT COUNT(s) > 0 FROM ShipmentRecord s WHERE s.customerId = :customerId")
    boolean hasRelatedShipments(@Param("customerId") String customerId);

    /**
     * 获取客户评级分布
     */
    @Query("SELECT c.rating, COUNT(c) FROM Customer c WHERE c.factoryId = :factoryId " +
           "GROUP BY c.rating")
    List<Object[]> getCustomerRatingDistribution(@Param("factoryId") String factoryId);

    /**
     * 查找有欠款的客户
     */
    @Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
           "AND c.currentBalance > 0 ORDER BY c.currentBalance DESC")
    List<Customer> findCustomersWithOutstandingBalance(@Param("factoryId") String factoryId);

    /**
     * 获取信用额度最高的客户
     */
    @Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
           "ORDER BY c.creditLimit DESC")
    List<Customer> findTopCustomersByCreditLimit(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 获取评级最高的客户
     */
    @Query("SELECT c FROM Customer c WHERE c.factoryId = :factoryId " +
           "AND c.rating >= :minRating ORDER BY c.rating DESC")
    List<Customer> findTopCustomersByRating(@Param("factoryId") String factoryId,
                                           @Param("minRating") Integer minRating);

    /**
     * 计算工厂的客户总数
     */
    long countByFactoryId(String factoryId);

    /**
     * 计算工厂的活跃客户数
     */
    long countByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 统计客户的平均评级
     */
    @Query("SELECT AVG(c.rating) FROM Customer c WHERE c.factoryId = :factoryId " +
           "AND c.rating IS NOT NULL")
    Double calculateAverageRating(@Param("factoryId") String factoryId);

    /**
     * 统计客户的总欠款
     */
    @Query("SELECT SUM(c.currentBalance) FROM Customer c WHERE c.factoryId = :factoryId")
    BigDecimal calculateTotalOutstandingBalance(@Param("factoryId") String factoryId);

    /**
     * 统计客户的总信用额度
     */
    @Query("SELECT SUM(c.creditLimit) FROM Customer c WHERE c.factoryId = :factoryId " +
           "AND c.isActive = true")
    BigDecimal calculateTotalCreditLimit(@Param("factoryId") String factoryId);

    /**
     * 按客户类型统计数量
     */
    @Query("SELECT c.type, COUNT(c) FROM Customer c WHERE c.factoryId = :factoryId " +
           "GROUP BY c.type")
    List<Object[]> countByType(@Param("factoryId") String factoryId);

    /**
     * 按行业统计客户数量
     */
    @Query("SELECT c.industry, COUNT(c) FROM Customer c WHERE c.factoryId = :factoryId " +
           "GROUP BY c.industry")
    List<Object[]> countByIndustry(@Param("factoryId") String factoryId);
}
