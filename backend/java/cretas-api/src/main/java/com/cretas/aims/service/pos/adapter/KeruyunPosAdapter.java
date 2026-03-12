package com.cretas.aims.service.pos.adapter;

import com.cretas.aims.config.KeruyunConfig;
import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.pos.PosConnection;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.pos.PosAdapter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 客如云POS适配器
 *
 * 实现客如云开放平台API对接，支持:
 * - OAuth2.0 授权流程 (授权码 → accessToken + refreshToken)
 * - 订单数据拉取 (分页查询)
 * - 商品/菜品目录同步
 * - 库存数据同步
 * - Webhook回调处理 (HMAC-SHA256签名验证)
 *
 * 注意: 这是框架/骨架代码。实际对接客如云开放平台需要:
 * 1. 完成商务合作并获取appKey/appSecret
 * 2. 确认实际API端点路径 (以客如云官方文档为准)
 * 3. 完成OAuth2授权回调页面
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@Slf4j
@Component
public class KeruyunPosAdapter implements PosAdapter {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final DateTimeFormatter KERUYUN_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final KeruyunConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public KeruyunPosAdapter(KeruyunConfig config, ObjectMapper objectMapper) {
        this.config = config;
        this.restTemplate = new RestTemplate();
        this.objectMapper = objectMapper;
    }

    @Override
    public PosBrand getBrand() {
        return PosBrand.KERUYUN;
    }

