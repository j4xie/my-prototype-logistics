# 43. RN APK 员工工作流 (operator/inspector/warehouse)

**来源**: R3 Agent 4 — RN 覆盖 5% → 目标 60%
**耗时**: 45 min (3 角色)

---

## 43.1 安装前置

1. APK: `CretasFoodTrace-六扇门V1-prod-v1.0.1.apk`
2. Android 7+ (API 24+)
3. 允许未知来源
4. API URL: `https://www.cretaceousfuture.com`

---

## 43.2 Operator (操作员) 完整工作流

### 43.2.1 登录 + 生物识别 (若有)
- 输 `operator / 123456`
- 或指纹/FaceID 快速登录

### 43.2.2 考勤打卡 (TimeClockScreen)
- 上班打卡 → 选工位 + 相机确认
- 下班打卡
- 打卡记录查看

### 43.2.3 扫工序条码 (ScanReportScreen)
1. 底部 tab "报工"
2. 点 "扫码" → BarcodeScannerModal 打开相机
3. 扫工序条码 / 批次条码
4. 后端查批次信息返回
5. 填完工数量 + 良品 + 次品 + 备注
6. (可选) 拍照附件
7. 点 "提交" / "保存草稿"

### ✅ PASS
- 扫码 2s 内识别
- 后端查批次返回不失败
- 草稿保存 AsyncStorage

### 43.2.4 草稿管理
- "我的" tab → "草稿"
- 列表显示所有未提交草稿
- 可编辑 / 删除 / 提交

### 43.2.5 离线提交
- WiFi 关闭
- 扫码+填报 → 保存草稿
- 开 WiFi
- 自动同步上传

---

## 43.3 Inspector (质检员) 工作流

### 43.3.1 扫码查询批次 (QIScanScreen)
- 扫批次码 → 显示批次详情 + 质检标准

### 43.3.2 现场质检拍照 (QICameraScreen)
- 按标准逐项检测
- 每项可拍照附证
- 前后置相机切换
- 多张照片管理

### 43.3.3 提交结果
- 每项: 合格 / 不合格 + 备注
- 不合格自动进异常处理 (§20.4)

---

## 43.4 Warehouse (仓库) 工作流

### 43.4.1 扫码收货 (WHScanOperationScreen)
- 扫采购单/送货单二维码
- 核对供应商/数量
- 录入实收数量
- 拍照留档

### 43.4.2 扫码发货
- 扫发货单二维码
- 按 FIFO 批次分配
- 录入物流信息
- 扫每批次条码确认

### 43.4.3 盘点
- 扫仓位二维码
- 盘点每个批次
- 盘盈/盘亏录入

---

## 43.5 签名手写板 (若有)

- 审批/签收场景
- 手指手写
- 保存为图片上传

---

## 43.6 Checklist (25 项)

| # | 场景 | 角色 | 勾选 |
|---|------|------|------|
| 1 | APK 安装成功 | - | ☐ |
| 2 | 登录 | operator | ☐ |
| 3 | 生物识别 (若有) | operator | ☐ |
| 4 | 考勤上班打卡 | operator | ☐ |
| 5 | 考勤下班打卡 | operator | ☐ |
| 6 | 扫工序条码 | operator | ☐ ⭐ |
| 7 | 填报工数据 | operator | ☐ ⭐ |
| 8 | 拍照附件 | operator | ☐ |
| 9 | 保存草稿 | operator | ☐ |
| 10 | 草稿列表查看 | operator | ☐ |
| 11 | 离线保存草稿 | operator | ☐ ⭐ |
| 12 | 联网自动同步 | operator | ☐ ⭐⭐ |
| 13 | 扫批次查询 | inspector | ☐ |
| 14 | 质检拍照 | inspector | ☐ |
| 15 | 前后置切换 | inspector | ☐ |
| 16 | 多张照片管理 | inspector | ☐ |
| 17 | 提交合格结果 | inspector | ☐ |
| 18 | 提交不合格→异常 | inspector | ☐ ⭐ |
| 19 | 扫码收货 | warehouse | ☐ |
| 20 | 录入实收数量 | warehouse | ☐ |
| 21 | 扫码发货 + FIFO | warehouse | ☐ |
| 22 | 扫仓位盘点 | warehouse | ☐ |
| 23 | 盘盈/盘亏录入 | warehouse | ☐ |
| 24 | 签名手写板 | 各 | ☐ |
| 25 | 后台唤醒 + 深链 | - | ☐ |
