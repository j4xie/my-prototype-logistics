package com.cretas.aims.service.inventory.impl;

import com.cretas.aims.entity.inventory.PriceList;
import com.cretas.aims.entity.inventory.PriceListItem;
import com.cretas.aims.repository.inventory.PriceListItemRepository;
import com.cretas.aims.repository.inventory.PriceListRepository;
import com.cretas.aims.service.inventory.PriceListService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Issue #793 — auto-apply 客户协议价 at SO creation.
 *
 * <p>Mirrors {@code PriceListController.lookupPrice} resolution but returns
 * {@code Optional<BigDecimal>} for use by service-layer callers (avoids
 * controller-to-controller HTTP coupling).</p>
 *
 * @since 2026-05-17
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PriceListServiceImpl implements PriceListService {

    private static final String SELLING_PRICE = "SELLING_PRICE";

    private final PriceListRepository priceListRepository;
    private final PriceListItemRepository priceListItemRepository;

    @Override
    public Optional<BigDecimal> findActivePriceForOrder(String factoryId,
                                                        String customerId,
                                                        String productId,
                                                        LocalDate asOf) {
        if (factoryId == null || factoryId.isBlank()) {
            return Optional.empty();
        }
        if (productId == null || productId.isBlank()) {
            return Optional.empty();
        }
        LocalDate effectiveDate = asOf != null ? asOf : LocalDate.now();

        // 1) Customer-specific selling price first (协议价).
        if (customerId != null && !customerId.isBlank()) {
            List<PriceList> customerLists = priceListRepository.findEffectiveForCustomer(
                    factoryId, customerId, SELLING_PRICE, effectiveDate);
            for (PriceList pl : customerLists) {
                BigDecimal price = findItemPrice(pl.getId(), productId);
                if (price != null) {
                    log.debug("Issue #793: applied customer 协议价 — factoryId={}, customerId={}, " +
                            "productId={}, priceList={}, price={}",
                            factoryId, customerId, productId, pl.getName(), price);
                    return Optional.of(price);
                }
            }
        }

        // 2) Fall back to global selling price (无客户绑定的统一定价).
        List<PriceList> globalLists = priceListRepository.findEffectiveGlobal(
                factoryId, SELLING_PRICE, effectiveDate);
        for (PriceList pl : globalLists) {
            BigDecimal price = findItemPrice(pl.getId(), productId);
            if (price != null) {
                log.debug("Issue #793: applied global selling price — factoryId={}, productId={}, " +
                        "priceList={}, price={}",
                        factoryId, productId, pl.getName(), price);
                return Optional.of(price);
            }
        }

        return Optional.empty();
    }

    private BigDecimal findItemPrice(String priceListId, String productId) {
        List<PriceListItem> items = priceListItemRepository.findByPriceListIdAndProductTypeId(
                priceListId, productId);
        if (items.isEmpty()) {
            return null;
        }
        return items.get(0).getStandardPrice();
    }
}
