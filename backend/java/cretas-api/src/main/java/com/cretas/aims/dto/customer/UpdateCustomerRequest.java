package com.cretas.aims.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * 更新客户请求 — 所有字段可选, 允许 partial update.
 *
 * 与 CreateCustomerRequest 的区别: 去掉 @NotBlank on name, 保留格式校验.
 * 外部 API 调用方可 partial update; FE 继续发全字段没影响.
 *
 * Pattern reference: UpdateSalesOrderRequest (inventory), UpdateSupplierRequest (supplier).
 */
@Data
@Schema(description = "更新客户请求")
public class UpdateCustomerRequest {

    @Schema(description = "客户名称")
    @Size(max = 200, message = "客户名称长度不能超过200个字符")
    private String name;

    @Schema(description = "客户类型")
    @Size(max = 50, message = "客户类型长度不能超过50个字符")
    private String type;

    @Schema(description = "所属行业")
    @Size(max = 100, message = "所属行业长度不能超过100个字符")
    private String industry;

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

    @Schema(description = "状态 ACTIVE/INACTIVE", example = "ACTIVE")
    @Size(max = 20, message = "状态长度不能超过20个字符")
    private String status;

    // ==================== Sprint 4 W2 S-CRM-FULL-1 ====================

    @Schema(description = "客户生命周期状态 (LEAD/INITIAL_CONTACT/SAMPLE_SENT/QUOTING/NEGOTIATING/SIGNING/RECURRING/INACTIVE/LOST/BLACKLIST/RECOVERED)")
    private com.cretas.aims.entity.enums.CustomerStatus customerStatus;

    @Schema(description = "客户重要程度 (VIP/IMPORTANT/NORMAL/LOW)")
    private com.cretas.aims.entity.enums.CustomerImportance importance;

    @Schema(description = "客户来源渠道 (EXHIBITION/REFERRAL/WEBSITE/SEARCH_ENGINE/WECHAT/PHONE/COLD_VISIT/PLATFORM/PARTNER/REPEAT_PURCHASE/OTHER)")
    private com.cretas.aims.entity.enums.CustomerSource source;

    @Schema(description = "最近接洽时间 — 显式更新或由销售活动 hook 自动更新")
    private java.time.LocalDateTime lastContactedAt;

    // ==================== Sprint 4 W2 S-INVOICE-CLIENT-1: 开票默认 ====================

    @Schema(description = "客户级默认税率 (%) — SO 创建时自动 prefill")
    private java.math.BigDecimal defaultTaxRate;

    @Schema(description = "客户级默认开票类型 (NORMAL/SPECIAL/DIGITAL/RECEIPT/NONE/OTHER)")
    private com.cretas.aims.entity.enums.InvoiceType defaultInvoiceType;

    /** 乐观锁版本号 (编辑时必传, 来自 GET 响应); mismatch → 409 Conflict */
    @Schema(description = "乐观锁版本号")
    private Long version;
}
