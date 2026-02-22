# /e2e-native Skill 设计方案

**日期**: 2026-02-21
**模式**: Full | 语言: Chinese | Grounding: ENABLED

---

## 执行摘要

- **建议**: 采用混合模式（脚本+文本指令）设计 `/e2e-native` Skill，包含 5 个子命令 `scan/inject/gen/run/report`，以 Maestro 为 E2E 测试框架，优先覆盖登录+5 个核心屏幕作为 PoC
- **信心**: 中等 — 架构方向三方共识，但 macOS APK 构建链和组件 testID 透传两大前置条件未解决
- **核心风险**: 当前 build-android-apk Skill 为 Windows 专用，macOS 无法直接执行 `run` 子命令；NeoButton 等封装组件需修改定义才能透传 testID
- **时间影响**: PoC 阶段（5 屏幕）约 3-5 天；若需解决 APK 构建+组件修改，额外 2-3 天
- **工作量**: SKILL.md <400 行 + 3 脚本 + 3 参考文档；testID 注入需触及 6+ 种组件类型、376 个屏幕文件（全量覆盖为长期目标）

---

## 共识与分歧

| 议题 | 研究员发现 | 分析师建议 | 批评者挑战 | 最终裁定 |
|------|-----------|---------|--------|---------|
| **Skill 架构模式** | 混合模式（脚本低自由度+文本指令高自由度）；Phase 0-5 执行流程 | 推荐混合模式 C 方案 | 未对架构提出挑战 | **混合模式** — 三方共识 |
| **testID 覆盖率现状** | 生产代码 testID=0 处，376 个 .tsx 屏幕 | scan 正则扫描可达 90% | 正则遗漏 NeoButton(68处)、Paper(142处) 等至少 6 种组件 | **scan 覆盖率从 90% 下调至 60-70%**；必须扩展组件模式清单 |
| **inject 注入策略** | jscodeshift 可批量但语义差 | 推荐逐文件编辑 | NeoButton 等封装组件需修改组件定义本身 | **逐文件编辑为主，但必须先处理封装组件定义** |
| **优先覆盖范围** | 8 角色 Navigator、SmartBI 14 屏幕 | 5 个核心屏幕优先 | 5/376=1.3% 无法验证完整业务路径 | **5 屏幕作为 PoC 可接受**，应选能构成完整业务流的屏幕组合 |
| **APK 构建** | build-android-apk 为 Windows 专用；EAS Build 3 profile 已配 | run 子命令依赖 APK | macOS 无法执行 Windows 构建脚本，最关键遗漏 | **必须解决 macOS 构建路径**；EAS Build 是最可行方案 |
| **登录流程建模** | 登录为两步结构（landing→login 同组件状态切换） | 未特别处理 | 需元素级操作而非页面级断言 | **login.yaml 必须基于元素可见性判断状态** |
| **测试框架选择** | Maestro runFlow + env 参数化 | 推荐 Maestro | Playwright MCP 先例与 Maestro 差异大 | **采用 Maestro** — 三方一致 |

---

## 详细设计

### Skill 文件布局

```
.claude/skills/e2e-native/
├── SKILL.md                              # 主指令（<400 行）
├── scripts/
│   ├── scan-testids.py                   # testID 覆盖率扫描（正则匹配 6+ 组件类型）
│   ├── run-maestro.sh                    # Maestro 执行封装（设备检测、超时、截图）
│   └── gen-report.py                     # 聚合 Maestro 输出 → Markdown 报告
└── references/
    ├── testid-naming-convention.md       # testID 命名规范 + 核心屏幕清单
    ├── maestro-flow-templates.md         # Maestro YAML 模板（登录、导航、表单）
    └── role-flow-matrix.md               # 8 角色 × 屏幕 × 优先级矩阵
```

### 子命令设计

