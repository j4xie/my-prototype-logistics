# React Native 移动端 — 状态驱动 Ralph Loop 指令

你是 React Native 移动端 QA 工程师，执行**状态驱动**的迭代循环。每轮检查 5-8 个屏幕，通过 JSON 状态文件在迭代间传递进度。即使屏幕基础检查通过，也要深度分析找优化空间——循环跑满 100 轮，持续迭代优化。

**绝对禁止输出 `<promise>` 标签** — 循环由 max_iterations=100 自然终止。

⚠️ **浏览器工具**: 全部使用 `mcp__playwright-rn__browser_*` 系列（不是 `mcp__playwright-test__*`，那是 web-admin loop 专用）。

---

## 浏览器工具映射

本 loop 使用第二套 Playwright MCP，与 web-admin loop 互不冲突:

| 操作 | 工具名 |
|------|--------|
| 导航 | `mcp__playwright-rn__browser_navigate` |
| 快照 | `mcp__playwright-rn__browser_snapshot` |
| 截图 | `mcp__playwright-rn__browser_take_screenshot` |
| Console | `mcp__playwright-rn__browser_console_messages` |
| Network | `mcp__playwright-rn__browser_network_requests` |
| 点击 | `mcp__playwright-rn__browser_click` |
| 输入 | `mcp__playwright-rn__browser_type` |
| 等待 | `mcp__playwright-rn__browser_wait_for` |
| 调整窗口 | `mcp__playwright-rn__browser_resize` |

⚠️ 没有 `browser_fill_form`，用 `browser_type` 替代。

---

## Step 0: 环境准备 + 读取状态

### 0a. 确保 Expo Web 运行

```bash
curl -s http://localhost:3010 > /dev/null 2>&1 && echo "OK" || echo "NOT_RUNNING"
```

如果 NOT_RUNNING:
```bash
cd frontend/CretasFoodTrace && npm run web &
```
等待 30 秒后重试 curl。

⚠️ **手机尺寸模拟**: RN App 通过 Expo Web 在浏览器中运行，但必须模拟手机屏幕。每次首次打开浏览器或 `browser_navigate` 到 localhost:3010 后，**必须立即执行** `mcp__playwright-rn__browser_resize` 设置宽度 390、高度 844（iPhone 14 尺寸）。不 resize 则看到的是桌面端布局，检查结果无意义。

### 0b. 读取状态

读取 `.claude/ralph-state/rn-app-progress.json`。

- **不存在** → 从 `.claude/ralph-state/rn-page-registry.json` 初始化：
  - 复制所有屏幕，每个设为 `"status": "UNVISITED"`
  - 设 `currentIteration: 1`，`currentRole: "factory_admin1"`，summary 全部归零
- **存在** → 读取，`currentIteration++`，继续上轮进度

### 0c. 角色轮换检查

根据 `currentIteration` 确定本轮角色:

| 迭代 | 角色 | 用户名 | 密码 | 屏幕范围 |
|------|------|--------|------|---------|
| 1-2 | 工厂管理员 | `factory_admin1` | `123456` | ~60 屏幕 |
| 3 | 餐饮管理员 | `factory_admin1` (餐饮模式) | `123456` | ~11 屏幕 |
| 4-5 | 调度员 | `dispatcher1` | `123456` | ~29 屏幕 |
| 6 | 车间主管 | `workshop_sup1` | `123456` | ~20 屏幕 |
| 7 | 仓储主管 | `warehouse_mgr1` | `123456` | ~35 屏幕 |
| 8 | HR 管理员 | `hr_admin1` | `123456` | ~22 屏幕 |
| 9 | 质检员 | `quality_insp1` | `123456` | ~18 屏幕 |
| 10-11 | 平台管理员 | `platform_admin` | `123456` | ~61 屏幕 |
| 12-14 | 深度轮转 | 按 T1 屏幕回访 | — | 混合 |
| 15+ | 循环重复 (iteration % 14) | — | — | — |

如果本轮角色与上轮不同，需要在 Step 2 中执行角色切换。

### 0d. 后台任务消费

检查是否有上轮后台启动的 agent-team 已完成:
- 如有: 提取建议，P0/P1 纳入本轮修复优先级，P2 记录到屏幕 optimizations
- 如有竞品调研结果: 提取可落地的改进方案
- 摘要中注明 "consumed background agent-team from iteration N"

---

## Step 1: 选屏（5-8 个）

只选当前角色可见的屏幕（按 `rn-page-registry.json` 中的 `role` 字段匹配）。

按优先级选取:

1. **未访问** (`status: "UNVISITED"`) — 必须先覆盖该角色所有屏幕
2. **刚修复待验证** (`status: "FIXED"`) — 回归验证
3. **有问题未修** (`status: "HAS_ISSUES"`) — 重试修复
4. **需要优化** (`status: "NEEDS_OPTIMIZATION"`) — 应用优化
5. **最久没深度分析的** — 按 `lastDeepAnalysis` 升序排列

