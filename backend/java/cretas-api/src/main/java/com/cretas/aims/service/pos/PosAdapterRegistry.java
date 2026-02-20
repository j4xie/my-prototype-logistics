package com.cretas.aims.service.pos;

import com.cretas.aims.entity.enums.PosBrand;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * POS适配器注册中心
 *
 * 利用Spring @Component自动发现机制：
 * - 所有实现PosAdapter接口并标注@Component的类会自动注入
 * - 按PosBrand查找对应的适配器
 * - 无适配器时返回Optional.empty()（调用方决定如何处理）
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Component
public class PosAdapterRegistry {

    private static final Logger log = LoggerFactory.getLogger(PosAdapterRegistry.class);

    private final Map<PosBrand, PosAdapter> adapterMap = new EnumMap<>(PosBrand.class);

    /**
     * Spring自动注入所有PosAdapter实现
     * 构造函数注入确保启动时即完成注册
     */
    public PosAdapterRegistry(List<PosAdapter> adapters) {
        for (PosAdapter adapter : adapters) {
            adapterMap.put(adapter.getBrand(), adapter);
            log.info("注册POS适配器: brand={}, class={}",
                    adapter.getBrand().getDisplayName(), adapter.getClass().getSimpleName());
        }
        log.info("POS适配器注册完成, 共{}个品牌", adapterMap.size());
    }

    /** 按品牌查找适配器 */
    public Optional<PosAdapter> getAdapter(PosBrand brand) {
        return Optional.ofNullable(adapterMap.get(brand));
    }

    /** 获取所有已注册的品牌 */
    public Set<PosBrand> getRegisteredBrands() {
        return Collections.unmodifiableSet(adapterMap.keySet());
    }

    /** 检查某品牌是否有适配器 */
    public boolean isSupported(PosBrand brand) {
        return adapterMap.containsKey(brand);
    }
}
