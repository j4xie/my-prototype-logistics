# Git提交规范

所有与重构相关的提交必须遵循以下格式：

```
[阶段X][类型] 简短描述

详细描述

相关任务: TASK-XXX
```

## 提交类型

- `struct`: 结构变更
- `refactor`: 代码重构
- `docs`: 文档更新
- `test`: 测试相关
- `perf`: 性能优化
- `fix`: 修复问题

## 示例

```
[阶段一][struct] 重组目录结构

将所有组件移至web-app/src/components目录
统一命名规范为PascalCase

相关任务: TASK-001
```

## 分支管理策略

```
master
  └── refactor/main
       ├── refactor/phase-1
       │    ├── refactor/phase-1/task-1
       │    └── refactor/phase-1/task-2
       ├── refactor/phase-2
       └── ...
```

## 工作流程

1. 为每个任务创建单独的分支
2. 提交遵循上述规范
3. 完成任务后提交Pull Request
4. 代码评审通过后合并到对应阶段分支
5. 阶段完成后合并到refactor/main分支
6. 重构完成后合并到master分支 