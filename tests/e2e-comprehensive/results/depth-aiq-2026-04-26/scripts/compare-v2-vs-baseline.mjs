/**
 * Compare v2 conversation memory results against S3 baseline.
 *
 * Reads:
 *   qa-results.json                 (S3 baseline — followup-only, no session_id)
 *   qa-results.v2-conv-memory.json  (v2 — main+followup pairs sharing session_id)
 *
 * Outputs:
 *   - Per-tenant per-type bucket breakdown deltas (cache hit %, empty %, avg ms)
 *   - timeout_or_slow rate change (target: 11.5% → <5%)
 *   - 6 critical handoff cases side-by-side (qhj-fu-15-1, qhj-fu-13-1, gml-fu-01-2,
 *     xmx-fu-15-1, plus 2 controls).
 *
 * NOTE: This compares quantitative bucketing only. Quality scoring (1-5) requires
 * agent-team audit — invoke separately on this output.
 */
import { readFileSync, writeFileSync } from 'fs';

const ROOT = 'tests/e2e-comprehensive/results/depth-aiq-2026-04-26';
const BASELINE = `${ROOT}/qa-results.json`;
const V2 = `${ROOT}/qa-results.v2-conv-memory.json`;
const REPORT = `${ROOT}/v2-vs-baseline-report.md`;

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const v2 = JSON.parse(readFileSync(V2, 'utf8'));

const SPOTLIGHT_IDS = new Set([
  'qhj-fu-15-1',  // 哪个维度评分最低 为什么 — baseline 26s 0 字
  'qhj-fu-13-1',  // 流失会员的主因是什么 (qhj has reviews, not members — bad fit)
  'gml-fu-01-2',  // 如果停售 Top 1 影响多大 — baseline 28s LLM cold but accurate
  'xmx-fu-15-1',  // 流失会员的主因是什么 — baseline 30s timeout 0 字
  'qhj-fu-09-2',  // 和去年同月比差多少 — baseline 767ms cache hit (control)
  'gml-fu-09-2',  // 头部vs末位差距正确算 (control)
]);

function bucketStats(items) {
  const buckets = {};
  let total = 0;
  let totalMs = 0;
  let emptyCount = 0;
  let cacheCount = 0;
  for (const it of items) {
    if (!it.bucket) continue;
    buckets[it.bucket] = (buckets[it.bucket] || 0) + 1;
    total++;
    totalMs += it.totalMs || 0;
    if ((it.answerLen || 0) === 0) emptyCount++;
    if (it.source === 'materialized_cache') cacheCount++;
  }
  return {
    total,
    avgMs: total > 0 ? Math.round(totalMs / total) : 0,
    emptyPct: total > 0 ? +(emptyCount * 100 / total).toFixed(1) : 0,
    cachePct: total > 0 ? +(cacheCount * 100 / total).toFixed(1) : 0,
    timeoutPct: total > 0 ? +(((buckets.timeout_or_slow || 0) * 100 / total)).toFixed(1) : 0,
    buckets,
  };
}

function tenantSummary(label, results) {
  const tenants = ['qhj', 'gml', 'xmx'];
  const out = {};
  for (const t of tenants) {
    const fu = results.tenants?.[t]?.followup || [];
    out[t] = bucketStats(fu);
  }
  return out;
}

function findById(results, tenant, id) {
  const all = [
    ...(results.tenants?.[tenant]?.main || []),
    ...(results.tenants?.[tenant]?.followup || []),
  ];
  return all.find(x => x.id === id);
}

function deltaLine(label, baselineV, v2V) {
  const delta = (v2V - baselineV).toFixed(1);
  const sign = v2V > baselineV ? '+' : '';
  return `${label}: ${baselineV} → ${v2V} (${sign}${delta})`;
}

const baselineSummary = tenantSummary('baseline', baseline);
const v2Summary = tenantSummary('v2', v2);

let out = `# v2 conv memory vs S3 baseline — quantitative deltas\n\n`;
out += `Generated: ${new Date().toISOString()}\n`;
out += `Baseline file: ${BASELINE}\n`;
out += `v2 file: ${V2}\n\n`;