    @Override
    public boolean testConnection(PosConnection connection) {
        log.info("测试客如云连接: posStoreId={}", connection.getPosStoreId());

        try {
            // 确保Token有效
            ensureValidToken(connection);

            // TODO: 替换为客如云实际的门店信息查询接口
            String url = config.getApiBaseUrl() + "/open/v1/shop/get";

            HttpHeaders headers = buildAuthHeaders(connection);
            Map<String, Object> body = Map.of("shopId", connection.getPosStoreId());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, Map.class);

            boolean success = response.getStatusCode().is2xxSuccessful()
                    && response.getBody() != null
                    && isSuccessResponse(response.getBody());

            log.info("客如云连接测试{}: posStoreId={}", success ? "成功" : "失败",
                    connection.getPosStoreId());
            return success;
        } catch (Exception e) {
            log.error("客如云连接测试异常: posStoreId={}, error={}",
                    connection.getPosStoreId(), e.getMessage());
            return false;
        }
    }

    @Override
    public List<Map<String, Object>> syncOrders(PosConnection connection, LocalDateTime since) {
        log.info("同步客如云订单: posStoreId={}, since={}", connection.getPosStoreId(), since);

        ensureValidToken(connection);

        List<Map<String, Object>> allOrders = new ArrayList<>();
        int pageNo = 1;
        int pageSize = 50;
        boolean hasMore = true;

        while (hasMore) {
            try {
                // TODO: 替换为客如云实际的订单查询接口
                String url = config.getApiBaseUrl() + "/open/v1/order/list";

                HttpHeaders headers = buildAuthHeaders(connection);
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("shopId", connection.getPosStoreId());
                body.put("beginTime", since.format(KERUYUN_DATE_FORMAT));
                body.put("endTime", LocalDateTime.now().format(KERUYUN_DATE_FORMAT));
                body.put("pageNo", pageNo);
                body.put("pageSize", pageSize);

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
                ResponseEntity<String> response = restTemplate.exchange(
                        url, HttpMethod.POST, request, String.class);

                Map<String, Object> responseBody = parseResponse(response.getBody());
                if (!isSuccessResponse(responseBody)) {
                    log.error("客如云订单查询失败: page={}, response={}",
                            pageNo, responseBody.get("message"));
                    break;
                }

                Map<String, Object> data = getDataMap(responseBody);
                List<Map<String, Object>> orders = getOrderList(data);

                for (Map<String, Object> keruyunOrder : orders) {
                    allOrders.add(normalizeOrder(keruyunOrder));
                }

                // 检查是否还有下一页
                int totalCount = getInt(data, "totalCount", 0);
                hasMore = pageNo * pageSize < totalCount;
                pageNo++;

                log.debug("客如云订单分页: page={}, fetched={}, total={}",
                        pageNo - 1, orders.size(), totalCount);
            } catch (Exception e) {
                log.error("客如云订单同步异常: page={}, error={}", pageNo, e.getMessage());
                throw new BusinessException("客如云订单同步失败: " + e.getMessage());
            }
        }

        log.info("客如云订单同步完成: posStoreId={}, 共{}条",
                connection.getPosStoreId(), allOrders.size());
        return allOrders;
    }

    @Override
    public List<Map<String, Object>> syncProducts(PosConnection connection) {
        log.info("同步客如云商品: posStoreId={}", connection.getPosStoreId());

        ensureValidToken(connection);

        List<Map<String, Object>> allProducts = new ArrayList<>();
        int pageNo = 1;
        int pageSize = 100;
        boolean hasMore = true;

        while (hasMore) {
            try {
                // TODO: 替换为客如云实际的菜品/商品查询接口
                String url = config.getApiBaseUrl() + "/open/v1/dish/list";

                HttpHeaders headers = buildAuthHeaders(connection);
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("shopId", connection.getPosStoreId());
                body.put("pageNo", pageNo);
                body.put("pageSize", pageSize);

                HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
                ResponseEntity<String> response = restTemplate.exchange(
                        url, HttpMethod.POST, request, String.class);

                Map<String, Object> responseBody = parseResponse(response.getBody());
                if (!isSuccessResponse(responseBody)) {
                    log.error("客如云商品查询失败: page={}, response={}",
                            pageNo, responseBody.get("message"));
                    break;
                }

                Map<String, Object> data = getDataMap(responseBody);
                List<Map<String, Object>> products = getListFromData(data, "dishList");

                for (Map<String, Object> keruyunProduct : products) {
                    allProducts.add(normalizeProduct(keruyunProduct));
                }

                int totalCount = getInt(data, "totalCount", 0);
                hasMore = pageNo * pageSize < totalCount;
                pageNo++;
            } catch (Exception e) {
                log.error("客如云商品同步异常: page={}, error={}", pageNo, e.getMessage());
                throw new BusinessException("客如云商品同步失败: " + e.getMessage());
            }
        }

        log.info("客如云商品同步完成: posStoreId={}, 共{}条",
                connection.getPosStoreId(), allProducts.size());
        return allProducts;
    }

    @Override
    public List<Map<String, Object>> syncInventory(PosConnection connection) {
        log.info("同步客如云库存: posStoreId={}", connection.getPosStoreId());

        ensureValidToken(connection);

        try {
            // TODO: 替换为客如云实际的库存查询接口
            String url = config.getApiBaseUrl() + "/open/v1/stock/list";

            HttpHeaders headers = buildAuthHeaders(connection);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("shopId", connection.getPosStoreId());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            Map<String, Object> responseBody = parseResponse(response.getBody());
            if (!isSuccessResponse(responseBody)) {
                throw new BusinessException("客如云库存查询失败: " + responseBody.get("message"));
            }

            Map<String, Object> data = getDataMap(responseBody);
            List<Map<String, Object>> stockItems = getListFromData(data, "stockList");

            List<Map<String, Object>> normalizedItems = new ArrayList<>();
            for (Map<String, Object> item : stockItems) {
                normalizedItems.add(normalizeInventory(item));
            }

            log.info("客如云库存同步完成: posStoreId={}, 共{}条",
                    connection.getPosStoreId(), normalizedItems.size());
            return normalizedItems;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("客如云库存同步异常: error={}", e.getMessage());
            throw new BusinessException("客如云库存同步失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> handleWebhook(PosConnection connection, String payload,
                                              String signature, Map<String, String> headers) {
        log.info("处理客如云Webhook: posStoreId={}", connection.getPosStoreId());

        try {
            Map<String, Object> webhookData = parseResponse(payload);

            // 根据事件类型处理
            String eventType = getString(webhookData, "eventType", "");

            switch (eventType) {
                case "ORDER_PAID":
                case "ORDER_COMPLETED":
                    return normalizeWebhookOrder(webhookData);
                case "ORDER_REFUNDED":
                    log.info("客如云退款事件: orderId={}", webhookData.get("orderId"));
                    return normalizeWebhookOrder(webhookData);
                case "DISH_UPDATE":
                    log.info("客如云菜品更新事件");
                    return Collections.emptyMap(); // 非订单事件，返回空
                default:
                    log.debug("客如云未处理的事件类型: {}", eventType);
                    return Collections.emptyMap();
            }
        } catch (Exception e) {
            log.error("客如云Webhook处理异常: error={}", e.getMessage());
            throw new BusinessException("客如云Webhook处理失败: " + e.getMessage());
        }
    }

    @Override
    public boolean verifyWebhookSignature(PosConnection connection, String payload,
                                           String signature) {
        if (signature == null || signature.isEmpty()) {
            log.warn("客如云Webhook签名为空");
            return false;
        }

        try {
            // 获取签名密钥: 优先用连接级别的webhookSecret，否则用全局配置
            String secret = connection.getWebhookSecret() != null
                    ? connection.getWebhookSecret()
                    : config.getWebhookSecret();

            if (secret == null || secret.isEmpty()) {
                log.warn("客如云Webhook签名密钥未配置，跳过验证");
                return true; // 未配置密钥时不验证（开发阶段）
            }

            String computed = computeHmacSha256(payload, secret);
            boolean valid = computed.equalsIgnoreCase(signature);

            if (!valid) {
                log.warn("客如云Webhook签名不匹配: expected={}, actual={}",
                        computed.substring(0, Math.min(8, computed.length())) + "...",
                        signature.substring(0, Math.min(8, signature.length())) + "...");
            }

            return valid;
        } catch (Exception e) {
            log.error("客如云Webhook签名验证异常: error={}", e.getMessage());
            return false;
        }
    }

    @Override
    public PosConnection refreshToken(PosConnection connection) {
        log.info("刷新客如云Token: posStoreId={}", connection.getPosStoreId());

        try {
            // TODO: 替换为客如云实际的Token刷新接口
            String url = config.getApiBaseUrl() + "/open/v1/token/refresh";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("appKey", connection.getAppKey());
            body.put("refreshToken", connection.getRefreshToken());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            Map<String, Object> responseBody = parseResponse(response.getBody());
            if (!isSuccessResponse(responseBody)) {
                throw new BusinessException("客如云Token刷新失败: " + responseBody.get("message"));
            }

            Map<String, Object> data = getDataMap(responseBody);

            connection.setAccessToken(getString(data, "accessToken", null));
            connection.setRefreshToken(getString(data, "refreshToken", null));

            // 计算Token过期时间（客如云accessToken一般7200秒有效）
            int expiresIn = getInt(data, "expiresIn", 7200);
            connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));

            log.info("客如云Token刷新成功: posStoreId={}, expiresIn={}s",
                    connection.getPosStoreId(), expiresIn);
            return connection;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("客如云Token刷新异常: error={}", e.getMessage());
            throw new BusinessException("客如云Token刷新失败: " + e.getMessage());
        }
    }

    // ==================== OAuth2 授权 ====================

    /**
     * OAuth2授权码换取Token
     *
     * @param connection POS连接配置 (需要appKey, appSecret)
     * @param authCode   授权码 (用户在客如云授权页面同意后回调的code)
     * @return 更新了accessToken/refreshToken的连接
     */
    public PosConnection authorize(PosConnection connection, String authCode) {
        log.info("客如云OAuth2授权: authCode={}", authCode);

        try {
            // TODO: 替换为客如云实际的OAuth2 Token获取接口
            String url = config.getApiBaseUrl() + "/open/v1/token/get";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("appKey", connection.getAppKey());
            body.put("appSecret", connection.getAppSecret());
            body.put("code", authCode);
            body.put("grantType", "authorization_code");

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            Map<String, Object> responseBody = parseResponse(response.getBody());
            if (!isSuccessResponse(responseBody)) {
                throw new BusinessException("客如云授权失败: " + responseBody.get("message"));
            }

            Map<String, Object> data = getDataMap(responseBody);

            connection.setAccessToken(getString(data, "accessToken", null));
            connection.setRefreshToken(getString(data, "refreshToken", null));

            int expiresIn = getInt(data, "expiresIn", 7200);
            connection.setTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));

            // 从授权响应中获取门店ID（如果之前未设置）
            String shopId = getString(data, "shopId", null);
            if (shopId != null && connection.getPosStoreId() == null) {
                connection.setPosStoreId(shopId);
            }

            log.info("客如云OAuth2授权成功: posStoreId={}", connection.getPosStoreId());
            return connection;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("客如云OAuth2授权异常: error={}", e.getMessage());
            throw new BusinessException("客如云授权失败: " + e.getMessage());
        }
    }

    // ==================== 数据规范化 ====================

    /**
     * 将客如云订单数据规范化为内部统一格式
     */
    private Map<String, Object> normalizeOrder(Map<String, Object> keruyunOrder) {
        Map<String, Object> normalized = new LinkedHashMap<>();

        // TODO: 字段映射需根据客如云实际API响应结构调整
        normalized.put("orderId", getString(keruyunOrder, "orderId", ""));
        normalized.put("orderNumber", getString(keruyunOrder, "orderNo", ""));
        normalized.put("totalAmount", keruyunOrder.get("totalAmount"));
        normalized.put("payAmount", keruyunOrder.get("payAmount"));
        normalized.put("orderTime", getString(keruyunOrder, "orderTime", null));
        normalized.put("orderStatus", mapOrderStatus(getString(keruyunOrder, "status", "")));
        normalized.put("payType", getString(keruyunOrder, "payType", ""));
        normalized.put("tableNo", getString(keruyunOrder, "tableNo", ""));
        normalized.put("guestCount", keruyunOrder.get("guestCount"));
        normalized.put("source", "KERUYUN");

        // 订单明细
        List<Map<String, Object>> items = getListFromData(keruyunOrder, "orderItems");
        List<Map<String, Object>> normalizedItems = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> normalizedItem = new LinkedHashMap<>();
            normalizedItem.put("productId", getString(item, "dishId", ""));
            normalizedItem.put("productName", getString(item, "dishName", ""));
            normalizedItem.put("quantity", item.get("quantity"));
            normalizedItem.put("unitPrice", item.get("price"));
            normalizedItem.put("totalPrice", item.get("totalPrice"));
            normalizedItems.add(normalizedItem);
        }
        normalized.put("items", normalizedItems);

        return normalized;
    }

    /**
     * 将客如云商品数据规范化
     */
    private Map<String, Object> normalizeProduct(Map<String, Object> keruyunProduct) {
        Map<String, Object> normalized = new LinkedHashMap<>();

        // TODO: 字段映射需根据客如云实际API响应结构调整
        normalized.put("productId", getString(keruyunProduct, "dishId", ""));
        normalized.put("productName", getString(keruyunProduct, "dishName", ""));
        normalized.put("categoryId", getString(keruyunProduct, "categoryId", ""));
        normalized.put("categoryName", getString(keruyunProduct, "categoryName", ""));
        normalized.put("price", keruyunProduct.get("price"));
        normalized.put("unit", getString(keruyunProduct, "unit", ""));
        normalized.put("status", getString(keruyunProduct, "status", ""));
        normalized.put("source", "KERUYUN");

        return normalized;
    }

    /**
     * 将客如云库存数据规范化
     */
    private Map<String, Object> normalizeInventory(Map<String, Object> keruyunStock) {
        Map<String, Object> normalized = new LinkedHashMap<>();

        // TODO: 字段映射需根据客如云实际API响应结构调整
        normalized.put("productId", getString(keruyunStock, "dishId", ""));
        normalized.put("productName", getString(keruyunStock, "dishName", ""));
        normalized.put("currentStock", keruyunStock.get("stock"));
        normalized.put("unit", getString(keruyunStock, "unit", ""));
        normalized.put("source", "KERUYUN");

        return normalized;
    }

    /**
     * 规范化Webhook推送的订单数据
     */
    private Map<String, Object> normalizeWebhookOrder(Map<String, Object> webhookData) {
        Map<String, Object> normalized = new LinkedHashMap<>();

        // TODO: Webhook payload结构需以客如云文档为准
        normalized.put("orderId", getString(webhookData, "orderId", ""));
        normalized.put("orderNumber", getString(webhookData, "orderNo", ""));
        normalized.put("totalAmount", webhookData.get("totalAmount"));
        normalized.put("orderTime", getString(webhookData, "orderTime", null));
        normalized.put("source", "KERUYUN_WEBHOOK");

        return normalized;
    }

    // ==================== Token管理 ====================

    /**
     * 确保Token有效，过期时自动刷新
     */
    private void ensureValidToken(PosConnection connection) {
        if (connection.getAccessToken() == null || connection.getAccessToken().isEmpty()) {
            throw new BusinessException("客如云未授权，请先完成OAuth2授权");
        }

        // Token即将过期（提前5分钟刷新）
        if (connection.getTokenExpiresAt() != null
                && connection.getTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            log.info("客如云Token即将过期，自动刷新");
            refreshToken(connection);
        }
    }

    // ==================== HTTP辅助 ====================

    /**
     * 构建带OAuth2 Token的请求头
     */
    private HttpHeaders buildAuthHeaders(PosConnection connection) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + connection.getAccessToken());

        // 客如云开放平台通常还需要appKey + 时间戳签名
        // TODO: 根据客如云实际鉴权方式调整
        String timestamp = String.valueOf(System.currentTimeMillis());
        headers.set("X-App-Key", connection.getAppKey());
        headers.set("X-Timestamp", timestamp);

        try {
            String signContent = connection.getAppKey() + timestamp + connection.getAccessToken();
            String sign = computeHmacSha256(signContent, connection.getAppSecret());
            headers.set("X-Sign", sign);
        } catch (Exception e) {
            log.warn("客如云请求签名生成失败: {}", e.getMessage());
        }

        return headers;
    }

    // ==================== 签名计算 ====================

    /**
     * 计算HMAC-SHA256签名
     */
    private String computeHmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            SecretKeySpec secretKey = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
            mac.init(secretKey);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new BusinessException("HMAC-SHA256签名计算失败: " + e.getMessage());
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    // ==================== JSON解析辅助 ====================

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResponse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("JSON解析失败: {}", e.getMessage());
            throw new BusinessException("客如云响应解析失败");
        }
    }

    /**
     * 判断客如云API响应是否成功
     * TODO: 根据客如云实际响应结构调整成功判断逻辑
     */
    @SuppressWarnings("unchecked")
    private boolean isSuccessResponse(Map<String, Object> response) {
        if (response == null) return false;

        // 客如云通常用 code=0 表示成功
        Object code = response.get("code");
        if (code instanceof Number) {
            return ((Number) code).intValue() == 0;
        }
        if (code instanceof String) {
            return "0".equals(code) || "SUCCESS".equalsIgnoreCase((String) code);
        }

        // 备用: 检查result字段
        return response.containsKey("data") || response.containsKey("result");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getDataMap(Map<String, Object> response) {
        Object data = response.get("data");
        if (data == null) {
            data = response.get("result");
        }
        if (data instanceof Map) {
            return (Map<String, Object>) data;
        }
        return Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getOrderList(Map<String, Object> data) {
        Object list = data.get("orderList");
        if (list == null) {
            list = data.get("list");
        }
        if (list instanceof List) {
            return (List<Map<String, Object>>) list;
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getListFromData(Map<String, Object> data, String key) {
        Object list = data.get(key);
        if (list == null) {
            list = data.get("list");
        }
        if (list instanceof List) {
            return (List<Map<String, Object>>) list;
        }
        return Collections.emptyList();
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object value = map.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private int getInt(Map<String, Object> map, String key, int defaultValue) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    /**
     * 将客如云订单状态映射为内部状态
     * TODO: 确认客如云实际状态枚举值
     */
    private String mapOrderStatus(String keruyunStatus) {
        switch (keruyunStatus.toUpperCase()) {
            case "WAIT_PAY":
            case "1":
                return "PENDING";
            case "PAID":
            case "2":
                return "PAID";
            case "COMPLETED":
            case "3":
                return "COMPLETED";
            case "CANCELLED":
            case "REFUNDED":
            case "4":
            case "5":
                return "CANCELLED";
            default:
                return keruyunStatus;
        }
    }
}
