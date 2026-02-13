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
4. **Assess complexity** to select mode:
   - **Quick mode** (2 agents): simple factual questions, single-technology topics, "what is X" type queries, topics with a single clear answer
     → 1 Researcher (haiku) + 1 Analyst-Critic combo (sonnet)
     → Skip Integrator, Manager directly presents
   - **Full mode** (5+ agents): comparisons, strategic decisions, multi-faceted topics, "A vs B" questions, architecture decisions
     → Full 4-phase pipeline as below
5. Break the topic into 2-3 **independent research angles** suitable for parallel investigation
6. Announce the plan to the user:
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

Launch 2-3 **Task** tool calls **in parallel**, each using `subagent_type: "general-purpose"` and `model: "haiku"`. Each task should:

- Reference the `researcher` agent role
- Assign a specific research angle
- Include the research topic and any constraints from the user
- Set `max_turns: 8` to prevent runaway searches
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

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Researcher Output"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**After Phase 1, output progress to the user:**
> Research complete — N researchers collected M findings from X sources.

**Output validation**: If any researcher's Task result does NOT contain "## Researcher Output", resume that agent once to retrieve the full output.

---

### Phase 2: Analysis (Analyst agent) — Full mode only

**Compress researcher outputs** before passing downstream: convert each researcher's findings to compact format (1 line per finding):
```
=== RESEARCHER A (condensed) ===
1. [★★★★★] Finding summary — source: URL
2. [★★★★☆] Finding summary — source: URL
...
```

Launch a single **Task** call with `subagent_type: "general-purpose"` (default model — sonnet):

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

**Output validation**: If the Task result does NOT contain "## Analyst Output", resume that agent once.

---

### Phase 2-Quick: Analysis + Critique combo — Quick mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` (default model — sonnet):

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

PART 2 (Critic): Challenge at least 2 conclusions from your own analysis. Search for counterexamples. Provide revised confidence levels per critic.md format.

Output both parts in sequence: "## Analyst Output" followed by "## Critic Output".

CRITICAL: Your FINAL message must contain both "## Analyst Output" and "## Critic Output" sections. Do NOT end with a question.
```

**After Phase 2-Quick, output progress to the user:**
> Analysis & critique complete.

Then skip to **Phase 5** (Present Results) — the Manager synthesizes directly instead of using the Integrator.

---

### Phase 3: Critique (Critic agent) — Full mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` (default model — sonnet):

**Prompt template:**
```
You are acting as a Critic agent. Read .claude/agents/critic.md for your full role definition and output format.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.
User context: [USER_CONTEXT]

Below is the analysis to critique:

=== ANALYST OUTPUT ===
[paste full analyst output]

=== KEY RESEARCH FINDINGS (condensed) ===
[paste condensed researcher findings — 1 line per finding]

Instructions:
1. Challenge at least 2 major conclusions from the Analyst
2. Search for counterexamples and failure stories
3. Identify hidden assumptions
4. Rate failure modes by probability and impact
5. Provide revised confidence levels
6. Output in the exact format specified in critic.md

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Critic Output"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**After Phase 3, output progress to the user:**
> Critique complete — challenged N conclusions, found M counterarguments.

**Output validation**: If the Task result does NOT contain "## Critic Output", resume that agent once.

---

### Phase 4: Integration (Integrator agent) — Full mode only

Launch a single **Task** call with `subagent_type: "general-purpose"` and `model: "haiku"`:

**Prompt template:**
```
You are acting as an Integrator agent. Read .claude/agents/integrator.md for your full role definition and output format.

Research topic: [TOPIC]
Output language: [OUTPUT_LANGUAGE] — write your ENTIRE output in this language.

Below are all team outputs to synthesize:

=== RESEARCHER OUTPUTS (condensed) ===
[paste condensed findings from all researchers]

=== ANALYST OUTPUT ===
[paste full analyst output]

=== CRITIC OUTPUT ===
[paste full critic output]

Instructions:
1. Create an executive summary (under 100 words)
2. Map consensus and disagreements across agents
3. Assign final confidence levels
4. Provide actionable recommendations (immediate, short-term, conditional)
5. List open questions
6. Output in the exact format specified in integrator.md

CRITICAL: Your FINAL message must be your complete structured output (starting with "## Final Integrated Report"). Do NOT end with a question or status update. The LAST thing you write must be the full formatted report.
```

**Output validation**: If the Task result does NOT contain "## Final Integrated Report", resume that agent once.

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

- If a researcher finds no results for their angle: note the gap, proceed with available data
- If the critic cannot find counterarguments: explicitly state "No strong counterarguments found" (this increases confidence)
- If any agent times out: summarize what was gathered and note the incomplete phase
- If a Task returns empty output (no expected format marker): resume the agent once; if still empty, note the gap and proceed

## Tips

- For technical comparison topics, angles could be: (A) official docs, (B) benchmarks/performance, (C) developer experience/community
- For strategic decisions, angles could be: (A) technical feasibility, (B) cost/effort analysis, (C) market trends/competition
- For debugging/investigation, angles could be: (A) error patterns, (B) similar issues in community, (C) code analysis
- Quick mode is ideal for: "what is MCP", "explain WebSockets", "how does X work"
- Full mode is ideal for: "React Native vs Flutter", "compare database options", "should we migrate to X"
