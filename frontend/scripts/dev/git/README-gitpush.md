# GitPush 快捷脚本使用指南

## 概述
GitPush是一个便捷的Git操作脚本，可以将 `git add .`、`git commit -m "message"` 和 `git push` 三个命令合并为一个简单的命令。

## 文件说明
- `gitpush.ps1` - PowerShell版本的主脚本
- `gitpush.bat` - 批处理版本的主脚本  
- `setup-gitpush-alias.ps1` - PowerShell全局别名设置脚本

## 安装与设置

### 方法1: 设置全局PowerShell别名（推荐）

1. 以管理员身份运行PowerShell
2. 执行设置脚本：
```powershell
.\scripts\dev\git\setup-gitpush-alias.ps1
```

3. 重新加载PowerShell配置：
```powershell
. $PROFILE
```

4. 现在你可以在任何目录下使用：
```powershell
gitpush "你的提交信息"
```

### 方法2: 直接调用脚本

#### PowerShell版本
```powershell
.\scripts\dev\git\gitpush.ps1 "你的提交信息"
```

#### 批处理版本
```cmd
.\scripts\dev\git\gitpush.bat "你的提交信息"
```

## 使用示例

```bash
# 基本用法
gitpush "修复登录页面bug"

# 带有详细描述的提交
gitpush "feat: 添加用户认证功能

- 实现JWT token验证
- 添加登录/登出接口
- 更新用户状态管理"

# 快速修复
gitpush "fix: 修复拼写错误"
```

## 功能特性

### ✅ 自动化流程
- 自动执行 `git add .`
- 自动执行 `git commit -m "message"`
- 自动执行 `git push`

### ✅ 智能检查
- 检查当前目录是否为Git仓库
- 检查是否有更改需要提交
- 如果没有更改，会友好提示并退出

### ✅ 错误处理
- 完整的错误处理机制
- 彩色输出，易于识别状态
- 详细的错误信息提示

### ✅ 用户友好
- 支持带空格的提交信息
- 清晰的进度提示
- 表情符号增强可读性

## 注意事项

1. **提交信息必须用引号包围**（如果包含空格）
2. **确保在Git仓库根目录或子目录中运行**
3. **脚本会添加所有更改的文件** (`git add .`)
4. **确保你有推送权限**到远程仓库

## 卸载

如果需要移除PowerShell别名：
```powershell
.\scripts\dev\git\setup-gitpush-alias.ps1 -Remove
```

## 故障排除

### 问题1: "执行策略"错误
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题2: 找不到gitpush命令
确保已正确设置别名并重新加载PowerShell配置：
```powershell
. $PROFILE
```

### 问题3: Git推送失败
检查：
- 网络连接
- Git远程仓库配置
- 认证信息（用户名/密码或SSH密钥）

## 高级用法

### 与其他Git命令结合
```bash
# 查看状态后再推送
git status
gitpush "基于状态检查的提交"

# 推送前查看差异
git diff
gitpush "确认差异后的提交"
```

### 批量操作
```bash
# 可以在脚本中使用
gitpush "自动化部署更新"
```

## 贡献与反馈

如果你发现任何问题或有改进建议，请：
1. 检查现有的issue
2. 创建新的issue描述问题
3. 提交pull request（如果你有解决方案） 