# GitPush 快速开始指南

## 🚀 一键设置

1. **运行设置脚本**：
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/dev/git/setup-gitpush-simple.ps1"
```

2. **重新加载配置**：
```powershell
. $PROFILE
```

## ✨ 立即使用

现在你可以用一个命令完成Git的三步操作：

```bash
gitpush "你的提交信息"
```

### 使用示例

```bash
# 基本用法
gitpush "修复登录bug"

# 功能开发
gitpush "feat: 添加用户认证功能"

# 快速修复
gitpush "fix: 修复拼写错误"

# 文档更新
gitpush "docs: 更新API文档"
```

## 🔧 脚本功能

**自动执行**：
- ✅ `git add .` - 添加所有更改
- ✅ `git commit -m "message"` - 提交更改
- ✅ `git push` - 推送到远程仓库

**智能检查**：
- ✅ 检查是否在Git仓库中
- ✅ 检查是否有更改需要提交
- ✅ 完整的错误处理

## 📝 注意事项

1. **提交信息用引号包围**（特别是包含空格时）
2. **确保在Git仓库目录中运行**
3. **脚本会添加所有更改的文件**
4. **确保有推送权限**

## 🛠️ 故障排除

### 问题：找不到gitpush命令
**解决**：重新加载PowerShell配置
```powershell
. $PROFILE
```

### 问题：执行策略错误
**解决**：设置执行策略
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题：Git推送失败
**检查**：
- 网络连接
- Git认证信息
- 远程仓库权限

## 🎯 高级用法

### 直接调用脚本（无需设置别名）
```powershell
# PowerShell版本
.\scripts\dev\git\gitpush.ps1 "提交信息"

# 批处理版本
.\scripts\dev\git\gitpush.bat "提交信息"
```

### 在其他项目中使用
复制脚本文件到其他项目，或将脚本目录添加到PATH环境变量中。

---

**🎉 现在你可以用 `gitpush "信息"` 一键完成Git操作了！** 