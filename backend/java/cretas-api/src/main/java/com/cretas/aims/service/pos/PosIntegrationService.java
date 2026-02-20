package com.cretas.aims.service.pos;

import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.enums.PosSyncStatus;
import com.cretas.aims.entity.pos.PosConnection;
import com.cretas.aims.entity.pos.PosOrderSync;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.pos.PosConnectionRepository;
import com.cretas.aims.repository.pos.PosOrderSyncRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/**
 * POS集成服务
 *
 * 核心职责：
 * 1. 管理POS连接配置（CRUD）
 * 2. 调用对应品牌的Adapter同步数据
 * 3. 通过PosOrderSync表实现幂等去重
 * 4. 将POS订单转换为内部SalesOrder（由调用方完成）
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Service
public class PosIntegrationService {

    private static final Logger log = LoggerFactory.getLogger(PosIntegrationService.class);
    private static final int MAX_RETRIES = 3;

    private final PosAdapterRegistry adapterRegistry;
    private final PosConnectionRepository connectionRepository;
    private final PosOrderSyncRepository orderSyncRepository;

    public PosIntegrationService(PosAdapterRegistry adapterRegistry,
                                  PosConnectionRepository connectionRepository,
                                  PosOrderSyncRepository orderSyncRepository) {
        this.adapterRegistry = adapterRegistry;
        this.connectionRepository = connectionRepository;
        this.orderSyncRepository = orderSyncRepository;
    }

    // ==================== 连接管理 ====================

    public PosConnection createConnection(String factoryId, PosBrand brand, String connectionName,
                                           String appKey, String appSecret, String posStoreId,
                                           Long userId, String remark) {
        // 检查是否已有同品牌连接
        connectionRepository.findByFactoryIdAndBrand(factoryId, brand).ifPresent(existing -> {
            throw new BusinessException("该工厂已存在" + brand.getDisplayName() + "的POS连接");
        });

        if (!adapterRegistry.isSupported(brand)) {
            log.warn("POS品牌{}暂无适配器实现，连接将创建但无法同步", brand.getDisplayName());
        }

        PosConnection connection = new PosConnection();
        connection.setFactoryId(factoryId);
        connection.setBrand(brand);
        connection.setConnectionName(connectionName);
        connection.setAppKey(appKey);
        connection.setAppSecret(appSecret);
        connection.setPosStoreId(posStoreId);
        connection.setCreatedBy(userId);
        connection.setRemark(remark);
        connection.setIsActive(true);

        log.info("创建POS连接: factoryId={}, brand={}", factoryId, brand.getDisplayName());
        return connectionRepository.save(connection);
    }

    public List<PosConnection> getConnections(String factoryId) {
        return connectionRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
    }

    public PosConnection getConnection(String factoryId, String connectionId) {
        return connectionRepository.findByIdAndFactoryId(connectionId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("POS连接不存在"));
    }

    @Transactional
    public void deleteConnection(String factoryId, String connectionId) {
        PosConnection connection = getConnection(factoryId, connectionId);
        connectionRepository.delete(connection);
        log.info("删除POS连接: connectionId={}, brand={}", connectionId, connection.getBrand());
    }

    @Transactional
    public PosConnection toggleConnection(String factoryId, String connectionId, boolean active) {
        PosConnection connection = getConnection(factoryId, connectionId);
        connection.setIsActive(active);
        log.info("{}POS连接: connectionId={}", active ? "启用" : "停用", connectionId);
        return connectionRepository.save(connection);
    }

    // ==================== 连接测试 ====================

    public boolean testConnection(String factoryId, String connectionId) {
        PosConnection connection = getConnection(factoryId, connectionId);
        PosAdapter adapter = getAdapterOrThrow(connection.getBrand());

        try {
            boolean result = adapter.testConnection(connection);
            connection.setLastError(result ? null : "连接测试失败");
            connectionRepository.save(connection);
            return result;
        } catch (Exception e) {
            connection.setLastError(e.getMessage());
            connectionRepository.save(connection);
            log.error("POS连接测试失败: brand={}, error={}", connection.getBrand(), e.getMessage());
            return false;
        }
    }

    // ==================== 订单同步 ====================

    @Transactional
    public List<PosOrderSync> syncOrders(String factoryId, String connectionId) {
        PosConnection connection = getConnection(factoryId, connectionId);
        if (!connection.getIsActive()) {
            throw new BusinessException("POS连接已停用");
        }

        PosAdapter adapter = getAdapterOrThrow(connection.getBrand());

        // 从上次同步时间开始拉取（首次拉取最近7天）
        LocalDateTime since = connection.getLastSyncAt() != null
                ? connection.getLastSyncAt()
                : LocalDateTime.now().minusDays(7);

        List<Map<String, Object>> posOrders;
        try {
            posOrders = adapter.syncOrders(connection, since);
        } catch (Exception e) {
            connection.setLastError("同步失败: " + e.getMessage());
            connectionRepository.save(connection);
            throw new BusinessException("POS订单同步失败: " + e.getMessage());
        }

        List<PosOrderSync> syncResults = new ArrayList<>();
        for (Map<String, Object> posOrder : posOrders) {
            String posOrderId = String.valueOf(posOrder.get("orderId"));

            // 幂等检查
            if (orderSyncRepository.existsByPosOrderIdAndBrand(posOrderId, connection.getBrand())) {
                log.debug("POS订单已同步，跳过: posOrderId={}", posOrderId);
                continue;
            }

            PosOrderSync sync = new PosOrderSync();
            sync.setFactoryId(factoryId);
            sync.setBrand(connection.getBrand());
            sync.setPosOrderId(posOrderId);
            sync.setPosOrderNumber((String) posOrder.get("orderNumber"));
            sync.setOrderAmount(posOrder.get("totalAmount") != null
                    ? new BigDecimal(posOrder.get("totalAmount").toString()) : null);
            sync.setPosOrderTime(posOrder.get("orderTime") != null
                    ? LocalDateTime.parse(posOrder.get("orderTime").toString()) : null);
            sync.setSyncStatus(PosSyncStatus.PENDING);
            sync.setSyncedAt(LocalDateTime.now());
            sync.setRawPayload(posOrder.toString());

            syncResults.add(orderSyncRepository.save(sync));
        }

        // 更新连接的最后同步时间
        connection.setLastSyncAt(LocalDateTime.now());
        connection.setLastError(null);
        connectionRepository.save(connection);

        log.info("POS订单同步完成: factoryId={}, brand={}, 新增{}条, 跳过{}条",
                factoryId, connection.getBrand(), syncResults.size(), posOrders.size() - syncResults.size());
        return syncResults;
    }

    // ==================== Webhook处理 ====================

    @Transactional
    public PosOrderSync handleWebhook(String factoryId, PosBrand brand,
                                       String payload, String signature,
                                       Map<String, String> headers) {
        PosConnection connection = connectionRepository.findByFactoryIdAndBrand(factoryId, brand)
                .orElseThrow(() -> new ResourceNotFoundException("未找到" + brand.getDisplayName() + "的POS连接"));

        PosAdapter adapter = getAdapterOrThrow(brand);

        // 验证签名
        if (!adapter.verifyWebhookSignature(connection, payload, signature)) {
            throw new BusinessException("Webhook签名验证失败");
        }

        // 处理回调数据
        Map<String, Object> orderData = adapter.handleWebhook(connection, payload, signature, headers);
        if (orderData == null || orderData.isEmpty()) {
            log.debug("Webhook返回空数据，可能是非订单类事件");
            return null;
        }

        String posOrderId = String.valueOf(orderData.get("orderId"));

        // 幂等检查
        if (orderSyncRepository.existsByPosOrderIdAndBrand(posOrderId, brand)) {
            log.debug("Webhook重复推送，跳过: posOrderId={}", posOrderId);
            return orderSyncRepository.findByPosOrderIdAndBrand(posOrderId, brand).orElse(null);
        }

        PosOrderSync sync = new PosOrderSync();
        sync.setFactoryId(factoryId);
        sync.setBrand(brand);
        sync.setPosOrderId(posOrderId);
        sync.setPosOrderNumber((String) orderData.get("orderNumber"));
        sync.setOrderAmount(orderData.get("totalAmount") != null
                ? new BigDecimal(orderData.get("totalAmount").toString()) : null);
        sync.setSyncStatus(PosSyncStatus.PENDING);
        sync.setSyncedAt(LocalDateTime.now());
        sync.setRawPayload(payload);

        log.info("Webhook订单同步: factoryId={}, brand={}, posOrderId={}", factoryId, brand, posOrderId);
        return orderSyncRepository.save(sync);
    }

    // ==================== 统计 ====================

    public Map<String, Object> getStatistics(String factoryId) {
        Map<String, Object> stats = new LinkedHashMap<>();

        List<PosConnection> connections = connectionRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
        stats.put("connectionCount", connections.size());
        stats.put("activeCount", connections.stream().filter(PosConnection::getIsActive).count());
        stats.put("registeredBrands", adapterRegistry.getRegisteredBrands());

        List<PosOrderSync> pending = orderSyncRepository.findByFactoryIdAndSyncStatus(factoryId, PosSyncStatus.PENDING);
        List<PosOrderSync> failed = orderSyncRepository.findByFactoryIdAndSyncStatus(factoryId, PosSyncStatus.FAILED);
        stats.put("pendingSyncCount", pending.size());
        stats.put("failedSyncCount", failed.size());

        return stats;
    }

    // ==================== 内部方法 ====================

    private PosAdapter getAdapterOrThrow(PosBrand brand) {
        return adapterRegistry.getAdapter(brand)
                .orElseThrow(() -> new BusinessException(brand.getDisplayName() + "适配器尚未实现"));
    }
}
