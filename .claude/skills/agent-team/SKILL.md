---
name: agent-team
description: 编排多角色 Agent Team 深度研究工作流（研究员×2-3并行 → 分析师 → 批评者 → 整合者）。适用于技术调研、方案对比、竞品分析等需要多角度深度研究的任务。使用 /agent-team <研究主题> 触发。
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - WebSearch
  - WebFetch
  - Write
---

# Agent Team — Deep Research Workflow

Orchestrate a multi-agent research and analysis workflow with parallel research, structured analysis, critical review, and integrated reporting.

## Trigger

User invokes `/agent-team <research topic or question>`

## Workflow

When triggered, execute the following phases in order. The argument after `/agent-team` is the **research topic**.

### Phase 0: Planning (You — the Manager)

1. Parse the research topic from the user's input
2. **Detect output language**: if the topic contains CJK characters (Chinese/Japanese/Korean), set `OUTPUT_LANGUAGE=Chinese`; otherwise set `OUTPUT_LANGUAGE=English`. Pass this to ALL agent prompts.
3. **Extract user context** (if available): check the current project's CLAUDE.md for tech stack, environment, and constraints. Summarize in 1-2 sentences as `USER_CONTEXT` to pass to Analyst and Critic.
4. **Detect codebase grounding need**: Set `CODEBASE_GROUNDING=true` if topic matches ANY:
   - 项目路径关键词: `backend/`, `frontend/`, `web-admin/`, `SmartBI`, `smartbi`, `TwoStage`, `AIIntentService`, `IntentExecutor`, `DashScope`, `chart_builder`, `insight_generator`, `python/`, `java/`, `agents/`, `skills/`, `vite.config`, `application.properties`, `main.py`, `KPICard`, `DashboardBuilder`
   - 中文所有权词: `我们的`、`本项目`、`当前系统`、`现有代码`、`项目里`、`已有的`、`系统里`、`项目中`、`我们现在`、`目前的`
   - 项目专有名词: `Cretas`、`AIMS`、`食品溯源`、`SmartBIAnalysis`、`KPICard`、`IntentDisambiguation`、`LinUCB`、`agent-team`、`CrossSheetAggregator`、`FinanceAnalysis`、`DemoTour`、`PythonSmartBI`
   - 代码检查动词: `怎么实现的`、`现在是怎么`、`代码里`、`源码`、`排查`、`为什么我们`、`看看代码`、`检查一下`、`分析一下我们`、`优化我们`、`review`、`audit`
   - 泛化模式: any mention of specific file names (e.g., `*.vue`, `*.java`, `*.py`, `*.ts`) or line numbers (e.g., `line 42`, `:245`)

   Default: `CODEBASE_GROUNDING=false`

   Pass to ALL agent prompts. When `CODEBASE_GROUNDING=true`, add to the announce block:
   > Grounding: ENABLED — agents will verify claims against actual source code
5. **Assess complexity** to select mode using these heuristics:
   - **Quick mode** (2 agents) — select when ALL of these are true:
     - Topic is a single factual question or explanation ("what is X", "explain Y", "how does Z work")
     - No comparison keywords: `vs`、`对比`、`比较`、`A还是B`、`哪个更好`、`优缺点`、`选择`
     - No multi-faceted structure (only 1 clear answer expected)
     - `CODEBASE_GROUNDING=false` (grounding topics are inherently multi-faceted → Full)
     → 1 Researcher (sonnet) + 1 Analyst-Critic combo (opus)
     → Skip Integrator, Manager directly presents
   - **Full mode** (5+ agents) — select when ANY of these are true:
     - Contains comparison keywords (`vs`、`对比`、`比较`、`A还是B`、`哪个更好`、`tradeoff`)
     - Strategic/architectural decision ("should we", "应该用", "迁移", "重构", "migrate")
     - Multi-faceted topic requiring 2+ research angles
     - `CODEBASE_GROUNDING=true`
     → Full 4-phase pipeline as below
   - **When in doubt, choose Full mode** — it's better to over-research than under-research
6. Break the topic into 2-3 **independent research angles** suitable for parallel investigation
7. Announce the plan to the user:
   ```
   ## Agent Team: [topic]

   Mode: [Quick/Full] | Language: [Chinese/English]

   Research angles:
   1. [Angle A] — official docs & technical specs
   2. [Angle B] — community experience & real-world usage
   3. [Angle C] — alternatives & competitive landscape  (Full mode only)

   Phases: Research (parallel) → Analysis → Critique → Integration
   ```

---

### Phase 1: Parallel Research (Researcher agents)

Launch 2-3 **Task** tool calls **in parallel**, each using `subagent_type: "general-purpose"` and `model: "sonnet"`. Each task should:

- Reference the `researcher` agent role
- Assign a specific research angle
- Include the research topic and any constraints from the user
- Set `max_turns: 12` when `CODEBASE_GROUNDING=true` (code exploration needs extra turns), otherwise `max_turns: 8`
- Include the output language instruction