⚠️ 跳过 `webCompatible: false` 的屏幕（浏览器无法测试），但仍安排后台 Agent 做源代码分析。

全覆盖后进入**深度轮转模式**：每轮从 `lastDeepAnalysis` 最小的屏幕中选 5-8 个。

---

## Step 2: 登录/角色切换

使用 `mcp__playwright-rn__browser_*` 登录 Expo Web:

```
1. browser_navigate → http://localhost:3010
2. browser_resize → 宽 390, 高 844 (iPhone 14 尺寸，模拟手机屏幕)
3. browser_snapshot → 确认登录页
3. browser_type → username 输入框填入角色用户名
4. browser_type → password 输入框填入 123456
5. browser_click → 登录按钮
6. browser_wait_for → 底部 Tab 栏出现
7. browser_snapshot → 确认进入主界面
```

如果需要角色切换（与上轮不同角色）:
```
1. browser_click → "我的" Tab
2. browser_click → "退出登录" 按钮
3. browser_wait_for → 登录页出现
4. 执行上述登录流程，使用新角色
```

如果已登录为当前角色（snapshot 显示主界面），跳过登录步骤。

---

## Step 3: Screenshot-Handoff Pipeline — 并行浏览器检查 + 深度分析

### 架构: 主 Agent 独占浏览器，后台 Agent 只做代码分析

```
主 Agent (唯一浏览器控制者, 用 mcp__playwright-rn__*):
  Group 1: 浏览器导航 3-4 个屏幕 → snapshot + screenshot + console + network
  → 启动后台 Agent-A (general-purpose, run_in_background=true)
     Agent-A 只读: Read 截图文件 + Read 源代码 + Grep 代码模式
  Group 2: 浏览器导航下一组屏幕 → 同上
  → 启动后台 Agent-B
  ...
  主 Agent 视觉审查截图
  等待所有后台 Agent → 收集结果 → /compact
```

⚠️ **后台 Agent 绝对不访问浏览器** — 只读文件和截图。
⚠️ **后台 Agent 类型**: `general-purpose`（需要 Bash/Grep/Read 等工具能力）。

### 动态分组策略

```
分组规则:
1. 复杂屏幕单独一组: SmartBI 相关、AI Chat、仪表盘类
   → 大量交互/图表，需要完整分析时间
2. HAS_ISSUES / FIXED 屏幕优先独立: 有问题的屏幕单独分组
   → 需要更深入的根因分析
3. 简单列表屏幕合并: CRUD 列表页 3-4 个一组
   → 分析模式相似，批量处理效率高
4. PASS_DEEP 轮转屏幕可以多合并: 5+ 个一组
   → 主要是复查，分析量小

结果: 每轮 2-4 个 Wave Agent，每个负责 1-4 个屏幕
```

### RN 导航方式

RN Expo Web 不像 web-admin 有 URL 路径。导航方式:

1. **底部 Tab 切换**: `browser_click` 点击 Tab 栏按钮
2. **列表项点击**: `browser_click` 点击列表行进入详情
3. **按钮点击**: `browser_click` 点击功能按钮进入子页面
4. **返回**: `browser_click` 点击返回箭头或 `browser_navigate_back`

参考每个屏幕的 `navigationPath` 字段确定到达路径。

### Wave 执行流程（严格按此顺序）

⚠️ **必须流水线化**: 访问完一组立即启动后台 Agent，不要等所有屏幕访问完。

```
for each group in 动态分组结果:
  # 1. 主 Agent 浏览器操作（本组所有屏幕）
  for each screen in group:
    导航到屏幕 (按 navigationPath 点击)
    browser_wait_for → 主要内容加载
    browser_snapshot → 获取页面快照
    browser_console_messages → 检查 JS 错误/警告
    browser_network_requests → 检查 4xx/5xx API 错误
    browser_take_screenshot → 获取视觉截图
    记录 L1 结果: PASS_BASIC / HAS_ISSUES / ERROR

  # 2. 立即启动后台 Agent（不等结果，继续下一组浏览器操作）
  Agent(
    subagent_type="general-purpose",    ← ⚠️ 不是 Explore！需要读写能力
    run_in_background=true,
    prompt=填充 Wave Agent Prompt 模板（见下方）
  )

# 3. 所有组浏览器访问完成后，主 Agent 视觉审查截图
# 4. 业务逻辑验证（本轮维度含"业务逻辑"时执行）
#    主 Agent 在浏览器中执行 1-2 个当前角色的核心流程（创建/编辑/提交）
#    测试表单校验（空提交、非法值）
#    验证操作后数据刷新、状态流转、空状态显示
# 5. 等待所有后台 Agent 完成，收集结果
# 6. ⚠️ 所有 Wave Agent 结果收集完毕后，立即执行 /compact 压缩上下文
```

⚠️ **禁止**: 先串行访问所有屏幕，最后才启动 agent。每组访问完必须立即启动对应 agent。

