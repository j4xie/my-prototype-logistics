package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.repository.isapi.IsapiDeviceChannelRepository;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

/**
 * V3 P0-1 camera 漏洞修复回归测试 (remaining HIGH from audit 2026-04-07).
 *
 * <p>{@link IsapiDeviceService#getDevice(String)} 老 API 无 factoryId 校验,
 * 导致 6 个 camera tool (Subscribe/Detail/Sync/Streams/TestConnection/Unsubscribe)
 * 可跨工厂读取/操作设备. 本测试覆盖新 overload {@code getDevice(factoryId, deviceId)}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("IsapiDeviceService 跨工厂隔离 (P0-1 camera fix)")
class IsapiDeviceServiceFactoryIsolationTest {

    private static final String FACTORY_A = "F001";
    private static final String FACTORY_B = "F002";
    private static final String DEVICE_ID = "dev-1";

    @Mock
    private IsapiDeviceRepository deviceRepository;
    @Mock
    private IsapiDeviceChannelRepository channelRepository;
    @Mock
    private IsapiClient isapiClient;

    @InjectMocks
    private IsapiDeviceService service;

    private IsapiDevice deviceOfFactoryA() {
        IsapiDevice d = new IsapiDevice();
        d.setId(DEVICE_ID);
        d.setFactoryId(FACTORY_A);
        d.setDeviceName("前门摄像头");
        return d;
    }

    @Test
    @DisplayName("同工厂查询应返回设备")
    void getDevice_sameFactory_returns() {
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(deviceOfFactoryA()));
        IsapiDevice result = service.getDevice(FACTORY_A, DEVICE_ID);
        assertEquals(DEVICE_ID, result.getId());
        assertEquals(FACTORY_A, result.getFactoryId());
    }

    @Test
    @DisplayName("跨工厂查询应抛 IllegalArgumentException")
    void getDevice_crossFactory_throws() {
        when(deviceRepository.findById(DEVICE_ID)).thenReturn(Optional.of(deviceOfFactoryA()));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.getDevice(FACTORY_B, DEVICE_ID));
        // 不应泄露设备真实信息 (e.g. 设备名称)
        assertEquals(true, ex.getMessage() != null && !ex.getMessage().contains("前门摄像头"),
                "跨工厂错误消息不应泄露设备名称");
    }

    @Test
    @DisplayName("设备不存在应抛 IllegalArgumentException")
    void getDevice_notFound_throws() {
        when(deviceRepository.findById("missing")).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.getDevice(FACTORY_A, "missing"));
    }
}
