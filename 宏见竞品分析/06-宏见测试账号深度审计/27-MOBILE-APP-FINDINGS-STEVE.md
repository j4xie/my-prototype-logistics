# 27 — 宏见 Mobile APP 实测发现 (Steve 实测 + Claude 整合)

> **状态**: Skeleton 准备完毕, 等 Steve 实测后填字段.
>
> **Steve 使用方式**: 边测试边在每个 section 下写观察 (可中文/英文/混搭都行), 截图放 `screenshots/mobile/` 目录. 完了 ping 我, 我整合到其他 audit docs.

---

## ⚡ 极简 3 步开始 (Steve)

### 步骤 1 — 下载 APK
**Android 手机** 浏览器打开 (复制粘贴):
```
https://app.hongjian.com/app/hongjian.apk
```

### 步骤 2 — 安装
- 浏览器下载完成 → 点 APK → 系统提示"未知来源" → 同意 → 安装

### 步骤 3 — 登录
- 打开"宏见ERP" app
- 公司编号: `lyh01`
- 账号: `admin`
- 密码: `Aa123456`

⚠️ **登录前确保** 网页端 `https://login.hongjian.com` 退出登录, 避免 session 冲突.

---

## 1. App 信息基本观察

请填:

| 项 | Steve 观察 |
|---|---|
| App 包名 (从设置看) | |
| App 版本号 | |
| App 大小 (MB) | |
| 启动时长 (秒, cold start) | |
| 启动 splash 是否有动画 | |
| 主框架是 H5 webview 还是真原生? | (滑动是否丝滑判别) |
| 整体设计语言 (Material / 自定义 / 仿微信?) | |
| 字号舒服度 (1-5 分) | |
| 整体流畅度 (1-5 分) | |

---

## 2. 首页 / Dashboard

**截图**: `screenshots/mobile/m-01-home.png`

请填:
- 首页布局: ? 列卡片 / BottomTab / Drawer / 12 模块缩略 / 角色化首页
- 是否有数据卡片 (类似 PC 12 stats)? 列出看到的:
- 是否有底部 Tab 栏? 列出 Tab 名:
- 顶部 header 含什么 (公司名/用户名/搜索/消息/扫码)?
- 是否有"添加" 浮动按钮 (FAB)?

---

## 3. 菜单 / 模块导航

**截图**: `screenshots/mobile/m-02-modules.png`

请填:
- 是 PC 12 模块全显示, 还是简化?
- 列出看到的 模块名:
- 是否有"全部"/"更多"展开?
- 角色相关? (你 admin 视角看应该全)

---

## 4. 销售模块

**截图**:
- `screenshots/mobile/m-03-sale-list.png` (销售单 list)
- `screenshots/mobile/m-04-sale-detail.png` (随便点 1 个销售单看详情)
- `screenshots/mobile/m-05-sale-create.png` (新增销售单页, 不必真提交)

请填:
- 销售单 list 表头列数 (PC 是 8):
- 是否能滑动查看更多列? 还是列被精简?
- 是否有筛选/排序?
- 行末"操作" dropdown 几项? (PC 是 11):
- 创建表单字段数 (PC 是 33):
- 字段类型是否相同 (popup picker / dropdown / textbox)?

---

## 5. 仓库 / 扫码功能 ⭐ (核心)

**截图**:
- `screenshots/mobile/m-06-stock.png` (库存查询)
- `screenshots/mobile/m-07-scan.png` (扫码功能)

请填:
- 仓库菜单/导航位置:
- 是否有显眼的"扫码"按钮?
- 扫码是用原生相机吗? (拿任意条码试)
- 扫码后跳到哪? (入库单 / 出库单 / 商品详情)
- 是否能拍照附件? (附图证据)
- 是否需要 PC desktop 助手? (期望: 不需要)

---

## 6. 审批 / 待办

**截图**: `screenshots/mobile/m-08-approval.png`

请填:
- 待办审批入口在哪?
- 有几条待办? (跟 PC admin 16 条对比)
- 审批界面是否含意见 textarea + "设置常用语"?
- 是否能批量审批?

---

## 7. 客户档案 (CRM)

**截图**: `screenshots/mobile/m-09-crm.png`

请填:
- 客户档案字段数 (PC 是 51):
- 是否有 21 个跟踪 tab? (PC 实测有: 跟踪记录/微信/通话/短信/谈话录音/邮件 等)
- 客户列表是否能拨打电话?
- 是否能直接微信发消息给客户?

