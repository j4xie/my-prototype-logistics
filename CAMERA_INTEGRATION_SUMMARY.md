# 海康威视工业相机SDK集成

## 概述

本次提交完成了海康威视工业相机SDK的基础集成，为质检流程提供自动拍照功能支持。

## 主要变更

### 新增功能
- ✅ 相机设备枚举、连接、断开功能
- ✅ 图像采集和保存功能
- ✅ 7个RESTful API接口
- ✅ 支持多种图像格式（JPEG、BMP、PNG、TIFF、RAW）
- ✅ 线程安全的相机操作实现

### 新增文件
```
backend-java/
├── src/main/java/com/cretas/aims/
│   ├── controller/CameraController.java
│   ├── service/CameraService.java
│   ├── service/impl/CameraServiceImpl.java
│   ├── dto/camera/
│   │   ├── CameraDeviceInfo.java
│   │   ├── CaptureImageRequest.java
│   │   └── CaptureImageResponse.java
│   └── exception/CameraException.java
└── docs/
    ├── HIKVISION_CAMERA_INTEGRATION.md
    ├── CAMERA_SDK_SETUP.md
    └── CAMERA_INTEGRATION_COMMIT_REPORT.md
```

### 修改文件
- `pom.xml` - 添加相机SDK依赖
- `application.properties` - 添加相机配置项

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/camera/version` | 获取SDK版本 |
| GET | `/api/camera/devices` | 枚举相机设备 |
| POST | `/api/camera/connect` | 连接相机 |
| POST | `/api/camera/disconnect` | 断开连接 |
| GET | `/api/camera/status` | 检查连接状态 |
| POST | `/api/camera/capture` | 采集图像 |
| POST | `/api/camera/capture/quick` | 快速拍照 |

## 重要说明

⚠️ **SDK状态**: 代码已准备完成，但SDK调用代码处于注释状态，需要根据实际环境启用。详见 `docs/CAMERA_SDK_SETUP.md`

## 依赖要求

- `lib/MvCameraControlWrapper.jar` (必需)
- JDK 1.8+
- 相机驱动已安装

## 配置示例

```properties
# application.properties
camera.save.path=./camera-images
camera.save.format=JPEG
camera.jpeg.quality=90
camera.timeout=5000
```

## 文档

- [完整集成指南](backend-java/docs/HIKVISION_CAMERA_INTEGRATION.md)
- [SDK启用步骤](backend-java/docs/CAMERA_SDK_SETUP.md)
- [详细变更报告](backend-java/docs/CAMERA_INTEGRATION_COMMIT_REPORT.md)

## 测试建议

- [ ] SDK初始化测试
- [ ] 设备枚举测试
- [ ] 相机连接/断开测试
- [ ] 图像采集测试
- [ ] API端点测试

## 后续计划

- 启用SDK并完成测试
- 集成到质检流程
- 实现图像上传到OSS
- 添加单元测试和集成测试

