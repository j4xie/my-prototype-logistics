# 任务：目录结构重组实施

- **任务ID**: TASK-004
- **优先级**: P0
- **状态**: 进行中
- **开始日期**: 2023-05-16
- **完成日期**: -
- **负责人**: 项目组
- **估计工时**: 5人天

## 任务描述

按照TASK-001中制定的目录重组方案，实施项目目录结构的重组，包括文件移动、目录创建、引用更新等。这是重构阶段一的核心任务，将为后续工作奠定基础。

## 实施步骤

### 1. 准备工作

1.1. 创建完整项目备份
```bash
# 创建备份文件夹
mkdir -p ../backups/$(date +%Y%m%d)
# 复制整个项目（除node_modules）
rsync -av --exclude='node_modules' --exclude='.git' . ../backups/$(date +%Y%m%d)/
```

1.2. 创建实施前快照
```bash
# 创建目录结构快照
find . -type d -not -path "*/node_modules/*" -not -path "*/.git/*" > ../backups/$(date +%Y%m%d)/directories.txt
# 创建文件列表快照
find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" > ../backups/$(date +%Y%m%d)/files.txt
```

### 2. 创建新目录结构

按照目录重组方案，创建新的目录结构：

```bash
# 创建前端核心目录
mkdir -p web-app/src/{components/{common,modules/{trace,farming,logistics,processing,admin,profile},ui},pages/{auth,home,trace,farming,logistics,processing,admin,profile},hooks,utils/{network,storage,auth,common},services,store,styles,types}

# 创建前端静态资源目录
mkdir -p web-app/public/{assets/{images,icons,media},fonts}

# 创建前端测试目录
mkdir -p web-app/tests/{unit,integration,e2e}

# 创建前端配置目录
mkdir -p web-app/config/{build,test,app,deploy}

# 创建服务器目录
mkdir -p server/src/{api,models,services,utils}
mkdir -p server/config
mkdir -p server/tests

# 创建文档目录
mkdir -p docs/{architecture,api,components,guides}

# 创建脚本目录
mkdir -p scripts/{dev,build,deploy}
```

### 3. 文件迁移

#### 3.1 前端代码迁移

将前端代码按类别移至相应目录：

```bash
# 移动组件文件
find web-app/components -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | while read file; do
  # 根据命名或内容判断组件类型
  if [[ $file == *Trace* || $file == *trace* ]]; then
    target_dir="web-app/src/components/modules/trace"
  elif [[ $file == *Farm* || $file == *farm* ]]; then
    target_dir="web-app/src/components/modules/farming"
  # ... 其他模块判断
  else
    target_dir="web-app/src/components/common"
  fi
  
  # 创建目标目录（如果不存在）
  mkdir -p "$target_dir"
  
  # 移动文件
  mv "$file" "$target_dir/"
done

# 移动页面文件
find web-app/pages -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.html" | while read file; do
  # 根据路径或内容判断页面类型
  if [[ $file == *auth* || $file == *login* ]]; then
    target_dir="web-app/src/pages/auth"
  # ... 其他页面类型判断
  else
    target_dir="web-app/src/pages"
  fi
  
  # 创建目标目录（如果不存在）
  mkdir -p "$target_dir"
  
  # 移动文件
  mv "$file" "$target_dir/"
done

# 移动工具函数
find web-app/src -path "*/utils/*" -type f | while read file; do
  # 根据文件内容或命名判断工具类型
  if [[ $file == *network* ]]; then
    target_dir="web-app/src/utils/network"
  elif [[ $file == *storage* ]]; then
    target_dir="web-app/src/utils/storage"
  # ... 其他工具类型判断
  else
    target_dir="web-app/src/utils/common"
  fi
  
  # 创建目标目录（如果不存在）
  mkdir -p "$target_dir"
  
  # 移动文件
  mv "$file" "$target_dir/"
done

# 移动静态资源
mkdir -p web-app/public/assets
cp -r web-app/assets/* web-app/public/assets/
cp -r web-app/styles/* web-app/src/styles/
```

#### 3.2 服务器代码迁移

将服务器代码移至server目录：

```bash
# 移动服务器入口文件
mv web-app/server.js server/src/
mv web-app/local-server.js server/src/
mv web-app/api-router.js server/src/api/

# 移动服务器配置
mv web-app/server-config.js server/config/
```

