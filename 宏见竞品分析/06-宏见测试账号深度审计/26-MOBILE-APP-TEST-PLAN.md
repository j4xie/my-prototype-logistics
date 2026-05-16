# 26 — Steve 实测指南: 宏见 APP 安装 + 测试 checklist

> Round 9 输出. 我 (Claude) 远程指导, Steve 现场实测. 完成后把截图 + 观察发给我整合 audit.
>
> **预期总耗时**: 1-1.5 小时 (含安装 + 测试 + 截图)

---

## 1. 全套下载 URL 表 (实测官网确认)

| 平台 | 下载链接 | 来源 |
|---|---|---|
| **Android 手机** | `https://app.hongjian.com/app/hongjian.apk` | ⭐ 官网软件下载页 |
| **Android TV 大屏** | `https://tv.hongjian.com/app/HoanTV.apk` | ⭐ tv.hongjian.com 内 link |
| **iOS 手机/iPad** | 苹果 App Store 搜 "宏见ERP" | 官网指引 |
| **Windows 桌面助手 (新版)** | `https://www.hongjian.com/product/network/HongjianToolV1.0.exe` | 官网 |
| **Windows 桌面助手 (旧版)** | `https://www.hongjian.com/product/network/HKBToolSetupV2.0.exe` | 官网 |

⚠️ **Windows 桌面助手** = 网盘/打印/扫码硬件桥接 (本地 WebSocket 38580/38581 — Round 1 audit 提到的 desktop assistant).

---

## 2. 测试账号 (复用前 audit 的)

- **公司编号**: `lyh01`
- **账号**: `admin`
- **密码**: `Aa123456`
- ⚠️ **跟 Steve 网页 audit 共用账号** — 同一时间只能登 1 端 (避免 session 冲突)

---

## 3. Steve 安装顺序 (推荐 — 从最高 ROI 开始)

### 3.1 优先 — Android 手机 (~5 min) ⭐⭐⭐
**ROI 最高 — 客户实际场景**

1. 用 Android 手机 (任何 Android 7+ 都行) 打开浏览器
2. 访问: `https://app.hongjian.com/app/hongjian.apk`
3. 下载 APK (~30-100 MB 推测)
4. 安装 (系统会提示"安装未知来源", 同意)
5. 打开"宏见ERP" app, 用上面账号登录

**截图请求 (~10 张)**:
- screen-mobile-01-app-icon.png — App 主屏 icon 显示
- screen-mobile-02-login.png — 登录页
- screen-mobile-03-home.png — 登录后首页 (类比 PC dashboard)
- screen-mobile-04-modules.png — 看是否有 12 模块菜单 / 角色简化 / BottomTab
- screen-mobile-05-sales-list.png — 销售订单列表 (跟 PC 对比 — 数据 + 字段精简程度)
- screen-mobile-06-sales-create.png — 销售单创建表单 (字段数比 PC 33 字段少多少?)
- screen-mobile-07-scan.png — 找扫码功能入口 (推测仓管员扫码入库)
- screen-mobile-08-camera.png — 拍照附件上传
- screen-mobile-09-push.png — 通知/消息中心
- screen-mobile-10-settings.png — 设置页 (含偏好/账号切换/退出)

### 3.2 次优先 — Android TV (~10 min) ⭐⭐
**罕见但战略级 — Cretas 是否要做 TV 看板的依据**

需要 Android TV / Fire TV / 投屏盒子 (e.g. Xiaomi/Tencent TV box). 不是手机, 是**电视**或电视盒子.

1. 在 Android TV 浏览器或 ADB 安装 APK: `https://tv.hongjian.com/app/HoanTV.apk`
2. 打开"HoanTV" app
3. 登录 (推测要扫码或输入公司码 + admin 账号)

**截图请求 (~5 张)**:
- screen-tv-01-home.png — TV 大屏首页 (可能是工厂看板 / 销售大屏)
- screen-tv-02-dashboard.png — 数据可视化大屏 (实时生产 / 销售 / 库存)
- screen-tv-03-realtime.png — 是否有实时刷新 + 报警
- screen-tv-04-config.png — 看板内容配置入口
- screen-tv-05-fallback.png — 没数据时如何显示

> ⚠️ 如果 Steve 没有 Android TV/盒子, **跳过此项**. 用 Android 手机模拟器或 BlueStacks 装 APK 看也 OK (横屏 view).

### 3.3 选做 — iOS 手机 (~5 min)
**ROI 中 — Android 已能反推 iOS 大概体验**

如果 Steve 有 iPhone:
1. App Store 搜 "宏见ERP"
2. 下载安装
3. 登录 (账号同上)

**截图请求 (~5 张)**:
- screen-ios-01-store.png — App Store 搜索结果 (含版本号 + 评分 + 下载量)
- screen-ios-02-login.png
- screen-ios-03-home.png
- screen-ios-04-compare-android.png — 跟 Android 版差异截图
- screen-ios-05-ios-specific.png — iOS 专有 (e.g. Face ID 登录)

### 3.4 不建议 — Windows 桌面助手
**Cretas 完全不需要** (扫码/打印硬件桥接).
- 安装会创建本地 WebSocket 38580/38581 服务 (跟浏览器 ERP 通信)
- 仅 Windows 限定
- Cretas RN 用原生 API 替代, 无需助手
- 跳过

---

## 4. 关键观察清单 (Steve 测试时注意)

### 4.1 UX 维度
- [ ] 是 H5 webview 还是真原生 (RN/Flutter/Native)?
  - **判别**: 滑动是否丝滑? 是否能离线打开过的页? 是否有原生导航返回手势?
