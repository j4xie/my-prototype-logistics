# 脚本清单

<!-- updated for: 项目重构阶段一 - 脚本文件整理 -->

## 构建脚本 (scripts/build/)

目前尚未包含脚本。

## 部署脚本 (scripts/deploy/)

目前尚未包含脚本。

## 开发脚本 (scripts/dev/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| run-test.ps1 | scripts/dev/run-test.ps1 | PowerShell脚本，用于运行网络加载测试 |
| run-test.bat | scripts/dev/run-test.bat | 批处理脚本，用于运行测试 |
| run-tests.bat | scripts/dev/run-tests.bat | 批处理脚本，用于运行所有测试 |
| start-app.ps1 | scripts/dev/start-app.ps1 | PowerShell脚本，用于启动应用服务器 |
| start-app.bat | scripts/dev/start-app.bat | 批处理脚本，用于启动应用服务器 |
| setup-debug-tools.ps1 | scripts/dev/setup-debug-tools.ps1 | PowerShell脚本，用于设置调试工具 |

### Git相关脚本 (scripts/dev/git/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| gitpull.bat | scripts/dev/git/gitpull.bat | 批处理脚本，用于从远程仓库拉取更新 |
| setup-git-scripts.ps1 | scripts/dev/git/setup-git-scripts.ps1 | PowerShell脚本，用于设置Git工作流脚本 |

### Git相关脚本 (scripts/dev/git/tools/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| git-tools.ps1 | scripts/dev/git/tools/git-tools.ps1 | PowerShell脚本，提供Git常用操作简化命令 |
| git-tools.bat | scripts/dev/git/tools/git-tools.bat | 批处理脚本，提供Git常用操作简化命令 |
| git-tools.sh | scripts/dev/git/tools/git-tools.sh | Shell脚本，提供Git常用操作简化命令 |
| README.md | scripts/dev/git/tools/README.md | Git工具脚本使用说明文档 |

### 调试脚本 (scripts/dev/debug/)

调试相关的脚本，用于应用程序的调试和故障排除。

## 数据处理脚本 (scripts/data/)

目前尚未包含脚本。

## 工具脚本 (scripts/utils/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| memory-stress-test.js | scripts/utils/memory-stress-test.js | 内存压力测试工具 |
| check-progress-ticks.js | scripts/utils/check-progress-ticks.js | 检查处理进度指示器 |
| fix-button-navigation.js | scripts/utils/fix-button-navigation.js | 按钮导航问题修复工具 |
| fix-resource-paths.js | scripts/utils/fix-resource-paths.js | 资源路径修复工具 |

### 模块相关脚本 (scripts/utils/modules/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| find-mixed-module-files.js | scripts/utils/modules/find-mixed-module-files.js | 查找混合模块文件 |
| fix-mixed-module-files.js | scripts/utils/modules/fix-mixed-module-files.js | 修复混合模块文件 |
| convert-module-format.js | scripts/utils/modules/convert-module-format.js | 转换模块格式 |
| convert-to-commonjs.js | scripts/utils/modules/convert-to-commonjs.js | 将模块转换为CommonJS格式 |
| check-module-consistency.js | scripts/utils/modules/check-module-consistency.js | 检查模块一致性 |

### 按钮修复脚本 (scripts/utils/button-fixes/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| fix-button-navigation.js | scripts/utils/button-fixes/fix-button-navigation.js | 修复按钮导航问题 |
| test-button-navigation.js | scripts/utils/button-fixes/test-button-navigation.js | 测试按钮导航功能 |
| fix-specific-buttons.js | scripts/utils/button-fixes/fix-specific-buttons.js | 修复特定按钮问题 |
| fix-page-transitions.js | scripts/utils/button-fixes/fix-page-transitions.js | 修复页面过渡问题 |

### 资源修复脚本 (scripts/utils/resource-fixes/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| fix-resources.js | scripts/utils/resource-fixes/fix-resources.js | 修复资源引用问题 |
| fix-specific-resources.js | scripts/utils/resource-fixes/fix-specific-resources.js | 修复特定资源问题 |

## 验证脚本 (scripts/validation/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| setup.ps1 | scripts/validation/setup.ps1 | 设置验证环境 |

### 验证子脚本 (scripts/validation/scripts/)

| 脚本名称 | 路径 | 描述 |
|---------|------|------|
| fix-button-attributes.js | scripts/validation/scripts/fix-button-attributes.js | 修复按钮属性 |
| fix-farming-buttons.js | scripts/validation/scripts/fix-farming-buttons.js | 修复农业页面按钮 |
| generate-button-issues.js | scripts/validation/scripts/generate-button-issues.js | 生成按钮问题报告 |
| run-all-tests.js | scripts/validation/scripts/run-all-tests.js | 运行所有验证测试 |
| validate-farming-buttons.js | scripts/validation/scripts/validate-farming-buttons.js | 验证农业页面按钮 |
| validate-fixed-buttons.js | scripts/validation/scripts/validate-fixed-buttons.js | 验证已修复的按钮 | 