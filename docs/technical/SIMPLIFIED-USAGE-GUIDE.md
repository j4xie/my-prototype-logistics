# 🚀 海牛项目开发环境 - 简化使用指南

> **快速上手指南 - 3分钟开始开发**  
> 最后更新: 2025-08-06

---

## ⚡ 立即开始 (推荐方式)

### 🎯 一键启动解决方案

```bash
# 双击运行，选择你需要的环境
SOLUTION-HUB.cmd
```

**菜单选项**:
- `1` - Web开发环境 (MySQL + Backend + Frontend)
- `2` - React Native环境 (MySQL + Backend + RN)  
- `3` - 停止所有服务
- `4` - 诊断工具

---

## 🔧 分别启动环境

### Web开发
```bash
# 启动Web开发环境
start-local.cmd

# 停止服务
STOP.cmd
```

### React Native开发
```bash
# 启动RN开发环境  
start-backend-rn.cmd

# 停止服务
STOP.cmd
```

---

## 💡 进阶功能 (可选)

### 如果你需要PowerShell全局命令

#### 安装Web开发命令
```powershell
# 右键"以管理员身份运行"PowerShell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
.\SAFE-setup-dev-command.ps1

# 安装后可用命令: dev, dev-stop, dev-status
```

#### 安装React Native命令  
```powershell
.\SAFE-setup-rn-command.ps1

# 安装后可用命令: dev-rn, dev-rn-stop, dev-rn-status
```

#### Profile健康管理
```powershell
# 检查Profile健康状态
.\Profile-Manager.ps1 -Action health

# 列出所有管理的功能模块
.\Profile-Manager.ps1 -Action list

# 如有问题，重置Profile
.\Profile-Manager.ps1 -Action reset
```

---

## 🛡️ 安全提醒

### ✅ 安全脚本 (推荐使用)
- `SOLUTION-HUB.cmd` - 主菜单 ⭐⭐⭐⭐⭐
- `start-local.cmd` - Web环境 ⭐⭐⭐⭐⭐  
- `start-backend-rn.cmd` - RN环境 ⭐⭐⭐⭐⭐
- `SAFE-setup-*.ps1` - 安全PowerShell工具 ⭐⭐⭐⭐
- `Profile-Manager.ps1` - Profile管理工具 ⭐⭐⭐⭐⭐

### ❌ 已删除的危险脚本
- ~~`setup-dev-command.ps1`~~ - 会损坏PowerShell Profile
- ~~`setup-rn-command.ps1`~~ - 有重复追加风险

---

## 🏃‍♂️ 快速开始流程

### 新用户 (第一次使用)
1. **立即开始**: 双击运行 `SOLUTION-HUB.cmd`
2. **选择环境**: 根据需要选择Web(1)或RN(2)
3. **开始开发**: 环境自动启动，开始编码

### 日常使用
```bash
# 选项1: 使用菜单 (推荐)
SOLUTION-HUB.cmd

# 选项2: 直接启动
start-local.cmd        # Web开发
start-backend-rn.cmd   # RN开发
```

### 需要PowerShell命令
```powershell
# 一次性安装
.\SAFE-setup-dev-command.ps1   # Web命令
.\SAFE-setup-rn-command.ps1    # RN命令

# 然后就能使用
dev        # 启动Web环境
dev-rn     # 启动RN环境
```

---

## 🆘 问题解决

### PowerShell启动缓慢？
```powershell
.\Profile-Manager.ps1 -Action health
# 如果显示文件过大，运行重置
.\Profile-Manager.ps1 -Action reset
```

### 找不到命令？
```bash
# 使用安全的CMD脚本替代
start-local.cmd      # 替代 dev 命令
start-backend-rn.cmd # 替代 dev-rn 命令
```

### 执行策略错误？
```powershell
# 管理员PowerShell运行
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 方案对比

| 使用场景 | CMD方案 (推荐) | PowerShell方案 | 特点 |
|---------|---------------|---------------|------|
| 日常开发 | `SOLUTION-HUB.cmd` | `dev` / `dev-rn` | CMD更安全 |
| Web开发 | `start-local.cmd` | `dev` | CMD零风险 |
| RN开发 | `start-backend-rn.cmd` | `dev-rn` | CMD零风险 |
| 一次性使用 | 立即可用 | 需要安装 | CMD更快 |
| 集成体验 | 功能完整 | 命令简短 | 各有优势 |

---

## 📞 获取帮助

```powershell
# Profile管理器帮助
.\Profile-Manager.ps1 -Action help

# 诊断PowerShell问题  
DIAGNOSE-PS-ISSUE.cmd
```

**核心原则**: **优先使用CMD脚本，需要全局命令时才使用安全的PowerShell脚本**

---

**🎯 总结**: 双击 `SOLUTION-HUB.cmd` 开始，选择环境，立即开发！