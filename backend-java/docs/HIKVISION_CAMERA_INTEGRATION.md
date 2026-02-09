# 海康威视工业相机SDK集成指南

> **文档版本**: 1.0  
> **创建时间**: 2025-02-02  
> **适用范围**: 白垩纪食品溯源系统 - 后端Java服务  
> **SDK来源**: MVS (Machine Vision Software) Development Samples

---

## 📋 目录

1. [SDK概述](#sdk概述)
2. [示例代码说明](#示例代码说明)
3. [项目集成方案](#项目集成方案)
4. [API参考](#api参考)
5. [使用示例](#使用示例)

---

## 🎯 SDK概述

### 基本信息

- **SDK名称**: MvCameraControlWrapper.jar
- **供应商**: 海康威视 (Hikvision)
- **版本**: V4.3.2+
- **支持设备类型**:
  - GigE Vision (千兆以太网)
  - USB3.0
  - CameraLink
  - CoaXPress (CXP)
  - XoF

### 依赖要求

```xml
<!-- 需要在pom.xml中添加本地JAR依赖 -->
<dependency>
    <groupId>com.hikvision</groupId>
    <artifactId>mv-camera-control</artifactId>
    <version>4.3.2</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/lib/MvCameraControlWrapper.jar</systemPath>
</dependency>
```

### 环境要求

- **JDK版本**: 64位JDK 1.8+ 或 32位JDK 1.8+
- **系统权限**: 需要文件读写权限
- **JAVA_HOME**: 必须正确配置

---

## 📚 示例代码说明

### 1. InterfaceDemo - 接口枚举示例

**功能**: 演示如何枚举和操作相机接口（采集卡）

**关键API**:
- `MV_CC_EnumInterfaces()` - 枚举接口
- `MV_CC_CreateInterface()` - 创建接口句柄
- `MV_CC_OpenInterface()` - 打开接口
- `MV_CC_GetEnumValue()` / `MV_CC_SetEnumValue()` - 枚举参数操作
- `MV_CC_GetIntValue()` / `MV_CC_SetIntValue()` - 整数参数操作
- `MV_CC_GetBoolValue()` / `MV_CC_SetBoolValue()` - 布尔参数操作

**使用场景**: 需要配置采集卡参数时使用

---

### 2. InterfaceAndDeviceDemo - 接口和设备联合操作

**功能**: 演示同时操作接口和相机设备

**使用场景**: 需要在接口级别和设备级别同时配置时

---

### 3. GetImage - 获取单帧图像

**功能**: 演示如何获取单帧图像数据

**关键代码流程**:
```java
// 1. 初始化SDK
MvCameraControl.MV_CC_Initialize();

// 2. 枚举设备
ArrayList<MV_CC_DEVICE_INFO> devices = MvCameraControl.MV_CC_EnumDevices(...);

// 3. 创建设备句柄
Handle hCamera = MvCameraControl.MV_CC_CreateHandle(device);

// 4. 打开设备
MvCameraControl.MV_CC_OpenDevice(hCamera);

// 5. 关闭触发模式（连续采集）
MvCameraControl.MV_CC_SetEnumValueByString(hCamera, "TriggerMode", "Off");

// 6. 开始采集
MvCameraControl.MV_CC_StartGrabbing(hCamera);

// 7. 获取图像缓冲（循环）
MV_FRAME_OUT frameOut = new MV_FRAME_OUT();
MvCameraControl.MV_CC_GetImageBuffer(hCamera, frameOut, 1000);

// 8. 释放图像缓冲
MvCameraControl.MV_CC_FreeImageBuffer(hCamera, frameOut);

// 9. 停止采集
MvCameraControl.MV_CC_StopGrabbing(hCamera);

// 10. 关闭设备
MvCameraControl.MV_CC_CloseDevice(hCamera);

// 11. 销毁句柄
MvCameraControl.MV_CC_DestroyHandle(hCamera);

// 12. 清理SDK
MvCameraControl.MV_CC_Finalize();
```

**使用场景**: 连续采集图像数据（可用于视频流预览）

---

### 4. Grab_Callback - 回调方式采集图像

**功能**: 使用回调函数方式采集图像（推荐用于实时处理）

**关键API**:
```java
// 注册图像回调
MvCameraControl.MV_CC_RegisterImageCallBack(hCamera, new CameraImageCallBack() {
    @Override
    public int OnImageCallBack(byte[] bytes, MV_FRAME_OUT_INFO frameInfo) {
        // 处理图像数据
        processImage(bytes, frameInfo);
        return 0;
    }
});
```

**优势**: 
- 异步处理，性能更好
- 适合实时图像处理场景
- 减少数据拷贝

**使用场景**: 实时质检图像采集、自动识别场景

---

### 5. ImageSave - 保存图像到文件

**功能**: 演示如何将采集的图像保存为各种格式

**支持格式**:
- RAW (原始格式)
- JPEG (压缩图片)
- BMP (位图)
- TIFF (标签图像文件格式)
- PNG (便携式网络图形)

**关键API**:
```java
// 获取单帧图像（带超时）
MV_FRAME_OUT_INFO imageInfo = new MV_FRAME_OUT_INFO();
byte[] imageData = new byte[payloadSize];
int nRet = MvCameraControl.MV_CC_GetOneFrameTimeout(
    hCamera, imageData, imageInfo, 1000);

// 保存为JPEG
MV_SAVE_IMAGE_TO_FILE_PARAM_EX saveParam = new MV_SAVE_IMAGE_TO_FILE_PARAM_EX();
saveParam.imageType = MV_SAVE_IAMGE_TYPE.MV_Image_Jpeg;
saveParam.pixelType = imageInfo.pixelType;
saveParam.width = imageInfo.ExtendWidth;
saveParam.height = imageInfo.ExtendHeight;
saveParam.dataLen = imageInfo.frameLen;
saveParam.data = imageData;
saveParam.jpgQuality = 99; // 质量 50-99
saveParam.imagePath = "output.jpg";

MvCameraControl.MV_CC_SaveImageToFileEx(hCamera, saveParam);
```

**使用场景**: 质检照片保存、存档记录

---

### 6. ConvertPixelType - 像素格式转换

**功能**: 演示如何转换图像像素格式

**使用场景**: 需要特定像素格式进行图像处理时

---

### 7. ParametrizeCamera_LoadAndSave - 参数保存和加载

**功能**: 保存和加载相机参数配置

**使用场景**: 相机参数预设、批量配置

---

### 8. ParametrizeCamera_LineScanIOSettings - 线阵相机IO设置

**功能**: 配置线阵相机的IO参数

**使用场景**: 线阵相机专用配置

---

### 9. Events_Interface - 接口事件处理

**功能**: 处理接口级别的事件

**使用场景**: 接口连接状态监控

---

### 10. Events_Camera - 相机事件处理

**功能**: 处理相机设备级别的事件

**使用场景**: 相机状态监控、异常检测

---

## 🔧 项目集成方案

### 方案1: 质检照片采集服务（推荐）

**场景**: 在质检流程中自动采集产品照片

#### 架构设计

```
质检请求 → CameraService → 海康相机SDK → 图像数据 → 保存到本地/上传到OSS → 返回图片URL
```

#### 实现步骤

1. **添加Maven依赖** (pom.xml)

```xml
<dependency>
    <groupId>com.hikvision</groupId>
    <artifactId>mv-camera-control</artifactId>
    <version>4.3.2</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/lib/MvCameraControlWrapper.jar</systemPath>
</dependency>
```

2. **创建相机服务类**

```java
@Service
@Slf4j
public class CameraService {
    
    private Handle hCamera = null;
    private boolean isInitialized = false;
    
    /**
     * 初始化SDK（应用启动时调用一次）
     */
    @PostConstruct
    public void initialize() {
        try {
            int nRet = MvCameraControl.MV_CC_Initialize();
            if (nRet == MV_OK) {
                isInitialized = true;
                log.info("海康相机SDK初始化成功");
            } else {
                log.error("海康相机SDK初始化失败: 0x{}", Integer.toHexString(nRet));
            }
        } catch (Exception e) {
            log.error("初始化相机SDK异常", e);
        }
    }
    
    /**
     * 枚举可用相机设备
     */
    public List<CameraDeviceInfo> enumerateDevices() {
        if (!isInitialized) {
            throw new IllegalStateException("相机SDK未初始化");
        }
        
        try {
            ArrayList<MV_CC_DEVICE_INFO> devices = MvCameraControl.MV_CC_EnumDevices(
                MV_GIGE_DEVICE | MV_USB_DEVICE
            );
            
            return devices.stream()
                .map(this::convertDeviceInfo)
                .collect(Collectors.toList());
        } catch (CameraControlException e) {
            log.error("枚举相机设备失败", e);
            throw new CameraException("枚举设备失败", e);
        }
    }
    
    /**
     * 连接到指定相机
     */
    public void connectCamera(int deviceIndex) {
        // 实现连接逻辑
    }
    
    /**
     * 采集单张照片
     */
    public byte[] captureImage() {
        // 实现采集逻辑
    }
    
    /**
     * 保存照片到文件
     */
    public String saveImageToFile(byte[] imageData, MV_FRAME_OUT_INFO imageInfo, String format) {
        // 实现保存逻辑
    }
    
    /**
     * 断开相机连接
     */
    public void disconnectCamera() {
        // 实现断开逻辑
    }
    
    /**
     * 清理资源（应用关闭时调用）
     */
    @PreDestroy
    public void cleanup() {
        if (hCamera != null) {
            MvCameraControl.MV_CC_DestroyHandle(hCamera);
            hCamera = null;
        }
        if (isInitialized) {
            MvCameraControl.MV_CC_Finalize();
            isInitialized = false;
        }
    }
}
```

3. **创建相机控制器**

```java
@RestController
@RequestMapping("/api/camera")
@PreAuthorize("hasRole('QUALITY_INSPECTOR')")
public class CameraController {
    
    @Autowired
    private CameraService cameraService;
    
    /**
     * 获取可用相机列表
     */
    @GetMapping("/devices")
    public ResponseEntity<List<CameraDeviceInfo>> listDevices() {
        return ResponseEntity.ok(cameraService.enumerateDevices());
    }
    
    /**
     * 连接相机
     */
    @PostMapping("/connect")
    public ResponseEntity<Void> connectCamera(@RequestParam int deviceIndex) {
        cameraService.connectCamera(deviceIndex);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 采集照片（用于质检）
     */
    @PostMapping("/capture")
    public ResponseEntity<Map<String, String>> captureImage(
            @RequestParam(required = false) String format) {
        
        byte[] imageData = cameraService.captureImage();
        String imageUrl = cameraService.saveImageToFile(
            imageData, null, format != null ? format : "JPEG"
        );
        
        Map<String, String> response = new HashMap<>();
        response.put("imageUrl", imageUrl);
        response.put("format", format != null ? format : "JPEG");
        
        return ResponseEntity.ok(response);
    }
}
```

4. **集成到质检流程**

修改质检相关的Service，在创建质检记录时自动采集照片：

```java
@Service
public class QualityInspectionService {
    
    @Autowired
    private CameraService cameraService;
    
    public QualityInspection createInspection(CreateInspectionRequest request) {
        // ... 创建质检记录逻辑 ...
        
        // 如果启用自动拍照
        if (request.isAutoCapturePhoto()) {
            try {
                byte[] photoData = cameraService.captureImage();
                String photoUrl = savePhoto(photoData);
                inspection.setPhotoUrl(photoUrl);
            } catch (Exception e) {
                log.warn("自动拍照失败，继续创建质检记录", e);
            }
        }
        
        return inspectionRepository.save(inspection);
    }
}
```

### 方案2: 实时监控服务

**场景**: 生产线实时监控，持续采集图像

**实现要点**:
- 使用回调方式采集（Grab_Callback示例）
- 图像数据推送到消息队列（Redis Stream / RabbitMQ）
- WebSocket实时推送图像给前端
- 支持多客户端订阅

---

## 📖 API参考

### 核心API列表

| API函数 | 功能说明 | 返回值 |
|---------|---------|--------|
| `MV_CC_Initialize()` | 初始化SDK | MV_OK=成功 |
| `MV_CC_Finalize()` | 清理SDK资源 | MV_OK=成功 |
| `MV_CC_GetSDKVersion()` | 获取SDK版本 | 版本字符串 |
| `MV_CC_EnumDevices()` | 枚举相机设备 | 设备列表 |
| `MV_CC_CreateHandle()` | 创建设备句柄 | Handle对象 |
| `MV_CC_DestroyHandle()` | 销毁设备句柄 | MV_OK=成功 |
| `MV_CC_OpenDevice()` | 打开设备 | MV_OK=成功 |
| `MV_CC_CloseDevice()` | 关闭设备 | MV_OK=成功 |
| `MV_CC_StartGrabbing()` | 开始采集 | MV_OK=成功 |
| `MV_CC_StopGrabbing()` | 停止采集 | MV_OK=成功 |
| `MV_CC_GetImageBuffer()` | 获取图像缓冲（轮询） | MV_OK=成功 |
| `MV_CC_GetOneFrameTimeout()` | 获取单帧图像（带超时） | MV_OK=成功 |
| `MV_CC_RegisterImageCallBack()` | 注册图像回调 | MV_OK=成功 |
| `MV_CC_SaveImageToFileEx()` | 保存图像到文件 | MV_OK=成功 |
| `MV_CC_SetEnumValueByString()` | 设置枚举参数 | MV_OK=成功 |
| `MV_CC_GetIntValue()` | 获取整数参数 | MV_OK=成功 |
| `MV_CC_SetIntValue()` | 设置整数参数 | MV_OK=成功 |

### 错误码说明

所有API返回 `MV_OK` (0x00000000) 表示成功，其他值为错误码。

常见错误码：
- `MV_E_HANDLE` (0x80000001): 无效句柄
- `MV_E_SUPPORT` (0x80000002): 不支持的功能
- `MV_E_BUFOVER` (0x80000003): 缓存溢出
- `MV_E_CALLORDER` (0x80000004): 调用顺序错误
- `MV_E_PARAMETER` (0x80000005): 参数错误
- `MV_E_RESOURCE` (0x80000006): 资源不足
- `MV_E_NODATA` (0x80000007): 无数据

---

## 💡 使用示例

### 示例1: 简单拍照服务

```java
@Service
public class SimpleCameraService {
    
    private Handle hCamera;
    
    public byte[] takePhoto() throws CameraException {
        try {
            // 1. 枚举设备（简化版，假设使用第一个设备）
            ArrayList<MV_CC_DEVICE_INFO> devices = 
                MvCameraControl.MV_CC_EnumDevices(MV_GIGE_DEVICE | MV_USB_DEVICE);
            if (devices.isEmpty()) {
                throw new CameraException("未找到相机设备");
            }
            
            // 2. 创建并打开设备
            hCamera = MvCameraControl.MV_CC_CreateHandle(devices.get(0));
            int ret = MvCameraControl.MV_CC_OpenDevice(hCamera);
            if (ret != MV_OK) {
                throw new CameraException("打开设备失败: 0x" + Integer.toHexString(ret));
            }
            
            // 3. 关闭触发模式
            MvCameraControl.MV_CC_SetEnumValueByString(hCamera, "TriggerMode", "Off");
            
            // 4. 开始采集
            MvCameraControl.MV_CC_StartGrabbing(hCamera);
            
            // 5. 获取单帧
            MVCC_INTVALUE payloadSize = new MVCC_INTVALUE();
            MvCameraControl.MV_CC_GetIntValue(hCamera, "PayloadSize", payloadSize);
            
            MV_FRAME_OUT_INFO imageInfo = new MV_FRAME_OUT_INFO();
            byte[] imageData = new byte[(int)payloadSize.curValue];
            ret = MvCameraControl.MV_CC_GetOneFrameTimeout(hCamera, imageData, imageInfo, 5000);
            if (ret != MV_OK) {
                throw new CameraException("获取图像失败: 0x" + Integer.toHexString(ret));
            }
            
            // 6. 停止采集并关闭
            MvCameraControl.MV_CC_StopGrabbing(hCamera);
            MvCameraControl.MV_CC_CloseDevice(hCamera);
            MvCameraControl.MV_CC_DestroyHandle(hCamera);
            hCamera = null;
            
            // 返回实际图像数据长度
            byte[] actualData = Arrays.copyOf(imageData, (int)imageInfo.frameLen);
            return actualData;
            
        } catch (Exception e) {
            cleanup();
            throw new CameraException("拍照失败", e);
        }
    }
    
    private void cleanup() {
        if (hCamera != null) {
            try {
                MvCameraControl.MV_CC_StopGrabbing(hCamera);
                MvCameraControl.MV_CC_CloseDevice(hCamera);
                MvCameraControl.MV_CC_DestroyHandle(hCamera);
            } catch (Exception e) {
                // 忽略清理错误
            }
            hCamera = null;
        }
    }
}
```

### 示例2: 保存为JPEG格式

```java
public String saveAsJpeg(byte[] rawImageData, MV_FRAME_OUT_INFO imageInfo, String outputPath) {
    MV_SAVE_IMAGE_TO_FILE_PARAM_EX saveParam = new MV_SAVE_IMAGE_TO_FILE_PARAM_EX();
    saveParam.imageType = MV_SAVE_IAMGE_TYPE.MV_Image_Jpeg;
    saveParam.pixelType = imageInfo.pixelType;
    saveParam.width = imageInfo.ExtendWidth;
    saveParam.height = imageInfo.ExtendHeight;
    saveParam.dataLen = imageInfo.frameLen;
    saveParam.data = rawImageData;
    saveParam.jpgQuality = 90; // JPEG质量 50-99
    saveParam.imagePath = outputPath;
    saveParam.methodValue = 1;
    
    int ret = MvCameraControl.MV_CC_SaveImageToFileEx(hCamera, saveParam);
    if (ret == MV_OK) {
        return outputPath;
    } else {
        throw new CameraException("保存图像失败: 0x" + Integer.toHexString(ret));
    }
}
```

---

## ⚠️ 注意事项

1. **SDK初始化**: 整个应用生命周期只需初始化一次，在应用启动时初始化，关闭时清理
2. **设备连接**: 同一时间一个相机只能被一个进程/线程使用
3. **资源管理**: 确保在使用完毕后正确释放设备句柄和SDK资源
4. **异常处理**: 所有SDK调用都应进行异常处理，避免资源泄漏
5. **线程安全**: SDK操作不是线程安全的，需要加锁保护
6. **像素格式**: 不同相机支持的像素格式不同，需要根据实际情况处理
7. **HB格式**: 如果相机使用HB压缩格式，需要先解码再保存

---

## 🔗 相关资源

- **示例代码位置**: `C:\Program Files (x86)\MVS\Development\Samples\Java`
- **SDK JAR文件**: `backend-java/lib/MvCameraControlWrapper.jar`
- **SDK文档**: 参考MVS安装目录下的文档

---

## 📝 后续计划

- [ ] 实现CameraService完整功能
- [ ] 集成到质检流程
- [ ] 添加相机配置管理
- [ ] 实现图像压缩和上传到OSS
- [ ] 添加相机状态监控
- [ ] 支持多相机管理

---

**文档维护**: 根据实际集成情况更新此文档