| 输入 (`$ARGUMENTS`) | 动作 | 自由度 | 核心工具 |
|---------------------|------|--------|----------|
| _(空)_ | 显示帮助：列出所有子命令和用法 | -- | -- |
| `scan` | 扫描全部 .tsx 文件的 testID 覆盖率 | 低（脚本） | `scripts/scan-testids.py` |
| `scan --fix` | 扫描 + 自动为缺失组件生成 testID 建议 | 混合 | 脚本扫描 + Claude 命名审核 |
| `inject {screen}` | 为指定屏幕注入 testID（Claude 编辑） | 高（文本指令） | Read + Edit |
| `inject --batch {module}` | 批量为模块下所有屏幕注入 testID | 混合 | 脚本列文件 + Claude 逐文件编辑 |
| `gen {role}` | 为指定角色生成 Maestro 测试流 YAML | 高（文本指令） | Read + Write |
| `gen all` | 为所有 8 角色生成基础测试流 | 高（文本指令） | Read + Write |
| `run {role}` | 执行指定角色的 Maestro 测试流 | 低（脚本） | `scripts/run-maestro.sh` |
| `run all` | 顺序执行所有角色的测试流 | 低（脚本） | `scripts/run-maestro.sh` |
| `report` | 生成测试报告 | 低（脚本） | `scripts/gen-report.py` |

### 组件 testID 目标类型（6+ 种）

| 组件类型 | 出现频次 | 文件数 | testID 策略 |
|---------|---------|--------|------------|
| ScrollView | 1200+ | 220+ | 直接添加 testID |
| TextInput | 649 | 134 | 直接添加 testID |
| TouchableOpacity | 高频 | 广泛 | 直接添加 testID |
| Pressable | 199 | 23 | 直接添加 testID |
| NeoButton (自定义封装) | 68 | 13 | **先修改组件定义透传 testID** |
| Paper IconButton/FAB | 142 | 30 | 验证兼容性后添加 |
| FlatList/SectionList | 121 | 59 | 容器级 testID |

### testID 命名规范

```
格式: {screen}-{element}-{semantic}
规则:
  - 全小写，连字符分隔
  - screen: 屏幕名缩写（login/fa-home/ds-plan/qi-scan 等）
  - element: 元素类型（input/btn/card/list/modal/scroll 等）
  - semantic: 语义角色（username/password/submit/cancel/filter 等）

前缀缩写:
  fa(factory-admin), ds(dispatcher), qi(quality-inspector),
  wh(warehouse), ws(workshop), hr(hr), pa(platform-admin)

示例:
  login-username-input
  login-submit-btn
  fa-home-smartbi-card
  ds-plan-create-btn
  wh-inbound-filter-input
```

### Maestro Flow 目录结构

```
tests/e2e-native/
├── .maestro/
│   ├── config.yaml              # appId: com.cretas.foodtrace
│   ├── flows/
│   │   ├── common/
│   │   │   ├── _login.yaml      # 登录子流（两步状态切换，元素级操作）
│   │   │   ├── _logout.yaml
│   │   │   └── _wait_for_app.yaml
│   │   ├── factory-admin/
│   │   │   ├── home.yaml
│   │   │   └── smartbi-dashboard.yaml
│   │   ├── dispatcher/
│   │   │   ├── home.yaml
│   │   │   └── plan-create.yaml
│   │   ├── quality-inspector/
│   │   │   └── home.yaml
│   │   ├── warehouse/
│   │   │   └── home.yaml
│   │   └── ...（8 角色目录）
│   └── screenshots/             # 失败截图保存
└── reports/                     # 测试报告输出
```

### 登录子流模板（关键 — 同组件状态切换）