基础健康判定:
- **PASS_BASIC**: 无错误，渲染正常
- **HAS_ISSUES**: 有 JS 错误、API 失败或渲染异常
- **ERROR**: 屏幕崩溃或无法访问

### 分析维度（11 项，RN 适配版）

每个 Wave Agent 按以下维度分析:

| 维度 | RN 特有检查项 |
|------|-------------|
| **组件质量** | Screen vs Component 拆分、hooks 使用、导航参数类型、FlatList keyExtractor |
| **类型安全** | 禁止 `as any`、RouteProp/StackParamList 类型、API 响应类型 |
| **性能** | FlatList vs ScrollView、memo/useMemo/useCallback、图片优化 (expo-image)、重渲染 |
| **安全性** | SecureStore (非 AsyncStorage)、API key 暴露、权限守卫、输入校验 |
| **无障碍** | accessibilityLabel、触控区域 ≥44pt、accessibilityRole、VoiceOver 兼容 |
| **响应式** | useWindowDimensions、SafeAreaView、平板布局、横屏适配 |
| **国际化就绪** | 硬编码中文字符串检测（标记为待 i18n，不实际替换） |
| **API 集成** | 请求错误处理、loading 状态、空数据处理、离线缓存、请求取消 |
| **代码重复** | 跨屏幕重复逻辑、可抽取 hooks/utils、相似组件合并 |
| **RN-Web 兼容性** | Platform.OS 检查、原生模块使用、Web 不兼容 API、expo-web polyfill |
| **业务逻辑** | 流程完整性、权限边界、表单校验、数据一致性、空/异常状态（详见下方） |

#### 业务逻辑维度详细检查项

⚠️ **此维度需要主 Agent 浏览器配合** — 后台 Agent 做代码层面审查，主 Agent 在浏览器中验证实际行为。

**1. 核心流程走通**（主 Agent 浏览器操作）

按当前角色的主线业务流程实际操作：

| 角色 | 必测流程 |
|------|---------|
| factory_admin1 | 创建批次 → 查看详情 → 阶段流转 → 完成 |
| factory_admin1 | 创建采购单 → 入库 → 库存变化 |
| factory_admin1 | 创建销售单 → 出货 → 状态流转 |
| dispatcher1 | 创建计划 → 任务分配 → 甘特图显示 |
| workshop_sup1 | 查看批次 → 开始生产 → 物料消耗 → 质检 → 完成 |
| warehouse_mgr1 | 入库单创建 → 验收 → 上架 → 库存更新 |
| warehouse_mgr1 | 出库单 → 拣货 → 打包 → 发货确认 |
| hr_admin1 | 新增员工 → 分配部门 → 查看考勤 |
| quality_insp1 | 选择批次 → 填写质检表单 → 提交结果 → 查看记录 |

每轮选 1-2 个当前角色的流程实际走通（不需要每轮全走），记录：
- ✅ 流程走通
- ❌ 卡在哪一步 + 错误信息
- ⚠️ 能走通但体验差（如：提交后没反馈、成功后没跳转）

**2. 权限边界验证**（角色切换时检查）

每次角色切换后验证：
- 当前角色只能看到自己该看的 Tab 和屏幕
- 不该有的功能按钮确实不显示（如：操作员不该有"管理"Tab）
- 代码层面：检查 `isScreenEnabled()`、`useFactoryFeatureStore()`、权限守卫逻辑

**3. 表单校验**（主 Agent 浏览器操作）

对有"新增/创建/编辑"功能的屏幕：
- 必填字段空提交 → 应显示错误提示，不能直接发请求
- 数字字段填非法值（负数、字母）→ 应拦截
- 日期字段：结束日期早于开始日期 → 应拦截
- 代码层面：检查 `onSubmit` 是否有 validation，是否用了 `required` / `pattern`

**4. 数据一致性**（代码审查为主）

后台 Agent 检查：
- 创建/编辑操作后是否调用了 `refetch()` / `invalidateQueries()` 刷新列表
- 删除操作后是否从列表移除了对应项
- 状态流转后 UI 是否同步更新（如：批次状态变"已完成"后按钮应变灰）
- 多个屏幕显示同一数据时，来源是否一致（同一 API 还是各取各的）

**5. 跨角色数据联动**（代码审查 + 角色切换验证）

验证不同角色间的数据是否正确互通：

| 操作角色 | 操作 | 应该看到变化的角色 | 验证点 |
|---------|------|-------------------|--------|
| dispatcher1 | 创建计划/分配任务 | workshop_sup1 | 车间主管首页能看到被分配的任务 |
| dispatcher1 | 人员排班 | workshop_sup1, hr_admin1 | 排班结果在车间和HR都可见 |
| factory_admin1 | 创建批次 | workshop_sup1, quality_insp1 | 车间能开工、质检能看到待检批次 |
| factory_admin1 | 创建采购单 | warehouse_mgr1 | 仓库能看到待入库的采购单 |
| factory_admin1 | 创建销售单 | warehouse_mgr1 | 仓库能看到待出库的销售单 |
| warehouse_mgr1 | 入库完成 | factory_admin1 | 管理员看到库存数量更新 |
| quality_insp1 | 提交质检结果 | factory_admin1, workshop_sup1 | 批次详情显示质检记录 |
| hr_admin1 | 新增/禁用员工 | dispatcher1 | 调度员人员列表同步更新 |

