# 项目备份系统使用指南

## 📋 **概述**

本项目已配置了自动化备份系统，支持手动备份和定时自动备份两种模式。

## 🔧 **快速使用**

### **手动备份**
```bash
# 标准备份
npm run backup

# 详细输出模式
npm run backup-verbose
```

### **备份存储位置**
- **位置**: 项目根目录下
- **命名格式**: `webback-YYYYMMDD-HHMM`
- **示例**: `webback-20250602-0351`
- **保留数量**: 最多2个备份（自动清理旧备份）

## 📂 **备份内容**

### **包含的文件/目录**
- ✅ 所有源代码 (`src/`, `web-app/`, `web-app-next/`)
- ✅ 配置文件 (`.vscode/`, `.cursor/`, `.husky/`)
- ✅ 文档 (`docs/`, `README.md`, 等)
- ✅ 脚本 (`scripts/`)
- ✅ 项目配置 (`package.json`, `vercel.json`, 等)
- ✅ 重构相关文档 (`refactor/`)

### **排除的文件/目录**
- ❌ `node_modules/` (依赖包)
- ❌ `.git/` (Git历史)
- ❌ `.next/`, `dist/`, `build/` (构建产物)
- ❌ `coverage/`, `tmp/` (临时文件)
- ❌ `*.log`, `*.cache` (缓存和日志)
- ❌ 其他备份目录 (`webback-*`, `backup-*`)

## ⏰ **定时自动备份**

### **设置定时备份**
```powershell
# 设置每日中午2点自动备份（当前设置）
.\scripts\utils\Setup-DailyBackup.ps1 -BackupTime "14:00"

# 自定义备份时间（例如上午9点）
.\scripts\utils\Setup-DailyBackup.ps1 -BackupTime "09:00"
```

### **管理定时任务**
```powershell
# 查看任务状态
Get-ScheduledTask -TaskName "HeiNiu-Project-Daily-Backup"

# 删除定时任务
.\scripts\utils\Setup-DailyBackup.ps1 -Remove

# 查看备份日志
Get-Content "scripts\utils\backup.log"
```

## 📊 **备份统计**

典型备份信息：
- **文件数量**: ~820个文件
- **跳过文件**: ~75,000个文件（主要是node_modules）
- **备份大小**: ~22MB
- **备份时间**: ~10-15秒

## 🔍 **备份验证**

### **检查备份**
```powershell
# 查看所有备份
dir webback-* | ft Name,CreationTime

# 检查最新备份内容
dir webback-* | sort CreationTime -Descending | select -First 1 | %{ dir $_.Name }
```

### **恢复文件**
如需从备份恢复特定文件：
```powershell
# 示例：恢复package.json
copy webback-20250602-0351\package.json .\package.json
```

## 🚨 **故障排除**

### **常见问题**

#### **权限问题**
```powershell
# 如果遇到执行策略问题
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### **路径问题**
- 确保脚本路径正确：`scripts\utils\Create-ProjectBackup.ps1`
- 确保在项目根目录运行命令

#### **空间不足**
- 备份会自动保留最多2个版本
- 手动清理：`Remove-Item webback-* -Recurse -Force`

### **日志查看**
```powershell
# 查看详细日志（如果设置了定时任务）
Get-Content "scripts\utils\backup.log" -Tail 50
```

## 🔧 **高级配置**

### **修改备份参数**
编辑 `scripts\utils\Create-ProjectBackup.ps1` 文件：

```powershell
# 修改最大备份数量
$MaxBackups = 3  # 改为保留3个备份

# 修改备份前缀
$BackupPrefix = "mybackup"  # 改为 mybackup-时间

# 添加排除项
$ExcludeDirs += "my-custom-dir"
```

### **自定义备份脚本**
```powershell
# 只备份特定目录
.\scripts\utils\Create-ProjectBackup.ps1 -MaxBackups 5 -Verbose
```

## 📋 **最佳实践**

1. **定期检查**: 每周检查一次备份是否正常
2. **重要变更前**: 手动执行一次备份
3. **测试恢复**: 定期测试从备份恢复文件
4. **空间监控**: 注意备份占用的磁盘空间
5. **日志检查**: 查看定时备份的执行日志

## 📞 **支持**

如遇到问题：
1. 检查PowerShell执行策略
2. 确认脚本文件存在且可执行
3. 查看错误日志进行诊断
4. 手动运行脚本进行调试

---

**创建时间**: 2025-06-02
**最后更新**: 2025-06-02
**版本**: 1.0.0