- [ ] 菜单结构跟 PC 一致还是精简版?
- [ ] 字号是否舒服 (vs 之前发现 PC 端 375 viewport 必须双指放大)
- [ ] 是否有移动专属功能 (扫码/拍照/语音/定位)

### 4.2 功能维度
- [ ] 是否能创建销售单 (跟 PC 33 字段对比, 移动版简化多少?)
- [ ] 是否能扫码入库 (vs PC 必须 desktop 助手 + USB 扫码枪)
- [ ] 是否能拍照附件 (业务证据照片)
- [ ] 是否能审批 (待办审批 PC 16 条, 移动是否同步?)
- [ ] 是否有推送通知 (微信推送 / 应用内消息)

### 4.3 性能维度
- [ ] App 启动时长 (cold start vs warm start)
- [ ] 列表滚动是否卡 (60FPS?)
- [ ] 加载圈出现频率 (vs Cretas SPA 0.1s 响应)

### 4.4 跟 PC 对比观察
| 维度 | PC (我已实测) | Mobile (Steve 实测) |
|---|---|---|
| 12 模块 | 横向永久菜单 | ? 是否 BottomTab? |
| 销售单字段 | 33 字段 | ? 精简到几? |
| 查询字段 | 37 字段 | ? 简化 toggle? |
| 操作下拉 | 11 项 | ? Long press / BottomSheet? |
| dashboard | 12 stats + 4×4 + 4×2 | ? 单列 vs 网格? |
| iframe 嵌套 | 6 层 | ? SPA 还是同样 iframe? |
| 加载速度 | 50 秒到销售单 | ? 多少秒? |

---

## 5. 测试场景 5 个 (跟我之前 PC audit 对照)

### 场景 1: 销售员一键创建销售单
1. 打开 app → 销售模块
2. 创建新销售单
3. 选客户 / 选产品 / 输数量
4. 提交
5. 记录: 总耗时 (PC 50s) + 字段数 (PC 33) + 整体体验

### 场景 2: 仓管员扫码入库
1. 找到仓库/入库功能
2. 扫码 (拿任意条码扫)
3. 输数量 + 拍照
4. 提交
5. 记录: 是否需 desktop 助手? 扫码是否流畅?

### 场景 3: 老板看 dashboard
1. 打开 app → 首页
2. 看是否有数据 dashboard
3. 是否能筛选时间范围
4. 是否能下钻到详情
5. 记录: 12 stats 卡片是否同步显示

### 场景 4: 审批人审批待办
1. 通知 → 待办审批
2. 打开 1 条审批单 (PC 实测 admin 有 16 条)
3. 查看详情 + 输意见 + 同意
4. 记录: 跟 PC workflow 引擎是否打通?

### 场景 5: 移动专属功能 (PC 没有)
- 扫码 / 拍照附件 / 语音输入 / GPS 定位 / 离线工作
- 记录每个发现, 哪些 Cretas 应抄

---

## 6. 收尾 — Steve 把结果发给我

测试完成后, Steve 把:
1. **所有截图** 放到 `06-宏见测试账号深度审计/screenshots/mobile/` 目录
2. **观察笔记** 写到 `06-宏见测试账号深度审计/27-MOBILE-APP-FINDINGS-STEVE.md` (我也可以根据 Steve 口述帮整理)

我 (Claude) 然后整合:
- 把 Steve 发现写到 27-MOBILE-APP-FINDINGS-STEVE.md
- 更新 09-CRETAS-DIFFERENTIATORS.md 加 Mobile 维度
- 更新 08-MUST-COPY-AUGMENT.md 加 mobile 增量
- 更新 MASTER-PLAN 工时表 (mobile audit 后的最终修正)

---

## 7. 公司信息 (Round 9 发现)

**广东宏见软件有限公司**
- 咨询热线: **0755-36658855**
- 总部: 深圳市宝安区新安街道44区金宝商务大厦5楼8513室
- **9 个分公司** (覆盖广东 + 江苏 + 湖北 + 重庆 + 浙江):
  - 深圳总部 (宝安)
  - 东莞 (南城)
  - 中山 (石岐)
  - 佛山 (禅城)
  - 江苏苏州 (姑苏)
  - 昆山 (黄河南路)
  - 湖北武汉 (东西湖)
  - 重庆 (渝北)
  - 浙江宁波 (海曙)
- 行业方案 (主推): **电子行业 / 注塑行业 / 五金行业** ⭐ — 跟 Cretas F006 食品厂行业**不重叠** (Cretas 在食品工厂主线没有直接竞争, 但客户群比较接近)
- 服务: 宏见 API 开放平台 (开发对接)

### 战略意义
- 宏见**不主推食品行业** — Cretas F006 卤制品 + 餐饮 QHJ 在它弱区
- 宏见 9 分公司=**销售网络强**, 直销模式
- Cretas 应**避开正面竞争** (电子/注塑/五金), 专注**食品/餐饮**差异化
- **Cretas API 开放** — 学宏见做 API 开放平台 (Sprint 8+)

---

## 8. 下一步

1. ✅ Steve **自行安装 + 测试** (1-1.5h)
2. ✅ Steve 把截图 + 笔记发到约定位置
3. 🟡 我 (Claude) 整合 → 27-MOBILE-APP-FINDINGS-STEVE.md + 更新 audit docs

**等 Steve 完成实测后, ping me 这边继续**.

如果 Steve 没时间或不想装 APK, **可以跳过** — 当前 audit 已 85% 完整, mobile 是补 +5% 完整度.