代码层面检查：
- 不同角色的屏幕调用的 API 端点是否一致（如都查 `/api/mobile/{factoryId}/scheduling/plans`）
- 数据是否通过 `factoryId` 隔离（不同工厂不能看到对方数据）
- 操作后是否有通知/推送机制（或至少下次进入时能看到最新数据）

浏览器验证（深度轮转期间，iteration 12-14）：
- 用角色 A 创建数据 → 切换到角色 B → 检查数据是否可见
- 每次角色切换时顺便验证 1 条跨角色数据链路

**6. 空状态与异常处理**（主 Agent + 后台 Agent）

主 Agent 浏览器检查：
- 列表无数据时：显示友好的空状态提示还是白屏？
- 网络请求失败时：有错误提示还是无限 loading？

后台 Agent 代码检查：
- `data?.length === 0` 时是否有空状态 UI（EmptyState 组件）
- `isError` 时是否显示重试按钮
- `isLoading` 时是否有 loading 指示器（Skeleton / Spinner）
- 请求超时是否有兜底处理

**7. 溯源链完整性**（代码审查 + 浏览器验证）

食品溯源是系统核心功能，验证从原材料到成品的完整链路：

| 检查环节 | 验证点 |
|---------|--------|
| 原材料入库 | 入库记录关联供应商 + 批次号 + 质检报告 |
| 生产投料 | 投料记录关联原材料批次（BOM 追溯） |
| 生产过程 | 批次阶段流转记录完整（时间、操作人、工序） |
| 质检关联 | 质检结果关联到具体批次（不是孤立记录） |
| 成品出库 | 出库记录关联生产批次 + 客户订单 |
| 溯源查询 | 输入批次号/二维码能完整显示全链路 |

代码检查：
- `TraceabilityScreen` 是否能正确拼装溯源链路
- 每个环节的 `batchId` / `materialBatchId` 是否正确传递
- 溯源链上每个节点是否都有时间戳和操作人

**8. 批次状态机**（代码审查为主）

批次生命周期必须遵循状态机规则，非法流转应被阻止：

```
CREATED → IN_PROGRESS → QUALITY_CHECK → COMPLETED → SHIPPED
                ↑              ↓
                └── REWORK ←──┘
                              ↓
                          REJECTED → DISPOSED
```

代码检查：
- 状态流转是否有前置校验（如：`CREATED` 不能直接跳到 `COMPLETED`）
- UI 按钮是否根据当前状态正确显示/隐藏（如：`COMPLETED` 状态下不显示"开始生产"）
- 后端 API 是否校验状态合法性（不只是前端控制）
- `REWORK` 返回 `IN_PROGRESS` 后，之前的质检记录是否保留

**9. 库存数值一致性**（代码审查 + 浏览器验证）

库存操作后数值必须准确：

| 操作 | 预期变化 | 验证方式 |
|------|---------|---------|
| 入库 | 库存 +N | 入库前后库存差 = 入库量 |
| 出库 | 库存 -N | 出库前后库存差 = 出库量 |
| 投料消耗 | 原材料库存 -N | 消耗量 = BOM 配方量 × 生产量 |
| 盘点 | 库存 = 盘点值 | 差异记入损益 |

代码检查：
- 库存变更是否在事务内完成（前端不直接改库存数字）
- 负库存是否有告警或阻止（`quantity < 0` 校验）
- 多仓库场景下库存汇总是否正确
- 安全库存预警阈值判断逻辑

**10. 预警触发验证**（代码审查 + 浏览器验证）

阈值超越时预警是否正确触发：

| 预警类型 | 触发条件 | 验证点 |
|---------|---------|--------|
| 库存预警 | quantity < safetyStock | 预警列表中出现 + 通知 |
| 设备预警 | 运行时间 > 维保周期 | 设备预警列表 + 维保提醒 |
| 质检不合格 | 质检结果 = FAIL | 质量预警列表 + 批次标记 |
| 临期预警 | 到期日 - 今天 < N 天 | 库存列表标红 + 预警列表 |
| 考勤异常 | 未打卡/迟到/早退 | HR 预警面板显示 |

代码检查：
- 预警阈值是否可配置（而非硬编码）
- 预警去重逻辑（同一批次不重复告警）
- 预警已读/处理状态的流转

**11. 报表数据准确性**（代码审查 + 浏览器验证）

KPI 卡片和报表数字必须与底层数据一致：

代码检查：
- KPI 数值的计算 SQL/API 逻辑是否正确（如合格率 = 合格批次数 / 总批次数）
- 时间范围筛选是否正确传参（"本月" → 当月 1 日 00:00 到 now）
- 前端显示的百分比是否有正确的小数位数和四舍五入
- 聚合报表（日/周/月）的时间分组是否正确
- 图表数据点与表格数据是否对得上

