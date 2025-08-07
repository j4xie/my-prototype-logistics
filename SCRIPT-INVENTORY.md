# 🗂️ 海牛项目脚本清单

> 最后更新: 2025-08-06  
> 状态: 已完成脚本清理和整合，移除重复脚本

---

## 📋 当前可用脚本

### 🟢 完全安全脚本（推荐日常使用）

#### CMD脚本 - 零Profile风险
| 脚本名称 | 功能描述 | 风险等级 | 推荐度 |
|---------|---------|---------|--------|
| `SOLUTION-HUB.cmd` | 完整解决方案菜单 | 🟢 无风险 | ⭐⭐⭐⭐⭐ |
| `start-backend-rn.cmd` | React Native环境启动 | 🟢 无风险 | ⭐⭐⭐⭐⭐ |
| `start-local.cmd` | Web开发环境启动 | 🟢 无风险 | ⭐⭐⭐⭐⭐ |
| `NO-PROFILE-DEV.cmd` | 无Profile开发环境 | 🟢 无风险 | ⭐⭐⭐⭐⭐ |
| `DIAGNOSE-PS-ISSUE.cmd` | PowerShell诊断工具 | 🟢 无风险 | ⭐⭐⭐ |
| `STOP.cmd` | 停止开发服务 | 🟢 无风险 | ⭐⭐⭐ |

### 🛡️ 安全PowerShell工具

| 脚本名称 | 功能描述 | 风险等级 | 推荐度 |
|---------|---------|---------|--------|
| `SAFE-setup-dev-command.ps1` | 安全Web命令安装器 | 🟡 低风险 | ⭐⭐⭐⭐ |
| `SAFE-setup-rn-command.ps1` | 安全RN命令安装器 | 🟡 低风险 | ⭐⭐⭐⭐ |
| `Profile-Manager.ps1` | Profile安全管理工具 | 🟡 低风险 | ⭐⭐⭐⭐⭐ |
| `start-backend-rn.ps1` | PowerShell版RN启动 | 🟢 无风险 | ⭐⭐⭐⭐ |
| `fix-powershell-profile.ps1` | Profile修复工具 | 🟡 低风险 | ⭐⭐⭐ |
| `diagnose-powershell-startup.ps1` | 启动诊断工具 | 🟢 无风险 | ⭐⭐⭐ |

---

## 🗑️ 已删除的危险脚本

### ❌ 已删除脚本清单
| 脚本名称 | 删除原因 | 替代方案 |
|---------|---------|---------|
| ~~`setup-dev-command.ps1`~~ | Add-Content追加导致Profile无限增长 | `SAFE-setup-dev-command.ps1` |
| ~~`setup-rn-command.ps1`~~ | 正则替换不可靠，重复累积风险 | `SAFE-setup-rn-command.ps1` |
| ~~`Microsoft.PowerShell_profile.ps1`~~ | 损坏文件（622MB） | 使用Profile-Manager重建 |
| ~~`fix-profile.cmd`~~ | 引用已删除的危险脚本 | `Profile-Manager.ps1` |
| ~~`emergency-fix-powershell.cmd`~~ | 功能重复，已被替代 | `SAFE-setup-rn-command.ps1` |
| ~~`fix-powershell-completely.cmd`~~ | 功能重复，已被替代 | `Profile-Manager.ps1` |
| ~~`fast-powershell.cmd`~~ | 功能重复，已被替代 | `NO-PROFILE-DEV.cmd` |
| ~~`FINAL-FIX.cmd`~~ | 功能重复，已被替代 | `Profile-Manager.ps1` |
| ~~`START.cmd`~~ | 功能重复，已被替代 | `SOLUTION-HUB.cmd` |
| ~~`quick-dev.cmd`~~ | 功能与start-backend-rn重复 | `start-backend-rn.cmd` |
| ~~`dev-start.ps1`~~ | 功能被安全脚本替代 | `SAFE-setup-dev-command.ps1` |

### 删除详情
- **删除时间**: 2025-08-06
- **删除原因**: 导致622MB Profile损坏事件
- **影响**: 无，已提供完整替代方案
- **记录位置**: `DANGEROUS-SCRIPTS-REMOVED.md`

---

## 📖 使用指南

### 🎯 推荐使用流程

#### 新用户开始开发
1. **立即开始**: 双击运行 `SOLUTION-HUB.cmd`
2. **选择环境**: 根据需要选择Web或React Native
3. **日常使用**: 直接使用CMD脚本，无需安装

#### 需要PowerShell全局命令
1. **安全安装**: 运行 `SAFE-setup-dev-command.ps1`
2. **健康检查**: 定期运行 `Profile-Manager.ps1 -Action health`
3. **安全管理**: 使用Profile-Manager进行后续管理

### 🛡️ 安全使用原则

1. **优先级**: CMD脚本 > 安全PowerShell脚本 > 手动操作
2. **Profile管理**: 只使用SAFE-前缀的脚本或Profile-Manager
3. **健康监控**: 定期检查Profile大小，超过100KB需清理
4. **备份策略**: 修改Profile前自动创建备份

---

## 🔧 功能对照表

### 开发环境启动

| 需求 | CMD方案 | PowerShell方案 | 说明 |
|-----|---------|---------------|-----|
| React Native | `start-backend-rn.cmd` | `dev-rn` | CMD更安全 |
| Web开发 | `start-local.cmd` | `dev` | CMD更安全 |
| 混合开发 | `SOLUTION-HUB.cmd` | 组合使用 | 菜单式选择 |
| 快速诊断 | `DIAGNOSE-PS-ISSUE.cmd` | `Profile-Manager.ps1` | 各有特点 |

### Profile管理

| 操作 | 工具 | 命令示例 |
|-----|-----|---------|
| 健康检查 | Profile-Manager.ps1 | `-Action health` |
| 列出模块 | Profile-Manager.ps1 | `-Action list` |
| 创建备份 | Profile-Manager.ps1 | `-Action backup` |
| 安全重置 | Profile-Manager.ps1 | `-Action reset` |

---

## 📊 风险评级说明

- 🟢 **无风险**: 不涉及Profile修改，完全安全
- 🟡 **低风险**: 有安全机制保护，正常使用安全
- 🔴 **高风险**: 已删除，不推荐使用

---

## 📞 故障排除

### 常见问题

1. **PowerShell启动慢**
   - 运行: `Profile-Manager.ps1 -Action health`
   - 如文件过大: `Profile-Manager.ps1 -Action reset`

2. **找不到dev命令**
   - 使用CMD替代: `start-local.cmd`
   - 或重新安装: `SAFE-setup-dev-command.ps1`

3. **脚本执行策略错误**
   - 管理员PowerShell运行: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 紧急恢复

如果PowerShell出现问题：
1. 使用 `powershell -NoProfile` 绕过Profile
2. 运行 `Profile-Manager.ps1 -Action reset` 重置
3. 使用CMD脚本继续开发工作

---

**维护说明**: 此文档记录所有项目脚本的安全状态，定期更新。如发现新的安全问题，立即更新此清单。