#### 3.3 配置文件迁移

整合配置文件：

```bash
# 移动配置文件
mv web-app/babel.config.js web-app/config/build/
mv web-app/postcss.config.js web-app/config/build/
mv web-app/jest.config.js web-app/config/test/
mv web-app/playwright.config.js web-app/config/test/
mv web-app/vercel.json web-app/config/deploy/
```

#### 3.4 测试文件迁移

整合测试目录：

```bash
# 移动测试文件
find __tests__ -type f | while read file; do
  # 判断测试类型
  if [[ $file == *unit* ]]; then
    target_dir="web-app/tests/unit"
  elif [[ $file == *integration* ]]; then
    target_dir="web-app/tests/integration"
  elif [[ $file == *e2e* ]]; then
    target_dir="web-app/tests/e2e"
  else
    target_dir="web-app/tests/unit"  # 默认为单元测试
  fi
  
  # 创建目标目录（如果不存在）
  mkdir -p "$target_dir"
  
  # 移动文件
  mv "$file" "$target_dir/"
done

# 移动test目录下的测试文件
find test -type f | while read file; do
  target_dir="web-app/tests/integration"
  mkdir -p "$target_dir"
  mv "$file" "$target_dir/"
done
```

#### 3.5 脚本文件迁移

整理脚本文件：

```bash
# 移动Git脚本
mkdir -p scripts/dev/git
mv gitpull.bat scripts/dev/git/
mv *.ps1 scripts/dev/

# 移动其他脚本
mv *.bat scripts/dev/
```

### 4. 引用更新

更新代码中的引用路径：

```bash
# 更新JS/TS文件中的引用
find web-app/src -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's|import .* from "../components/|import * from "../components/|g' {} \;

# 更新HTML文件中的引用
find web-app/src -type f -name "*.html" -exec sed -i 's|href="../assets/|href="../public/assets/|g' {} \;
find web-app/src -type f -name "*.html" -exec sed -i 's|src="../assets/|src="../public/assets/|g' {} \;

# 更新配置文件中的引用
# ... (需要根据具体配置文件格式定制)
```

### 5. 清理工作

移除冗余和过时文件：

```bash
# 清理原目录中已迁移的文件
rm -rf web-app/assets
rm -rf web-app/styles
rm -rf web-app/components
# 其他需要移除的目录...

# 移除备份文件
rm -f README.md.bak
```

## 变更记录

| 文件路径 | 变更类型 | 变更说明 |
|---------|---------|---------|
| /web-app/src/ | 新增 | 创建规范化的源代码目录结构 |
| /web-app/public/ | 新增 | 创建统一的静态资源目录 |
| /web-app/config/ | 新增 | 创建统一的配置目录 |
| /web-app/tests/ | 新增 | 创建统一的测试目录 |
| /server/ | 新增 | 创建独立的服务器代码目录 |
| /docs/ | 新增 | 创建文档目录结构 |
| /scripts/ | 新增 | 创建脚本目录结构 |
| /web-app/components/ | 删除 | 原组件目录（文件已迁移） |
| /web-app/assets/ | 删除 | 原资源目录（文件已迁移） |
| /web-app/styles/ | 删除 | 原样式目录（文件已迁移） |
| /__tests__/ | 删除 | 原测试目录（文件已迁移） |
| /test/ | 删除 | 原测试目录（文件已迁移） |
| /README.md.bak | 删除 | 过时的备份文件 |

## 依赖任务

- TASK-001: 目录结构分析与重组计划（需要完成后才能开始此任务）

## 验收标准

- [ ] 所有文件已按照计划移动到正确位置
- [ ] 新目录结构与重组方案文档一致
- [ ] 引用路径已全部更新，无断链
- [ ] 项目可以成功构建
- [ ] 基本功能测试通过
- [ ] 无冗余文件和目录残留
- [ ] 目录结构重组实施报告已完成

## 注意事项

- 实施前必须做好完整备份，以便出现问题时可以回滚
- 移动文件时注意保留文件权限和元数据
- 更新引用路径时需谨慎，以避免引入错误
- 对于复杂的引用关系，可能需要手动调整
- 实施过程分阶段进行，每个阶段后进行验证
- 优先移动和调整影响较小的文件
- 服务器代码迁移后需特别注意配置和环境变量的处理 