浏览器验证（抽样）：
- 首页 KPI 数字 vs 对应列表页的总数是否吻合
- 报表页的合计行 vs 明细行求和是否一致

**12. 搜索/筛选有效性**（主 Agent 浏览器操作）

列表页的搜索和筛选功能：
- 关键词搜索：输入"test" → 结果中每条都包含"test"
- 状态筛选：选"进行中" → 结果中不应出现"已完成"的项
- 日期范围筛选：选 3 月 1-10 日 → 结果中不应有 2 月或 3 月 11 日的数据
- 组合筛选：多条件同时生效（AND 而非 OR）
- 清空筛选：重置后恢复全量数据

代码检查：
- 搜索是否前端过滤还是后端查询（大数据量必须后端）
- 筛选参数是否正确拼接到 API 请求
- 搜索防抖（debounce）是否实现

**13. 分页完整性**（代码审查 + 浏览器验证）

FlatList 分页加载不丢失不重复：

代码检查：
- 分页参数传递：`page` / `size` 是否正确递增
- 是否有 `hasMore` / `totalPages` 判断来停止加载
- 下拉刷新时是否重置 `page = 0`
- `keyExtractor` 是否唯一（避免重复渲染）
- 列表项更新后是否正确合并（不重复追加）

浏览器验证：
- 连续上拉加载 3 页 → 数据是否递增、无重复项
- 下拉刷新后 → 是否回到第一页

**14. 计量单位一致性**（代码审查为主）

同一物料在不同屏幕的单位必须一致：

代码检查：
- 物料列表显示的单位（kg/g/吨）vs 入库单的单位 vs BOM 配方的单位
- 单位转换逻辑是否正确（如 BOM 用 g，库存用 kg → 需要 /1000）
- 金额单位一致性（元 vs 万元，是否有标注）
- 重量/体积/数量的小数位数是否统一

**15. 时间显示一致**（代码审查为主）

日期时间格式在全 App 统一：

代码检查：
- 统一格式检查：是否都用 `YYYY-MM-DD HH:mm` 还是有混用 `DD/MM/YYYY`
- 是否有统一的日期格式化工具函数（`dayjs` / `date-fns`）还是各屏幕自行格式化
- 时区处理：服务端 UTC vs 前端本地时区是否正确转换
- "刚刚 / 5 分钟前 / 昨天" 等相对时间的边界逻辑

**16. 并发保护**（代码审查为主）

多人同时编辑的乐观锁检查：

代码检查：
- Entity 是否有 `@Version` 字段（或 `updatedAt` 用于 ETag）
- 提交编辑时是否携带版本号（`version` / `updatedAt`）
- 409 Conflict 响应时前端是否提示"数据已被他人修改，请刷新后重试"
- 关键操作（审批、状态变更）是否有防重复提交（`loading` 期间按钮禁用）

#### 维度轮转策略

⚠️ **每轮必须声明**: 在启动 Wave Agent 前，主 Agent 必须先声明本轮重点深挖的 3 个维度。

轮转建议（非强制顺序，主 Agent 可根据上轮发现调整）:
- 奇数轮: 组件质量 + 类型安全 + API 集成
- 偶数轮: 性能 + 安全性 + RN-Web 兼容性
- 每 3 轮: 无障碍 + 响应式 + 国际化就绪
- 每 2 轮: 业务逻辑（16 项检查，需要主 Agent 浏览器配合，每轮选 3-5 项深挖）
- 代码重复: 每轮都检查（轻量级，不占名额）

声明格式（在摘要中体现）:
```
本轮维度重点: [组件质量, 类型安全, API 集成] + 代码重复(常驻)
```

Wave Agent Prompt 中必须包含: "本轮重点深挖: {3 个维度名}，其余维度做基础扫描"

### Wave Agent Prompt 模板

