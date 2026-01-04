package com.cretas.edge.collector;

import com.cretas.edge.model.ScaleReading;

import java.util.Optional;

/**
 * 秤数据采集接口
 *
 * 定义电子秤数据采集的通用接口，支持不同类型的采集方式（串口、网络、模拟等）
 */
public interface ScaleCollector {

    /**
     * 初始化采集器
     *
     * @throws Exception 初始化失败时抛出异常
     */
    void initialize() throws Exception;

    /**
     * 启动采集
     */
    void start();

    /**
     * 停止采集
     */
    void stop();

    /**
     * 判断采集器是否正在运行
     *
     * @return true 表示正在运行
     */
    boolean isRunning();

    /**
     * 读取一次称重数据
     *
     * @return 称重数据（如果读取成功）
     */
    Optional<ScaleReading> readOnce();

    /**
     * 获取设备ID
     *
     * @return 设备唯一标识
     */
    String getDeviceId();

    /**
     * 获取采集器类型
     *
     * @return 采集器类型标识
     */
    String getCollectorType();

    /**
     * 获取采集器状态描述
     *
     * @return 状态描述字符串
     */
    String getStatusDescription();

    /**
     * 设置数据回调
     *
     * @param callback 数据回调接口
     */
    void setDataCallback(DataCallback callback);

    /**
     * 数据回调接口
     */
    @FunctionalInterface
    interface DataCallback {
        /**
         * 当采集到新数据时调用
         *
         * @param reading 称重数据
         */
        void onData(ScaleReading reading);
    }

    /**
     * 错误回调接口
     */
    @FunctionalInterface
    interface ErrorCallback {
        /**
         * 当发生错误时调用
         *
         * @param deviceId 设备ID
         * @param error    错误信息
         */
        void onError(String deviceId, Throwable error);
    }

    /**
     * 设置错误回调
     *
     * @param callback 错误回调接口
     */
    void setErrorCallback(ErrorCallback callback);
}