out += `## Followup buckets (baseline → v2)\n\n`;
out += `| Tenant | total | cache % | empty % | timeout % | avg ms |\n`;
out += `|---|---|---|---|---|---|\n`;
for (const t of ['qhj', 'gml', 'xmx']) {
  const b = baselineSummary[t];
  const v = v2Summary[t];
  out += `| **${t}** | ${b.total}→${v.total} | ${b.cachePct}→${v.cachePct} | ${b.emptyPct}→${v.emptyPct} | ${b.timeoutPct}→${v.timeoutPct} | ${b.avgMs}→${v.avgMs} |\n`;
}

// Aggregate "All"
const allAgg = (sum) => {
  const allFu = ['qhj', 'gml', 'xmx'].flatMap(t => sum.tenants?.[t]?.followup || []);
  return bucketStats(allFu);
};
const bAll = allAgg(baseline);
const vAll = allAgg(v2);
out += `| **All** | ${bAll.total}→${vAll.total} | ${bAll.cachePct}→${vAll.cachePct} | ${bAll.emptyPct}→${vAll.emptyPct} | ${bAll.timeoutPct}→${vAll.timeoutPct} | ${bAll.avgMs}→${vAll.avgMs} |\n`;

out += `\n**Targets** (per handoff §3): cache % approximately stable, empty % drop, timeout % 11.5 → <5, avg ms ideally lower.\n\n`;

// Spotlight cases
out += `## Spotlight: 6 critical handoff cases\n\n`;
out += `| ID | type | baseline | v2 | answer cmp |\n`;
out += `|---|---|---|---|---|\n`;
for (const t of ['qhj', 'gml', 'xmx']) {
  for (const id of SPOTLIGHT_IDS) {
    if (!id.startsWith(t)) continue;
    const b = findById(baseline, t, id);
    const v = findById(v2, t, id);
    if (!b && !v) continue;
    const bLine = b ? `${b.totalMs}ms ${b.bucket} (${b.answerLen}c)` : '—';
    const vLine = v ? `${v.totalMs}ms ${v.bucket} (${v.answerLen}c)` : '—';
    let cmp;
    if (!b && !v) cmp = 'N/A';
    else if (b && !v) cmp = 'v2 missing';
    else if (!b && v) cmp = 'baseline missing';
    else {
      const d = v.totalMs - b.totalMs;
      cmp = d < 0 ? `🟢 ${Math.abs(d)}ms faster` : d > 0 ? `🔴 ${d}ms slower` : '⚪ same';
    }
    out += `| ${id} | ${(b || v).type || '?'} | ${bLine} | ${vLine} | ${cmp} |\n`;
  }
}

out += `\n## Bucket distribution (followup, both runs)\n\n`;
const allBuckets = new Set([...Object.keys(bAll.buckets), ...Object.keys(vAll.buckets)]);
out += `| Bucket | baseline | v2 | Δ |\n|---|---|---|---|\n`;
for (const k of allBuckets) {
  const bv = bAll.buckets[k] || 0;
  const vv = vAll.buckets[k] || 0;
  out += `| ${k} | ${bv} | ${vv} | ${vv - bv >= 0 ? '+' : ''}${vv - bv} |\n`;
}

out += `\n## 解读\n\n`;
out += `- timeout_or_slow 是核心指标 — handoff §3 期望 11.5% → <5%。\n`;
out += `- empty % 同样关键 — 没数据答案的 follow-up 应当大幅减少。\n`;
out += `- cache % 应保持/提高 (Phase 6 P1 reject mismatch 后会让一小撮 false positive 重新走 LLM,但 LLM 现在有 parent context, 总体质量应升).\n`;
out += `- 量化 bucket 只反映速度+空答率,不反映 1-5 评分。需要 agent-team 审计 qa-results.v2-conv-memory.json 才能算 综合分 vs 3.21 baseline.\n`;

writeFileSync(REPORT, out);
console.log(`Report written: ${REPORT}`);
console.log(`\n=== Summary ===`);
console.log(`baseline followup: ${bAll.total} total, ${bAll.cachePct}% cache, ${bAll.emptyPct}% empty, ${bAll.timeoutPct}% timeout, avg ${bAll.avgMs}ms`);
console.log(`v2       followup: ${vAll.total} total, ${vAll.cachePct}% cache, ${vAll.emptyPct}% empty, ${vAll.timeoutPct}% timeout, avg ${vAll.avgMs}ms`);