---

## 8. 工作流 / 流程图 (U-NAV-1)

**截图**: `screenshots/mobile/m-10-workflow.png`

请填:
- 是否有 jsPlumb 流程图显示? (PC 每模块有 7-14 节点)
- 节点是否可点击导航?
- mobile 上流程图是否好用 (横屏 vs 竖屏)?

---

## 9. 设置 / 个人中心

**截图**: `screenshots/mobile/m-11-settings.png`

请填:
- 设置项列表 (例如: 账号 / 偏好 / 推送 / 数据同步 / 退出):
- 是否有 push 通知开关?
- 是否能切公司 (lyh01 切其他)?
- 是否有"指纹/Face ID 登录"?
- 是否能离线工作?

---

## 10. 移动专属功能 ⭐ (Cretas 是否抄)

请填 (有就标 ✅, 没就 ❌):

| 功能 | 是否有 | 备注 |
|---|---|---|
| 扫码 (条码/二维码) | | |
| 拍照附件 | | |
| 语音输入 | | |
| GPS 定位 (考勤打卡) | | |
| 摇一摇 | | |
| 长按操作 (BottomSheet) | | |
| 下拉刷新 | | |
| 离线缓存 | | |
| 推送通知 | | |
| 微信分享 | | |
| 钉钉集成 | | |
| 指纹/Face ID 登录 | | |

---

## 11. 性能 + UX 评分

请填 (1-5 分):

| 维度 | 分 | 备注 |
|---|---|---|
| 启动速度 | | (cold/warm start) |
| 列表滚动流畅度 | | |
| 切页等待 | | |
| 字号 / hit area 舒服度 | | |
| 整体设计语言 | | 现代 vs 老土 |
| 移动优化程度 | | (vs PC 缩小版) |
| 离线可用性 | | |
| **总体推荐度** | | |

---

## 12. iOS (如有 iPhone)

**截图**:
- `screenshots/mobile/ios-01-store.png` (App Store 搜索结果)
- `screenshots/mobile/ios-02-home.png` (登录后首页)

请填:
- App Store 搜 "宏见ERP" 找到的 app 名 + 版本号 + 评分 + 下载量:
- 跟 Android 差异 (功能少 / 多 / 同?):
- iOS 专有 (Face ID / Apple Pay / Siri Shortcuts)?

---

## 13. TV 大屏 (如有 Android TV / 盒子)

**截图**:
- `screenshots/mobile/tv-01-home.png`

请填:
- 是否需 ADB 安装 还是 TV 应用商店?
- TV 看板内容 (实时生产 / 销售 / 库存 / 报警)?
- 是否能配置看板?
- 数据刷新频率?
- 横屏/竖屏?

---

## 14. 关键发现 (Steve 总结)

请用 3-5 句话总结你的感受:

```
(Steve 写)
```

---

## 15. Cretas 启发 (Steve 战略思考)

哪些**必须抄**到 Cretas RN app?
```
(Steve 写)
```

哪些**做得很烂**, Cretas 应该更好?
```
(Steve 写)
```

哪些**Cretas 已经领先**?
```
(Steve 写)
```

---

## 16. 完成后 ping Claude

Steve 完成测试后:
1. 把截图全放 `screenshots/mobile/` 目录
2. 在本 doc 各 section 填字段
3. 发消息给 Claude: **"宏见 mobile audit 完成, 整合下"**

Claude (我) 会:
- 把 Steve 笔记整合到本 doc + 09-DIFFERENTIATORS / 08-MUST-COPY-AUGMENT / MASTER-PLAN
- 计算移动维度 Cretas 工时增量
- 给最终 audit 完整度评估 (预计从 85% → 92-95%)

---

## 17. 备用方案 (Steve 没设备 / 没时间)

如果 Steve 测试不了, 可以**简化为**:
- **只测 Android 手机 5 分钟** (最关键)
- **跳过 TV + iOS** (TV 罕见, iOS 跟 Android 推测一致)
- 只填 section 1-5 + 10 + 14

---

## 18. 估计耗时

| 任务 | 时长 |
|---|---|
| 下载 + 安装 + 登录 | 5 min |
| 简化测试 (section 1-5 + 10 + 14) | 30 min |
| 完整测试 (含 iOS + TV) | 1.5h |

**推荐**: **30 min 简化测试**, ROI 最高.
