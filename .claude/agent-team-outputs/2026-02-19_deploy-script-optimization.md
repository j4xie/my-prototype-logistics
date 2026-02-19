# Agent Team Report: 优化部署脚本 (v2)

**Generated**: 2026-02-19
**Mode**: Full (5 agents) | **Language**: Chinese | **Codebase Grounding**: ENABLED
**Previous version**: Overwrites earlier report from same day

---

## Executive Summary

部署脚本 `deploy-backend.sh` (587行, v4.0) 核心设计已在生产验证 — 并行上传竞争、MD5两层校验、备份管理等都是亮点。**推荐选项B: 分阶段局部改进**，总投入 ~8h，避免 Ansible/蓝绿部署等过度工程。

---

## Implementation Priority

```
WEEK 1 (NOW)
├─ P0.1: Fix Python path deploy-smartbi-python.sh:44 (30 min)
├─ P0.2: Verify IP consistency across all 9 deploy scripts (15 min)
└─ P0.3: Document R2 Account ID as non-secret (5 min)

WEEK 2
├─ P1.1: Create scripts/lib/deploy-common.sh shared library (3 hours)
├─ P1.2: Refactor top 3 scripts to use shared library (1 hour)
└─ P1.3: Add structured logging with timestamps (1 hour)

WEEK 3+
├─ P2.1: Add --dry-run flag (2-3 hours)
├─ P2.2: Add --rollback command (2 hours)
├─ P3.1: Add set -u enforcement (2-3 hours)
└─ ❌ Blue-green deployment (NOT recommended — overkill)
```

---

## Consensus Map

| Topic | All Agree? | Final Verdict |
|-------|-----------|---------------|
| Python path bug P0 | YES (all 5) | Fix immediately — deploy-smartbi-python.sh:44 |
| Option B (局部改进) | YES (all 5) | Correct approach for small team |
| stat compat fix needed | NO → Critic wins | No fix needed (fallback works on MSYS) |
| Process cleanup over-engineered | NO → Critic wins | Keep (4 defensive layers are necessary) |
| R2 Account ID is security risk | NO → Critic wins | LOW risk (public ID, not credential) |
| set -u priority | NO → Critic wins | P3 not P1 (set -e already catches most) |
| GitHub mirrors useful | YES (all 5) | Keep (faster than SCP in China network) |
| Ansible migration | YES reject | Not for 1-2 dev team |
| Blue-green deploy | YES reject | Overkill for single server |

---

## P0.1: Python Deploy Path Fix (CRITICAL)

**File**: `deploy-smartbi-python.sh`, line 44
**Bug**: Script defines `REMOTE_DIR="/www/wwwroot/cretas/code/backend/python"` (line 9) but SSH session uses `cd /www/wwwroot/smartbi-python` (line 44) — wrong directory
**Fix**: Change line 44 from `cd /www/wwwroot/smartbi-python` to `cd $REMOTE_DIR`
**Impact**: Without fix, Python services deploy to nonexistent directory, service fails to start
**Confidence**: ★★★★★ (verified by all agents)

---

## P1: Shared Function Library Design

Create `scripts/lib/deploy-common.sh` with shared functions:

- `log()` — structured logging (ISO 8601 timestamps + levels)
- `cleanup_temp()` — unified temp directory cleanup
- `ssh_exec()` — SSH with timeout + error context
- `wait_for_health()` — health check with configurable retry
- `archive_backup()` — keep last N backups

---

## Rejected Approaches

| Approach | Cost | Why Rejected |
|----------|------|-------------|
| Ansible migration | 20-30h | Windows不原生支持, 小团队学习曲线过陡 |
| Blue-green deploy | 8-12h | 需双Tomcat+LB, 单服务器20-60s停机可接受 |
| 统一部署框架 | 8-12h | 短期收益不明显, 选项B足够 |
| 删除GitHub镜像 | - | 在中国比SCP快5-10x |
| 删除进程清理代码 | - | 4层防御是必要的, 不是过度工程 |

---

## Critic Corrections (3 False Positives Caught)

1. **stat命令兼容性** — Researcher A标记为bug, 但实际 `stat -f%z || stat -c%s` fallback在MSYS正常工作
2. **进程清理75行** — Researcher C认为过度工程, 但4种kill方法是防御性层次, 针对不同故障模式
3. **R2_ACCOUNT_ID泄露** — Researcher A标为P0安全, 但Account ID是公开信息(非凭证), 降为LOW

---

## Risk Assessment (Final)

| Risk | Prob | Impact | Priority |
|------|------|--------|----------|
| Python deploy path wrong (L44) | HIGH | HIGH | P0.1 |
| No shared function library | MED | MED | P1 |
| No --dry-run mode | MED | LOW | P2 |
| No --rollback command | LOW | MED | P2 |
| set -u missing | MED | LOW | P3 |
| R2 Account ID visible | LOW | LOW | Document only |

---

## Open Questions

1. 服务器 `/www/wwwroot/cretas/code/backend/python/` 实际部署内容验证?
2. 旧服务器 139.196.165.140 后端是否完全停止?
3. restart.sh 是否应调用共享库? (建议: 保持独立)
4. GitHub 镜像全部失败时, SCP fallback 启动延迟?
5. `/tmp` 空间是否始终 >= 180MB?

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (代码深度分析 + 最佳实践 + 简化分析)
- Total sources found: 19 (8 codebase + 11 external)
- Key disagreements: 5 resolved (stat, cleanup, R2, set-u, GitHub speed), 0 unresolved
- Phases completed: Research → Analysis → Critique → Integration
