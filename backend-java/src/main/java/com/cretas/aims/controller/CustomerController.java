package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.service.CustomerService;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.utils.TokenUtils;
import com.cretas.aims.util.ErrorSanitizer;
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
@Tag(name = "客户管理", description = "客户管理相关接口，包括客户的创建、查询、更新、删除，状态管理、评级评分、信用额度及余额管理，购买历史统计、VIP客户查询、Excel导入导出，以及客户类型/行业分布统计等功能")
public class CustomerController {

    private final CustomerService customerService;
    private final MobileService mobileService;

    /**
     * 创建客户
     */
    @PostMapping
    @Operation(summary = "创建客户", description = "在指定工厂下创建新客户，包括客户基本信息、联系方式、信用额度等")
    public ApiResponse<CustomerDTO> createCustomer(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", example = "Bearer eyJhbGciOiJIUzI1NiJ9...", required = true)
            @RequestHeader("Authorization") String authorization,
            @Parameter(description = "客户创建请求体")
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
    @Operation(summary = "更新客户", description = "更新指定客户的信息，包括名称、联系方式、地址等")
    public ApiResponse<CustomerDTO> updateCustomer(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "客户更新请求体")
            @Valid @RequestBody CreateCustomerRequest request) {

        log.info("更新客户: factoryId={}, customerId={}", factoryId, customerId);
        CustomerDTO customer = customerService.updateCustomer(factoryId, customerId, request);
        return ApiResponse.success("客户更新成功", customer);
    }

    /**
     * 删除客户
     */
    @DeleteMapping("/{customerId}")
    @Operation(summary = "删除客户", description = "删除指定客户记录（软删除），有关联订单的客户不可删除")
    public ApiResponse<Void> deleteCustomer(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId) {

        log.info("删除客户: factoryId={}, customerId={}", factoryId, customerId);
        customerService.deleteCustomer(factoryId, customerId);
        return ApiResponse.success("客户删除成功", null);
    }

    /**
     * 获取客户详情
     */
    @GetMapping("/{customerId}")
    @Operation(summary = "获取客户详情", description = "根据客户ID获取客户详细信息，包括联系方式、信用状况、交易统计等")
    public ApiResponse<CustomerDTO> getCustomerById(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId) {

        CustomerDTO customer = customerService.getCustomerById(factoryId, customerId);
        return ApiResponse.success(customer);
    }

