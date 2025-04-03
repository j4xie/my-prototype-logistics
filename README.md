# 食品溯源系统

## 项目概述

本系统是一个基于Web的食品溯源平台，旨在提供从农场到餐桌的全链条食品追踪系统，确保食品安全和透明度。系统支持多种角色（农场主、加工商、物流方、零售商和消费者）访问和管理相关溯源数据。

## 系统功能

- **产品溯源**：扫码查询产品完整溯源信息
- **多级溯源链**：支持从种植/养殖、加工、物流到零售的全过程记录
- **区块链认证**：关键溯源数据上链，确保数据不可篡改
- **数据可视化**：通过地图和图表直观展示溯源信息
- **用户权限管理**：基于角色的权限控制系统
- **移动端兼容**：响应式设计，支持各种设备访问

## 系统架构

```
/
├── pages/                    # 页面文件
│   ├── admin/                # 管理员界面
│   ├── auth/                 # 认证相关页面
│   ├── farming/              # 农场管理界面
│   ├── processing/           # 加工环节界面
│   ├── logistics/            # 物流管理界面
│   ├── trace/                # 溯源查询界面
│   ├── profile/              # 用户资料界面
│   └── home/                 # 首页和导航
├── components/               # 公共组件
│   ├── trace-core.js         # 核心功能组件
│   ├── trace-ui.js           # UI组件
│   ├── trace-map.js          # 地图组件
│   ├── trace-blockchain.js   # 区块链接口
│   ├── trace-scanner.js      # 扫码组件
│   └── trace-ui-components.js # UI组件库
├── assets/                   # 静态资源
│   ├── icons/                # 图标资源
│   ├── styles/               # 样式文件
│   └── images/               # 图片资源
├── validation/               # 测试和验证
│   ├── scripts/              # 验证脚本
│   └── reports/              # 验证报告
└── README.md                 # 本文档
```

## 快速开始

1. 确保已安装Node.js（v14或更高版本）
2. 安装依赖项：

```bash
npm install
```

3. 启动本地服务器：

```bash
npm start
```

4. 访问系统：

```
http://localhost:8080/
```

## 用户角色与权限

- **系统管理员**：管理用户、角色和系统配置
- **农场管理员**：记录和管理种植/养殖信息
- **加工方**：记录加工环节信息
- **物流方**：记录运输和存储信息
- **零售商**：管理产品上架和销售信息
- **消费者**：查询产品溯源信息

## 主要模块说明

### 认证模块
- 用户登录/注册
- 角色分配
- 权限管理

### 农场管理模块
- 种植/养殖记录
- 农事活动记录
- 环境监测数据

### 加工模块
- 原料接收记录
- 加工工艺记录
- 质检记录

### 物流模块
- 运输信息记录
- 仓储信息记录
- 配送追踪

### 产品溯源模块
- 产品溯源码生成
- 溯源信息查询
- 溯源证书生成

### 管理后台
- 用户管理
- 系统配置
- 数据导入/导出

## 按钮升级工具

作为系统交互体验优化的一部分，我们开发了按钮升级工具，用于提升系统中所有按钮组件的用户体验和可访问性。

### 按钮升级功能

- **自动注入按钮升级脚本**：为所有HTML页面自动注入按钮升级脚本
- **按钮自动升级**：
  - 为按钮添加唯一ID
  - 添加无障碍属性（ARIA标签）
  - 添加视觉反馈效果（点击、悬停效果）
  - 支持键盘导航
- **升级报告生成**：生成HTML和JSON格式的按钮升级报告

### 运行按钮升级工具

执行以下命令启动按钮升级流程：

```bash
node validation/scripts/run-button-upgrade.js
```

该命令将执行以下操作：
1. 检查并安装所需依赖
2. 为系统中的HTML页面注入自动升级脚本
3. 启动本地服务器（如果尚未运行）
4. 备份现有的按钮报告（如果有）
5. 运行升级报告生成器

### 验证按钮升级效果

要单独验证按钮升级效果（不执行升级），可运行：

```bash
node validation/scripts/validate-button-improvements.js
```

### 按钮组件API

#### 手动升级单个按钮

```javascript
// 引入组件库
const { upgradeExistingButton } = window.traceUIComponents;

// 获取按钮元素
const buttonElement = document.getElementById('myButton');

// 升级按钮
upgradeExistingButton(buttonElement);
```

#### 手动升级页面中的所有按钮

```javascript
// 引入组件库
const { upgradeAllButtons } = window.traceUIComponents;

// 升级所有按钮
upgradeAllButtons();
```

#### 创建符合升级标准的新按钮

```javascript
// 引入组件库
const { createButton } = window.traceUIComponents;

// 创建按钮
const button = createButton({
  text: '提交',
  type: 'primary',
  onClick: () => console.log('按钮点击'),
  accessibilityLabel: '提交表单'
});

// 将按钮添加到容器
document.getElementById('buttonContainer').appendChild(button);
```

## 贡献指南

欢迎提交问题报告和改进建议。如需提交代码贡献，请遵循以下步骤：

1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add your feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 提交Pull Request

## 版本历史

- **1.0.0**：初始版本，提供基本的食品溯源功能
- **2.0.0**：增加区块链认证和数据可视化功能
- **2.1.0**：添加按钮升级工具，提升系统交互体验 