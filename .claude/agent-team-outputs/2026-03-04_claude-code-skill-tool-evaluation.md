# Claude Code Skill 发现与管理工具评估报告

**日期**: 2026-03-04
**模式**: Full (5 agents + Fact-Check)
**研究主题**: 评估 6 个 Claude Code Skill 发现与管理工具，找出最适合白垩纪食品溯源系统项目的方案

---

## Executive Summary

**推荐**: 维持官方原生 Skill 机制（`.claude/skills/` 本地目录）作为唯一管理层，配合强制 pre-commit 凭证扫描钩子（trufflehog/git-secrets），完全回避第三方 Skill 注册表。

**理由**: 项目已有 33 个本地 Skill 形成完整闭环，无外部注册表需求。第三方生态存在系统性安全危机（Snyk ToxicSkills: ~13% 严重漏洞，76 个恶意 payload）。自建私有 registry（tech-leads-club 模式）维护成本超过收益。

**最紧迫风险**: 3 套 AccessKey 明文散落在仓库中（`.claude/rules/aliyun-credentials.md` 2 套 + `.claude/skills/aliyun-operations/SKILL.md` 1 套），凭证轮换比工具选型更紧迫。

> ⚠️ **Fact-check notice**: 研究过程中发现 5 项声明无法核实或存疑（详见附录），但不影响核心结论方向。

---

## Comparison Matrix

| 评估维度 | 官方原生机制 | tech-leads-club | @daymade/ccpm | kaldown/ccpm | SkillsMP/claude-plugins.dev | 手工管理(现状) |
|---|---|---|---|---|---|---|
| **冲突风险** | 低（命名空间隔离） | 低 | 高 | 中 | 高 | 无 |
| **凭证安全** | 中（9种安全钩子） | 高（CI/CD+mcp-scan） | 低 | 低 | 极低 | 中（已泄露） |
| **安装便捷性** | 中（/plugin install） | 高（git clone） | 中（npm） | 低（Rust TUI） | 高 | 低 |
| **Skill 发现** | 弱 | 弱 | 弱 | 极弱（12 skills） | 强（87k+） | 无 |
| **项目适配性** | 中 | 高（可定制） | 低 | 低 | 低 | 高（已适配） |
| **长期可维护** | 高（Anthropic 官方） | 中 | 极低（v0.x） | 低 | 低 | 高（自控） |
| **社区规模** | 高 | 中 | 极低 | 低 | 高 | N/A |
| **推荐等级** | ✅ 基础层 | ⚠️ 条件推荐 | ❌ 不推荐 | ❌ 不推荐 | ❌ 禁用 | ✅ 增强后继续 |

---

## Consensus & Disagreements

| 主题 | 研究员 | 分析师 | 批评者 | 最终裁定 |
|------|--------|--------|--------|----------|
| 官方原生为基础层 | 支持 | 支持 | 降级（CVE 漏洞） | **采纳（中等置信）** |
| 回避第三方注册表 | 支持 | 支持 | 支持 | **完全采纳** |
| tech-leads-club 自建 | 推荐 | 可选 | 反对（维护成本） | **不采纳** |
| 凭证泄露最高优先 | 支持 | 支持 | 升级严重性 | **完全采纳 Critic** |
| ghproxy 供应链风险 | 未提及 | 未评估 | 新发现 | **有效，中等优先** |

---

## Confidence Assessment

| 结论 | 置信度 | 说明 |
|------|--------|------|
| 官方原生 Skill 机制最适合本项目 | ★★★★☆ | 3 个智能体一致；33 个 Skill 已形成闭环 |
| 完全回避第三方注册表 | ★★★★★ | 一致共识；安全数据方向一致（具体数字存疑） |
| 不采用 tech-leads-club 自建 registry | ★★★☆☆ | Critic 反驳有力；维护成本是主要争议 |
| 凭证泄露优先级最高 | ★★★★★ | 代码验证：3 套 AccessKey 散落 |
| ghproxy 供应链风险（中等） | ★★★☆☆ | 仅 Critic 提出；需进一步审计 |

---

## Actionable Recommendations

### Immediate（今天执行）

1. **轮换 3 套 AccessKey**
   - `LTAI5tCChEydQf5sXWc8iRn9`（aliyun-operations/SKILL.md:107）
   - `LTAI5tD9HGcb6Mgafs98ZYcq`（aliyun-credentials.md 账号 A）
   - `LTAI5tGjGs6wnKDk8BZDNKFL`（aliyun-credentials.md 账号 B）
   - 在阿里云控制台创建新 Key → 更新服务器环境变量 → 删除旧 Key

2. **安装 pre-commit 凭证扫描钩子**
   ```bash
   pip install pre-commit trufflehog
   # 配置 .pre-commit-config.yaml 添加 trufflehog 规则
   pre-commit install
   ```

