# Git工具脚本使用说明

本目录包含了项目中使用的Git工具脚本，用于简化Git操作流程，提高开发效率。

## 支持的脚本文件

- **git-tools.ps1** - PowerShell实现版本
- **git-tools.bat** - Windows批处理实现版本
- **git-tools.sh** - Bash实现版本(适用于Linux/macOS)

## 主要功能

Git工具脚本提供以下主要功能：

1. **快速提交和推送** - 一步完成add、commit、push操作
2. **状态查看** - 简洁展示当前工作目录状态
3. **分支管理** - 快速浏览、切换和创建分支
4. **提交历史** - 查看最近提交记录

## 使用方法

### PowerShell版本

```powershell
./git-tools.ps1 push "提交信息"  # 添加、提交并推送
./git-tools.ps1 s                # 显示状态
./git-tools.ps1 b                # 列出分支
```

### Batch版本

```batch
git-tools.bat push "提交信息"    # 添加、提交并推送
git-tools.bat s                  # 显示状态
git-tools.bat b                  # 列出分支
```

### Bash版本

```bash
./git-tools.sh push "提交信息"   # 添加、提交并推送
./git-tools.sh s                 # 显示状态
./git-tools.sh b                 # 列出分支
```

## 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `push` | 添加所有更改、提交并推送 | `git-tools push "修复按钮样式"` |
| `s` | 查看简洁状态 | `git-tools s` |
| `a` | 添加所有更改 | `git-tools a` |
| `c` | 提交更改 | `git-tools c "更新文档"` |
| `p` | 推送到远程仓库 | `git-tools p` |
| `b` | 列出分支 | `git-tools b` |
| `co` | 切换分支 | `git-tools co develop` |
| `l` | 查看最近提交记录 | `git-tools l` |
| `help` | 显示帮助信息 | `git-tools help` |

## 安装别名

为了更方便地使用Git工具脚本，可以通过以下方式设置别名：

### PowerShell用户

使用 `../setup-git-tools.ps1` 安装PowerShell配置文件中的别名。

### Bash用户

在 `.bashrc` 或 `.zshrc` 中添加：

```bash
alias gt='/path/to/git-tools.sh'
```

### Windows用户

将 `scripts/git` 目录添加到系统PATH环境变量中，或使用批处理文件创建别名。 