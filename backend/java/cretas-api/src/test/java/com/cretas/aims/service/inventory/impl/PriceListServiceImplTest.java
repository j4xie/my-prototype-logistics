package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.entity.inventory.PriceList;
import com.cretas.aims.entity.inventory.PriceListItem;
import com.cretas.aims.repository.inventory.PriceListItemRepository;
import com.cretas.aims.repository.inventory.PriceListRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Issue #793 — unit tests for PriceListServiceImpl auto-apply 协议价 lookup.
 */
@ExtendWith(MockitoExtension.class)
class PriceListServiceImplTest {

    @Mock PriceListRepository priceListRepository;
    @Mock PriceListItemRepository priceListItemRepository;

    @InjectMocks PriceListServiceImpl service;

    private static final String FACTORY = "F006";
    private static final String CUSTOMER_A = "cust-A";
    private static final String CUSTOMER_B = "cust-B";
    private static final String PRODUCT = "prod-X";
    private static final LocalDate TODAY = LocalDate.of(2026, 5, 17);

    private PriceList priceList(String id, String customerId, String name) {
        PriceList pl = new PriceList();
        pl.setId(id);
        pl.setFactoryId(FACTORY);
        pl.setCustomerId(customerId);
        pl.setName(name);
        pl.setPriceType("SELLING_PRICE");
        pl.setEffectiveFrom(TODAY.minusMonths(1));
        pl.setEffectiveTo(TODAY.plusMonths(1));
        pl.setIsActive(true);
        return pl;
    }

    private PriceListItem item(String priceListId, BigDecimal price) {
        PriceListItem it = new PriceListItem();
        it.setPriceListId(priceListId);
        it.setProductTypeId(PRODUCT);
        it.setStandardPrice(price);
        return it;
    }

    @Test
    void customerSpecificPriceTakesPrecedence_returnsContractPrice() {
        PriceList customerPl = priceList("pl-a", CUSTOMER_A, "客户A协议");
        when(priceListRepository.findEffectiveForCustomer(
                eq(FACTORY), eq(CUSTOMER_A), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(List.of(customerPl));
        when(priceListItemRepository.findByPriceListIdAndProductTypeId("pl-a", PRODUCT))
                .thenReturn(List.of(item("pl-a", new BigDecimal("10.00"))));

        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, CUSTOMER_A, PRODUCT, TODAY);

        assertTrue(result.isPresent());
        assertEquals(new BigDecimal("10.00"), result.get());
    }

    @Test
    void customerSpecificMissing_fallsBackToGlobalSellingPrice() {
        when(priceListRepository.findEffectiveForCustomer(
                eq(FACTORY), eq(CUSTOMER_B), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(Collections.emptyList());
        PriceList globalPl = priceList("pl-g", null, "全局价格");
        when(priceListRepository.findEffectiveGlobal(
                eq(FACTORY), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(List.of(globalPl));
        when(priceListItemRepository.findByPriceListIdAndProductTypeId("pl-g", PRODUCT))
                .thenReturn(List.of(item("pl-g", new BigDecimal("12.50"))));

        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, CUSTOMER_B, PRODUCT, TODAY);

        assertTrue(result.isPresent());
        assertEquals(new BigDecimal("12.50"), result.get());
    }

    @Test
    void noCustomerAndNoGlobalPrice_returnsEmpty() {
        lenient().when(priceListRepository.findEffectiveForCustomer(
                any(), any(), any(), any())).thenReturn(Collections.emptyList());
        when(priceListRepository.findEffectiveGlobal(
                eq(FACTORY), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(Collections.emptyList());

        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, null, PRODUCT, TODAY);

        assertTrue(result.isEmpty());
    }

    @Test
    void nullProductId_returnsEmptyWithoutQuerying() {
        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, CUSTOMER_A, null, TODAY);

        assertTrue(result.isEmpty());
    }

    @Test
    void nullFactoryId_returnsEmptyWithoutQuerying() {
        Optional<BigDecimal> result = service.findActivePriceForOrder(
                null, CUSTOMER_A, PRODUCT, TODAY);

        assertTrue(result.isEmpty());
    }

    @Test
    void customerPriceWithNoMatchingProductLine_fallsBackToGlobal() {
        // Customer has an active price list but no row for this productId.
        PriceList customerPl = priceList("pl-a", CUSTOMER_A, "客户A协议");
        when(priceListRepository.findEffectiveForCustomer(
                eq(FACTORY), eq(CUSTOMER_A), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(List.of(customerPl));
        when(priceListItemRepository.findByPriceListIdAndProductTypeId("pl-a", PRODUCT))
                .thenReturn(Collections.emptyList());
        PriceList globalPl = priceList("pl-g", null, "全局价格");
        when(priceListRepository.findEffectiveGlobal(
                eq(FACTORY), eq("SELLING_PRICE"), eq(TODAY)))
                .thenReturn(List.of(globalPl));
        when(priceListItemRepository.findByPriceListIdAndProductTypeId("pl-g", PRODUCT))
                .thenReturn(List.of(item("pl-g", new BigDecimal("8.00"))));

        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, CUSTOMER_A, PRODUCT, TODAY);

        assertTrue(result.isPresent());
        assertEquals(new BigDecimal("8.00"), result.get());
    }

    @Test
    void nullAsOf_usesTodayImplicitly() {
        PriceList customerPl = priceList("pl-a", CUSTOMER_A, "客户A协议");
        when(priceListRepository.findEffectiveForCustomer(
                eq(FACTORY), eq(CUSTOMER_A), eq("SELLING_PRICE"), any(LocalDate.class)))
                .thenReturn(List.of(customerPl));
        when(priceListItemRepository.findByPriceListIdAndProductTypeId("pl-a", PRODUCT))
                .thenReturn(List.of(item("pl-a", new BigDecimal("9.99"))));

        Optional<BigDecimal> result = service.findActivePriceForOrder(
                FACTORY, CUSTOMER_A, PRODUCT, null);

        assertTrue(result.isPresent());
        assertEquals(new BigDecimal("9.99"), result.get());
    }
}
