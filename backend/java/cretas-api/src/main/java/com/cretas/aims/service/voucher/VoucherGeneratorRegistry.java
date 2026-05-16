package com.cretas.aims.service.voucher;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Optional;

/**
 * VoucherGenerator 注册中心. Spring DI 自动收集所有 @Component VoucherGenerator,
 * 提供 dispatch by businessType.
 */
@Slf4j
@Component
public class VoucherGeneratorRegistry {

    @Autowired
    @SuppressWarnings("rawtypes")
    private List<VoucherGenerator> generators;

    @PostConstruct
    void logRegistration() {
        log.info("✅ VoucherGeneratorRegistry: registered {} generators", generators.size());
        for (VoucherGenerator<?> g : generators) {
            log.info("    - {} ({})", g.getClass().getSimpleName(), g.getType());
        }
    }

    /**
     * 根据业务类型查找匹配的 generator. 不匹配返回空 Optional.
     */
    @SuppressWarnings("rawtypes")
    public Optional<VoucherGenerator> findByBusinessType(String businessType) {
        return generators.stream()
                .filter(g -> g.supports(businessType))
                .findFirst();
    }

    @SuppressWarnings("rawtypes")
    public List<VoucherGenerator> all() {
        return List.copyOf(generators);
    }
}
