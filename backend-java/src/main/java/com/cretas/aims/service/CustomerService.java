package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
/**
 * 客户服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface CustomerService {
    /**
     * 创建客户
     */
    CustomerDTO createCustomer(String factoryId, CreateCustomerRequest request, Integer userId);
     /**
     * 更新客户
      */
    CustomerDTO updateCustomer(String factoryId, String customerId, CreateCustomerRequest request);
     /**
     * 删除客户
      */
    void deleteCustomer(String factoryId, String customerId);
     /**
     * 获取客户详情
      */
    CustomerDTO getCustomerById(String factoryId, String customerId);
     /**
     * 获取客户列表（分页）
      */
    PageResponse<CustomerDTO> getCustomerList(String factoryId, PageRequest pageRequest);
     /**
     * 获取所有活跃客户
      */
    List<CustomerDTO> getActiveCustomers(String factoryId);
     /**
     * 按名称搜索客户
      */
    List<CustomerDTO> searchCustomersByName(String factoryId, String keyword);
     /**
     * 按客户类型获取客户
      */
    List<CustomerDTO> getCustomersByType(String factoryId, String type);
     /**
     * 按行业获取客户
      */
    List<CustomerDTO> getCustomersByIndustry(String factoryId, String industry);
     /**
     * 激活/停用客户
      */
    CustomerDTO toggleCustomerStatus(String factoryId, String customerId, Boolean isActive);
     /**
     * 更新客户评级
      */
    CustomerDTO updateCustomerRating(String factoryId, String customerId, Integer rating, String notes);
     /**
     * 更新客户信用额度
      */
    CustomerDTO updateCreditLimit(String factoryId, String customerId, BigDecimal creditLimit);
     /**
     * 更新客户当前余额
      */
    CustomerDTO updateCurrentBalance(String factoryId, String customerId, BigDecimal balance);
     /**
     * 获取客户统计信息
      */
    Map<String, Object> getCustomerStatistics(String factoryId, String customerId);
     /**
     * 获取客户购买历史
      */
    List<Map<String, Object>> getCustomerPurchaseHistory(String factoryId, String customerId);
     /**
     * 检查客户代码是否存在
      */
    boolean checkCustomerCodeExists(String factoryId, String customerCode);
     /**
     * 导出客户列表
      */
    byte[] exportCustomerList(String factoryId);

    /**
     * 生成客户导入模板
      */
    byte[] generateImportTemplate();

    /**
     * 从Excel文件批量导入客户
      */
    com.cretas.aims.dto.common.ImportResult<CustomerDTO> importCustomersFromExcel(String factoryId, java.io.InputStream inputStream);
     /**
     * 批量导入客户
      */
    List<CustomerDTO> importCustomers(String factoryId, List<CreateCustomerRequest> requests, Integer userId);
     /**
     * 获取客户评级分布
      */
    Map<Integer, Long> getCustomerRatingDistribution(String factoryId);
     /**
     * 获取欠款客户列表
      */
    List<CustomerDTO> getCustomersWithOutstandingBalance(String factoryId);
     /**
     * 获取VIP客户列表（按信用额度）
      */
    List<CustomerDTO> getVIPCustomers(String factoryId, Integer limit);
     /**
     * 获取客户类型分布
      */
    Map<String, Long> getCustomerTypeDistribution(String factoryId);
     /**
     * 获取客户行业分布
      */
    Map<String, Long> getCustomerIndustryDistribution(String factoryId);
     /**
     * 获取客户总体统计
      */
    Map<String, Object> getOverallCustomerStatistics(String factoryId);
}
