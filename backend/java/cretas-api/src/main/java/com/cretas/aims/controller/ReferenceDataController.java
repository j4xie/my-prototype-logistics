package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.User;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.util.SqlLikeEscaper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Lightweight read-only lookup endpoints for Canvas DYNAMIC mode dropdowns.
 *
 * <p>Why this exists: SchemaFormRenderer.vue renders {@code type=reference} fields via
 * ReferenceSelector, which calls {@code apiEndpoint?keyword=...&page=&size=}. The existing
 * domain endpoints (e.g. {@code /users}, {@code /customers}) carry permission gates
 * ({@code hr:read}, {@code sales:read_write}) that exclude users who legitimately need to
 * pick a salesperson/customer/product when creating a sales order. These minimal lookups
 * return only display fields (id, label, secondary) and require no module permission beyond
 * authentication — sales-friendly without leaking sensitive HR data (salary, hire date).
 *
 * <p>Response shape: {@code { content: [{id, label, ...}], totalElements }} — matches what
 * ReferenceSelector and other PageResponse-aware components expect.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/reference-data")
@RequiredArgsConstructor
@Tag(name = "Reference Data Lookup", description = "Canvas dropdown 通用查找端点")
public class ReferenceDataController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 50;

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;
    private final ProductTypeRepository productTypeRepository;

    /** Salesperson-eligible roles (department name fallback also applied). */
    private static final Set<String> SALES_ROLES = Set.of(
            "salesperson", "sales_manager", "sales_director",
            "factory_super_admin", "permission_admin");

    /**
     * 业务员/员工查找. salesOnly defaults to true (Canvas SO dropdown's intended use case);
     * pass {@code ?salesOnly=false} to fetch all active users (e.g. for assignee pickers).
     * 返回 fullName 作为 label (sales_orders.salesperson 列存的是 name 字符串, 不是 user_id).
     */
    @GetMapping("/employees")
    @Operation(summary = "员工查找 (业务员下拉)")
    public ApiResponse<Map<String, Object>> findEmployees(
            @PathVariable String factoryId,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(required = false, defaultValue = "true") boolean salesOnly,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        org.springframework.data.domain.PageRequest pageable = PageRequest.of(
                Math.max(page - 1, 0), clampSize(size),
                Sort.by(Sort.Direction.ASC, "fullName"));
        Page<User> result = userRepository.searchUsers(
                factoryId, SqlLikeEscaper.escape(keyword), pageable);
        List<Map<String, Object>> content = result.getContent().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> !salesOnly || isSalesEligible(u))
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("fullName", u.getFullName());
                    m.put("employeeCode", u.getEmployeeCode());
                    m.put("roleCode", u.getRoleCode());
                    m.put("department", u.getDepartment());
                    return m;
                })
                .collect(Collectors.toList());
        return wrap(content, salesOnly ? content.size() : result.getTotalElements());
    }

    private boolean isSalesEligible(User u) {
        if (SALES_ROLES.contains(String.valueOf(u.getRoleCode()))) return true;
        String dept = u.getDepartment();
        return dept != null && dept.contains("销售");
    }

    /** 客户查找 (sales_order.customerId 字段用此). */
    @GetMapping("/customers")
    @Operation(summary = "客户查找")
    public ApiResponse<Map<String, Object>> findCustomers(
            @PathVariable String factoryId,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        org.springframework.data.domain.PageRequest pageable = PageRequest.of(
                Math.max(page - 1, 0), clampSize(size),
                Sort.by(Sort.Direction.ASC, "name"));
        String esc = SqlLikeEscaper.escape(keyword);
        Page<Customer> result = (esc == null || esc.isBlank())
                ? customerRepository.findByFactoryId(factoryId, pageable)
                : customerRepository.searchByNamePaged(factoryId, esc, pageable);
        List<Map<String, Object>> content = result.getContent().stream()
                .map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", c.getId());
                    m.put("name", c.getName());
                    m.put("customerCode", c.getCustomerCode());
                    m.put("contactPerson", c.getContactPerson());
                    return m;
                })
                .collect(Collectors.toList());
        return wrap(content, result.getTotalElements());
    }

    /** 供应商查找. */
    @GetMapping("/suppliers")
    @Operation(summary = "供应商查找")
    public ApiResponse<Map<String, Object>> findSuppliers(
            @PathVariable String factoryId,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        org.springframework.data.domain.PageRequest pageable = PageRequest.of(
                Math.max(page - 1, 0), clampSize(size),
                Sort.by(Sort.Direction.ASC, "name"));
        String esc = SqlLikeEscaper.escape(keyword);
        Page<Supplier> result = (esc == null || esc.isBlank())
                ? supplierRepository.findByFactoryId(factoryId, pageable)
                : supplierRepository.searchByNamePaged(factoryId, esc, pageable);
        List<Map<String, Object>> content = result.getContent().stream()
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", s.getId());
                    m.put("name", s.getName());
                    m.put("supplierCode", s.getSupplierCode());
                    m.put("contactPerson", s.getContactPerson());
                    return m;
                })
                .collect(Collectors.toList());
        return wrap(content, result.getTotalElements());
    }

    /** 产品/SKU 查找 (订单明细 productTypeId). */
    @GetMapping("/products")
    @Operation(summary = "产品查找")
    public ApiResponse<Map<String, Object>> findProducts(
            @PathVariable String factoryId,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        org.springframework.data.domain.PageRequest pageable = PageRequest.of(
                Math.max(page - 1, 0), clampSize(size),
                Sort.by(Sort.Direction.ASC, "name"));
        String esc = SqlLikeEscaper.escape(keyword);
        Page<ProductType> result = (esc == null || esc.isBlank())
                ? productTypeRepository.findByFactoryId(factoryId, pageable)
                : productTypeRepository.searchProductTypes(factoryId, esc, pageable);
        List<Map<String, Object>> content = result.getContent().stream()
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", p.getId());
                    m.put("name", p.getName());
                    m.put("code", p.getCode());
                    m.put("specification", p.getSpecification());
                    m.put("unit", p.getUnit());
                    m.put("unitPrice", p.getUnitPrice());
                    return m;
                })
                .collect(Collectors.toList());
        return wrap(content, result.getTotalElements());
    }

    private int clampSize(int requested) {
        if (requested <= 0) return DEFAULT_PAGE_SIZE;
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    private ApiResponse<Map<String, Object>> wrap(List<Map<String, Object>> content, long total) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        body.put("totalElements", total);
        return ApiResponse.success(body);
    }
}