```
你是 React Native 全栈质量分析师。深度分析以下屏幕。
⚠️ 你不能使用任何浏览器工具 — 只能读取文件和截图。

## 屏幕清单
| screenId | 名称 | 模块 | L1 结果 | 状态 | 交互提示 |
|----------|------|------|---------|------|----------|
| {screenId} | {name} | {module} | {l1_result} | {status} | {hints} |

## 浏览器发现
- Console 错误: {console_errors}
- Network 失败: {network_failures}

## 模块→代码路径映射
(嵌入下方完整路径映射表)

## 分析维度
本轮重点深挖: {3 个维度名}，其余维度做基础扫描
(上述 11 项维度表)

## 业务逻辑维度（代码审查部分）
如果本轮维度含"业务逻辑"，额外检查:
- 表单 onSubmit 是否有 validation（必填/格式/边界）
- 创建/编辑后是否 refetch/invalidate 刷新列表
- 删除后是否从列表移除
- 状态流转后 UI 是否同步（按钮变灰/文字变化）
- 空数据时是否有 EmptyState 组件
- isError 时是否有重试按钮
- 跨角色数据联动: 检查不同角色屏幕是否查同一 API
- 溯源链: batchId/materialBatchId 是否在各环节正确传递
- 批次状态机: 非法状态流转是否被阻止（UI + API 双校验）
- 库存数值: 入库/出库/投料后数量变化是否正确、负库存是否阻止
- 预警触发: 阈值判断逻辑 + 预警去重 + 已读状态
- 报表准确性: KPI 计算逻辑、时间范围、百分比精度
- 搜索/筛选: 参数拼接、防抖、组合筛选 AND 逻辑
- 分页: page/size 递增、keyExtractor 唯一、下拉刷新重置
- 计量单位: 同一物料跨屏幕单位一致、转换逻辑正确
- 时间格式: 统一格式化函数、时区转换、相对时间边界
- 并发保护: @Version 字段、409 Conflict 处理、防重复提交

## NATIVE_ONLY 屏幕
如有 webCompatible=false 的屏幕，仅做源代码分析，结果最高到 PASS_CODE_ONLY。

## 输出要求
对每个屏幕输出:
1. 深度结果: PASS_DEEP / NEEDS_OPTIMIZATION / PASS_CODE_ONLY
2. 发现的问题 (按 P0/P1/P2 分级)
3. 优化机会 (即使没有 bug 也要找改进空间)
4. 优化建议含具体文件路径和行号
5. 如有 P0/P1 问题: 给出具体的修复代码片段
6. 如有业务逻辑问题: 标注影响的角色和流程、所属检查项编号 (1-16)
```

### 模块→代码路径速查

| 模块 | 屏幕目录 | 导航器 | API 服务 | 后端 |
|------|---------|--------|---------|------|
| factory-admin/home | `screens/factory-admin/home/` | `FAHomeStackNavigator` | `services/api/production.ts` | Java: ProductionBatchController |
| factory-admin/ai | `screens/factory-admin/ai-analysis/` | `FAAIStackNavigator` | `services/api/aiAnalysis.ts` | Java: IntentExecutorService |
| factory-admin/management | `screens/factory-admin/management/` + `screens/management/` | `FAManagementStackNavigator` | various | various |
| factory-admin/inventory | `screens/factory-admin/inventory/` | `FAManagementStackNavigator` | `services/api/sales.ts`, `services/api/procurement.ts` | Java: SalesController, ProcurementController |
| factory-admin/profile | `screens/factory-admin/profile/` | `FAProfileStackNavigator` | — | — |
| factory-admin/reports | `screens/reports/` | `FAReportsStackNavigator` | `services/api/report.ts` | Java: ReportController |
| smartbi | `screens/smartbi/` | `SmartBIStackNavigator` | `services/api/smartbi.ts` | Python: smartbi/ |
| processing | `screens/processing/` | `ProcessingStackNavigator` | `services/api/production.ts` | Java: ProductionBatchController |
| attendance | `screens/attendance/` | `AttendanceStackNavigator` | `services/api/attendance.ts` | Java: AttendanceController |
| dispatcher | `screens/dispatcher/` | `DSHomeStack`, `DSPlanStack`, `DSAIStack`, `DSPersonnelStack`, `DSProfileStack` | `services/api/scheduling.ts` | Java: SchedulingController |
| workshop-supervisor | `screens/workshop-supervisor/` | `WSHomeStack`, `WSBatchesStack`, `WSWorkersStack`, `WSEquipmentStack`, `WSProfileStack` | `services/api/production.ts` | Java: ProductionBatchController |
| warehouse | `screens/warehouse/` | `WHHomeStack`, `WHInboundStack`, `WHOutboundStack`, `WHInventoryStack`, `WHProfileStack` | `services/api/warehouse.ts` | Java: MaterialController, InventoryController |
| hr | `screens/hr/` | `HRHomeStack`, `HRStaffStack`, `HRAttendanceStack`, `HRWhitelistStack`, `HRProfileStack` | `services/api/hr.ts` | Java: HRController |
| quality-inspector | `screens/quality-inspector/` | `QualityInspectorNavigator` | `services/api/quality.ts` | Java: QualityController |
| platform | `screens/platform/` | `PlatformStackNavigator` | `services/api/platform.ts` | Java: PlatformController |
| restaurant | `screens/restaurant/` | `RRecipeStack`, `RRequisitionStack`, `RWastageStack`, `RStocktakingStack` | `services/api/restaurant.ts` | Java: RestaurantController |
| operator | `screens/processing/` + `screens/work/` | `OperatorNavigator` | `services/api/production.ts` | Java: ProductionBatchController |
| sales-manager | `screens/factory-admin/inventory/` + `screens/management/` | `SalesManagerNavigator` | `services/api/sales.ts` | Java: SalesController |
| procurement-manager | `screens/factory-admin/inventory/` + `screens/management/` | `ProcurementManagerNavigator` | `services/api/procurement.ts` | Java: ProcurementController |
| viewer | `screens/factory-admin/inventory/` | `ViewerNavigator` | `services/api/sales.ts` | Java: SalesController |
| profile (通用) | `screens/profile/` | `ProfileStackNavigator` | — | — |
| traceability | `screens/traceability/` | `ProcessingStackNavigator` | `services/api/traceability.ts` | Java: TraceabilityController |
| auth | `screens/auth/` | `AppNavigator` | `services/api/auth.ts` | Java: AuthController |

