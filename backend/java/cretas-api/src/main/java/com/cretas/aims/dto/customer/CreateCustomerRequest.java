package com.cretas.aims.dto.customer;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.PositiveOrZero;
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
    private String name;

    @Schema(description = "客户类型")
    private String type;

    @Schema(description = "所属行业")
    private String industry;

    @Schema(description = "联系人", required = true)
    @NotBlank(message = "联系人不能为空")
    private String contactPerson;

    @Schema(description = "联系电话", required = true)
    @NotBlank(message = "联系电话不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$|^0\\d{2,3}-?\\d{7,8}$", message = "电话格式不正确")
    private String phone;

    @Schema(description = "邮箱")
    @Email(message = "邮箱格式不正确")
    private String email;

    @Schema(description = "收货地址", required = true)
    @NotBlank(message = "收货地址不能为空")
    private String shippingAddress;

    @Schema(description = "账单地址")
    private String billingAddress;

    @Schema(description = "税号")
    private String taxNumber;

    @Schema(description = "营业执照号")
    private String businessLicense;

    @Schema(description = "付款条款")
    private String paymentTerms;

    @Schema(description = "信用额度")
    @PositiveOrZero(message = "信用额度必须大于等于0")
    private BigDecimal creditLimit;

    @Schema(description = "客户评级 (1-5)")
    private Integer rating;

    @Schema(description = "评级说明")
    private String ratingNotes;

    @Schema(description = "备注")
    private String notes;
}