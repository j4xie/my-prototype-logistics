package com.cretas.aims.service.crm.impl;

import com.cretas.aims.dto.customer.CreditStatusDTO;
import com.cretas.aims.entity.Customer;
import com.cretas.aims.entity.enums.CreditStatus;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.CustomerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * P1 #23 S-CREDIT-1 单元测试.
 */
@ExtendWith(MockitoExtension.class)
class CustomerCreditCheckServiceImplTest {

    @Mock
    private CustomerRepository customerRepository;

    @InjectMocks
    private CustomerCreditCheckServiceImpl service;

    private Customer baseCustomer;

    @BeforeEach
    void setup() {
        baseCustomer = new Customer();
        baseCustomer.setId("C-001");
        baseCustomer.setFactoryId("F001");
        baseCustomer.setName("测试客户");
        baseCustomer.setCreditLimit(new BigDecimal("100000.00"));
        baseCustomer.setCurrentBalance(new BigDecimal("20000.00"));
        baseCustomer.setCreditStatus(CreditStatus.NORMAL);
        baseCustomer.setCreditPeriodDays(30);
    }

    @Test
    @DisplayName("NORMAL 状态 + 充足额度 → green / not exceeds")
    void shouldReturnGreenWhenAmpleCredit() {
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.checkCreditAvailable("F001", "C-001", new BigDecimal("5000"));

        assertThat(dto.isExceeds()).isFalse();
        assertThat(dto.getSeverity()).isEqualTo("green");
        assertThat(dto.getAvailable()).isEqualByComparingTo("80000.00");
        assertThat(dto.getUsed()).isEqualByComparingTo("20000.00");
        assertThat(dto.getCustomerName()).isEqualTo("测试客户");
    }

    @Test
    @DisplayName("WARNING 阈值 — used / limit ≥ 0.8 → yellow")
    void shouldReturnYellowAtWarningThreshold() {
        baseCustomer.setCurrentBalance(new BigDecimal("85000.00")); // 85% utilization
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.checkCreditAvailable("F001", "C-001", new BigDecimal("5000"));

        assertThat(dto.getSeverity()).isEqualTo("yellow");
        assertThat(dto.isExceeds()).isFalse(); // 85k + 5k = 90k ≤ 100k limit
        assertThat(dto.getSuggestedAction()).contains("接近上限");
    }

    @Test
    @DisplayName("超额 → red / exceeds=true / suggestedAction 含金额")
    void shouldReturnRedWhenExceeds() {
        baseCustomer.setCurrentBalance(new BigDecimal("90000.00"));
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.checkCreditAvailable("F001", "C-001", new BigDecimal("15000"));

        assertThat(dto.isExceeds()).isTrue();
        assertThat(dto.getSeverity()).isEqualTo("red");
        assertThat(dto.getSuggestedAction()).contains("超出信用额度");
        // 90k + 15k = 105k, 超出 5k
        assertThat(dto.getSuggestedAction()).contains("5000");
    }

    @Test
    @DisplayName("SUSPENDED 状态 → red 直接阻塞, 不看额度")
    void shouldReturnRedWhenSuspended() {
        baseCustomer.setCreditStatus(CreditStatus.SUSPENDED);
        baseCustomer.setCurrentBalance(new BigDecimal("0"));
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.checkCreditAvailable("F001", "C-001", BigDecimal.ZERO);

        assertThat(dto.getSeverity()).isEqualTo("red");
        assertThat(dto.isExceeds()).isTrue();
        assertThat(dto.getAvailable()).isEqualByComparingTo("0");
        assertThat(dto.getSuggestedAction()).contains("销售管理员");
    }

    @Test
    @DisplayName("无信用额度 (NULL) → 无限制, exceeds=false")
    void shouldAllowWhenNoCreditLimit() {
        baseCustomer.setCreditLimit(null);
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.checkCreditAvailable("F001", "C-001", new BigDecimal("1000000"));

        assertThat(dto.isExceeds()).isFalse();
        assertThat(dto.getAvailable()).isNull();
        assertThat(dto.getSeverity()).isEqualTo("green");
    }

    @Test
    @DisplayName("客户不存在 → ResourceNotFoundException")
    void shouldThrowWhenCustomerNotFound() {
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.checkCreditAvailable("F001", "C-XXX", BigDecimal.ZERO))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getCreditStatus default 方法 — requestedAmount=0")
    void shouldUseZeroForGetCreditStatus() {
        when(customerRepository.findByIdAndFactoryId(anyString(), anyString()))
                .thenReturn(Optional.of(baseCustomer));

        CreditStatusDTO dto = service.getCreditStatus("F001", "C-001");

        assertThat(dto.getRequestedAmount()).isEqualByComparingTo("0");
        assertThat(dto.isExceeds()).isFalse();
    }
}