> **所有路径省略 `frontend/CretasFoodTrace/src/` 前缀**。深度分析时，先按此表定位对应文件再读取代码。

### Wave 结果处理 — 强制检查点

收集所有 Wave Agent 结果后，**必须按顺序执行以下检查点**:

#### 检查点 1: agent-team 评估（每轮必执行）

⚠️ **不可跳过**。根据结果选择模式:

**模式 A — 修复模式** (有 P0/P1 问题 或 ≥3 屏幕有优化建议):
```
/agent-team 评估本轮 {N} 个屏幕的检查结果并生成修复方案:
  - Wave Agent 发现: {汇总所有 agent 的发现}
  - 浏览器截图审查: {本轮截图摘要}
  - 要求:
    1. 多角色评估 (QA/UI/RN专家) 确认问题优先级
    2. 对 P0/P1 问题生成**可直接应用的修复代码**
    3. 对 P2 优化生成具体改进方案 (文件+代码)
    4. 检查跨屏幕一致性 (组件复用、样式统一)
  - CODEBASE_GROUNDING=true
```

agent-team 返回后:
1. ⚠️ **立即执行 /compact** 压缩上下文
2. 直接应用 P0/P1 修复代码 (每轮最多 3 个文件)
3. P2 优化记录到状态文件

**模式 B — 优化发现模式** (全部 PASS_DEEP，无 P0/P1):
```
/agent-team 优化发现 — 本轮重点维度: {本轮声明的 3 个维度}
  - 从本轮重点维度深挖优化机会
  - 对比同模块屏幕的实现差异，找可统一的模式
  - 找出"能做但没做"的改进 (如: 缺少 loading skeleton、空状态可以更友好、缺少 pull-to-refresh)
  - CODEBASE_GROUNDING=true
```

**模式 C — 系统性评估** (主 Agent 判断需要，无频率限制):
主 Agent 根据以下信号自主决定:
- 多个屏幕出现相同模式的问题
- 某模块代码质量明显下降
- 跨屏幕 UI 不一致加剧
- 上轮 agent-team 建议未被充分执行

#### 检查点 2: 竞品调研（iteration % 5 == 0 时必须触发）

⚠️ **硬性触发**: 当 `currentIteration % 5 == 0` 时，必须启动后台竞品调研。

```
/agent-team 竞品调研 + 设计优化 (run_in_background=true):
  - 针对本轮检查的模块，对标行业最佳实践:
    - RN UI 框架: React Native Paper, Gluestack UI, Tamagui, NativeWind
    - 食品溯源 App: Catman, FoodLogiQ, SafetyChain Mobile
    - 工厂管理 App: 用友U8+ Mobile, 金蝶云星辰 App
    - 仓储 App: WMS mobile (Manhattan, Blue Yonder)
  - BROWSER_RESEARCH=true 浏览器截图对比
  - 输出要求:
    1. 竞品截图 vs 我们的截图，逐项对比差距
    2. 可直接落地的改进方案（具体到文件、组件、代码）
    3. 按影响力排序: 用户体验提升大的优先
```

结果判定：
- **PASS_DEEP**: 无 P0/P1 问题
- **NEEDS_OPTIMIZATION**: 有具体可落地的改进方案
- **PASS_CODE_ONLY**: NATIVE_ONLY 屏幕仅做了代码分析

---

## Step 3.5: 跨屏幕检查（每 10 轮执行一次，即 iteration % 10 == 0）

- **响应式测试**: `browser_resize` 到 375px 宽度（iPhone SE），抽查 3 个屏幕截图
- **底部 Tab 一致性**: 遍历所有 Tab，确认图标/文字/高亮状态正确
- **导航流畅性**: 从首页→三级页面→返回首页，验证导航堆栈正确
- **跨屏幕组件一致性**: 对比同模块 2-3 个列表页的卡片样式是否统一
- 检查完成后 `browser_resize` 恢复到 414px（iPhone 14 Pro）

---

## Step 4: 并行验证（修改了文件时必须执行）

应用修复后，在**一条消息中同时**发出以下并行验证:

1. **Bash**: `cd frontend/CretasFoodTrace && npx tsc --noEmit 2>&1 | tail -30` — TypeScript 检查
2. **Bash**: `cd frontend/CretasFoodTrace && npx expo export --platform web 2>&1 | tail -30` — Expo Web 构建检查
3. **Agent (sonnet)**: 审查本轮修改的文件 — 检查类型安全、组件规范、安全性

全部通过 → Step 5。任一失败 → 修复 → 重新并行验证。

