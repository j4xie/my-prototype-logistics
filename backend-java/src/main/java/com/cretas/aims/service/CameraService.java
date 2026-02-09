package com.cretas.aims.service;

import com.cretas.aims.dto.camera.CameraDeviceInfo;
import com.cretas.aims.dto.camera.CaptureImageRequest;
import com.cretas.aims.dto.camera.CaptureImageResponse;

import java.util.List;

/**
 * 相机服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
public interface CameraService {

    /**
     * 初始化SDK（应用启动时调用）
     */
    void initialize();

    /**
     * 清理SDK资源（应用关闭时调用）
     */
    void cleanup();

    /**
     * 枚举可用相机设备
     *
     * @return 相机设备列表
     */
    List<CameraDeviceInfo> enumerateDevices();

    /**
     * 连接到指定相机
     *
     * @param deviceIndex 设备索引
     */
    void connectCamera(int deviceIndex);

    /**
     * 断开相机连接
     */
    void disconnectCamera();

    /**
     * 检查相机是否已连接
     *
     * @return true-已连接，false-未连接
     */
    boolean isConnected();

    /**
     * 采集图像
     *
     * @param request 拍照请求参数
     * @return 拍照响应（包含图像路径等信息）
     */
    CaptureImageResponse captureImage(CaptureImageRequest request);

    /**
     * 采集图像（使用默认参数）
     *
     * @return 拍照响应
     */
    CaptureImageResponse captureImage();

    /**
     * 获取SDK版本
     *
     * @return SDK版本字符串
     */
    String getSdkVersion();
}

