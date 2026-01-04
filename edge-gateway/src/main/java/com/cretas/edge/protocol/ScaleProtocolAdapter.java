package com.cretas.edge.protocol;

import com.cretas.edge.model.ScaleReading;

import java.util.Optional;

/**
 * 电子秤协议适配器接口
 *
 * 定义解析不同品牌/型号电子秤通信协议的通用接口
 */
public interface ScaleProtocolAdapter {

    /**
     * 获取协议名称
     *
     * @return 协议名称（如 "KELI_D2008", "TOLEDO_ICS", "METTLER_MT"）
     */
    String getProtocolName();

    /**
     * 获取协议描述
     *
     * @return 协议的详细描述
     */
    String getProtocolDescription();

    /**
     * 解析原始数据
     *
     * @param rawData 从串口读取的原始字节数据
     * @return 解析后的称重数据，如果数据无效则返回空
     */
    Optional<ScaleReading> parse(byte[] rawData);

    /**
     * 检查数据是否为有效的数据帧
     *
     * @param data 原始数据
     * @return true 表示是有效的完整数据帧
     */
    boolean isValidFrame(byte[] data);

    /**
     * 查找数据帧结束位置
     *
     * 用于从数据流中提取完整的数据帧
     *
     * @param data 原始数据缓冲区
     * @return 帧结束位置（包含），如果没有找到完整帧则返回 -1
     */
    int findFrameEnd(byte[] data);

    /**
     * 生成请求命令
     *
     * 某些秤需要主动发送命令才能获取数据
     *
     * @param command 命令类型 (READ, ZERO, TARE)
     * @return 命令字节数组，如果不支持则返回 null
     */
    byte[] generateCommand(CommandType command);

    /**
     * 是否需要主动轮询
     *
     * @return true 表示需要发送命令主动请求数据
     */
    boolean requiresPolling();

    /**
     * 获取推荐的轮询间隔
     *
     * @return 毫秒数
     */
    int getRecommendedPollingInterval();

    /**
     * 命令类型枚举
     */
    enum CommandType {
        READ,    // 读取当前重量
        ZERO,    // 清零
        TARE,    // 去皮
        STATUS   // 获取状态
    }

    /**
     * 获取协议的帧头标识
     *
     * @return 帧头字节数组，用于识别数据帧开始
     */
    byte[] getFrameHeader();

    /**
     * 获取协议的帧尾标识
     *
     * @return 帧尾字节数组，用于识别数据帧结束
     */
    byte[] getFrameTerminator();
}
