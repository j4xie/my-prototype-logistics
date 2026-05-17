package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.dto.customer.UpdateCustomerRequest;
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
    CustomerDTO createCustomer(String factoryId, CreateCustomerRequest request, Long userId);
     /**
     * 更新客户
      */
    CustomerDTO updateCustomer(String factoryId, String customerId, UpdateCustomerRequest request);
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
     * 获取客户列表（分页, 支持 keyword 过滤）
      */
    PageResponse<CustomerDTO> getCustomerList(String factoryId, PageRequest pageRequest, String keyword);

    /**
     * 获取客户列表（分页, 支持 keyword + 3 个 CRM 过滤器）— Sprint 4 W2 S-CRM-FULL-1.
     * 任一过滤参数 null 即不过滤.
     */
    PageResponse<CustomerDTO> getCustomerList(String factoryId, PageRequest pageRequest, String keyword,
                                              com.cretas.aims.entity.enums.CustomerStatus customerStatus,
                                              com.cretas.aims.entity.enums.CustomerImportance importance,
                                              com.cretas.aims.entity.enums.CustomerSource source);

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
     * 导出客户列表 (Excel).
     *
     * <p>RBAC defense-in-depth (PR P0-C sweep, 2026-05-12): {@code maskPrice}=true 时
     * 信用额度 / 当前余额 列以 "—" 占位, 通过 {@link com.cretas.aims.dto.customer.CustomerMaskedExportDTO}
     * 渲染. 调用方应基于 {@code !permissionService.hasPermission(user, "procurement:price:view")}
     * 决定该参数。默认 (no-arg overload) 视为 admin 完整访问, 仅供内部 callers 使用。
     *
     * @param factoryId  工厂 ID
     * @param maskPrice  {@code true} → 信用额度 / 当前余额 显示 "—"; {@code false} → 真实数值
     * @return Excel 字节内容
      */
    byte[] exportCustomerList(String factoryId, boolean maskPrice);

    /** @deprecated callers must pass {@code maskPrice} explicitly (RBAC). Defaults to admin (no mask). */
    @Deprecated
    default byte[] exportCustomerList(String factoryId) {
        return exportCustomerList(factoryId, false);
    }

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
    List<CustomerDTO> importCustomers(String factoryId, List<CreateCustomerRequest> requests, Long userId);
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

    /**
     * Sprint 4 W1 S-CUSTOMER-TAB-1 (tab 20): 变更客户当前业务员 + 记录 history.
     *
     * 防呆 R4 idempotent: 5min 内对同一 customer 重复变更到同一 newSalesUserId
     * 抛 BusinessException(409) with actionHint to 已存在 history.
     *
     * @param factoryId tenant scope
     * @param customerId 客户 id
     * @param newSalesUserId 新业务员 user id (必填, 不可与 current 相同 — 由 controller 校验)
     * @param reason 变更原因 (必填, R3 dropdown 6 + 其他)
     * @param changedBy 操作人 user id
     * @return updated CustomerDTO
     */
    CustomerDTO updateAssignedSalesUser(String factoryId, String customerId,
                                        Long newSalesUserId, String reason, Long changedBy);
}