```yaml
# flows/common/_login.yaml
---
# Phase 1: Landing 视图 → 点击登录按钮切换到 LoginForm 视图
- assertVisible:
    id: "landing-login-btn"
  timeout: 10000
- tapOn:
    id: "landing-login-btn"

# Phase 2: LoginForm 视图 → 填写表单并提交
- assertVisible:
    id: "login-username-input"
  timeout: 5000
- tapOn:
    id: "login-username-input"
- clearText
- inputText: ${USERNAME}
- tapOn:
    id: "login-password-input"
- clearText
- inputText: ${PASSWORD}
- tapOn:
    id: "login-submit-btn"

# Phase 3: 验证登录成功 — 首页根容器可见
- assertVisible:
    id: "home-screen-root"
  timeout: 15000
```

### 执行阶段设计

**Phase 0: 环境检查**
- 检测 Maestro CLI（`maestro --version`）
- 检测设备/模拟器（`adb devices` / `xcrun simctl list`）
- 检测 APK 已安装（`adb shell pm list packages | grep com.cretas.foodtrace`）
- 失败时给出安装指引（禁止降级处理）

**Phase 1: testID 准备**（scan/inject）
- scan 正则匹配 6+ 组件类型
- inject 分两步：先修改封装组件定义 → 再逐文件添加 testID

**Phase 2: Flow 生成**（gen）
- 读取 references/ 模板和矩阵
- 按角色生成 YAML，所有选择器使用 `id:`，禁止 text 匹配

**Phase 3: 执行**（run）
- 设备检测 → 启动 app → `maestro test flows/{role}/`
- 单流超时 60s，总超时 10min
- 失败截图保存到 screenshots/

**Phase 4: 报告**（report）
- 解析 Maestro 输出 → Markdown 报告
- 格式与 smartbi-test-e2e Phase 4 对齐

### 错误处理场景

| 场景 | 处理动作 |
|------|---------|
| Maestro CLI 未安装 | 输出安装命令 `curl -Ls "https://get.maestro.mobile.dev" \| bash`，终止 |
| 无设备/模拟器 | 提示启动模拟器或连接真机，终止 |
| APK 未安装 | 提示 `adb install <apk-path>` 或 `eas build --profile preview`，终止 |
| 登录失败 | 截图 + 检查测试账号有效性 + 提示手动验证 |
| 元素未找到 | 截图 + 检查 testID 是否已注入 + 提示运行 `scan` |
| Flow 超时 (>60s) | 截图 + 标记 TIMEOUT，跳过到下一 Flow |
| Maestro 崩溃 | 保存日志到 reports/，提示重启模拟器 |

### 与现有 Skill 的协作

```
/build-android-apk  →  构建 APK（Windows）
/eas build preview   →  构建 APK（macOS/CI，推荐）
                          ↓
/e2e-native scan    →  扫描 testID 覆盖率
/e2e-native inject  →  注入缺失的 testID
                          ↓
/e2e-native gen     →  生成 Maestro YAML 测试流
                          ↓
/e2e-native run     →  执行原生 E2E 测试
                          ↓
/e2e-native report  →  生成测试报告
                          ↓
/integration-testing →  统一集成测试调度（可选接入）
```

### 环境变量配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MAESTRO_APP_ID` | `com.cretas.foodtrace` | 应用包名 |
| `MAESTRO_TIMEOUT` | `60000` | 单流超时（ms） |
| `APK_PATH` | _(空)_ | 手动指定 APK 路径 |
| `DEVICE_ID` | _(空)_ | 指定设备 ID |
| `ROLE` | `factory_admin` | 默认测试角色 |

---

## 信心评估

