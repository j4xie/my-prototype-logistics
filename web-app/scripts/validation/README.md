# 验证脚本迁移工具

此目录包含用于标准化和迁移项目根目录中旧验证脚本的工具。目的是使所有验证脚本符合标准化结构，并集中存放在 `validation/scripts` 目录中，便于维护和调用。

## 功能特点

- 自动将旧验证脚本迁移到 `validation/scripts` 目录
- 为脚本添加标准化的配置对象和模块化结构
- 确保所有脚本使用一致的导出格式 (`module.exports = { run }`)
- 建立统一的错误处理和报告机制
- 创建必要的目录结构

## 使用方法

### 通过 npm 命令运行

```bash
npm run migrate:scripts
```

### 直接运行脚本

```bash
node scripts/validation/migrate-validation-scripts.js
```

## 迁移过程

迁移工具执行以下步骤：

1. 确保目标目录结构存在 (`validation/scripts`, `validation/reports`, `validation/reports/screenshots`)
2. 检查每个定义的源脚本是否存在
3. 读取源脚本内容并应用定义的转换规则
4. 将转换后的内容写入目标位置
5. 生成迁移摘要报告

## 标准化结构

迁移后的脚本具有以下标准化结构：

```javascript
// 导入所需库
const { ... } = require('...');

// 标准化配置对象
const config = {
  baseUrl: '...',
  pages: [ ... ],
  screenshotsDir: '...',
  reportPath: '...'
};

// 确保目录存在
if (!fs.existsSync(config.screenshotsDir)) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
}

// 验证功能函数
async function validateXXX() { ... }

// 主运行函数
async function run() {
  try {
    // 执行验证
    // 生成结果
    return results;
  } catch (error) {
    // 标准化错误处理
    return errorResults;
  }
}

// 标准导出
module.exports = { run };
```

## 迁移后执行验证测试

所有验证脚本都已添加到 `package.json` 的 npm 脚本中，可以通过以下命令执行：

```bash
# 执行所有验证测试
npm run validate

# 执行特定验证测试
npm run validate:buttons
npm run validate:functionality
npm run validate:navigation
npm run validate:resources
npm run validate:ui
```

## 注意事项

- 迁移后请检查脚本是否正常工作
- 某些复杂脚本可能需要手动调整
- 建议保留原脚本直到确认新脚本工作正常

## 已完成工作

为了优化代码结构和简化维护，我们完成了以下工作：

1. **创建目录结构**：
   - 建立了`scripts/git`目录用于Git相关脚本
   - 建立了`scripts/debug`目录用于调试相关脚本
   - 建立了`scripts/validation`目录用于验证脚本迁移工具

2. **迁移脚本文件**：
   - 将Git相关脚本移至`scripts/git`
   - 将调试相关脚本移至`scripts/debug`
   - 将根目录下的验证脚本迁移至`validation/scripts`

3. **标准化验证脚本**：
   - 为所有脚本添加标准化的配置对象
   - 实现模块化设计，每个脚本都导出`run()`函数
   - 添加统一的错误处理和报告生成机制

4. **更新运行机制**：
   - 更新`run-all-tests.js`使用模块导入方式运行验证脚本
   - 添加异步执行支持，提高测试效率
   - 改进测试报告生成，更详细的状态显示

5. **添加npm脚本命令**：
   - 添加`validate`命令运行所有验证测试
   - 添加`validate:xxx`命令运行特定验证测试
   - 添加`validate:migrate`命令运行迁移工具

这些改进使得验证脚本更易于维护、扩展和执行，同时提高了代码的可读性和一致性。 