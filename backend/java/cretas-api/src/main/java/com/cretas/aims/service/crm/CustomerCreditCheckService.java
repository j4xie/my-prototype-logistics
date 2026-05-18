package com.cretas.aims.service.crm;

import com.cretas.aims.dto.customer.CreditStatusDTO;

import java.math.BigDecimal;

/**
 * 客户信用检查服务 (P1 #23 S-CREDIT-1, 2026-05-17).
 *
 * <p>计算客户当前信用占用 (= Customer.currentBalance, 由 ArApService 维护) 与
 * 信用额度的关系, 返回结构化 DTO 供:
 * <ol>
 *   <li>{@link com.cretas.aims.controller.CustomerCreditController} GET 端点 (信用面板)</li>
 *   <li>{@link com.cretas.aims.service.inventory.impl.SalesServiceImpl#createSalesOrder} 创建前 hook
 *       (SUSPENDED → 阻塞; WARNING → soft warn 仅 log; OK → 通过)</li>
 * </ol>
 *
 * <p>防呆设计:
 * <ul>
 *   <li>R1 边界: DTO.available / DTO.used / DTO.utilizationRate 给前端预先显示</li>
 *   <li>R2 context: DTO.customerName 必填</li>
 *   <li>R5 CTA: DTO.suggestedAction 提供下一步操作引导</li>
 * </ul>
 */
public interface CustomerCreditCheckService {

    /**
     * 检查客户信用是否足以承接新增金额. 不修改任何数据.
     *
     * @param factoryId        当前工厂 (tenant scope)
     * @param customerId       客户 ID
     * @param requestedAmount  本次请求金额 (传 BigDecimal.ZERO 即纯查询当前状态)
     * @return DTO 含 available / exceeds / suggestedAction / severity
     */
    CreditStatusDTO checkCreditAvailable(String factoryId, String customerId, BigDecimal requestedAmount);

    /**
     * 查询信用状态 (不传请求金额). 等价 checkCreditAvailable(factoryId, customerId, BigDecimal.ZERO).
     */
    default CreditStatusDTO getCreditStatus(String factoryId, String customerId) {
        return checkCreditAvailable(factoryId, customerId, BigDecimal.ZERO);
    }
}