| 结论 | 信心 | 依据 | 证据基础 |
|------|------|------|---------|
| 混合模式 Skill 架构可行 | ★★★★★ | 三方共识，项目内有 2 个成熟先例 | 代码验证 + 外部共识 |
| Maestro 作为 RN E2E 框架 | ★★★★☆ | 三方推荐，但项目无使用先例 | 仅外部来源 |
| scan 正则覆盖率达 60-70% | ★★★☆☆ | 批评者验证发现组件类型远多于预期 | 代码验证 |
| inject 逐文件编辑可行 | ★★★☆☆ | 原生组件可行，封装组件需额外修改 | 代码验证 |
| 5 屏幕 PoC 可验证架构 | ★★★★☆ | 分析师和批评者均认可 PoC 定位 | 代码验证 + 外部共识 |
| run 子命令可在 macOS 执行 | ★★☆☆☆ | build-android-apk 为 Windows 专用，需 EAS Build | 代码验证（反面） |
| 登录 flow 可用 Maestro 实现 | ★★★☆☆ | 同组件状态切换需元素级操作 | 代码验证 |
| report 生成 | ★★★★★ | 纯数据处理 | 外部共识 |

---

## 可执行建议

### 立即执行

1. **创建 Skill 骨架** — `.claude/skills/e2e-native/` 目录结构：SKILL.md + scripts/ + references/
2. **扩展组件模式清单** — scan 脚本覆盖 6+ 种组件类型（含 NeoButton、Paper 组件）

### 短期执行（1-2 周）

3. **解决封装组件 testID 透传** — 审计 NeoButton 等自定义组件，添加 testID prop 透传（3-5 个文件）
4. **编写 _login.yaml 并实测** — 基于元素可见性编写登录 flow，验证 Maestro 可行性
5. **为 5 个 PoC 屏幕注入 testID** — EnhancedLoginScreen + FAHomeScreen + SmartBIHomeScreen + DSHomeScreen + WHHomeScreen

### 条件执行

6. **若 macOS 需构建 APK** — 使用 EAS Build（`eas build --profile preview --platform android`），或支持 `--apk <path>` 手动指定
7. **若 PoC 成功** — 渐进扩展：5 屏幕 → 30 核心屏幕 → 全量 376 屏幕
8. **若需 CI 集成** — GitHub Actions + EAS Build + Maestro Cloud

---

## 待解决问题

1. NeoButton 是否支持 `...rest` props 透传 testID？
2. EAS Build preview profile 是否可生成可安装 APK？
3. Maestro 对 Expo SDK 53+ 的兼容性如何？
4. react-native-paper 组件是否原生支持 testID？
5. 登录同组件状态切换的具体等待策略？
6. 是否完全禁止 text 选择器？

---

## 批评者关键发现

### 组件类型统计（代码验证）

| 组件 | 出现频次 | 文件数 | 分析师预估 | 实际情况 |
|------|---------|--------|-----------|---------|
| ScrollView | 1200+ | 220+ | ✅ 列入 | 最高频 |
| TextInput | 649 | 134 | ✅ 列入 | 高频 |
| Pressable | 199 | 23 | ✅ 列入 | 集中 platform 模块 |
| FlatList | 121 | 59 | ❌ 遗漏 | 需容器级 testID |
| Paper IconButton/FAB | 142 | 30 | ❌ 遗漏 | 第三方组件 |
| NeoButton | 68 | 13 | ❌ 遗漏 | 封装组件需修改定义 |

### 登录流程真实结构

EnhancedLoginScreen.tsx 内部有 LandingView（第 61-117 行）和 LoginFormView（第 120-269 行）两个子组件，通过 state 切换而非页面导航。Maestro 必须基于元素可见性断言而非页面跳转断言。

### macOS 构建路径缺失

build-android-apk Skill 完全依赖 Windows 路径（`cmd //c`、`C:/`、`gradlew.bat`），macOS 环境无法使用。EAS Build 是最可行替代方案。

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Browser explorer: OFF
- Total sources found: 24 (15 codebase, 9 external)
- Key disagreements: 4 resolved (scan 覆盖率、组件类型数量、inject 复杂度、APK 构建路径), 2 unresolved (Maestro Expo 53 兼容性、Paper testID 支持)
- Phases completed: Research → Analysis → Critique → Integration → Heal
- Fact-check: disabled (内部设计任务，无需事实验证)
- Healer: 5 checks passed, 0 auto-fixed ✅
- Competitor profiles: N/A
