package com.cretas.aims.dto.supplier;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

/**
 * 创建供应商请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建供应商请求")
public class CreateSupplierRequest {

    @Schema(description = "供应商名称", required = true)
    @NotBlank(message = "供应商名称不能为空")
    private String name;

    @Schema(description = "联系人", required = true)
    @NotBlank(message = "联系人不能为空")
    private String contactPerson;

    @Schema(description = "联系电话", required = true)
    @NotBlank(message = "联系电话不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Schema(description = "邮箱")
    @Email(message = "邮箱格式不正确")
    private String email;

    @Schema(description = "地址", required = true)
    @NotBlank(message = "地址不能为空")
    private String address;

    @Schema(description = "营业执照号")
    private String businessLicense;

    @Schema(description = "税号")
    private String taxNumber;

    @Schema(description = "开户银行")
    private String bankName;

    @Schema(description = "银行账号")
    private String bankAccount;

    @Schema(description = "供应材料类型")
    private String suppliedMaterials;

    @Schema(description = "付款条款")
    private String paymentTerms;

    @Schema(description = "交货天数")
    @PositiveOrZero(message = "交货天数必须大于等于0")
    private Integer deliveryDays;

    @Schema(description = "信用额度")
    @PositiveOrZero(message = "信用额度必须大于等于0")
    private BigDecimal creditLimit;

    @Schema(description = "供应商评级 (1-5)")
    private Integer rating;

    @Schema(description = "评级说明")
    private String ratingNotes;

    @Schema(description = "质量认证证书")
    private String qualityCertificates;

    @Schema(description = "备注")
    private String notes;
}