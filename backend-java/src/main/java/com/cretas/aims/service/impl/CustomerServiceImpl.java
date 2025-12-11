package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.mapper.CustomerMapper;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
/**
 * 客户服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class CustomerServiceImpl implements CustomerService {
    private static final Logger log = LoggerFactory.getLogger(CustomerServiceImpl.class);

    private final CustomerRepository customerRepository;
    private final CustomerMapper customerMapper;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public CustomerServiceImpl(CustomerRepository customerRepository, CustomerMapper customerMapper) {
        this.customerRepository = customerRepository;
        this.customerMapper = customerMapper;
    }

    @Override
    @Transactional
    public CustomerDTO createCustomer(String factoryId, CreateCustomerRequest request, Integer userId) {
        log.info("创建客户: factoryId={}, name={}", factoryId, request.getName());
        // 检查客户名称是否重复
        if (customerRepository.existsByFactoryIdAndName(factoryId, request.getName())) {
            throw new BusinessException("客户名称已存在");
        }
        // 创建客户实体
        Customer customer = customerMapper.toEntity(request, factoryId, userId);
        // 生成UUID作为ID
        //customer.setId(java.util.UUID.randomUUID().toString());
        // 确保客户代码唯一
        String baseCode = "CUS";//customer.getCustomerCode();
        int counter = 0;
        while (customerRepository.existsByCustomerCode(customer.getCustomerCode())) {
            counter++;
            customer.setCustomerCode(baseCode + "-" + counter);
        }
        // 保存客户
        customer = customerRepository.save(customer);
        log.info("客户创建成功: id={}, code={}", customer.getId(), customer.getCustomerCode());
        return customerMapper.toDTO(customer);
    }

    @Override
    @Transactional
    public CustomerDTO updateCustomer(String factoryId, String customerId, CreateCustomerRequest request) {
        log.info("更新客户: factoryId={}, customerId={}", factoryId, customerId);
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        // 检查名称是否与其他客户重复
        if (request.getName() != null && !request.getName().equals(customer.getName())) {
            if (customerRepository.existsByFactoryIdAndNameAndIdNot(factoryId, request.getName(), customerId)) {
                throw new BusinessException("客户名称已存在");
            }
        }
        // 更新客户信息
        customerMapper.updateEntity(customer, request);
        customer = customerRepository.save(customer);
        log.info("客户更新成功: id={}", customer.getId());
        return customerMapper.toDTO(customer);
    }

    @Override
    @Transactional
    public void deleteCustomer(String factoryId, String customerId) {
        log.info("删除客户: factoryId={}, customerId={}", factoryId, customerId);
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        // 检查是否有关联的出货记录
        if (customerRepository.hasRelatedShipments(customerId)) {
            throw new BusinessException("客户有关联的出货记录，无法删除");
        }
        customerRepository.delete(customer);
        log.info("客户删除成功: id={}", customerId);
    }

    @Override
    public CustomerDTO getCustomerById(String factoryId, String customerId) {
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        return customerMapper.toDTO(customer);
    }

    @Override
    public PageResponse<CustomerDTO> getCustomerList(String factoryId, PageRequest pageRequest) {
        // 创建分页请求
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );
        // 查询客户
        Page<Customer> customerPage = customerRepository.findByFactoryId(factoryId, pageable);
        // 转换为DTO
        List<CustomerDTO> customerDTOs = customerPage.getContent().stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
        // 构建分页响应
        PageResponse<CustomerDTO> response = new PageResponse<>();
        response.setContent(customerDTOs);
        response.setPage(pageRequest.getPage());
        response.setSize(pageRequest.getSize());
        response.setTotalElements(customerPage.getTotalElements());
        response.setTotalPages(customerPage.getTotalPages());
        response.setFirst(customerPage.isFirst());
        response.setLast(customerPage.isLast());
        return response;
    }

    @Override
    public List<CustomerDTO> getActiveCustomers(String factoryId) {
        List<Customer> customers = customerRepository.findByFactoryIdAndIsActive(factoryId, true);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<CustomerDTO> searchCustomersByName(String factoryId, String keyword) {
        List<Customer> customers = customerRepository.searchByName(factoryId, keyword);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<CustomerDTO> getCustomersByType(String factoryId, String type) {
        List<Customer> customers = customerRepository.findByFactoryIdAndType(factoryId, type);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<CustomerDTO> getCustomersByIndustry(String factoryId, String industry) {
        List<Customer> customers = customerRepository.findByFactoryIdAndIndustry(factoryId, industry);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CustomerDTO toggleCustomerStatus(String factoryId, String customerId, Boolean isActive) {
        log.info("切换客户状态: factoryId={}, customerId={}, isActive={}",
                factoryId, customerId, isActive);
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        customer.setIsActive(isActive);
        customer.setUpdatedAt(LocalDateTime.now());
        customer = customerRepository.save(customer);
        log.info("客户状态更新成功: id={}, isActive={}", customer.getId(), isActive);
        return customerMapper.toDTO(customer);
    }

    @Override
    @Transactional
    public CustomerDTO updateCustomerRating(String factoryId, String customerId,
                                           Integer rating, String notes) {
        log.info("更新客户评级: factoryId={}, customerId={}, rating={}",
                factoryId, customerId, rating);
        if (rating < 1 || rating > 5) {
            throw new BusinessException("评级必须在1-5之间");
        }
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        customer.setRating(rating);
        customer.setRatingNotes(notes);
        customer = customerRepository.save(customer);
        log.info("客户评级更新成功: id={}, rating={}", customer.getId(), rating);
        return customerMapper.toDTO(customer);
    }

    @Override
    @Transactional
    public CustomerDTO updateCreditLimit(String factoryId, String customerId, BigDecimal creditLimit) {
        log.info("更新客户信用额度: factoryId={}, customerId={}, creditLimit={}",
                factoryId, customerId, creditLimit);
        if (creditLimit.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("信用额度不能为负数");
        }
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        customer.setCreditLimit(creditLimit);
        customer = customerRepository.save(customer);
        log.info("客户信用额度更新成功: id={}, creditLimit={}", customer.getId(), creditLimit);
        return customerMapper.toDTO(customer);
    }

    @Override
    @Transactional
    public CustomerDTO updateCurrentBalance(String factoryId, String customerId, BigDecimal balance) {
        log.info("更新客户当前余额: factoryId={}, customerId={}, balance={}",
                factoryId, customerId, balance);
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        customer.setCurrentBalance(balance);
        customer = customerRepository.save(customer);
        log.info("客户余额更新成功: id={}, balance={}", customer.getId(), balance);
        return customerMapper.toDTO(customer);
    }

    @Override
    public Map<String, Object> getCustomerStatistics(String factoryId, String customerId) {
        Customer customer = customerRepository.findByIdAndFactoryId(customerId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("客户不存在"));
        Map<String, Object> statistics = new HashMap<>();
        statistics.put("customerId", customer.getId());
        statistics.put("customerName", customer.getName());
        statistics.put("type", customer.getType());
        statistics.put("industry", customer.getIndustry());
        statistics.put("rating", customer.getRating());
        statistics.put("creditLimit", customer.getCreditLimit());
        statistics.put("currentBalance", customer.getCurrentBalance());

        // P2修复: 处理null值，避免NullPointerException
        BigDecimal creditLimit = customer.getCreditLimit() != null ? customer.getCreditLimit() : BigDecimal.ZERO;
        BigDecimal currentBalance = customer.getCurrentBalance() != null ? customer.getCurrentBalance() : BigDecimal.ZERO;
        statistics.put("creditAvailable", creditLimit.subtract(currentBalance));

        statistics.put("isActive", customer.getIsActive());
        // TODO: 添加订单统计、购买历史统计等信息
        statistics.put("totalOrders", 0);
        statistics.put("totalSales", BigDecimal.ZERO);
        statistics.put("averageOrderValue", BigDecimal.ZERO);
        statistics.put("lastOrderDate", null);
        return statistics;
    }

    @Override
    public List<Map<String, Object>> getCustomerPurchaseHistory(String factoryId, String customerId) {
        // TODO: 从订单表中获取购买历史
        List<Map<String, Object>> history = new ArrayList<>();
        return history;
    }

    @Override
    public boolean checkCustomerCodeExists(String factoryId, String customerCode) {
        return customerRepository.existsByFactoryIdAndCustomerCode(factoryId, customerCode);
    }

    @Override
    public byte[] exportCustomerList(String factoryId) {
        log.info("导出客户列表: factoryId={}", factoryId);

        // 查询所有客户
        List<Customer> customers = customerRepository.findByFactoryId(factoryId);

        // 转换为DTO
        List<CustomerDTO> customerDTOs = customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());

        // 转换为Excel导出DTO
        List<com.cretas.aims.dto.customer.CustomerExportDTO> exportDTOs = customerDTOs.stream()
                .map(com.cretas.aims.dto.customer.CustomerExportDTO::fromCustomerDTO)
                .collect(Collectors.toList());

        // 生成Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        byte[] excelBytes = excelUtil.exportToExcel(
                exportDTOs,
                com.cretas.aims.dto.customer.CustomerExportDTO.class,
                "客户列表"
        );

        log.info("客户列表导出成功: factoryId={}, count={}", factoryId, customers.size());
        return excelBytes;
    }

    @Override
    public byte[] generateImportTemplate() {
        log.info("生成客户导入模板");

        // 使用ExcelUtil生成空模板
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        byte[] templateBytes = excelUtil.generateTemplate(
                com.cretas.aims.dto.customer.CustomerExportDTO.class,
                "客户导入模板"
        );

        log.info("客户导入模板生成成功");
        return templateBytes;
    }

    @Override
    // 不使用@Transactional，让每个save操作独立进行，避免单行失败导致整体回滚
    public com.cretas.aims.dto.common.ImportResult<CustomerDTO> importCustomersFromExcel(String factoryId, java.io.InputStream inputStream) {
        log.info("开始从Excel批量导入客户: factoryId={}", factoryId);

        // 1. 解析Excel文件
        com.cretas.aims.util.ExcelUtil excelUtil = new com.cretas.aims.util.ExcelUtil();
        List<com.cretas.aims.dto.customer.CustomerExportDTO> excelData;
        try {
            excelData = excelUtil.importFromExcel(inputStream, com.cretas.aims.dto.customer.CustomerExportDTO.class);
        } catch (Exception e) {
            log.error("Excel文件解析失败: factoryId={}", factoryId, e);
            throw new RuntimeException("Excel文件格式错误或无法解析: " + e.getMessage());
        }

        com.cretas.aims.dto.common.ImportResult<CustomerDTO> result =
                com.cretas.aims.dto.common.ImportResult.create(excelData.size());

        // 2. 逐行验证并导入
        for (int i = 0; i < excelData.size(); i++) {
            com.cretas.aims.dto.customer.CustomerExportDTO exportDTO = excelData.get(i);
            int rowNumber = i + 2; // Excel行号（从2开始，1是表头）

            try {
                // 2.1 验证必填字段
                if (exportDTO.getName() == null || exportDTO.getName().trim().isEmpty()) {
                    result.addFailure(rowNumber, "客户名称不能为空", toJsonString(exportDTO));
                    continue;
                }

                // 2.2 验证编码唯一性（如果提供了编码）
                if (exportDTO.getCustomerCode() != null && !exportDTO.getCustomerCode().trim().isEmpty()) {
                    if (customerRepository.existsByFactoryIdAndCustomerCode(factoryId, exportDTO.getCustomerCode())) {
                        result.addFailure(rowNumber, "客户编码已存在: " + exportDTO.getCustomerCode(), toJsonString(exportDTO));
                        continue;
                    }
                }

                // 2.3 验证名称唯一性
                if (customerRepository.existsByFactoryIdAndName(factoryId, exportDTO.getName())) {
                    result.addFailure(rowNumber, "客户名称已存在: " + exportDTO.getName(), toJsonString(exportDTO));
                    continue;
                }

                // 2.4 转换为Entity
                Customer customer = convertFromExportDTO(exportDTO, factoryId);

                // 2.5 保存
                Customer saved = customerRepository.save(customer);

                // 2.6 转换为DTO并记录成功
                CustomerDTO dto = customerMapper.toDTO(saved);
                result.addSuccess(dto);

                log.debug("成功导入客户: row={}, name={}", rowNumber, exportDTO.getName());

            } catch (Exception e) {
                log.error("导入客户失败: factoryId={}, row={}, data={}", factoryId, rowNumber, exportDTO, e);
                result.addFailure(rowNumber, "保存失败: " + e.getMessage(), toJsonString(exportDTO));
            }
        }

        log.info("客户批量导入完成: factoryId={}, total={}, success={}, failure={}",
                factoryId, result.getTotalCount(), result.getSuccessCount(), result.getFailureCount());
        return result;
    }

    /**
     * 从ExportDTO转换为Entity
     */
    private Customer convertFromExportDTO(com.cretas.aims.dto.customer.CustomerExportDTO dto, String factoryId) {
        Customer customer = new Customer();
        customer.setId(java.util.UUID.randomUUID().toString());  // 生成UUID作为ID
        customer.setFactoryId(factoryId);
        customer.setCustomerCode(dto.getCustomerCode());
        customer.setCode(dto.getCustomerCode());  // code字段也使用customerCode
        customer.setName(dto.getName());
        customer.setType(dto.getType());  // Customer实体字段名是type
        customer.setIndustry(dto.getIndustry());
        customer.setContactPerson(dto.getContactPerson());
        customer.setPhone(dto.getPhone());  // Customer实体字段名是phone
        customer.setEmail(dto.getEmail());
        customer.setShippingAddress(dto.getShippingAddress());
        customer.setPaymentTerms(dto.getPaymentTerms());
        customer.setCreditLimit(dto.getCreditLimit());
        customer.setCurrentBalance(dto.getCurrentBalance());
        customer.setRating(dto.getRating());
        customer.setIsActive("启用".equals(dto.getStatus()));
        return customer;
    }

    /**
     * JSON序列化辅助方法（简单实现）
     */
    private String toJsonString(Object obj) {
        // 简单的字符串表示，生产环境可使用Jackson
        return obj != null ? obj.toString() : "null";
    }

    @Override
    @Transactional
    public List<CustomerDTO> importCustomers(String factoryId, List<CreateCustomerRequest> requests,
                                            Integer userId) {
        log.info("批量导入客户: factoryId={}, count={}", factoryId, requests.size());
        List<CustomerDTO> importedCustomers = new ArrayList<>();
        for (CreateCustomerRequest request : requests) {
            try {
                CustomerDTO customer = createCustomer(factoryId, request, userId);
                importedCustomers.add(customer);
            } catch (Exception e) {
                log.error("导入客户失败: name={}, error={}", request.getName(), e.getMessage());
            }
        }
        log.info("批量导入完成，成功导入 {} 个客户", importedCustomers.size());
        return importedCustomers;
    }

    @Override
    public Map<Integer, Long> getCustomerRatingDistribution(String factoryId) {
        List<Object[]> distribution = customerRepository.getCustomerRatingDistribution(factoryId);
        Map<Integer, Long> result = new HashMap<>();
        for (Object[] row : distribution) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            // 修复: 过滤null rating，避免JSON序列化失败
            if (rating != null) {
                result.put(rating, count);
            } else {
                // 将null rating归类为"未评级"（rating=0）
                log.warn("发现未评级的客户，数量: {}", count);
                result.put(0, result.getOrDefault(0, 0L) + count);
            }
        }
        // 确保所有评级都有值（0-5分，0表示未评级）
        for (int i = 0; i <= 5; i++) {
            result.putIfAbsent(i, 0L);
        }
        return result;
    }

    @Override
    public List<CustomerDTO> getCustomersWithOutstandingBalance(String factoryId) {
        List<Customer> customers = customerRepository.findCustomersWithOutstandingBalance(factoryId);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public List<CustomerDTO> getVIPCustomers(String factoryId, Integer limit) {
        org.springframework.data.domain.PageRequest pageable = org.springframework.data.domain.PageRequest.of(0, limit);
        List<Customer> customers = customerRepository.findTopCustomersByCreditLimit(factoryId, pageable);
        return customers.stream()
                .map(customerMapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Map<String, Long> getCustomerTypeDistribution(String factoryId) {
        List<Object[]> distribution = customerRepository.countByType(factoryId);
        Map<String, Long> result = new HashMap<>();
        for (Object[] row : distribution) {
            String type = (String) row[0];
            Long count = (Long) row[1];
            if (type != null) {
                result.put(type, count);
            } else {
                result.put("未分类", count);
            }
        }
        return result;
    }

    @Override
    public Map<String, Long> getCustomerIndustryDistribution(String factoryId) {
        List<Object[]> distribution = customerRepository.countByIndustry(factoryId);
        Map<String, Long> result = new HashMap<>();
        for (Object[] row : distribution) {
            String industry = (String) row[0];
            Long count = (Long) row[1];
            if (industry != null) {
                result.put(industry, count);
            } else {
                result.put("未分类", count);
            }
        }
        return result;
    }

    @Override
    public Map<String, Object> getOverallCustomerStatistics(String factoryId) {
        Map<String, Object> statistics = new HashMap<>();
        // 客户总数
        long totalCustomers = customerRepository.countByFactoryId(factoryId);
        statistics.put("totalCustomers", totalCustomers);
        // 活跃客户数
        long activeCustomers = customerRepository.countByFactoryIdAndIsActive(factoryId, true);
        statistics.put("activeCustomers", activeCustomers);
        // 平均评级
        Double averageRating = customerRepository.calculateAverageRating(factoryId);
        statistics.put("averageRating", averageRating != null ? averageRating : 0.0);
        // 总欠款
        BigDecimal totalOutstanding = customerRepository.calculateTotalOutstandingBalance(factoryId);
        statistics.put("totalOutstandingBalance", totalOutstanding != null ? totalOutstanding : BigDecimal.ZERO);
        // 总信用额度
        BigDecimal totalCredit = customerRepository.calculateTotalCreditLimit(factoryId);
        statistics.put("totalCreditLimit", totalCredit != null ? totalCredit : BigDecimal.ZERO);
        // 客户类型分布
        statistics.put("typeDistribution", getCustomerTypeDistribution(factoryId));
        // 客户行业分布
        statistics.put("industryDistribution", getCustomerIndustryDistribution(factoryId));
        // 客户评级分布
        statistics.put("ratingDistribution", getCustomerRatingDistribution(factoryId));
        return statistics;
    }
}
