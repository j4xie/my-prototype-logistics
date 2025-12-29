# 海康威视相机SDK启用指南

## 📋 概述

本文档说明如何启用海康威视工业相机SDK的实际功能。当前实现中，SDK调用代码已被注释，需要根据实际环境配置启用。

## 🔧 启用步骤

### 1. 确保SDK JAR文件存在

确保 `backend-java/lib/MvCameraControlWrapper.jar` 文件存在。

### 2. 添加SDK类导入

在 `CameraServiceImpl.java` 文件中，取消注释SDK类的导入：

```java
// 取消注释以下导入
import MvCameraControlWrapper.*;
import static MvCameraControlWrapper.MvCameraControlDefines.*;
```

### 3. 取消注释SDK调用代码

在 `CameraServiceImpl.java` 中，找到所有被注释的SDK调用代码并取消注释：

#### 初始化方法（initialize）
- 取消注释 `MvCameraControl.MV_CC_Initialize()` 调用
- 取消注释 `MvCameraControl.MV_CC_GetSDKVersion()` 调用

#### 枚举设备方法（enumerateDevices）
- 取消注释 `MvCameraControl.MV_CC_EnumDevices()` 调用
- 取消注释设备信息转换逻辑

#### 连接相机方法（connectCamera）
- 取消注释 `MvCameraControl.MV_CC_CreateHandle()` 调用
- 取消注释 `MvCameraControl.MV_CC_OpenDevice()` 调用
- 取消注释 `MvCameraControl.MV_CC_SetEnumValueByString()` 调用

#### 断开连接方法（disconnectCamera）
- 取消注释 `MvCameraControl.MV_CC_StopGrabbing()` 调用
- 取消注释 `MvCameraControl.MV_CC_CloseDevice()` 调用
- 取消注释 `MvCameraControl.MV_CC_DestroyHandle()` 调用

#### 采集图像方法（captureImage）
- 取消注释 `MvCameraControl.MV_CC_StartGrabbing()` 调用
- 取消注释 `MvCameraControl.MV_CC_GetIntValue()` 调用
- 取消注释 `MvCameraControl.MV_CC_GetOneFrameTimeout()` 调用
- 取消注释 `saveImage()` 方法调用

#### 保存图像方法（saveImage）
- 取消注释 `MvCameraControl.MV_CC_SaveImageToFileEx()` 调用
- 实现图像保存逻辑

### 4. 启用常量定义

取消注释类中的常量定义：

```java
private static final int MV_OK = 0x00000000;
private static final int MV_GIGE_DEVICE = 0x00000001;
private static final int MV_USB_DEVICE = 0x00000002;
```

### 5. 实现辅助方法

确保以下方法已实现：
- `convertDeviceInfo()` - 转换设备信息
- `saveImage()` - 保存图像到文件
- `getSaveImageType()` - 获取保存图像类型（如果需要）

### 6. 配置应用属性

在 `application.properties` 中配置相机参数：

```properties
# 相机配置（海康威视工业相机）
camera.save.path=./camera-images
camera.save.format=JPEG
camera.jpeg.quality=90
camera.timeout=5000
```

### 7. 测试SDK功能

#### 测试初始化
```bash
curl -X GET http://localhost:10010/api/camera/version
```

#### 测试枚举设备
```bash
curl -X GET http://localhost:10010/api/camera/devices
```

#### 测试连接相机
```bash
curl -X POST "http://localhost:10010/api/camera/connect?deviceIndex=0"
```

#### 测试拍照
```bash
curl -X POST http://localhost:10010/api/camera/capture/quick \
  -H "Content-Type: application/json"
```

## ⚠️ 注意事项

1. **编译问题**：如果使用 `system` scope 的依赖，在IDE中可能无法直接引用SDK类。需要在IDE的Project Structure中手动添加JAR到classpath。

2. **运行时错误**：如果运行时出现 `ClassNotFoundException`，检查：
   - JAR文件路径是否正确
   - Maven构建时是否正确包含JAR文件
   - 运行时classpath是否包含JAR文件

3. **权限问题**：确保应用有权限：
   - 访问相机设备（可能需要管理员权限）
   - 写入图像保存目录
   - 访问系统资源

4. **线程安全**：当前实现使用 `ReentrantLock` 保证线程安全，但SDK本身可能不是线程安全的，建议：
   - 避免多线程同时操作相机
   - 使用连接池管理多个相机（如果需要）

5. **资源清理**：确保在应用关闭时正确清理资源：
   - 断开所有相机连接
   - 调用SDK的 `MV_CC_Finalize()` 方法

## 🔍 故障排查

### 问题：SDK初始化失败
- 检查SDK JAR文件是否存在
- 检查系统是否安装了相机驱动
- 检查是否有其他进程占用相机

### 问题：枚举设备返回空列表
- 检查相机是否已连接
- 检查相机驱动是否正常
- 检查网络连接（GigE相机）

### 问题：连接相机失败
- 检查设备索引是否正确
- 检查相机是否被其他程序占用
- 检查相机权限

### 问题：采集图像失败
- 检查相机是否已连接
- 检查触发模式设置
- 检查超时时间设置

## 📚 参考文档

- [海康威视相机SDK集成指南](./HIKVISION_CAMERA_INTEGRATION.md)
- SDK官方文档（位于MVS安装目录）

## 📝 下一步

启用SDK后，可以：
1. 集成到质检流程，实现自动拍照
2. 实现图像上传到OSS/云存储
3. 实现图像预处理和识别功能
4. 支持多相机管理

