# 01. 环境准备 + 账号 + 登录

## 0.0 阅读顺序导航 (新人必读)

| 什么时候 | 看哪个文件 |
|---------|-----------|
| 演示/QA **开始前** 铺数据 | §79 前置 checklist (15 项全铺齐) |
| **演示中/测试中**突然发现缺 UI/数据/权限 | §0 本节 "遇缺即补" 应急流程 |
| 已知功能缺失 / 跳过不算 bug | §13 known-gaps |
| **异常/错误处理** 分三层 (按性质选): | |
| ├─ 表单级 (重复提交/空值/已终态操作) | §24 edge-cases |
| ├─ 网络级 (断网/token/文件中断/5xx) | §33 error-recovery |
| └─ 业务级 (报工驳回/扫码歪/库存不足/并发 409) | §86 failure-recovery |
| V2 roadmap — 对客户交付 | §13.6 |
| V2 roadmap — 内部追踪表 | §99 pending-followup |

**§79 vs §0 区别**: §79 是 **演示前 15-20 min 一次性铺齐**, §0 是 **运行中突然缺的应急处理**. 不要混用.

---

## ⚠️ 0. 测试执行总原则 — 遇缺即补

**测试中如果发现缺 UI / 缺测试数据 / 缺前置配置, 立即暂停, 先补齐再继续**.

### 触发条件
- 某操作需要的按钮/页面**代码里没有** (UI 缺失)
- 某下拉/列表**应有选项但空** (数据不足)
- 某前置实体**不存在** (如 "关联 SO" 下拉无 SO, 从没建过)
- 某配置/权限/白名单**需初始化**

### 补齐流程
1. **记录 gap**: 执行报告标 "BLOCKED at §XX.X — 缺 YY"
2. **分类处理**:
   - **UI 缺失** → 开发补 UI + 部署 → 回来继续
   - **数据缺失** → 按先行节创建 (如 SO 需客户 → 先到 §04.2 前置建)
   - **配置缺失** → admin 在 `/system/*` 或 Canvas 里配
3. **验证补齐**: 重跑本节确认
4. **恢复执行**: 继续后续节

### 常见数据前置依赖

| 模块 | 需要 | 补齐位置 |
|------|------|---------|
| §04 SO | ≥1 客户 + 产品 | §04.2 / `/sales/customers` |
| §05 采购 | ≥1 供应商 + 原料 | §23.2 |
| §06 生产 | SO 审批通过 + 原料足 | §04+§05 先走 |
| §07 发货 | 完工成品批次 | §06 报工审批 |
| §08 开票 | SHIPPED SO | §07 发货 |
| §09 G1 | SO 多税率行 | §04.2 建时加 |
| §18 HR | ≥1 部门 | §18.3 |
| §19 设备 | ≥1 设备 | §19.2.1 |
| §20 质检 | 质检标准 + 待检批次 | §20.2 |

### F001 当前数据 (R4 审计)

| 模块 | 数量 | 够否 |
|------|------|------|
| customers / suppliers / product_types | 28/10/9 | ✅ |
| users / departments | 72/10 | ✅ |
| SO / PO / production | 100/57/72 | ✅ |

**F001 充足, 可直接测**. 其他工厂 (如 FOOD_3101_048 仅 9/2/2) 需先补基础数据.

### 已知 UI 缺失 (跳过不算 bug, 详 §13)

- 生产领料 UI (后端有, 前端缺)
- 研发 `request-quotation` endpoint (后端缺)
- 到货扫码 (只手动)
- SO 成本分项
- 生产自动触发

### 缺失决策树

```
缺失发现
  ↓
属 §13 已知 gap? ─ YES → 跳过 + 记录
  ↓ NO
小问题 (字段错/文本错)? ─ YES → 开发 5 min 热修 → 继续
  ↓ NO
大缺失 (整页/整流程)? ─ YES → 停测 + 开 JIRA → 等补 → 标 BLOCKED
```

**原则**: 记录 gap 暂停 > 强跑绕过. 绕过的测试结果不可信.

---

## 1.1 浏览器要求

| 项 | 要求 |
|---|------|
| 浏览器 | Chrome / Edge 最新版 |
| 窗口尺寸 | 建议 1440×900 (响应式正常范围) |
| 缓存 | **测试前 Ctrl+Shift+Delete 清除缓存** |
| 开发者工具 | **F12 全程打开** (Network + Console 双面板) |
| 无痕模式 | 推荐使用 (避免插件/旧 cookie 干扰) |

### DevTools 设置
1. **F12** 打开
2. 切到 **Network** 面板:
   - ☑ Preserve log (页面跳转不清)
   - ☑ Disable cache
   - 过滤器输 `/api/` 只看业务接口
3. 切到 **Console** 面板:
   - ☑ Preserve log
   - 只显示 `Errors` + `Warnings`

---

## 1.2 URL 速查

| 环境 | URL |
|------|-----|
| Web-Admin (测试这个) | http://139.196.165.140:8086/ |
| 后端 API 健康检查 | https://www.cretaceousfuture.com/api/mobile/health |
| APK 下载 | 本地 `CretasFoodTrace-六扇门V1-prod-v1.0.1.apk` |