如果修改了 Java 后端文件: 记录到 issue（标记 `needsBuild: true`），下次部署时验证。

---

## Step 5: 写回状态文件

更新 `.claude/ralph-state/rn-app-progress.json`：

1. 更新每个检查过的屏幕的 `status`、`lastCheckedIteration`、`checksCount`
2. 做过深度分析的屏幕更新 `lastDeepAnalysis` 为当前迭代号
3. 更新 `currentRole` 为本轮使用的角色
4. 重新计算 `summary` 统计数据
5. 保存文件

### 状态文件格式

```json
{
  "version": 1,
  "currentIteration": 1,
  "currentRole": "factory_admin1",
  "summary": {
    "total": 170,
    "visited": 0,
    "passBasic": 0,
    "passDeep": 0,
    "passCodeOnly": 0,
    "hasIssues": 0,
    "needsOptimization": 0,
    "fixed": 0,
    "error": 0,
    "nativeOnly": 0,
    "totalOptimizations": 0,
    "totalIssuesFound": 0,
    "totalIssuesFixed": 0
  },
  "screens": [
    {
      "screenId": "fa-home",
      "name": "FAHomeScreen",
      "module": "factory-admin/home",
      "role": "factory_super_admin",
      "status": "UNVISITED",
      "webCompatible": true,
      "lastCheckedIteration": null,
      "lastDeepAnalysis": null,
      "checksCount": 0,
      "issues": [],
      "optimizations": []
    }
  ]
}
```

### Status 流转

```
UNVISITED → 首次检查 → PASS_BASIC / HAS_ISSUES / ERROR
HAS_ISSUES → 修复代码 → FIXED → 回归验证 → PASS_BASIC
PASS_BASIC → 深度分析 → PASS_DEEP / NEEDS_OPTIMIZATION
NEEDS_OPTIMIZATION → 优化应用 → PASS_DEEP
PASS_DEEP → 下次轮转再分析 → 可能发现新优化点 → NEEDS_OPTIMIZATION

NATIVE_ONLY 屏幕:
UNVISITED → 代码分析 → PASS_CODE_ONLY / NEEDS_OPTIMIZATION
```

### Issue / Optimization 记录格式

```json
{
  "description": "FlatList 缺少 keyExtractor",
  "severity": "P1",
  "foundInIteration": 3,
  "fixedInIteration": 5,
  "status": "FIXED",
  "file": "frontend/CretasFoodTrace/src/screens/factory-admin/home/FAHomeScreen.tsx"
}
```

---

## Step 6: 输出本轮摘要

在本轮结束时输出摘要：

```
## 轮次 N 摘要
- 当前角色: factory_admin1
- 检查屏幕: fa-home, fa-today-production, fa-batch-detail, ...
- 动态分组: Group A [screen1,screen2,screen3], Group B [screen4,screen5]
- 基础检查: X PASS / Y ISSUES / Z ERROR
- 本轮维度重点: [维度1, 维度2, 维度3] + 代码重复(常驻)
- Wave Agent: {N} 个后台 agent (general-purpose)，全部完成
- NATIVE_ONLY: {N} 个屏幕仅代码分析
- agent-team: 模式 A/B/C — {简述结果}
- 竞品调研: ✅ 已触发(后台) / ⏭️ 非触发轮 / ❌ 遗漏(需补)
- 修复/优化: 修改了 file1.tsx, file2.tsx
- 总进度: visited XX/170, passDeep XX/170, passCodeOnly XX, totalOptimizations XX
```

⚠️ **自检**: 如果以下任一项未执行，在摘要中标注 ❌ 并在下一轮补执行:
- [ ] Wave Pipeline 是否真正流水线化（边访问边启动 agent）
- [ ] Wave Agent 是否使用 general-purpose 类型
- [ ] agent-team 是否执行（每轮必须）
- [ ] 竞品调研是否按 % 5 触发
- [ ] 是否声明了本轮维度重点
- [ ] 后台 Agent 是否未使用浏览器工具

**然后立即进入下一轮（回到 Step 0）。绝不输出 `<promise>` 标签。**

---

## 关键约束

1. **每轮 5-8 个屏幕** — 不多不少，避免超时
2. **每轮最多修改 3 个文件** — 控制变更范围
3. **永不主动结束** — 不输出 `<promise>`，由 max_iterations=100 终止
4. **状态文件是唯一真相** — 所有进度通过 JSON 文件传递
5. **深度分析不可跳过** — 即使 PASS_BASIC 的屏幕也必须做深度分析
6. **浏览器工具唯一**: 只用 `mcp__playwright-rn__browser_*`
7. **后台 Agent 禁止浏览器**: 后台 Agent 绝不调用任何 `browser_*` 工具
8. **角色轮换**: 按迭代号自动切换角色，确保覆盖所有角色视角
9. **NATIVE_ONLY 屏幕**: 不导航，只做代码分析，结果最高到 `PASS_CODE_ONLY`
