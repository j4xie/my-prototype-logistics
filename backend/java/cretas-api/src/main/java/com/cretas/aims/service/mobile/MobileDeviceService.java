package com.cretas.aims.service.mobile;

import com.cretas.aims.dto.MobileDTO;

import java.util.List;

/**
 * 移动端设备管理服务接口
 * <p>
 * 负责设备激活、登录记录、设备列表、推送通知注册。
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface MobileDeviceService {

    MobileDTO.ActivationResponse activateDevice(MobileDTO.ActivationRequest request);

    void recordDeviceLogin(Long userId, MobileDTO.DeviceInfo deviceInfo);

    List<MobileDTO.DeviceInfo> getUserDevices(Long userId);

    void removeDevice(Long userId, String deviceId);

    void registerPushNotification(Long userId, MobileDTO.PushRegistration registration);

    void unregisterPushNotification(Long userId, String deviceToken);
}
