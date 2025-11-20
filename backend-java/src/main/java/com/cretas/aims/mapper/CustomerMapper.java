package com.cretas.aims.mapper;

import com.cretas.aims.dto.customer.CreateCustomerRequest;
import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.entity.Customer;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
/**
 * 客户实体映射器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Component
public class CustomerMapper {
    /**
     * Entity 转 DTO
     */
    public CustomerDTO toDTO(Customer customer) {
        if (customer == null) {
            return null;
        }
        CustomerDTO dto = CustomerDTO.builder()
                .id(customer.getId())
                .factoryId(customer.getFactoryId())
                .customerCode(customer.getCustomerCode())
                .name(customer.getName())
                .type(customer.getType())
                .industry(customer.getIndustry())
                .contactPerson(customer.getContactPerson())
                .phone(customer.getPhone())
                .email(customer.getEmail())
                .shippingAddress(customer.getShippingAddress())
                .billingAddress(customer.getBillingAddress())
                .taxNumber(customer.getTaxNumber())
                .businessLicense(customer.getBusinessLicense())
                .paymentTerms(customer.getPaymentTerms())
                .creditLimit(customer.getCreditLimit())
                .currentBalance(customer.getCurrentBalance())
                .rating(customer.getRating())
                .ratingNotes(customer.getRatingNotes())
                .isActive(customer.getIsActive())
                .notes(customer.getNotes())
                .createdAt(customer.getCreatedAt())
                .updatedAt(customer.getUpdatedAt())
                .createdBy(customer.getCreatedBy())
                .build();
        // 设置创建人姓名
        if (customer.getCreatedByUser() != null) {
            dto.setCreatedByName(customer.getCreatedByUser().getFullName());
        }
        // TODO: 设置统计信息（订单数量、销售总额、最后订单日期、平均订单价值）
        return dto;
    }

    /**
     * CreateRequest 转 Entity
     */
    public Customer toEntity(CreateCustomerRequest request, String factoryId, Integer createdBy) {
        if (request == null) {
            return null;
        }
        Customer customer = new Customer();
        customer.setFactoryId(factoryId);
        customer.setCode(generateCustomerCode());
        customer.setCustomerCode(generateCustomerCode());
        customer.setName(request.getName());
        customer.setType(request.getType());
        customer.setIndustry(request.getIndustry());
        customer.setContactName(request.getContactPerson());
        customer.setContactPerson(request.getContactPerson());
        customer.setContactPhone(request.getPhone());
        customer.setPhone(request.getPhone());
        customer.setContactEmail(request.getEmail());
        customer.setEmail(request.getEmail());
        customer.setShippingAddress(request.getShippingAddress());
        customer.setBillingAddress(request.getBillingAddress() != null ?
                request.getBillingAddress() : request.getShippingAddress());
        customer.setTaxNumber(request.getTaxNumber());
        customer.setBusinessLicense(request.getBusinessLicense());
        customer.setPaymentTerms(request.getPaymentTerms());
        customer.setCreditLimit(request.getCreditLimit());
        customer.setCurrentBalance(BigDecimal.ZERO);
        customer.setRating(request.getRating() != null ? request.getRating() : 3);
        customer.setRatingNotes(request.getRatingNotes());
        customer.setIsActive(true);
        customer.setNotes(request.getNotes());
        customer.setCreatedBy(createdBy);
        customer.setCreatedAt(LocalDateTime.now());
        return customer;
    }

    /**
     * 更新实体
     */
    public void updateEntity(Customer customer, CreateCustomerRequest request) {
        if (request.getName() != null) {
            customer.setName(request.getName());
        }
        if (request.getType() != null) {
            customer.setType(request.getType());
        }
        if (request.getIndustry() != null) {
            customer.setIndustry(request.getIndustry());
        }
        if (request.getContactPerson() != null) {
            customer.setContactPerson(request.getContactPerson());
            customer.setContactName(request.getContactPerson());
        }
        if (request.getPhone() != null) {
            customer.setPhone(request.getPhone());
            customer.setContactPhone(request.getPhone());
        }
        if (request.getEmail() != null) {
            customer.setEmail(request.getEmail());
            customer.setContactEmail(request.getEmail());
        }
        if (request.getShippingAddress() != null) {
            customer.setShippingAddress(request.getShippingAddress());
        }
        if (request.getBillingAddress() != null) {
            customer.setBillingAddress(request.getBillingAddress());
        }
        if (request.getTaxNumber() != null) {
            customer.setTaxNumber(request.getTaxNumber());
        }
        if (request.getBusinessLicense() != null) {
            customer.setBusinessLicense(request.getBusinessLicense());
        }
        if (request.getPaymentTerms() != null) {
            customer.setPaymentTerms(request.getPaymentTerms());
        }
        if (request.getCreditLimit() != null) {
            customer.setCreditLimit(request.getCreditLimit());
        }
        if (request.getRating() != null) {
            customer.setRating(request.getRating());
        }
        if (request.getRatingNotes() != null) {
            customer.setRatingNotes(request.getRatingNotes());
        }
        if (request.getNotes() != null) {
            customer.setNotes(request.getNotes());
        }
        customer.setUpdatedAt(LocalDateTime.now());
    }

    /**
     * 生成客户编码
     */
    private String generateCustomerCode() {
        return "CUS-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }
}