    /**
     * 获取客户列表（分页）
     */
    @GetMapping
    @Operation(summary = "获取客户列表（分页）", description = "分页查询指定工厂的客户列表，支持排序和筛选")
    public ApiResponse<PageResponse<CustomerDTO>> getCustomerList(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "分页参数")
            @Valid PageRequest pageRequest) {

        PageResponse<CustomerDTO> response = customerService.getCustomerList(factoryId, pageRequest);
        return ApiResponse.success(response);
    }

    /**
     * 获取活跃客户列表
     */
    @GetMapping("/active")
    @Operation(summary = "获取活跃客户列表", description = "获取所有状态为活跃的客户列表，用于下拉选择等场景")
    public ApiResponse<List<CustomerDTO>> getActiveCustomers(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<CustomerDTO> customers = customerService.getActiveCustomers(factoryId);
        return ApiResponse.success(customers);
    }

    /**
     * 搜索客户
     */
    @GetMapping("/search")
    @Operation(summary = "搜索客户", description = "根据关键词搜索客户，支持按名称、代码、联系人模糊匹配")
    public ApiResponse<List<CustomerDTO>> searchCustomers(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "搜索关键词", example = "海鲜批发", required = true)
            @RequestParam @NotBlank String keyword) {

        List<CustomerDTO> customers = customerService.searchCustomersByName(factoryId, keyword);
        return ApiResponse.success(customers);
    }

    /**
     * 按客户类型获取客户
     */
    @GetMapping("/by-type")
    @Operation(summary = "按客户类型获取客户", description = "根据客户类型筛选客户列表，如：经销商、零售商、餐饮企业等")
    public ApiResponse<List<CustomerDTO>> getCustomersByType(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户类型: DEALER/RETAILER/RESTAURANT/ENTERPRISE", example = "DEALER", required = true)
            @RequestParam @NotBlank String type) {

        List<CustomerDTO> customers = customerService.getCustomersByType(factoryId, type);
        return ApiResponse.success(customers);
    }

    /**
     * 按行业获取客户
     */
    @GetMapping("/by-industry")
    @Operation(summary = "按行业获取客户", description = "根据客户所属行业筛选客户列表")
    public ApiResponse<List<CustomerDTO>> getCustomersByIndustry(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "行业类型", example = "餐饮", required = true)
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
    @Operation(summary = "切换客户状态", description = "切换客户的激活/停用状态，支持URL参数或RequestBody两种方式传参")
    public ApiResponse<CustomerDTO> toggleCustomerStatus(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "激活状态 (URL参数)", example = "true")
            @RequestParam(required = false) Boolean isActive,
            @Parameter(description = "激活状态 (Body参数): {\"isActive\": true}")
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
    @Operation(summary = "更新客户评级", description = "更新客户的评级等级（1-5星），可附加评级说明备注")
    public ApiResponse<CustomerDTO> updateCustomerRating(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "评级(1-5)", example = "4", required = true)
            @RequestParam @NotNull Integer rating,
            @Parameter(description = "评级说明", example = "订单量稳定，回款及时")
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
    @Operation(summary = "更新客户信用额度", description = "更新客户的信用额度上限，用于控制客户的赊账额度")
    public ApiResponse<CustomerDTO> updateCreditLimit(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "信用额度（元）", example = "100000.00", required = true)
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
    @Operation(summary = "更新客户当前余额", description = "更新客户账户的当前余额，用于记录客户的预付款或欠款情况")
    public ApiResponse<CustomerDTO> updateCurrentBalance(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "当前余额（元），正数表示预付款，负数表示欠款", example = "5000.00", required = true)
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
    @Operation(summary = "获取客户统计信息", description = "获取指定客户的统计数据，包括订单总数、总金额、平均订单金额等")
    public ApiResponse<Map<String, Object>> getCustomerStatistics(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId) {

        Map<String, Object> statistics = customerService.getCustomerStatistics(factoryId, customerId);
        return ApiResponse.success(statistics);
    }

    /**
     * 获取客户购买历史
     */
    @GetMapping("/{customerId}/purchase-history")
    @Operation(summary = "获取客户购买历史", description = "获取指定客户的历史购买记录列表，包括订单时间、产品、数量、金额等")
    public ApiResponse<List<Map<String, Object>>> getCustomerPurchaseHistory(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", example = "CUST-001", required = true)
            @PathVariable @NotBlank String customerId) {

        List<Map<String, Object>> history = customerService.getCustomerPurchaseHistory(factoryId, customerId);
        return ApiResponse.success(history);
    }

    /**
     * 检查客户代码是否存在
     */
    @GetMapping("/check-code")
    @Operation(summary = "检查客户代码是否存在", description = "检查指定客户代码在工厂内是否已存在，用于创建客户前的唯一性校验")
    public ApiResponse<Boolean> checkCustomerCode(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户代码", example = "KH20250101001", required = true)
            @RequestParam @NotBlank String customerCode) {

        boolean exists = customerService.checkCustomerCodeExists(factoryId, customerCode);
        return ApiResponse.success(exists);
    }

    /**
     * 导出客户列表
     */
    @GetMapping("/export")
    @Operation(summary = "导出客户列表", description = "将工厂的所有客户数据导出为Excel文件，文件名包含时间戳")
    public ResponseEntity<byte[]> exportCustomerList(
            @Parameter(description = "工厂ID", example = "F001", required = true)
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
    @Operation(summary = "下载客户导入模板", description = "下载用于批量导入客户的Excel模板文件，包含字段说明和示例数据")
    public ResponseEntity<byte[]> downloadCustomerTemplate(
            @Parameter(description = "工厂ID", example = "F001", required = true)
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
    @Operation(summary = "从Excel文件批量导入客户", description = "通过上传Excel文件批量导入客户数据，支持.xlsx格式，文件大小限制10MB")
    public ApiResponse<com.cretas.aims.dto.common.ImportResult<CustomerDTO>> importCustomersFromExcel(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "Excel文件（.xlsx格式，最大10MB）", required = true)
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
            return ApiResponse.error("导入失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * 批量导入客户（旧版本，使用JSON）
     */
    @PostMapping("/import/json")
    @Operation(summary = "批量导入客户（JSON格式）", description = "通过JSON数组格式批量导入客户数据，适用于API对接场景")
    public ApiResponse<List<CustomerDTO>> importCustomersFromJson(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "访问令牌", example = "Bearer eyJhbGciOiJIUzI1NiJ9...", required = true)
            @RequestHeader("Authorization") String authorization,
            @Parameter(description = "客户创建请求列表")
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
    @Operation(summary = "获取客户评级分布", description = "统计工厂内各评级（1-5星）的客户数量分布情况")
    public ApiResponse<Map<Integer, Long>> getCustomerRatingDistribution(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<Integer, Long> distribution = customerService.getCustomerRatingDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取有欠款的客户
     */
    @GetMapping("/outstanding-balance")
    @Operation(summary = "获取有欠款的客户", description = "获取工厂内所有存在欠款（余额为负）的客户列表，用于应收账款管理")
    public ApiResponse<List<CustomerDTO>> getCustomersWithOutstandingBalance(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        List<CustomerDTO> customers = customerService.getCustomersWithOutstandingBalance(factoryId);
        return ApiResponse.success(customers);
    }

    /**
     * 获取VIP客户
     */
    @GetMapping("/vip")
    @Operation(summary = "获取VIP客户", description = "获取工厂内的VIP客户列表，按重要程度排序")
    public ApiResponse<List<CustomerDTO>> getVIPCustomers(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "返回数量限制", example = "10")
            @RequestParam(defaultValue = "10") Integer limit) {

        List<CustomerDTO> customers = customerService.getVIPCustomers(factoryId, limit);
        return ApiResponse.success(customers);
    }

    /**
     * 获取客户类型分布
     */
    @GetMapping("/type-distribution")
    @Operation(summary = "获取客户类型分布", description = "统计工厂内各类型（经销商/零售商/餐饮/企业等）的客户数量分布")
    public ApiResponse<Map<String, Long>> getCustomerTypeDistribution(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Long> distribution = customerService.getCustomerTypeDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取客户行业分布
     */
    @GetMapping("/industry-distribution")
    @Operation(summary = "获取客户行业分布", description = "统计工厂内各行业（餐饮/零售/批发/食品加工等）的客户数量分布")
    public ApiResponse<Map<String, Long>> getCustomerIndustryDistribution(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Long> distribution = customerService.getCustomerIndustryDistribution(factoryId);
        return ApiResponse.success(distribution);
    }

    /**
     * 获取客户总体统计
     */
    @GetMapping("/overall-statistics")
    @Operation(summary = "获取客户总体统计", description = "获取工厂客户的综合统计数据，包括总客户数、活跃客户数、信用额度汇总等")
    public ApiResponse<Map<String, Object>> getOverallCustomerStatistics(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId) {

        Map<String, Object> statistics = customerService.getOverallCustomerStatistics(factoryId);
        return ApiResponse.success(statistics);
    }
}