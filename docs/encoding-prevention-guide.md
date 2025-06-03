# 编码问题预防指南

## 文档目的

本文档记录了为防止项目中出现编码问题而设置的所有预防措施和配置。

## 已实施的预防措施

### 1. Git 编码配置 ✅

全局Git配置已设置以下参数：

```bash
git config --global core.autocrlf false          # 禁用自动CRLF转换
git config --global core.safecrlf true           # 启用安全CRLF检查
git config --global i18n.commitEncoding utf-8    # 提交信息编码为UTF-8
git config --global i18n.logOutputEncoding utf-8 # 日志输出编码为UTF-8
git config --global core.quotepath false         # 正确显示中文文件名
```

**验证命令**：
```bash
git config --global --list | Select-String "core\.|i18n\."
```

### 2. VS Code 项目配置 ✅

在 `.vscode/settings.json` 中设置：

```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "[markdown]": {
    "files.encoding": "utf8"
  },
  "[json]": {
    "files.encoding": "utf8"
  },
  "[typescript]": {
    "files.encoding": "utf8"
  },
  "[javascript]": {
    "files.encoding": "utf8"
  }
}
```

### 3. 编码检查脚本 ✅

创建了多个编码检查工具：

#### Node.js 版本（推荐）
- **文件位置**: `scripts/utils/check-encoding.js`
- **使用方法**: `npm run check-encoding`
- **功能**: 检查关键文件的编码完整性

#### PowerShell 版本（备用）
- **文件位置**: `scripts/utils/simple-encoding-check.ps1`
- **使用方法**: `powershell -ExecutionPolicy Bypass -File "./scripts/utils/simple-encoding-check.ps1"`
- **功能**: Windows环境下的编码检查

### 4. Git提交前钩子 ✅

在 `.husky/pre-commit` 中添加了编码检查：

```bash
# 编码完整性检查
echo "🔍 检查文件编码完整性..."
powershell -ExecutionPolicy Bypass -File "./scripts/utils/encoding-checker.ps1" -Verbose:$false

# 检查是否有编码问题
if [ $? -ne 0 ]; then
    echo "❌ 发现编码问题，请运行编码检查脚本修复后再提交"
    echo "运行: npm run check-encoding"
    exit 1
fi

echo "✅ 编码检查通过"
```

### 5. 关键文件监控列表

以下文件被重点监控编码完整性：

1. `DIRECTORY_STRUCTURE.md` - 目录结构文档
2. `docs/directory-structure-changelog.md` - 变更历史记录
3. `README.md` - 项目说明
4. `TASKS.md` - 任务概览
5. `重构阶段记录.md` - 重构记录
6. `项目重构方案.md` - 重构方案
7. `所有文件解释.md` - 文件解释

## 使用指南

### 日常检查

定期运行编码检查：
```bash
npm run check-encoding
```

### 发现问题时的处理流程

1. **立即检查**：
   ```bash
   npm run check-encoding
   ```

2. **从GitHub恢复**（如果有备份）：
   ```bash
   # 手动从GitHub下载干净版本到临时目录
   # 然后复制覆盖损坏的文件
   Copy-Item "b:\Download-Chrome\DIRECTORY_STRUCTURE.md" . -Force
   ```

3. **验证修复**：
   ```bash
   npm run check-encoding
   ```

### PowerShell环境设置

如果需要在PowerShell中正确显示中文：

```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

## 预防最佳实践

### 1. 编辑器设置
- 始终使用UTF-8编码保存文件
- 禁用自动编码检测
- 设置项目默认编码为UTF-8

### 2. 文件操作
- 避免在不同编码环境间复制粘贴文本
- 使用Git进行文件传输而非直接复制
- 定期验证关键文件的编码完整性

### 3. 系统环境
- 确保操作系统区域设置正确
- 使用支持UTF-8的终端和编辑器
- 避免使用老旧的文本处理工具

## 故障排除

### 常见问题

1. **PowerShell脚本无法运行**
   - 检查执行策略：`Get-ExecutionPolicy`
   - 临时允许：`Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process`

2. **中文字符显示为乱码**
   - 设置控制台编码：`chcp 65001`
   - 或使用Node.js版本的检查脚本

3. **Git提交被阻止**
   - 运行编码检查：`npm run check-encoding`
   - 修复问题后重新提交

### 应急方案

如果所有本地版本都损坏：

1. 从GitHub仓库重新克隆项目
2. 或从GitHub下载单个文件
3. 或从备份目录恢复（如果有的话）

## 维护记录

- **2025-06-02**: 初始设置完成，所有预防措施已实施
- **检查频率**: 建议每周运行一次编码检查
- **更新计划**: 根据使用情况优化检查脚本

---

**最后更新**: 2025-06-02
**维护者**: 项目开发团队
**相关文档**: [DIRECTORY_STRUCTURE.md](../DIRECTORY_STRUCTURE.md)
