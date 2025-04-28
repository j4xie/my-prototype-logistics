# 食品溯源系统

一个基于网页的食品溯源系统，用于跟踪农产品从农场到餐桌的整个过程。

## 功能特点

- 产品信息录入与管理
- 二维码生成与扫描
- 物流轨迹追踪
- 产品溯源查询
- 质量检测报告
- 数据统计与分析
- 农业/养殖数据采集与监控
- 数据趋势预测与分析

## 快速开始 (Getting Started)

### 环境要求

- Node.js (建议使用 LTS 版本)
- npm (通常随 Node.js 一起安装)

### 安装步骤

1.  **克隆仓库**:
    ```bash
    git clone https://github.com/yourusername/food-traceability-system.git
    cd food-traceability-system
    ```
2.  **安装依赖**:
```bash
    npm install
    ```

### 运行应用

使用以下命令启动开发服务器：

```bash
npm run start
```

服务器通常会启动在 `http://localhost:8080` 或 `http://localhost:8081` (根据端口占用情况)。它使用 `browser-sync`，可以自动监控文件变化并刷新浏览器。请留意终端输出获取确切的访问地址。

## 项目结构

```
.
├── assets/                # 存放全局静态资源 (CSS, JS, Images)
├── pages/                 # 存放所有 HTML 页面
│   ├── auth/              # 用户认证 (登录等)
│   ├── home/              # 主页与导航相关页面
│   ├── farming/           # 农业/养殖管理模块
│   ├── processing/        # 加工处理模块
│   ├── logistics/         # 物流运输模块
│   ├── trace/             # 核心溯源功能模块
│   ├── admin/             # 后台管理模块
│   ├── profile/           # 用户中心与设置
│   ├── demo/              # 示例/演示页面
│   ├── product-trace.html # (根目录) 面向消费者的产品溯源页
│   ├── coming-soon.html   # 待开发页面
│   └── _template.html     # 基础页面模板
├── scripts/               # 存放各种自动化、辅助脚本
│   ├── git/               # Git 操作快捷脚本
│   ├── debug/             # 调试工具脚本
│   └── validation/        # 页面验证相关脚本工具
├── validation/            # 存放验证测试相关的文件
│   ├── scripts/           # 核心验证测试脚本
│   ├── reports/           # 生成的验证报告
│   └── screenshots/       # 验证过程中可能产生的截图
├── tests/                 # 存放单元测试和集成测试 (使用 Jest) - [当前可能未完全实现]
├── components/            # (建议) 存放可复用的 UI 组件或 JS 模块
├── README.md              # 项目说明文件 (本文档)
├── package.json           # 项目依赖和脚本定义
└── ...                    # 其他配置文件 (如 .eslintrc, .gitignore, postcss.config.js 等)
```

## 开发工作流与脚本

### 核心脚本

-   **`npm run start`**: 启动开发服务器，支持热重载。
-   **`npm test`**: 运行所有单元和集成测试 (使用 Jest)。

### 实用工具脚本

为了简化开发流程，可以运行一次性设置脚本来配置快捷命令：

```bash
npm run setup:all
```
*   这将配置 Git 快捷命令 (方便版本控制) 和 调试工具 (方便浏览器调试)。

设置后，您可以使用如下命令 (示例，在 PowerShell 中):

-   **Git 快捷命令**:
    ```powershell
    g status        # git status
    g a             # git add .
    g c "message"   # git commit -m "message"
    g p             # git push
    gp "message"    # git add ., commit, push
    # ... 更多命令请查看 scripts/git/
    ```
-   **调试工具**:
    ```powershell
    debug           # 启动默认调试
    debug-chrome    # 使用Chrome启动调试
    debug-edge      # 使用Edge启动调试
    ```

## 测试与验证

### 单元/集成测试 (Jest)

```bash
# 运行所有测试 (Jest)
npm test

# 仅运行单元测试
npm run test:unit

# 仅运行集成测试
npm run test:integration
```
*注意: 当前项目的 Jest 测试可能仍在建设中。测试覆盖率报告位于 `coverage/` 目录。*

### UI/功能验证脚本

这些脚本用于检查页面元素的符合性、功能逻辑等。

#### 通用验证

```bash
# 运行所有验证测试 (综合性检查)
npm run validate
```

#### 按钮验证与修复

用于确保所有按钮符合项目定义的标准 (见"编码规范与指南"部分)。

-   **通用按钮 (所有页面)**:
    ```bash
    # 1. 验证所有按钮属性 (核心)
    npm run validate:buttons
    # 报告: validation/reports/button_improvements_report.(json|html)

    # 2. 自动修复不符合标准的按钮 (核心)
    npm run fix:buttons

    # 3. (高级/调试) 其他辅助脚本:
    #    - npm run fix:buttons:report   # 生成修复前报告
    #    - npm run validate:buttons:after-fix # 验证修复后
    #    - npm run validate:buttons:compare   # 对比修复前后
    #    - npm run fix:buttons:check        # 检查-修复-再检查流程
    ```
