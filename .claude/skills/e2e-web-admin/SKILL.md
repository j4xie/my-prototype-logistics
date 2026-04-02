---
name: e2e-web-admin
description: >
  Use when verifying web UI functionality actually works — form submissions,
  CRUD operations, cross-module data consistency, business workflow completion.
  Triggers: "测试web端", "验收测试", "e2e测试", "部署前验证", "测试app",
  after modifying Vue components or RN screens, after backend API changes,
  before deployment, after customer bug reports. Supports Web-Admin and
  RN App via Expo Web.
---

# 通用 E2E 功能验收测试

用 Playwright AI 驱动模式对 **Web-Admin** 和 **RN App (Expo Web)** 做功能验收测试。

核心原则：**不测"页面能打开"，测"用户能完成任务"。**

## 平台支持

| 平台 | 技术栈 | 启动方式 | 默认 URL |
|------|--------|---------|---------|
| **Web-Admin** | Vue 3 + Element Plus | `cd web-admin && npm run dev` | `http://localhost:5173` |
| **RN App** | Expo + React Native Web | `cd frontend/CretasFoodTrace && npx expo start --web` | `http://localhost:8081` |

两个平台共享同一个后端 API，业务逻辑相同，只是 UI 框架不同。

## 参数

```
/e2e-web                           # 默认: 测 Web-Admin Layer 1+2
/e2e-web admin                     # 明确指定 Web-Admin
/e2e-web app                       # 测 RN App (Expo Web)
/e2e-web admin quick               # Layer 1: 页面扫描
/e2e-web app crud                  # Layer 2: App CRUD 操作
/e2e-web admin cross               # Layer 3: 跨模块数据一致性
/e2e-web full                      # Layer 1-4 完整 (两个平台都测)
/e2e-web admin --module sales      # 只测特定模块
/e2e-web --fix                     # 测试+自动修复
```

## 环境配置

```bash
# Web-Admin
E2E_ADMIN_URL=${E2E_ADMIN_URL:-http://localhost:5173}
# RN App (Expo Web)
E2E_APP_URL=${E2E_APP_URL:-http://localhost:8081}
# 共享
E2E_USERNAME=${E2E_USERNAME:-factory_admin1}
E2E_PASSWORD=${E2E_PASSWORD:-123456}
E2E_API_BASE=${E2E_API_BASE:-http://localhost:10010}
```

## 执行流程

### Phase 0: 平台检测与启动

**Web-Admin:**
1. 检查 `$E2E_ADMIN_URL` 是否可访问
2. 如不可访问，提示: `cd web-admin && npm run dev`

**RN App (Expo Web):**
1. 检查 `$E2E_APP_URL` 是否可访问
2. 如不可访问，提示: `cd frontend/CretasFoodTrace && npx expo start --web`
3. 注意: Expo Web 不支持 SecureStore，token 存 AsyncStorage → 自动降级为 localStorage

### Phase 1: 准备
1. 检查 Playwright MCP 工具可用
2. 确认目标 URL 可访问
3. 确认后端 API 可访问: `curl -s $E2E_API_BASE/api/mobile/health`

### Phase 2: 运行 (AI 驱动模式)

使用 Playwright MCP 工具实时操作浏览器，自动适应 UI 变化。

**工具链 (按可靠性排序):**

1. **首选: `browser_run_code`** — 写 Playwright 代码片段直接执行，最可靠
   ```javascript
   async (page) => {
     await page.goto('http://...');
     await page.getByRole('button', { name: '新建' }).click();
     return await page.locator('.el-message').textContent();
   }
   ```
2. **次选: 独立 Node.js 脚本** — `node test-xxx.mjs`，适合批量测试
3. **备选: MCP 逐步操作** — `browser_navigate` + `browser_snapshot` + `browser_click`
4. **避免: `plugin_playwright_playwright`** — 会和用户浏览器抢 Chrome profile 导致卡死

> **已知问题**: `plugin_playwright_playwright` 在用户有 Chrome 浏览器打开时报
> "Browser is already in use" 错误。优先用 `browser_run_code` 或独立脚本绕开。

**平台差异处理:**

