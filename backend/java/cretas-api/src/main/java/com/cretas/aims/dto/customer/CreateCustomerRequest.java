package com.cretas.aims.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * 创建客户请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建客户请求")
public class CreateCustomerRequest {

    @Schema(description = "客户名称", required = true)
    @NotBlank(message = "客户名称不能为空")
    @Size(max = 200, message = "客户名称长度不能超过200个字符")
    private String name;

    @Schema(description = "客户类型")
    @Size(max = 50, message = "客户类型长度不能超过50个字符")
    private String type;

    @Schema(description = "所属行业")
    @Size(max = 100, message = "所属行业长度不能超过100个字符")
    private String industry;

    // T10 / spec P2.1: contact fields are now optional per docx feedback
    // (some customers don't have a designated contact person). Only client name remains required.
    @Schema(description = "联系人")
    @Size(max = 100, message = "联系人长度不能超过100个字符")
    private String contactPerson;

    @Schema(description = "联系电话")
    @Pattern(regexp = "^$|^1[3-9]\\d{9}$|^0\\d{2,3}-?\\d{7,8}$", message = "电话格式不正确")
    private String phone;

    @Schema(description = "邮箱")
    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100个字符")
    private String email;

    @Schema(description = "收货地址")
    @Size(max = 5000, message = "收货地址长度不能超过5000个字符")
    private String shippingAddress;

    @Schema(description = "账单地址")
    @Size(max = 5000, message = "账单地址长度不能超过5000个字符")
    private String billingAddress;

    @Schema(description = "税号")
    @Size(max = 50, message = "税号长度不能超过50个字符")
    private String taxNumber;

    @Schema(description = "营业执照号")
    @Size(max = 100, message = "营业执照号长度不能超过100个字符")
    private String businessLicense;

    @Schema(description = "付款条款")
    @Size(max = 200, message = "付款条款长度不能超过200个字符")
    private String paymentTerms;

    @Schema(description = "信用额度")
    @PositiveOrZero(message = "信用额度必须大于等于0")
    private BigDecimal creditLimit;

    @Schema(description = "客户评级 (1-5)")
    private Integer rating;

    @Schema(description = "评级说明")
    @Size(max = 5000, message = "评级说明长度不能超过5000个字符")
    private String ratingNotes;

    @Schema(description = "备注")
    @Size(max = 5000, message = "备注长度不能超过5000个字符")
    private String notes;

    /** Bug D fix: status 'ACTIVE'/'INACTIVE' from frontend P2.2 status field. Maps to entity.isActive. */
    @Schema(description = "状态 ACTIVE/INACTIVE", example = "ACTIVE")
    @Size(max = 20, message = "状态长度不能超过20个字符")
    private String status;

    // ==================== Sprint 4 W2 S-CRM-FULL-1 ====================

    @Schema(description = "客户生命周期状态 (默认 LEAD)")
    private com.cretas.aims.entity.enums.CustomerStatus customerStatus;

    @Schema(description = "客户重要程度 (默认 NORMAL)")
    private com.cretas.aims.entity.enums.CustomerImportance importance;

    @Schema(description = "客户来源渠道")
    private com.cretas.aims.entity.enums.CustomerSource source;

    // ==================== Sprint 4 W2 S-INVOICE-CLIENT-1: 开票默认 ====================

    @Schema(description = "客户级默认税率 (%) — SO 创建时自动 prefill")
    private java.math.BigDecimal defaultTaxRate;

    @Schema(description = "客户级默认开票类型 (NORMAL/SPECIAL/DIGITAL/RECEIPT/NONE/OTHER)")
    private com.cretas.aims.entity.enums.InvoiceType defaultInvoiceType;

    /**
     * Optimistic lock version — echoed from GET response.
     * On UPDATE: if server detects version mismatch → 409 Conflict.
     * On CREATE: ignored (entity starts at 0).
     */
    @Schema(description = "乐观锁版本号 (编辑时必传, 来自 GET 响应)")
    private Long version;
}