---

## 1.3 完整账号矩阵 (F001 工厂, 密码全部 `123456`)

| username | 角色 role_code | 用途 |
|----------|----------------|------|
| **admin** | factory_super_admin | 🔑 **全权限**, 单人跑测试用它最省事 |
| dept | department_admin | 部门管理员 |
| hr | hr_admin | 人力资源, 员工/部门管理 |
| finance | finance_manager | **财务审核 / 发票 / 收款** (必用!) |
| sales | sales_manager | **销售订单 / 发货 / 客户** (必用!) |
| purchase | procurement_manager | **采购订单 / 供应商** (必用!) |
| production | production_manager | **生产计划** (必用!) |
| warehouse | warehouse_manager | **仓储 / 到货收货 / 确认发货** (必用!) |
| quality | quality_manager | 质检管理 |
| inspector | quality_inspector | 质检员 |
| foreman | workshop_supervisor | 车间主管, 可报工审批 |
| operator | operator | 操作员, 报工 |
| worker | warehouse_worker | 仓库工人 |
| equipment | equipment_admin | 设备管理员 |
| dispatcher | dispatcher | 调度员 |
| viewer | viewer | **只读** (权限验证用) |

**全局权限**: `admin` 角色是 `factory_super_admin`, 后端 `PermissionServiceImpl.hasPermission()` L213 直接 return true 短路, 所有操作都有权限.

---

## 1.4 登录流程

### 步骤
1. 浏览器打开 `http://139.196.165.140:8086/` → 自动跳 `/login`
2. **首次必做**: `Ctrl + Shift + R` 强刷 (加载最新 build)
3. 填:
   - **用户名**: `admin`
   - **密码**: `123456`
4. 点 "**登 录**" 按钮 (绿色大按钮)

### ✅ PASS
- URL 跳转 `/dashboard`
- 左上角显示 "白垩纪食品溯源" 或类似品牌名
- 顶部右角显示当前用户名 (`admin`)
- 侧边栏显示完整菜单 (首页/销售/采购/生产/仓储/质量/财务/研发/数据分析/系统管理)
- **Network**: `POST /api/mobile/auth/unified-login` 返回 `{"code":200,"success":true,"data":{"token":"..."}}`
- **Console**: 无红色 error

### ❌ FAIL + 对策
| 现象 | 原因 | 对策 |
|------|------|------|
| "用户账号已被禁用" | 账号 is_active=false | 联系 DBA `UPDATE users SET is_active=true WHERE username='...'` |
| "用户名或密码错误" | 密码错 | 检查大小写, 密码确定是 `123456` |
| 页面卡住不跳 | 后端未起 | `curl https://www.cretaceousfuture.com/api/mobile/health` |
| 跳转到 `/403` | 路由白名单缺角色 | 截图 F12 全部 console error 上报 |

---

## 1.5 切换账号 (Part 2 高频)

### 退出登录
1. 右上角点**用户头像**
2. 下拉菜单点 "**退出登录**" (或 "注销")
3. 自动跳回 `/login`

### 快速切号技巧
- **Ctrl+Shift+N** 开无痕窗口, 登 `finance` 账号
- **Ctrl+Shift+P** (Firefox) 或 Edge 的 "InPrivate"
- 两个窗口并排, 一个 sales, 一个 finance, 省切换时间

### ⚠️ 常见坑
- 切号后必须 **Ctrl+Shift+R 强刷**, 否则可能缓存了旧 token
- 每次测试开始前确认 **右上角用户名** 是预期账号

---

## 1.6 Bug 上报格式

发现 bug 请按以下格式反馈:

```markdown
## Bug: [一句话描述]

### 环境
- URL: http://139.196.165.140:8086/xxx/yyy
- 账号: admin / sales / ...
- 浏览器: Chrome 130

### 操作步骤
1. ...
2. ...
3. 点 "XXX" 按钮

### 现象
**预期**: 弹出 XXX 对话框
**实际**: 无反应 / 弹错误 toast "XXX"

### 证据 (三项必给)
- **截图**: [界面截图]
- **Network**:
  - URL: POST /api/mobile/F001/xxx
  - Status: 400 / 500 / ...
  - Response: {"code":400,"message":"XXX"}
- **Console**: [红色 error 完整文本]

### 频率
必现 / 偶发 (3 次中 1 次) / 特定账号 / 特定浏览器
```

**缺任何一项证据** → 开发可能无法定位, 请补全.

---

## 1.7 本节 Checklist

| 项 | 勾选 |
|---|------|
| 浏览器 DevTools F12 打开 (Network + Console) | ☐ |
| Preserve log + Disable cache 勾上 | ☐ |
| 能访问 `http://139.196.165.140:8086/` (HTTP 200) | ☐ |
| 能访问后端 health (HTTP 200) | ☐ |
| 用 `admin / 123456` 登录成功跳 `/dashboard` | ☐ |
| 侧边栏显示完整模块 | ☐ |
| 了解切号方法 + 强刷必做 | ☐ |
| 了解 bug 上报格式三要素 (截图/Network/Console) | ☐ |

勾完 8/8 才能开始后续测试.