-   **农业页面按钮 (仅 pages/farming/)**:
    ```bash
    # 1. 验证农业页面按钮
    npm run validate:farming:buttons
    # 报告: validation/reports/farming_buttons_report.(json|html)

    # 2. 修复农业页面按钮
    npm run fix:farming:buttons

    # 3. (推荐) 一站式修复并验证农业页面按钮
    npm run fix:farming:all
    ```

#### 其他特定验证

```bash
# 验证页面核心功能
npm run validate:functionality

# 验证页面之间的导航跳转
npm run validate:navigation

# 检查页面引用的资源是否存在
npm run validate:resources

# 检查UI元素的基本结构和可见性
npm run validate:ui
```

## 应用概览

### 功能模块

本系统根据 `/pages` 目录下的文件结构，主要包含以下功能模块：

**1. 认证 (Auth)**
*   `login.html`: 用户登录页面。

**2. 核心溯源 (Trace)**
*   `trace-list.html`: 溯源批次或产品列表。
*   `trace-query.html`: 溯源查询入口页面。
*   `trace-detail.html`: 单个溯源批次或产品的详细信息展示。
*   `trace-edit.html`: 编辑溯源信息（可能用于管理员或特定角色）。
*   `trace-map.html`: 在地图上展示物流轨迹或地理位置。
*   `trace-certificate.html`: 展示相关的证书或检测报告。
*   `product-trace.html` (根目录): 可能是一个面向消费者的最终产品溯源展示页。

**3. 物流 (Logistics)**
*   `logistics-create.html`: 创建物流记录或运输任务。
*   `vehicle-monitor.html`: 车辆实时监控或状态查看。
*   `logistics-report.html`: 物流相关的报告或统计。
*   `sales-analytics.html`: 销售数据分析（与物流关联）。

**4. 加工 (Processing)**
*   `processing-quality.html`: 加工过程中的质量检测记录。
*   `processing-environment.html`: 加工环境数据记录（温度、湿度等）。
*   `processing-photos.html`: 加工过程照片上传或展示。
*   `processing-slaughter.html`: （特定行业）屠宰加工记录。
*   `process-detail.html`: 单个加工批次的详细信息。
*   `processing-reports.html`: 加工相关的报告。

**5. 农业/养殖 (Farming)**
*   `data-collection-center.html`: 农业数据采集的中心入口或仪表盘。
*   `qrcode-collection.html`: 通过扫描二维码采集数据。
*   `manual-collection.html`: 手动输入采集数据。
*   `auto-monitoring.html`: 自动化设备监控数据展示。
*   `data-verification.html`: 对采集到的数据进行审核或确认。
*   `farming-breeding.html`: 养殖过程记录（育种、饲喂等）。
*   `farming-monitor.html`: 养殖环境或其他指标监控。
*   `farming-vaccine.html`: 疫苗接种记录。
*   `create-trace.html`: 在农业/养殖环节创建溯源批次的起点。
*   **预测与分析 (子模块)**
    *   `prediction-analytics.html`: 数据预测结果展示与分析。
    *   `prediction-config.html`: 配置预测模型或参数。
    *   `model-management.html`: 管理预测模型。
    *   `indicator-detail.html`: 单个监控指标的详细历史数据或分析。

**6. 用户中心/设置 (Profile)**
*   `profile.html`: 用户个人信息展示与修改。
*   `settings.html`: 系统或个人设置。
*   `notifications.html`: 消息通知列表。
*   `help-center.html`: 帮助文档或支持中心。

**7. 管理后台 (Admin)**
*   `admin-dashboard.html`: 管理员仪表盘。
*   `admin-users.html` / `user-management.html`: 用户管理。
*   `admin-roles.html`: 角色与权限管理。
*   `admin-products.html` / `product-register.html`: 产品信息管理或注册。
*   `admin-templates.html`: 管理模板（可能是报告或录入模板）。
*   `data-import.html`: 数据批量导入功能。
*   `admin-system.html` / `admin-settings.html`: 系统级设置。
*   `system-logs.html`: 系统操作日志。

**8. 主页/导航 (Home)**
*   `home-selector.html`: 可能是一个根据用户角色或业务类型选择不同主页的入口。
*   `home-farming.html`: 农业/养殖模块的主页或仪表盘。
*   `home-processing.html`: 加工模块的主页或仪表盘。
*   `home-logistics.html`: 物流模块的主页或仪表盘。