| 操作 | Web-Admin (Element Plus) | RN App (Expo Web) |
|------|------------------------|-------------------|
| 导航 | 侧边栏 `.el-menu-item` 点击 | Tab bar + Stack navigation |
| 下拉 | `.el-select` → `.el-select-dropdown__item` | React Native Picker / Modal |
| 按钮 | `el-button` | `TouchableOpacity` / `Pressable` |
| 表单 | `el-form-item` + `el-input` | `TextInput` + `View` |
| Toast | `.el-message--success/error` | React Native Alert / Toast |
| 表格 | `.el-table` + `.el-table__row` | `FlatList` / `ScrollView` |

**每层执行逻辑:**

**Layer 1 (页面扫描):**
- **Admin**: 读取 `web-admin/src/router/` 路由，逐个导航检查
- **App**: 读取 `frontend/.../navigation/` 导航配置，按角色逐个 tab + screen 检查
- 通用: 无 error toast、无 401、有内容

**Layer 2 (CRUD 操作):**
对每个模块：
1. 导航到列表页
2. 点"新建"按钮，获取弹窗/页面结构
3. 识别所有表单字段，填写必填字段
4. 提交，检查成功提示（无 error）
5. 刷新验证数据持久化

**Layer 3 (跨模块):**
1. 在模块 A 创建数据
2. 导航到模块 B，检查下拉列表包含新数据

**Layer 4 (业务链路):**
- 销售: 创建订单→确认→发货→出货记录
- 采购: 创建订单→确认→入库→库存增加
- 生产: 创建计划→转批次→开始→完成

### Phase 3: 报告 (证据强制)

详见 [references/report-format.md](references/report-format.md)。

**核心规则: 没证据的 PASS 视为无效，必须重跑。**

### Phase 4: 自动修复 (--fix)

分析 evidence 中的错误 → 定位组件 + Controller → 修复 → 重跑失败项验证。
如果是应用 bug（非测试问题），标记 `KNOWN_BUG`，不无限重试。

## 并行执行

测试模块间无依赖时，用多个 subagent 并行执行以提高效率。每个 subagent 调用 `browser_run_code`，各自启动独立浏览器实例，无 profile 冲突。

**并行策略:**
- Layer 1 (页面扫描): 单 agent 顺序跑（快，无需并行）
- Layer 2 (CRUD): **按模块并行** — 销售/采购/生产/仓储各一个 agent
- Layer 3 (跨模块): 顺序跑（有依赖关系）
- Layer 4 (业务链路): 每条链路一个 agent 并行

**双平台并行:**
```
Agent A: browser_run_code → chromium.launch() → Web-Admin (localhost:5173)
Agent B: browser_run_code → chromium.launch() → Expo Web (localhost:8081)
```
两个平台同时测，互不干扰。

## 测试规范

详见 [references/test-rules.md](references/test-rules.md)。

### 硬性规则 (违反则测试无效)

1. **必须实际填写并提交表单** — 报告中必须有 `填写字段:` 证据行
2. **必须记录 API 响应** — 报告中必须有 `toast:` 或 `API 响应:` 证据行
3. **必须验证数据持久化** — 报告中必须有 `刷新后:` 证据行
4. **跨模块必须验证下拉列表** — 报告中必须有 `下拉列表:` 证据行
5. **禁止无证据 PASS** — 没有 evidence 区块的 PASS 自动标记为 ⚠️ UNVERIFIED

## 测试层级

| Layer | 测什么 | 怎么测 |
|-------|--------|--------|
| 1 页面 | 所有页面能打开 | 导航→无 error/401/500 |
| 2 CRUD | 创建/编辑/删除 | 填表单→提交→验证成功 |
| 3 跨模块 | 数据一致性 | A创建→B下拉能选到 |
| 4 链路 | 完整业务流程 | 端到端走通 |

## 覆盖模块

详见 [references/coverage-matrix.md](references/coverage-matrix.md)。

矩阵动态更新: 每次运行前扫描路由/导航配置，自动发现新模块。

## 何时运行

| 场景 | 命令 |
|------|------|
| 改了 Web-Admin Vue 组件 | `/e2e-web admin --module sales` |
| 改了 RN App 页面 | `/e2e-web app --module sales` |
| 改了后端 API | `/e2e-web full` (两端都测) |
| 部署前 | `/e2e-web admin full` |
| 打 APK 前 | `/e2e-web app crud` |
| 客户反馈后 | `/e2e-web full --fix` |
