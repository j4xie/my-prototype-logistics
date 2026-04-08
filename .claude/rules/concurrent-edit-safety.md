# 并发编辑安全规范

**最后更新**: 2026-04-08

---

## 背景

多个 Claude Code session / Cursor / VSCode 同时打开同一文件时, 可能互相覆盖编辑.

**真实事故 (2026-04-08)**: 重做 `scripts/deploy/deploy-backend.sh` v5.0 时, 写了 ~150 行 edits 后, 文件被并发 session 覆盖, 只保留最后的 29 行. Deploy run 一度成功执行 BG 逻辑 (说明文件之前是正确的), 但 git diff 只剩 29 行. 被迫重做所有 edits, 之后 commit `09af47780` 保住工作.

---

## 规则

### 1. 里程碑式 commit（最重要）

任何连续 3+ Edit 的同一文件, 或 15-30 分钟工作量, **立即 commit** (可用 `WIP:` 前缀):

```bash
git add <file> && git commit -m "WIP: <phase>"
```

完成后 `git rebase -i` squash 即可. 不要等 "全部做完再 commit" — 这是高风险模式.

### 2. 长任务用 git worktree 隔离

1 小时+ 的大工程 (脚本重构、跨文件 refactor) 开独立 worktree, 物理隔离:

```bash
git worktree add ../<project>-<task> HEAD
cd ../<project>-<task>
# 工作...
# 完成后
git worktree remove ../<project>-<task>
```

绝对隔离, 并发 session 不可能互相覆盖.

### 3. Edit 后验证预期 diff 大小

关键 edit 之后立即对比:

```bash
git diff --stat <file>
grep -c "<关键字>" <file>  # 预期值 vs 实际值
```

如果 diff 远小于预期 (e.g. 你改了 150 行但只显示 29 行) → 文件被覆盖, 用 `git log -p <file>` 或 `git reflog` 找回.

### 4. 修改共享脚本/规则前 git status

修改 `scripts/deploy/*.sh`、`.claude/rules/*`、`.claude/skills/*`、`pom.xml`、`package.json` 等共享文件前:

```bash
git status --short <file>
```

如显示 unstaged 变化而你不记得是自己做的 → **停手先确认**, 不要直接 edit.

### 5. 避免同时打开同一文件

- **Cursor/VSCode auto-save** 会覆盖外部修改. Claude 正在改的文件不要在 IDE 里打开 (哪怕只是查看).
- **多个 Claude Code chat** 同时 edit 一个文件会互相覆盖 — 不要并行 edit 同一文件.
- **必须并行时**: 用 git worktree 隔离, 或者明确分工 (session A 改 fileA, session B 改 fileB).

---

## 优先级组合 (Apr 8 事故总结)

| 场景 | 方案 |
|---|---|
| 单 session 内改 3+ 文件 | 里程碑 commit (规则 1) |
| 2+ chat 都要改同一文件 | git worktree 隔离 (规则 2) |
| 不确定是否并发 | git status 防御 (规则 4) + 关闭其他 editor (规则 5) |
| 长期约束 | 这个 rule 本身 + memory `feedback_concurrent_edit_safety.md` |

**Apr 8 事故正确做法**: Phase C 产品化应该用 **规则 1 + 规则 2** — 开 worktree 跑完整流程, 每个 phase 完成立即 commit.