**9. 其他**
*   `coming-soon.html`: 尚未开发的功能占位页面。
*   `_template.html`: 基础页面模板。
*   `demo/button-demo.html`: 按钮组件示例页面。

### 页面流转图 (Mermaid)

```mermaid
graph LR
    subgraph "用户认证"
        A[Login Page /auth/login.html] --> B{Role Check};
    end

    subgraph "主页/导航"
        B --> C[Home Selector /home/home-selector.html];
        C --> D_Farming[Farming Home /home/home-farming.html];
        C --> D_Processing[Processing Home /home/home-processing.html];
        C --> D_Logistics[Logistics Home /home/logistics-home.html];
        C --> D_Admin[Admin Dashboard /admin/admin-dashboard.html];
    end

    subgraph "农业/养殖"
        D_Farming --> F1[Data Collection Center /farming/data-collection-center.html];
        F1 --> F2_QR[QR Code Collection /farming/qrcode-collection.html];
        F1 --> F2_Manual[Manual Collection /farming/manual-collection.html];
        F1 --> F3_Monitor[Auto Monitoring /farming/auto-monitoring.html];
        F2_QR --> F4_Verify[Data Verification /farming/data-verification.html];
        F2_Manual --> F4_Verify;
        F4_Verify --> F1;
        D_Farming --> F5[Create Trace /farming/create-trace.html];
        F5 --> T1[Trace List /trace/trace-list.html];
        D_Farming --> F6_Pred[Prediction Analytics /farming/prediction-analytics.html];
        D_Farming --> F7_Models[Model Management /farming/model-management.html];
    end

    subgraph "核心溯源"
        T_Query[Trace Query /trace/trace-query.html] --> T2[Trace Detail /trace/trace-detail.html];
        T1 --> T2;
        T_Consumer[Consumer Scan QR] --> ProductTrace[Product Trace /product-trace.html];
    end

    subgraph "加工"
        D_Processing --> P1[Process Detail /processing/process-detail.html];
        D_Processing --> P2[Quality Check /processing/processing-quality.html];
        D_Processing --> P3[Photos /processing/processing-photos.html];
    end

    subgraph "物流"
        D_Logistics --> L1[Create Logistics /logistics/logistics-create.html];
        D_Logistics --> L2[Vehicle Monitor /logistics/vehicle-monitor.html];
        D_Logistics --> L3[Logistics Report /logistics/logistics-report.html];
    end

    subgraph "管理后台"
        D_Admin --> Adm_Users[User Management /admin/admin-users.html];
        D_Admin --> Adm_Roles[Role Management /admin/admin-roles.html];
        D_Admin --> Adm_Products[Product Management /admin/admin-products.html];
        Adm_Users --> Adm_User_Detail[User Detail /admin/user-management.html];
    end

    subgraph "用户中心"
        U1[Profile /profile/profile.html]
        U2[Settings /profile/settings.html]
        U3[Notifications /profile/notifications.html]
    end

    %% Links between main sections (Examples)
    F5 --> L1; %% Creating trace might trigger logistics creation
    P1 --> T2; %% Processing detail might link back to trace detail
    T2 --> U3; %% Trace events might generate notifications

    %% Navigation Links (Conceptual)
    D_Farming --> U1;
    D_Processing --> U1;
    D_Logistics --> U1;
    D_Admin --> U1;
```

## 编码规范与指南

### 按钮标准

为了保证代码质量、可测试性和用户体验，所有按钮元素（`<button>`, `<a role="button">`, `<input type="button">` 等）必须符合以下标准：

#### 1. 唯一ID

每个按钮必须有 **唯一** 的 `id` 属性。

```html
<button id="confirm-order-btn">确认订单</button>
```

**目的**: 便于自动化测试脚本定位元素，以及进行精确的 DOM 操作。

#### 2. 无障碍属性 (Accessibility)

按钮必须包含适当的无障碍属性，以确保屏幕阅读器和键盘用户可以正常使用。

- **`aria-label`**: 如果按钮文本不清晰或只有图标，必须提供 `aria-label` 来描述按钮功能。
- **`

## 按钮导航测试

为了测试按钮触发的页面导航，我们提供了专门的测试工具。这个工具会自动点击页面上的按钮，并检测是否发生了导航或者新窗口打开。

### 运行测试

```bash
npm run test:button-navigation
```

测试将生成详细的HTML报告，位于 `validation/reports/button_navigation_report.html`，以及JSON格式数据 `validation/reports/button_navigation_report.json`。

报告包含以下内容：
- 测试的页面列表
- 每个页面上找到的按钮
- 每个按钮点击后的导航状态
- 按钮导航测试的统计数据
- 页面截图和导航后的截图

这个工具特别适合检测那些不是通过`<a>`标签实现的导航，如JavaScript事件触发的页面跳转。