3. **清理明文凭证**
   - `aliyun-operations/SKILL.md` 第 107-108 行改为 `${ALIBABA_CLOUD_ACCESS_KEY_ID}` 环境变量引用
   - 评估是否需要 `git filter-repo` 清理 git 历史

### Short-term（本周内）

4. **新建 `credential-audit/SKILL.md`** — 定期扫描 `.claude/` 目录的凭证模式操作规程
5. **修改 `deploy-backend.sh`** — ghproxy 下载的 MD5 校验改为 GitHub 官方 Release SHA-256

### Conditional（团队扩大后）

6. **重新评估 tech-leads-club/agent-skills** — 3 人以上团队才有私有 registry 的维护价值

---

## Open Questions

1. `LTAI5tCChEydQf5sXWc8iRn9` 对应哪台服务器？（aliyun-operations 中的第三套 Key）
2. 仓库是否为公开仓库？若是，凭证可能已被扫描器采集
3. `deploy-backend.sh` 的 MD5 校验值来源是 GitHub 还是镜像站自报？
4. superpowers 框架是否有包装现有 SKILL.md 的价值？（当前判断：无需）

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (parallel)
- Browser explorer: OFF
- Total sources found: 24 findings from 30+ sources
- Key disagreements: 3 resolved (tech-leads-club 不采纳、凭证严重性升级、ghproxy 纳入), 1 unresolved (mcp-scan 扫描边界)
- Phases completed: Research → Analysis → Critique → Integration → Fact-Check → Heal
- Fact-check: 10 claims checked — 4 ✅ verified, 1 ⚠️ partial, 5 ❓ unverifiable
- Healer: structural completeness ✅, cross-reference integrity ✅ (after fact-check corrections), confidence consistency ✅, actionable recommendations ✅

---

## Appendix A: Fact-Check Report

| # | 声明 | 状态 | 纠正 |
|---|------|------|------|
| 1 | anthropics/skills 83k stars | ❓ 无法核实 | 仓库名/数字可能有误 |
| 2 | superpowers 69.9k stars, MIT, v4.1.1 | ✅ 已核实 | — |
| 3 | Anthropic 2026-01-09 技术封锁 | ✅ 已核实 | 日期为 1/5-9 窗口期 |
| 4 | CVE-2025-59536, CVE-2026-21852 | ❓ 高度存疑 | NVD 无记录，编号可能虚构 |
| 5 | ClawHub 20% 恶意 (Bitdefender) | ❓ 来源归属错误 | 应为 Snyk，非 Bitdefender |
| 6 | Snyk ToxicSkills 13.4%/283/76 | ⚠️ 部分准确 | 76 恶意确认；283 凭证泄露数字无法核实 |
| 7 | tech-leads-club mcp-scan + 100%开源 | ✅ 已核实 | — |
| 8 | claude-plugins-official 8.9k stars | ❓ 无法核实 | 仓库名可能有误 |
| 9 | Agent Skills spec 2025-12, OpenAI 采用 | ✅ 已核实 | — |
| 10 | @daymade/ccpm npm v0.2.1 | ❓ 无法核实 | npm 包不可查 |

**关键警示**: Claim #4 的两个 CVE 编号可能为 AI 幻觉产物。Critic 基于此 CVE 构建的"官方机制也有 RCE 漏洞"论点需降级处理，但其核心观点（凭证安全优先于工具选型）仍然成立。

---

## Appendix B: Healer Notes

- [Fixed] Critic 引用的 CVE-2025-59536/CVE-2026-21852 经 Fact-Check 无法核实 → 在主报告中降低该论点权重，但保留 Critic 的凭证安全文化论述（该论点不依赖 CVE 存在性）
- [Fixed] "20% 恶意包 (Bitdefender)" 来源归属错误 → 统一改为 "Snyk ToxicSkills 研究：~13% 严重漏洞"
- [Fixed] anthropics/skills 83k stars 无法核实 → 报告中不再引用具体 star 数字
- [Passed] 所有推荐的可操作性检查（每条均有具体步骤/命令）
- [Passed] 分析师与批评者的置信度差异已在 Integrator 阶段显式调和

---

## Sources

- [obra/superpowers](https://github.com/obra/superpowers) — 69.9k stars, MIT, v4.1.1
- [tech-leads-club/agent-skills](https://github.com/tech-leads-club/agent-skills) — CI/CD + mcp-scan
- [Snyk ToxicSkills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) — 恶意 Agent Skills 供应链
- [Cato Networks MedusaLocker](https://www.catonetworks.com/blog/cato-ctrl-weaponizing-claude-skills-with-medusalocker/) — SKILL.md 武器化
- [Anthropic Agent Skills Spec](https://github.com/anthropics/skills/blob/main/spec/agent-skills-spec.md) — 官方规格
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) — 官方插件文档
- [The New Stack: Agent Skills Open Standard](https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/)
- [VentureBeat: Third-party harness crackdown](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses)
- [Repello AI: Skill Security Audit](https://repello.ai/blog/claude-code-skill-security)
- [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
