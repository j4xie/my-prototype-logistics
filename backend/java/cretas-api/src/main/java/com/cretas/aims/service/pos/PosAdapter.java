package com.cretas.aims.service.pos;

import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.pos.PosConnection;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * POS系统适配器接口
 *
 * 每个POS品牌实现一个Adapter类：
 * - KeruyunPosAdapter（客如云，OAuth2）
 * - ErweihuoPosAdapter（二维火，SHA1签名）
 * - YinbaoPosAdapter（银豹，HMAC-SHA256）
 *
 * 新增POS品牌只需：
 * 1. 在PosBrand枚举添加值
 * 2. 编写XXXPosAdapter实现本接口
 * 3. 用@Component注册，PosAdapterRegistry自动发现
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
public interface PosAdapter {

    /** 返回此适配器支持的POS品牌 */
    PosBrand getBrand();

    /** 测试连接是否可用 */
    boolean testConnection(PosConnection connection);

    /**
     * 同步订单（拉取模式）
     * @param connection POS连接配置
     * @param since 从什么时间开始拉取
     * @return 规范化的订单数据列表（Map结构，由PosIntegrationService转换为SalesOrder）
     */
    List<Map<String, Object>> syncOrders(PosConnection connection, LocalDateTime since);

    /**
     * 同步商品目录
     * @return 规范化的商品数据列表
     */
    List<Map<String, Object>> syncProducts(PosConnection connection);

    /**
     * 同步库存数据
     * @return 规范化的库存数据列表
     */
    List<Map<String, Object>> syncInventory(PosConnection connection);

    /**
     * 处理Webhook回调
     * @param payload 回调请求体
     * @param signature 签名（用于验证）
     * @param headers 请求头
     * @return 处理后的规范化数据
     */
    Map<String, Object> handleWebhook(PosConnection connection, String payload,
                                       String signature, Map<String, String> headers);

    /**
     * 验证Webhook签名
     * @return true表示签名合法
     */
    boolean verifyWebhookSignature(PosConnection connection, String payload, String signature);

    /**
     * 刷新Token（OAuth2场景）
     * 默认不需要（非OAuth2品牌），OAuth2品牌应覆盖此方法
     */
    default PosConnection refreshToken(PosConnection connection) {
        return connection; // 默认无需刷新
    }
}
