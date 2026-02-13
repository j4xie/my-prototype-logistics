# NFC 签到功能安装指南

## 1. 安装 react-native-nfc-manager

```bash
cd frontend/CretasFoodTrace
npm install react-native-nfc-manager
```

安装完成后需要重新构建原生应用 (不支持热更新)。

## 2. Android 配置

### AndroidManifest.xml

以下配置已自动添加到 `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.NFC"/>
<uses-feature android:name="android.hardware.nfc" android:required="false"/>
```

`android:required="false"` 确保没有 NFC 的设备仍然可以安装应用 (降级到 QR 扫码)。

### 验证构建

```bash
# 清理并重新构建
cd frontend/CretasFoodTrace/android
./gradlew clean
cd ..
npx expo run:android
```

## 3. iOS 配置

### Info.plist

在 `ios/CretasFoodTrace/Info.plist` 中添加:

```xml
<key>NFCReaderUsageDescription</key>
<string>需要 NFC 功能来读取员工签到卡</string>
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
  <string>D276000085010100</string>
</array>
```

### Entitlements

在 Xcode 中启用 Near Field Communication Tag Reading capability:
1. 打开 Xcode -> Signing & Capabilities
2. 点击 "+ Capability"
3. 搜索并添加 "Near Field Communication Tag Reading"

### 注意
- iOS 要求 iPhone 7 或更新机型
- iOS 13+ 支持后台 NFC 标签读取
- iOS NFC 仅支持 NDEF 格式标签

## 4. NFC 标签规格

### 推荐标签型号

| 型号 | 存储 | 读写距离 | 适用场景 | 参考价格 |
|------|------|----------|----------|----------|
| **NTAG213** | 144 bytes | 1-5cm | 员工卡 (推荐) | 0.5-1 元/张 |
| NTAG215 | 504 bytes | 1-5cm | 需要更多数据时 | 1-2 元/张 |
| NTAG216 | 888 bytes | 1-5cm | 大量数据存储 | 2-3 元/张 |

**推荐**: NTAG213 足够存储员工签到数据，性价比最高。

### 采购建议

- 搜索关键词: "NTAG213 NFC 白卡" 或 "NTAG213 NFC 贴纸"
- 卡片形式: PVC 白卡 (类似门禁卡) 或 圆形贴纸 (可贴在工牌上)
- 批量采购 100+ 张价格更优
- 确认芯片型号为 NXP NTAG213 (兼容性最好)

## 5. 标签数据格式

### NDEF Text Record 格式

```
CRETAS:EMP:{employeeId}:{factoryId}
```

示例:
```
CRETAS:EMP:42:F001     -- 员工ID=42, 工厂=F001
CRETAS:EMP:108:F002    -- 员工ID=108, 工厂=F002
```

### 写入流程

1. 工厂管理员进入 **管理中心 -> NFC 标签管理**
2. 点击 **写入新标签**
3. 输入员工编号
4. 将空白 NFC 标签贴近手机背部
5. 等待写入完成
6. 验证: 再次扫描标签确认数据正确

### 数据校验规则

- `CRETAS:EMP:` 前缀必须完全匹配
- `employeeId` 必须是正整数
- `factoryId` 必须与当前登录工厂匹配
- 不匹配的标签会被拒绝签到

## 6. 使用流程

### 员工签到

1. 车间主管打开 **签到管理** 页面
2. 选择当前批次
3. 顶部切换到 **NFC 签到** 标签
4. 点击 **NFC 签到** 按钮
5. 员工将 NFC 卡贴近手机背部
6. 系统自动读取并完成签到

### QR 扫码降级

如果 NFC 不可用 (设备不支持 / 模块未安装 / NFC 关闭):
- NFC 标签页显示 "不可用" 标记
- 自动切换到 QR 扫码标签
- NFC 弹窗底部有 "改用 QR 扫码" 按钮

## 7. 测试步骤

### 无 NFC 硬件测试

即使没有 NFC 标签，也可以测试:

1. **不安装 react-native-nfc-manager**: 应用正常启动，NFC 标签显示"不可用"，QR 扫码正常工作
2. **安装模块但设备无 NFC**: NFC 标签显示"不可用"，提示"当前设备不支持 NFC 功能"
3. **NFC 已关闭**: 提示"请在系统设置中启用 NFC"

### 有 NFC 硬件测试

1. 准备一张 NTAG213 空白卡
2. 进入 **管理中心 -> NFC 标签管理**
3. 写入测试员工 (如: 员工编号 1, 工厂 F001)
4. 进入 **签到管理** -> 选择批次 -> NFC 签到
5. 扫描刚写入的标签
6. 验证签到记录中显示 "NFC" 方法标记

### Android 模拟器

Android 模拟器不支持 NFC 硬件。测试 NFC 功能需要使用真实设备。
可以使用 Android Studio 的 NFC Tag 模拟 (Tools -> NFC Tag Emulation) 进行有限测试。

## 8. 常见问题

### Q: 安装 react-native-nfc-manager 后构建失败

确保 Android SDK 版本 >= 19 (Android 4.4):
```gradle
// android/build.gradle
minSdkVersion = 21  // 已满足
```

### Q: NFC 标签读取不到

- 确认标签是 NDEF 格式 (NTAG213/215/216)
- 确认标签已写入数据 (不是空白标签)
- 手机 NFC 感应区通常在背部上半部分
- 金属手机壳可能影响 NFC 信号

### Q: 跨工厂标签被拒绝

这是预期行为。NFC 标签中的 factoryId 必须与当前登录用户的工厂匹配，防止员工跨厂签到。

### Q: 不安装 NFC 模块会影响其他功能吗?

不会。所有 NFC 代码使用条件导入 (`try-catch require`)，如果模块不存在，自动降级到 QR 扫码模式，不会导致应用崩溃。
