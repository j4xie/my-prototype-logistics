# Agent Team Report: 优化部署脚本

**Generated**: 2026-02-19
**Mode**: Full | **Language**: Chinese | **Codebase Grounding**: ENABLED

---

## Final Integrated Report

### Executive Summary

- **建议**: 采用"局部改进"路径，分4个优先级修复现有部署脚本的安全漏洞和可靠性问题，预计工时1-2天
- **置信度**: 高 — 3个Agent对核心问题达成共识，关键结论均经代码验证
- **核心风险**: 明文密码`R8mwtyFEDMDPBwC8`出现在12处文件中（含Git历史），且3个部署脚本仍指向已停用的旧服务器139.196.165.140
- **时间影响**: P0密码修复30分钟，P1-P2修复半天，P3新建脚本半天
- **工作量**: 低-中（修改8-10个文件，无架构变更）

---

### Consensus & Disagreements

| 主题 | Researcher | Analyst | Critic | 最终裁定 |
|------|-----------|---------|--------|----------|
| 明文密码数量 | 发现3处脚本 | 采信3处，估10min | 纠正为5+脚本+1个properties，需30min | **Critic正确**: 代码验证实际为12处文件含`R8mwtyFEDMDPBwC8` |
| scripts/deploy.sh能否删除 | 归类为"废弃脚本" | 建议删除 | 发现`deploy-backend.sh` L133 SSH远程调用此脚本，不可删 | **Critic正确**: 代码验证L133确认存在远程调用依赖 |
| R2环境变量abort bug | 发现`:?`语法问题 | 归为P2 | 建议提升至P0 | **Critic更合理**: 维持P0-a立即修复 |
| Graceful shutdown | 行业最佳实践建议添加 | 列入方案 | 发现当前未配置`server.shutdown=graceful`，分析师误报为已有能力 | **Critic正确**: grep确认无此配置 |
| 旧服务器IP数量 | 发现11个脚本 | 采信11个 | 纠正为30+引用 | **核心部署脚本中需修改的为3个** |
| 健康检查不一致 | 发现deploy-backend.sh仅sleep 8+单次curl | 建议统一30次重试 | 验证确认 | **全员共识** |

---

### Detailed Analysis

#### 1. 明文密码泄露（P0 — 安全）

**支持证据**: 代码验证确认`R8mwtyFEDMDPBwC8`出现在12个文件中:
- 部署脚本: `restart-prod.sh`, `deploy-first-time.sh`
- 配置文件: `application-prod.properties`
- 测试脚本: `test_runner.sh`, `schema_validator.sh`, `check_environment.sh`
- 迁移脚本: `migrate-mysql-to-pg.py`
- 文档: 多个README/GUIDE文件

**反面考量**: 此密码对应旧MySQL数据库(creats-test)，当前生产环境已迁移至PostgreSQL(`pg-prod` profile)。

**净评估**: 即使旧数据库已停用，密码仍在Git历史中。应替换为环境变量引用，并在旧服务器上轮换密码。

#### 2. 备份即删Bug（P1 — 可靠性）

**支持证据**: `scripts/deploy.sh` L49备份JAR为`.bak`，L69立即`rm -f`删除该备份。如果JAR启动失败，回滚能力为零。

**对比**: `deploy-backend.sh` L499-503的备份逻辑正确 — 保留带时间戳的备份，仅保留最近3份。

**净评估**: 应将备份逻辑对齐到deploy-backend.sh的模式。

#### 3. R2环境变量导致脚本Abort（P0-a — 可用性）

**支持证据**: `deploy-backend.sh` L40-41使用`:?`语法，在`set -e`环境下未设R2变量时整个脚本退出。

**净评估**: 将`:?`改为`:-""`，R2可用性在后续`HAS_R2`检查中已有保护。单行改动，零风险。

#### 4. 旧服务器IP残留（P0-b — 运维）

3个核心部署脚本仍指向已停用的旧服务器:
- `deploy-smartbi-python.sh`
- `deploy-embedding.sh`
- `deploy-error-analysis.sh`

#### 5. 健康检查不一致（P1 — 可靠性）

`deploy-backend.sh` L547仅`sleep 8` + 单次`curl`。应复用`deploy-first-time.sh`的30次重试逻辑。

#### 6. 缺少前端/Python统一部署路径（P3 — 完整性）

前端部署为手动`scp`命令。建议修复现有`deploy-smartbi-python.sh`并创建简单的`deploy-web-admin.sh`。

---

### Confidence Assessment

| 结论 | 置信度 | 基于 | 证据基础 |
|------|--------|------|----------|
| 明文密码出现在12个文件中 | ★★★★★ | 3个Agent共识 + grep验证 | 代码验证 + 外部共识 |
| scripts/deploy.sh不可删除 | ★★★★★ | Critic发现 + L133代码验证 | 代码验证 |
| 备份即删bug存在 | ★★★★★ | 3个Agent共识 + L49/L69验证 | 代码验证 |
| R2 `:?`语法导致abort | ★★★★★ | 3个Agent共识 + L40-41验证 | 代码验证 + 外部共识 |
| 健康检查sleep 8不足 | ★★★★☆ | 3个Agent共识，缺实际启动时间数据 | 代码验证 |
| 3个脚本指向旧服务器 | ★★★★★ | grep验证3个核心脚本 | 代码验证 |
| 当前未配置graceful shutdown | ★★★★★ | Critic纠正 + grep确认 | 代码验证 |
| Docker化不适合当前阶段 | ★★★★☆ | 单人项目现状 | 仅外部来源 |

---

### Actionable Recommendations

**1. 立即执行（30分钟）**

- [局部修改] **P0-a: R2变量abort修复** — `deploy-backend.sh` L40-41将`:?`改为`:-""`
- [局部修改] **P0-b: 旧服务器IP修正** — 修改3个脚本的SERVER变量为`47.100.235.168`

**2. 本周完成（半天）**

- [局部修改] **P1-a: 修复scripts/deploy.sh备份逻辑** — 删除L69的`rm -f`，改为带时间戳备份+保留3份
- [局部修改] **P1-b: 统一健康检查** — 提取重试函数，替换sleep 8+单次curl
- [局部修改] **P1-c: deploy-backend.sh添加JAVA_HOME** — L157添加JAVA_HOME设置
- [无需代码改动] **P1-d: 密码处理** — 12处明文密码替换为环境变量引用

**3. 条件性执行**

- [局部修改] **P3: 前端部署脚本** — 当手动scp频率>每周2次时创建`deploy-web-admin.sh`
- [局部修改] **P4: Graceful shutdown** — 添加`server.shutdown=graceful`配置
- [架构级] **P5: Docker化** — 仅当团队扩展至3+人时考虑

---

### Open Questions

1. 旧MySQL数据库是否仍可远程访问？密码泄露实际风险取决于此
2. `deploy-backend.sh`的`--git`模式是否仍在使用？
3. Java后端实际启动时间是多少？决定健康检查重试合理值
4. `application-prod.properties`是否仍被任何profile加载？

---

### Process Note
- Mode: Full
- Researchers deployed: 3（代码审计、行业实践、优化方案）
- Total sources found: 12+代码文件直接验证 + 行业文档
- Key disagreements: 4 resolved, 1 unresolved (R2分类)
- Phases completed: Research → Analysis → Critique → Integration
