package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.service.CustomerService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 客户管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/customers")
@RequiredArgsConstructor
@Tag(name = "客户管理", description = "客户管理相关接口")
public class CustomerController {

    private final CustomerService customerService;
    private final MobileService mobileService;

    /**
     * 创建客户
     */
    @PostMapping
    @Operation(summary = "创建客户")
    public ApiResponse<CustomerDTO> createCustomer(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateCustomerRequest request) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("创建客户: factoryId={}, name={}", factoryId, request.getName());
        CustomerDTO customer = customerService.createCustomer(factoryId, request, userId.longValue());
        return ApiResponse.success("客户创建成功", customer);
    }

    /**
     * 更新客户
     */
    @PutMapping("/{customerId}")
    @Operation(summary = "更新客户")
    public ApiResponse<CustomerDTO> updateCustomer(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Valid @RequestBody CreateCustomerRequest request) {

        log.info("更新客户: factoryId={}, customerId={}", factoryId, customerId);
        CustomerDTO customer = customerService.updateCustomer(factoryId, customerId, request);
        return ApiResponse.success("客户更新成功", customer);
    }

    /**
     * 删除客户
     */
    @DeleteMapping("/{customerId}")
    @Operation(summary = "删除客户")
    public ApiResponse<Void> deleteCustomer(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId) {

        log.info("删除客户: factoryId={}, customerId={}", factoryId, customerId);
        customerService.deleteCustomer(factoryId, customerId);
        return ApiResponse.success("客户删除成功", null);
    }

    /**
     * 获取客户详情
     */
    @GetMapping("/{customerId}")
    @Operation(summary = "获取客户详情")
    public ApiResponse<CustomerDTO> getCustomerById(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId) {

        CustomerDTO customer = customerService.getCustomerById(factoryId, customerId);
        return ApiResponse.success(customer);
    }

    /**
     * 获取客户列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取客户列表（分页）")
    public ApiResponse<PageResponse<CustomerDTO>> getCustomerList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Valid PageRequest pageRequest) {

        PageResponse<CustomerDTO> response = customerService.getCustomerList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 获取活跃客户列表
     */
    @GetMapping("/active")
    @Operation(summary = "获取活跃客户列表")
    public ApiResponse<List<CustomerDTO>> getActiveCustomers(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<CustomerDTO> customers = customerService.getActiveCustomers(factoryId);
        return ApiResponse.success(customers);
    }

    /**
     * 搜索客户
     */
    @GetMapping("/search")
    @Operation(summary = "搜索客户")
    public ApiResponse<List<CustomerDTO>> searchCustomers(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "搜索关键词", required = true)
            @RequestParam @NotBlank String keyword) {

        List<CustomerDTO> customers = customerService.searchCustomersByName(factoryId, keyword);
        return ApiResponse.success(customers);
    }

    /**
     * 按客户类型获取客户
     */
    @GetMapping("/by-type")
    @Operation(summary = "按客户类型获取客户")
    public ApiResponse<List<CustomerDTO>> getCustomersByType(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户类型", required = true)
            @RequestParam @NotBlank String type) {

        List<CustomerDTO> customers = customerService.getCustomersByType(factoryId, type);
        return ApiResponse.success(customers);
    }

    /**
     * 按行业获取客户
     */
    @GetMapping("/by-industry")
    @Operation(summary = "按行业获取客户")
    public ApiResponse<List<CustomerDTO>> getCustomersByIndustry(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "行业", required = true)
            @RequestParam @NotBlank String industry) {

        List<CustomerDTO> customers = customerService.getCustomersByIndustry(factoryId, industry);
        return ApiResponse.success(customers);
    }

    /**
     * 切换客户状态
     * 支持两种参数格式：
     * 1. URL参数: PUT /{customerId}/status?isActive=true
     * 2. Request Body: PUT /{customerId}/status {"isActive": true}
     */
    @PutMapping("/{customerId}/status")
    @Operation(summary = "切换客户状态")
    public ApiResponse<CustomerDTO> toggleCustomerStatus(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "激活状态 (URL参数)")
            @RequestParam(required = false) Boolean isActive,
            @Parameter(description = "激活状态 (Body参数)")
            @RequestBody(required = false) Map<String, Boolean> body) {

        // 优先使用URL参数，如果没有则从body获取
        Boolean activeStatus = isActive;
        if (activeStatus == null && body != null) {
            activeStatus = body.get("isActive");
        }
        if (activeStatus == null) {
            return ApiResponse.error("参数错误: isActive 是必需的");
        }

        log.info("切换客户状态: factoryId={}, customerId={}, isActive={}",
                factoryId, customerId, activeStatus);
        CustomerDTO customer = customerService.toggleCustomerStatus(factoryId, customerId, activeStatus);
        return ApiResponse.success("客户状态更新成功", customer);
    }

    /**
     * 更新客户评级
     */
    @PutMapping("/{customerId}/rating")
    @Operation(summary = "更新客户评级")
    public ApiResponse<CustomerDTO> updateCustomerRating(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "评级(1-5)", required = true)
            @RequestParam @NotNull Integer rating,
            @Parameter(description = "评级说明")
            @RequestParam(required = false) String notes) {

        log.info("更新客户评级: factoryId={}, customerId={}, rating={}",
                factoryId, customerId, rating);
        CustomerDTO customer = customerService.updateCustomerRating(factoryId, customerId, rating, notes);
        return ApiResponse.success("客户评级更新成功", customer);
    }

    /**
     * 更新客户信用额度
     */
    @PutMapping("/{customerId}/credit-limit")
    @Operation(summary = "更新客户信用额度")
    public ApiResponse<CustomerDTO> updateCreditLimit(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "信用额度", required = true)
            @RequestParam @NotNull BigDecimal creditLimit) {

        log.info("更新客户信用额度: factoryId={}, customerId={}, creditLimit={}",
                factoryId, customerId, creditLimit);
        CustomerDTO customer = customerService.updateCreditLimit(factoryId, customerId, creditLimit);
        return ApiResponse.success("信用额度更新成功", customer);
    }

    /**
     * 更新客户当前余额
     */
    @PutMapping("/{customerId}/balance")
    @Operation(summary = "更新客户当前余额")
    public ApiResponse<CustomerDTO> updateCurrentBalance(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "当前余额", required = true)
            @RequestParam @NotNull BigDecimal balance) {

        log.info("更新客户当前余额: factoryId={}, customerId={}, balance={}",
                factoryId, customerId, balance);
        CustomerDTO customer = customerService.updateCurrentBalance(factoryId, customerId, balance);
        return ApiResponse.success("客户余额更新成功", customer);
    }

    /**
     * 获取客户统计信息
     */
    @GetMapping("/{customerId}/statistics")
    @Operation(summary = "获取客户统计信息")
    public ApiResponse<Map<String, Object>> getCustomerStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId) {

        Map<String, Object> statistics = customerService.getCustomerStatistics(factoryId, customerId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取客户购买历史
     */
    @GetMapping("/{customerId}/purchase-history")
    @Operation(summary = "获取客户购买历史")
    public ApiResponse<List<Map<String, Object>>> getCustomerPurchaseHistory(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId) {

        List<Map<String, Object>> history = customerService.getCustomerPurchaseHistory(factoryId, customerId);
        return ApiResponse.success(history);
    }

    /**
     * 检查客户代码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查客户代码是否存在")
    public ApiResponse<Boolean> checkCustomerCode(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户代码", required = true)
            @RequestParam @NotBlank String customerCode) {

        boolean exists = customerService.checkCustomerCodeExists(factoryId, customerCode);
        return ApiResponse.success(exists);
    }

    /**
     * 导出客户列表
     */
    @GetMapping("/export")
    @Operation(summary = "导出客户列表")
    public ResponseEntity<byte[]> exportCustomerList(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("导出客户列表: factoryId={}", factoryId);
        byte[] excelBytes = customerService.exportCustomerList(factoryId);

        // 生成文件名（包含时间戳）
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "客户列表_" + timestamp + ".xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelBytes);
    }

    /**
     * 下载客户导入模板
     */
    @GetMapping("/export/template")
    @Operation(summary = "下载客户导入模板")
    public ResponseEntity<byte[]> downloadCustomerTemplate(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        log.info("下载客户导入模板: factoryId={}", factoryId);
        byte[] templateBytes = customerService.generateImportTemplate();

        // 设置文件名
        String filename = "客户导入模板.xlsx";

        // 设置响应头
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(templateBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(templateBytes);
    }

    /**
     * 从Excel文件批量导入客户
     */
    @PostMapping("/import")
    @Operation(summary = "从Excel文件批量导入客户")
    public ApiResponse<com.cretas.aims.dto.common.ImportResult<CustomerDTO>> importCustomersFromExcel(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "Excel文件", required = true)
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {

        log.info("从Excel批量导入客户: factoryId={}, filename={}", factoryId, file.getOriginalFilename());

        // 验证文件类型
        if (file.getOriginalFilename() == null || !file.getOriginalFilename().endsWith(".xlsx")) {
            return ApiResponse.error("只支持.xlsx格式的Excel文件");
        }

        // 验证文件大小（10MB限制）
        if (file.getSize() > 10 * 1024 * 1024) {
            return ApiResponse.error("文件大小不能超过10MB");
        }

        try {
            com.cretas.aims.dto.common.ImportResult<CustomerDTO> result =
                    customerService.importCustomersFromExcel(factoryId, file.getInputStream());

            if (result.getIsFullSuccess()) {
                log.info("客户批量导入完全成功: factoryId={}, count={}", factoryId, result.getSuccessCount());
                return ApiResponse.success("导入成功", result);
            } else {
                log.warn("客户批量导入部分失败: factoryId={}, success={}, failure={}",
                        factoryId, result.getSuccessCount(), result.getFailureCount());
                return ApiResponse.success(
                        String.format("导入完成：成功%d条，失败%d条", result.getSuccessCount(), result.getFailureCount()),
                        result);
            }
        } catch (Exception e) {
            log.error("客户批量导入失败: factoryId={}", factoryId, e);
            return ApiResponse.error("导入失败: " + e.getMessage());
        }
    }

    /**
     * 批量导入客户（旧版本，使用JSON）
     */
    @PostMapping("/import/json")
    @Operation(summary = "批量导入客户（JSON格式）")
    public ApiResponse<List<CustomerDTO>> importCustomersFromJson(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", required = true)
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateCustomerRequest> requests) {

        // 获取当前用户ID
        String token = TokenUtils.extractToken(authorization);
        Long userId = mobileService.getUserFromToken(token).getId();

        log.info("批量导入客户(JSON): factoryId={}, count={}", factoryId, requests.size());
        List<CustomerDTO> customers = customerService.importCustomers(factoryId, requests, userId.longValue());
        return ApiResponse.success(String.format("成功导入%d个客户", customers.size()), customers);
    }

    /**
     * 获取客户评级分布
     */
    @GetMapping("/rating-distribution")
    @Operation(summary = "获取客户评级分布")
    public ApiResponse<Map<Integer, Long>> getCustomerRatingDistribution(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<Integer, Long> distribution = customerService.getCustomerRatingDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取有欠款的客户
     */
    @GetMapping("/outstanding-balance")
    @Operation(summary = "获取有欠款的客户")
    public ApiResponse<List<CustomerDTO>> getCustomersWithOutstandingBalance(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<CustomerDTO> customers = customerService.getCustomersWithOutstandingBalance(factoryId);
        return ApiResponse.success(customers);
    }

    /**
     * 获取VIP客户
     */
    @GetMapping("/vip")
    @Operation(summary = "获取VIP客户")
    public ApiResponse<List<CustomerDTO>> getVIPCustomers(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "数量限制", required = true)
            @RequestParam(defaultValue = "10") Integer limit) {

        List<CustomerDTO> customers = customerService.getVIPCustomers(factoryId, limit);
        return ApiResponse.success(customers);
    }

    /**
     * 获取客户类型分布
     */
    @GetMapping("/type-distribution")
    @Operation(summary = "获取客户类型分布")
    public ApiResponse<Map<String, Long>> getCustomerTypeDistribution(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Long> distribution = customerService.getCustomerTypeDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取客户行业分布
     */
    @GetMapping("/industry-distribution")
    @Operation(summary = "获取客户行业分布")
    public ApiResponse<Map<String, Long>> getCustomerIndustryDistribution(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Long> distribution = customerService.getCustomerIndustryDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取客户总体统计
     */
    @GetMapping("/overall-statistics")
    @Operation(summary = "获取客户总体统计")
    public ApiResponse<Map<String, Object>> getOverallCustomerStatistics(
            @Parameter(description = "工厂ID", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Object> statistics = customerService.getOverallCustomerStatistics(factoryId);
        return ApiResponse.success(statistics);
    }
}