**Prompt template for each researcher:**
```
You are acting as a Researcher agent. Read .claude/agents/researcher.md for your full role definition and output format.

Research topic: [TOPIC]
Your angle: [SPECIFIC ANGLE]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.

Instructions:
1. Search for sources relevant to your angle on this topic
2. Collect up to 8 findings with exact quotes and source URLs
3. Rate each source's reliability (1-5 stars)
4. Note any contradictions between sources
5. Output in the exact format specified in researcher.md

[ONLY include the following block when CODEBASE_GROUNDING=true]
Codebase grounding: ENABLED.
MANDATORY: Before any web search, spend your first 2-3 turns exploring the actual codebase:
- Use Glob to locate relevant source files (e.g., **/*SmartBI*.vue, **/*chart_builder*.py)
- Use Grep to find class/function/config references
- Use Read to examine the 2-4 most relevant files in detail
Document your codebase findings as "Codebase Evidence" (★★★★★ reliability) FIRST in your Key Findings table, then supplement with web search sources.
[End conditional block]

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Researcher Output"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**After Phase 1, output progress to the user:**
> Research complete — N researchers collected M findings from X sources.

**Output validation**: If any researcher's Task result does NOT contain "## Researcher Output", resume that agent once with feedback: "Your output is missing the required '## Researcher Output' header. Please output your complete structured report now." If the second attempt also lacks the marker, extract any partial findings from the response, prefix with `[PARTIAL — incomplete output]`, and pass downstream. Do NOT discard partial data silently.

---

### Phase 2: Analysis (Analyst agent) — Full mode only

**Compress researcher outputs** before passing downstream: convert each researcher's findings to compact format (1 line per finding):
```
=== RESEARCHER A (condensed) ===
1. [★★★★★] Finding summary — source: URL
2. [★★★★☆] Finding summary — source: URL
...
```

Launch a single **Task** call with `subagent_type: "general-purpose"` and `model: "opus"`:

**Prompt template:**
```
You are acting as an Analyst agent. Read .claude/agents/analyst.md for your full role definition and output format.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.
User context: [USER_CONTEXT]

Below are the condensed research findings from our team:

=== RESEARCHER A (condensed) ===
[paste condensed findings — 1 line per finding, max 8 lines]

=== RESEARCHER B (condensed) ===
[paste condensed findings]

=== RESEARCHER C (condensed) ===  (if applicable)
[paste condensed findings]

Instructions:
1. Create a comparison matrix covering all options found
2. Identify patterns across the research
3. Build a decision framework for the user's specific context
4. Assess risks and data gaps
5. Output in the exact format specified in analyst.md

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Analyst Output"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**After Phase 2, output progress to the user:**
> Analysis complete — comparison matrix covers N dimensions across M options.

**Output validation**: If the Task result does NOT contain "## Analyst Output", resume that agent once with feedback specifying what's missing. If still incomplete, extract partial content, mark as `[PARTIAL]`, and pass downstream with a quality warning to the Critic.

---

### Phase 2-Quick: Analysis + Critique combo — Quick mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` and `model: "opus"`:

**Prompt template:**
```
You are acting as a combined Analyst + Critic agent. Read both .claude/agents/analyst.md and .claude/agents/critic.md for role definitions.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.
User context: [USER_CONTEXT]

Below are the research findings:

=== RESEARCHER (condensed) ===
[paste condensed findings]

Instructions — do BOTH:

PART 1 (Analyst): Create a structured analysis with comparison matrix, decision framework, and risk assessment per analyst.md format.

PART 2 (Critic): Now adopt a completely different perspective — imagine you are a skeptical external reviewer who has NOT seen PART 1's reasoning process. Re-examine the evidence independently. Challenge claims with weak evidence; verify and confirm claims with strong evidence. Provide revised confidence levels per critic.md format.

Output both parts in sequence: "## Analyst Output" followed by "## Critic Output".

[ONLY include the following block when CODEBASE_GROUNDING=true]
Codebase grounding: ENABLED.
For PART 1 (Analyst): Your Comparison Matrix first column must be "当前实现" citing actual code file:line references from the Researcher's codebase evidence.
For PART 2 (Critic): Before writing challenges, use Read/Grep to verify at least 2 code-related claims. Add a "### Code Verification" table before your challenges.
[End conditional block]

CRITICAL: Your FINAL message must contain both "## Analyst Output" and "## Critic Output" sections. Do NOT end with a question.
```

**After Phase 2-Quick, output progress to the user:**
> Analysis & critique complete.

Then skip to **Phase 5** (Present Results) — the Manager synthesizes directly instead of using the Integrator.

---

### Phase 3: Critique (Critic agent) — Full mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` and `model: "opus"`:

**Prompt template:**
```
You are acting as a Critic agent. Read .claude/agents/critic.md for your full role definition and output format.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.
User context: [USER_CONTEXT]

Below is the analysis to critique:

=== ANALYST OUTPUT (condensed) ===
[Compress the Analyst output: keep Summary in full, convert Comparison Matrix to 1-line-per-row, keep Decision Framework and Risk Assessment in full (Critic needs these for verification), drop Strengths & Weaknesses and Data Gaps sections]

=== KEY RESEARCH FINDINGS (condensed) ===
[paste condensed researcher findings — 1 line per finding]

Instructions:
1. Challenge at least 2 major conclusions from the Analyst
2. Search for counterexamples and failure stories
3. Identify hidden assumptions
4. Rate failure modes by probability and impact
5. Provide revised confidence levels
6. Output in the exact format specified in critic.md

[ONLY include the following block when CODEBASE_GROUNDING=true]
Codebase grounding: ENABLED.
MANDATORY: Before writing challenges, verify at least 3 code-related claims from the Analyst by using Read/Grep on actual source files.
Any unverified claim about project behavior or implementation is an automatic challenge target.
Add a "## Code Verification" section BEFORE "## Challenges to Key Claims" in your output.
[End conditional block]

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Critic Output"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**After Phase 3, output progress to the user:**
> Critique complete — challenged N conclusions, found M counterarguments.

**Output validation**: If the Task result does NOT contain "## Critic Output", resume that agent once with feedback specifying what's missing. If still incomplete, extract partial content, mark as `[PARTIAL]`, and pass downstream.

---

### Phase 4: Integration (Integrator agent) — Full mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` and `model: "opus"`:

**Prompt template:**
```
You are acting as an Integrator agent. Read .claude/agents/integrator.md for your full role definition and output format.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.

Below are all team outputs to synthesize:

=== RESEARCHER OUTPUTS (condensed) ===
[paste condensed findings from all researchers]

=== ANALYST OUTPUT (condensed) ===
[Compress: Summary + Comparison Matrix (1-line-per-row) + Decision Framework key points + Risk top items. Drop verbose Strengths/Weaknesses prose.]

=== CRITIC OUTPUT (condensed) ===
[Compress: Overall Assessment + Challenges table (1-line-per-challenge) + Strongest Counterargument + Revised Confidence table. Drop verbose Hidden Assumptions and Failure Modes prose.]

Instructions:
1. Create an executive summary (under 100 words)
2. Map consensus and disagreements across agents
3. Assign final confidence levels
4. Provide actionable recommendations (immediate, short-term, conditional)
5. List open questions
6. Output in the exact format specified in integrator.md

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Final Integrated Report"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**Output validation**: If the Task result does NOT contain "## Final Integrated Report", resume that agent once with feedback specifying what's missing. If still incomplete, the Manager should synthesize directly from the Analyst and Critic outputs rather than presenting an empty report.

---

### Phase 5: Present Results (You — the Manager)

After all agents complete:

1. Present the **Executive Summary** to the user first
2. Then the full integrated report (from Integrator in Full mode, or your own synthesis in Quick mode)
3. Add a brief **Process Note**:
   ```
   ---
   ### Process Note
   - Mode: Quick/Full
   - Researchers deployed: N
   - Total sources found: N
   - Key disagreements: N resolved, N unresolved
   - Phases completed: Research → Analysis → Critique → Integration
   ```
4. **Save the full report** using the Write tool to:
   `.claude/agent-team-outputs/YYYY-MM-DD_topic-slug.md`
   where `topic-slug` is a kebab-case summary of the research topic (max 50 chars).
   This allows the user to review results later across sessions.
5. Inform the user: "Report saved to `.claude/agent-team-outputs/[filename]`"
6. Ask: "Would you like me to dive deeper into any section, or run additional research on specific points?"

---

## Error Handling

- **No results**: If a researcher finds no results for their angle, note the gap and proceed with available data
- **No counterarguments**: If the critic cannot find weak claims to challenge, explicitly state "All major claims verified — high confidence" (this is a valid positive outcome)
- **Timeout**: If any agent does not return within 3 minutes (roughly 15-20 turns), consider it timed out. Summarize what was gathered and note the incomplete phase. For Researcher timeouts in parallel, proceed with the successful researchers' data.
- **Empty output**: If a Task returns empty output (no expected format marker), resume the agent once with specific feedback about what's missing. If still empty after resume, extract any partial content, mark as `[PARTIAL]`, and pass downstream. Do NOT silently drop data.
- **Partial parallel failure**: If 2 of 3 Researchers succeed but 1 fails/times out, proceed with the 2 successful outputs. Note the missing angle in the Analyst prompt so it can flag the gap.

## Tips

- For technical comparison topics, angles could be: (A) official docs, (B) benchmarks/performance, (C) developer experience/community
- For strategic decisions, angles could be: (A) technical feasibility, (B) cost/effort analysis, (C) market trends/competition
- For debugging/investigation, angles could be: (A) error patterns, (B) similar issues in community, (C) code analysis
- Quick mode is ideal for: "what is MCP", "explain WebSockets", "how does X work"
- Full mode is ideal for: "React Native vs Flutter", "compare database options", "should we migrate to X"
