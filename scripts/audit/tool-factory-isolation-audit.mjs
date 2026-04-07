#!/usr/bin/env node
/**
 * factoryId Isolation Audit Script
 *
 * Scans all Tool implementations under ai/tool/impl/**\/*.java and audits
 * whether each Tool properly propagates the factoryId parameter through its
 * service/repository calls.
 *
 * Output:
 *   1. scripts/audit/audit-results.csv   - full matrix (one row per Tool)
 *   2. scripts/audit/audit-results.md    - human-readable summary with high-risk list
 *
 * Risk classification:
 *   HIGH      - doExecute signature missing factoryId, OR factoryId is never used in body
 *   MEDIUM    - factoryId is referenced but suspicious calls exist (findAll/findById w/o factoryId, hardcoded "F001" etc.)
 *   LOW       - factoryId is propagated to at least one service/repo call, no suspicious patterns
 *   EXEMPT    - Tool source contains whitelist marker "factoryId 隔离豁免说明" or "@FactoryIsolationExempt"
 *
 * Usage:
 *   node scripts/audit/tool-factory-isolation-audit.mjs
 *   node scripts/audit/tool-factory-isolation-audit.mjs --domain sales   # only audit sales domain
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TOOL_IMPL_ROOT = path.join(
  PROJECT_ROOT,
  'backend',
  'java',
  'cretas-api',
  'src',
  'main',
  'java',
  'com',
  'cretas',
  'aims',
  'ai',
  'tool',
  'impl'
);

// Parse args
const args = process.argv.slice(2);
const domainFilterIdx = args.indexOf('--domain');
const domainFilter = domainFilterIdx >= 0 ? args[domainFilterIdx + 1] : null;
const verbose = args.includes('--verbose');

// ────────────────────────────────────────────────────────────
// File discovery
// ────────────────────────────────────────────────────────────

/**
 * Recursively collect all .java files under dir.
 * @param {string} dir
 * @returns {string[]}
 */
function walkJavaFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJavaFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract domain (first subdir under impl/) from a Tool file path.
 * Returns 'root' if directly under impl/.
 */
function extractDomain(filePath) {
  const rel = path.relative(TOOL_IMPL_ROOT, filePath);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : 'root';
}

// ────────────────────────────────────────────────────────────
// Audit rules
// ────────────────────────────────────────────────────────────

/**
 * Extract the body of the doExecute method.
 * Returns null if doExecute is not found.
 */
function extractDoExecuteBody(src) {
  // Match doExecute signature: protected Map<String, Object> doExecute(String factoryId, ...)
  const sigMatch = src.match(
    /protected\s+Map<String,\s*Object>\s+doExecute\s*\(\s*([^)]*)\)\s*(throws[^{]*)?\{/
  );
  if (!sigMatch) return null;

  const signature = sigMatch[0];
  const paramsList = sigMatch[1];
  const startIdx = sigMatch.index + signature.length - 1; // position of '{'

  // Walk braces to find matching close
  let depth = 0;
  let i = startIdx;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) return null;

  return {
    signature,
    paramsList,
    body: src.slice(startIdx + 1, i),
  };
}

/**
 * Check if any line in the body uses factoryId as an argument to a method call.
 * Returns count of occurrences.
 */
function countFactoryIdArgs(body) {
  // Match method calls with factoryId as argument: .foo(factoryId, ...) or .foo(..., factoryId, ...)
  // Simple heuristic: any occurrence of "factoryId" that is NOT part of "getFactoryId" or a declaration
  const matches = body.match(/\bfactoryId\b/g) || [];
  // Exclude "String factoryId =" declarations
  let count = 0;
  for (const m of matches) count++;
  return count;
}

/**
 * Look for suspicious patterns that may indicate missing factoryId filter.
 * Returns array of warnings.
 */
function findSuspiciousPatterns(body, fileName) {
  const warnings = [];

  // 1. findAll() without factoryId nearby
  const findAllMatches = [...body.matchAll(/\.(findAll|findAllActive|findByDeletedAtIsNull)\s*\(\s*\)/g)];
  for (const m of findAllMatches) {
    const ctx = body.slice(Math.max(0, m.index - 60), m.index + 80);
    if (!ctx.includes('factoryId')) {
      warnings.push(`findAll() without factoryId nearby: ${m[0]}`);
    }
  }

  // 2. findById(...) without factoryId nearby (might be cross-factory lookup)
  const findByIdMatches = [...body.matchAll(/\.findById\s*\(\s*([^)]+)\)/g)];
  for (const m of findByIdMatches) {
    const ctx = body.slice(Math.max(0, m.index - 60), m.index + 100);
    // findById is OK if followed by .filter(x -> x.getFactoryId().equals(factoryId)) or similar
    if (!ctx.includes('factoryId') && !ctx.includes('getFactoryId')) {
      warnings.push(`findById() without factoryId guard: ${m[0]}`);
    }
  }

  // 3. Hardcoded factory ID strings (F001, F002, etc.)
  const hardcodedMatches = body.match(/"F\d{3,}"/g) || [];
  for (const m of hardcodedMatches) {
    warnings.push(`Hardcoded factory ID literal: ${m}`);
  }

  // 4. Native SQL without WHERE factory_id
  const nativeSqlMatches = [...body.matchAll(/(createNativeQuery|createQuery)\s*\(\s*"([^"]+)"/g)];
  for (const m of nativeSqlMatches) {
    const sql = m[2];
    if (/\bSELECT\b/i.test(sql) && !/factory[_]?id/i.test(sql)) {
      warnings.push(`Native SQL without factory_id: ${sql.slice(0, 80)}...`);
    }
  }

  // 5. Service method call suspicious patterns: anything ending in "Service.find" or "Repository.find" without factoryId
  // This is fuzzy — we just flag suspicious loops
  const serviceFindMatches = [...body.matchAll(/(\w+(?:Service|Repository))\.(find\w*|get\w*|query\w*|list\w*|count\w*)\s*\(([^)]*)\)/g)];
  for (const m of serviceFindMatches) {
    const callArgs = m[3];
    // Skip if factoryId is in the call args
    if (callArgs.includes('factoryId')) continue;
    // Skip if call args only contain other known-safe params
    // Only flag if the call looks like a lookup with no factoryId
    if (callArgs.trim() === '' || /^[a-zA-Z0-9_.,\s"']+$/.test(callArgs)) {
      warnings.push(`${m[1]}.${m[2]}(${callArgs.slice(0, 40)}) — no factoryId arg`);
    }
  }

  return warnings;
}

// ────────────────────────────────────────────────────────────
// Main audit
// ────────────────────────────────────────────────────────────

/**
 * Audit a single Tool .java file.
 * @returns {object} audit result
 */
function auditTool(filePath) {
  const fileName = path.basename(filePath);
  const domain = extractDomain(filePath);
  const relPath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
  const src = fs.readFileSync(filePath, 'utf8');

  const result = {
    fileName,
    domain,
    relPath,
    extendsAbstractBusinessTool: /extends\s+AbstractBusinessTool/.test(src),
    hasDoExecute: false,
    doExecuteSignature: null,
    factoryIdRefCount: 0,
    factoryIdIsInSignature: false,
    suspiciousPatterns: [],
    risk: 'UNKNOWN',
    reason: '',
  };

  // Whitelist check — Tool explicitly marked as exempt from factoryId isolation
  // (e.g., meta/governance tools operating on global entities, unimplemented stubs)
  if (/factoryId\s*隔离豁免说明|@FactoryIsolationExempt/.test(src)) {
    result.risk = 'EXEMPT';
    result.reason = '已声明 factoryId 隔离豁免（白名单）';
    return result;
  }

  // Non-BusinessTool utility: skip or mark as NOT_BUSINESS
  if (!result.extendsAbstractBusinessTool) {
    // Still check for factoryId references at all
    const allFactoryRefs = (src.match(/\bfactoryId\b/g) || []).length;
    result.factoryIdRefCount = allFactoryRefs;
    result.risk = allFactoryRefs === 0 ? 'NON_BUSINESS' : 'NON_BUSINESS_W_FACTORY';
    result.reason = '不是 AbstractBusinessTool 子类（可能是工具/查询类）';
    return result;
  }

  // Extract doExecute body
  const method = extractDoExecuteBody(src);
  if (!method) {
    result.risk = 'HIGH';
    result.reason = 'doExecute 方法未找到（Tool 定义异常）';
    return result;
  }

  result.hasDoExecute = true;
  result.doExecuteSignature = method.signature.replace(/\s+/g, ' ').trim();
  result.factoryIdIsInSignature = /String\s+factoryId/.test(method.paramsList);

  // Rule A: signature must have factoryId
  if (!result.factoryIdIsInSignature) {
    result.risk = 'HIGH';
    result.reason = 'doExecute 签名缺少 factoryId 参数';
    return result;
  }

  // Rule B: body must use factoryId at least once
  const factoryIdCount = countFactoryIdArgs(method.body);
  result.factoryIdRefCount = factoryIdCount;

  if (factoryIdCount === 0) {
    result.risk = 'HIGH';
    result.reason = 'doExecute body 中完全没有使用 factoryId（签名接收但从未使用）';
    return result;
  }

  // Rule C: suspicious patterns
  const warnings = findSuspiciousPatterns(method.body, fileName);
  result.suspiciousPatterns = warnings;

  if (warnings.length >= 3) {
    result.risk = 'HIGH';
    result.reason = `存在 ${warnings.length} 条可疑模式（findAll/findById/硬编码/裸 SQL）`;
  } else if (warnings.length >= 1) {
    result.risk = 'MEDIUM';
    result.reason = `存在 ${warnings.length} 条可疑模式需人工复核`;
  } else {
    result.risk = 'LOW';
    result.reason = `factoryId 被使用 ${factoryIdCount} 次，无可疑模式`;
  }

  return result;
}

// ────────────────────────────────────────────────────────────
// Report generation
// ────────────────────────────────────────────────────────────

function writeCsv(results, outPath) {
  const header = [
    'domain',
    'file',
    'relPath',
    'extends_AbstractBusinessTool',
    'has_doExecute',
    'factoryId_in_signature',
    'factoryId_ref_count',
    'suspicious_count',
    'risk',
    'reason',
  ].join(',');

  const rows = results.map((r) =>
    [
      r.domain,
      r.fileName,
      r.relPath,
      r.extendsAbstractBusinessTool,
      r.hasDoExecute,
      r.factoryIdIsInSignature,
      r.factoryIdRefCount,
      r.suspiciousPatterns.length,
      r.risk,
      `"${r.reason.replace(/"/g, '""')}"`,
    ].join(',')
  );

  fs.writeFileSync(outPath, [header, ...rows].join('\n'), 'utf8');
}

function writeMarkdown(results, outPath) {
  const byRisk = {
    HIGH: [],
    MEDIUM: [],
    LOW: [],
    EXEMPT: [],
    NON_BUSINESS: [],
    NON_BUSINESS_W_FACTORY: [],
    UNKNOWN: [],
  };
  for (const r of results) {
    (byRisk[r.risk] || byRisk.UNKNOWN).push(r);
  }

  const byDomain = {};
  for (const r of results) {
    if (!byDomain[r.domain]) byDomain[r.domain] = { HIGH: 0, MEDIUM: 0, LOW: 0, EXEMPT: 0, NON_BUSINESS: 0, total: 0 };
    byDomain[r.domain].total++;
    if (r.risk === 'HIGH') byDomain[r.domain].HIGH++;
    else if (r.risk === 'MEDIUM') byDomain[r.domain].MEDIUM++;
    else if (r.risk === 'LOW') byDomain[r.domain].LOW++;
    else if (r.risk === 'EXEMPT') byDomain[r.domain].EXEMPT++;
    else byDomain[r.domain].NON_BUSINESS++;
  }

  const md = [];
  md.push('# factoryId 隔离审计报告');
  md.push('');
  md.push(`**生成时间**: ${new Date().toISOString()}`);
  md.push(`**审计脚本**: scripts/audit/tool-factory-isolation-audit.mjs`);
  md.push(`**扫描目录**: backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/`);
  md.push('');
  md.push('## 总览');
  md.push('');
  md.push(`- **Total Tools 扫描数**: ${results.length}`);
  md.push(`- 🔴 **HIGH 风险**: ${byRisk.HIGH.length}`);
  md.push(`- 🟡 **MEDIUM 风险**: ${byRisk.MEDIUM.length}`);
  md.push(`- 🟢 **LOW 风险**: ${byRisk.LOW.length}`);
  md.push(`- ⚪ **EXEMPT（白名单豁免）**: ${byRisk.EXEMPT.length}`);
  md.push(`- ⚪ **NON_BUSINESS（非业务 Tool）**: ${byRisk.NON_BUSINESS.length + byRisk.NON_BUSINESS_W_FACTORY.length}`);
  md.push('');

  // Risk by domain
  md.push('## 按 Domain 分组');
  md.push('');
  md.push('| Domain | Total | HIGH | MEDIUM | LOW | EXEMPT | NON_BIZ |');
  md.push('|--------|-------|------|--------|-----|--------|---------|');
  const sortedDomains = Object.entries(byDomain).sort((a, b) => b[1].HIGH - a[1].HIGH);
  for (const [domain, stats] of sortedDomains) {
    md.push(
      `| ${domain} | ${stats.total} | ${stats.HIGH ? '**' + stats.HIGH + '**' : stats.HIGH} | ${stats.MEDIUM} | ${stats.LOW} | ${stats.EXEMPT} | ${stats.NON_BUSINESS} |`
    );
  }
  md.push('');

  // HIGH list
  md.push('## 🔴 HIGH 风险清单（立即修复）');
  md.push('');
  if (byRisk.HIGH.length === 0) {
    md.push('_无 HIGH 风险 Tool。_');
  } else {
    md.push('| # | Domain | File | 原因 |');
    md.push('|---|--------|------|------|');
    byRisk.HIGH.forEach((r, i) => {
      md.push(`| ${i + 1} | ${r.domain} | \`${r.fileName}\` | ${r.reason} |`);
    });
  }
  md.push('');

  // MEDIUM list
  md.push('## 🟡 MEDIUM 风险清单（人工复核）');
  md.push('');
  if (byRisk.MEDIUM.length === 0) {
    md.push('_无 MEDIUM 风险 Tool。_');
  } else {
    md.push('| # | Domain | File | 可疑模式数 | 示例 |');
    md.push('|---|--------|------|-----------|------|');
    byRisk.MEDIUM.forEach((r, i) => {
      const example = r.suspiciousPatterns[0] || '';
      md.push(
        `| ${i + 1} | ${r.domain} | \`${r.fileName}\` | ${r.suspiciousPatterns.length} | ${example.replace(/\|/g, '\\|').slice(0, 80)} |`
      );
    });
  }
  md.push('');

  // Details for HIGH+MEDIUM
  md.push('## 详情（HIGH + MEDIUM）');
  md.push('');
  for (const r of [...byRisk.HIGH, ...byRisk.MEDIUM]) {
    md.push(`### [${r.risk}] ${r.fileName}`);
    md.push(`- **路径**: \`${r.relPath}\``);
    md.push(`- **Domain**: ${r.domain}`);
    md.push(`- **原因**: ${r.reason}`);
    if (r.doExecuteSignature) {
      md.push(`- **签名**: \`${r.doExecuteSignature}\``);
    }
    md.push(`- **factoryId 引用次数**: ${r.factoryIdRefCount}`);
    if (r.suspiciousPatterns.length > 0) {
      md.push(`- **可疑模式**:`);
      for (const w of r.suspiciousPatterns) {
        md.push(`  - ${w.replace(/\|/g, '\\|')}`);
      }
    }
    md.push('');
  }

  // Non-business w/ factory
  if (byRisk.NON_BUSINESS_W_FACTORY.length > 0) {
    md.push('## ⚠️ 非 BusinessTool 但引用了 factoryId（建议人工 review）');
    md.push('');
    md.push('| # | Domain | File | factoryId 引用次数 |');
    md.push('|---|--------|------|-------------------|');
    byRisk.NON_BUSINESS_W_FACTORY.forEach((r, i) => {
      md.push(`| ${i + 1} | ${r.domain} | \`${r.fileName}\` | ${r.factoryIdRefCount} |`);
    });
    md.push('');
  }

  md.push('---');
  md.push('');
  md.push('## 建议后续动作');
  md.push('');
  md.push('1. **HIGH 风险**: 立即逐项修复并提交 PR，建议双人 review。');
  md.push('2. **MEDIUM 风险**: 人工复核每一条可疑模式，修复确认的真实漏洞。');
  md.push('3. **跨工厂 E2E 回归测试**: 建议每个 Repository 的 by-factory finder 加单元测试，确保跨工厂查询返回空。');
  md.push('4. **定期审计**: 建议 CI 增加 `node scripts/audit/tool-factory-isolation-audit.mjs` 作为门禁，发现 HIGH 立即阻塞合并。');
  md.push('');

  fs.writeFileSync(outPath, md.join('\n'), 'utf8');
}

// ────────────────────────────────────────────────────────────
// Entrypoint
// ────────────────────────────────────────────────────────────

function main() {
  console.log(`[audit] scanning ${TOOL_IMPL_ROOT}...`);
  let files = walkJavaFiles(TOOL_IMPL_ROOT);
  if (domainFilter) {
    files = files.filter((f) => extractDomain(f) === domainFilter);
    console.log(`[audit] --domain filter: ${domainFilter} → ${files.length} files`);
  }
  console.log(`[audit] found ${files.length} .java files`);

  const results = [];
  for (const f of files) {
    try {
      const r = auditTool(f);
      results.push(r);
      if (verbose) {
        console.log(`  [${r.risk.padEnd(25)}] ${r.fileName}`);
      }
    } catch (err) {
      console.error(`[audit] error on ${f}: ${err.message}`);
    }
  }

  // Sort: HIGH > MEDIUM > LOW > EXEMPT > NON_BUSINESS
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2, EXEMPT: 3, NON_BUSINESS_W_FACTORY: 4, NON_BUSINESS: 5, UNKNOWN: 6 };
  results.sort((a, b) => {
    const ra = order[a.risk] ?? 99;
    const rb = order[b.risk] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.fileName.localeCompare(b.fileName);
  });

  // Write outputs
  const outDir = path.join(PROJECT_ROOT, 'scripts', 'audit');
  const csvPath = path.join(outDir, 'audit-results.csv');
  const mdPath = path.join(outDir, 'audit-results.md');
  writeCsv(results, csvPath);
  writeMarkdown(results, mdPath);

  // Summary to stdout
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, EXEMPT: 0, NON_BUSINESS: 0, NON_BUSINESS_W_FACTORY: 0, UNKNOWN: 0 };
  for (const r of results) counts[r.risk] = (counts[r.risk] || 0) + 1;

  console.log('');
  console.log('[audit] ═══════════════════════════════════════');
  console.log(`[audit]   Total:    ${results.length}`);
  console.log(`[audit]   🔴 HIGH:   ${counts.HIGH}`);
  console.log(`[audit]   🟡 MED:    ${counts.MEDIUM}`);
  console.log(`[audit]   🟢 LOW:    ${counts.LOW}`);
  console.log(`[audit]   ⚪ EXEMPT: ${counts.EXEMPT}`);
  console.log(`[audit]   ⚪ N/A:    ${counts.NON_BUSINESS + counts.NON_BUSINESS_W_FACTORY}`);
  console.log('[audit] ═══════════════════════════════════════');
  console.log('');
  console.log(`[audit] CSV:  ${path.relative(PROJECT_ROOT, csvPath)}`);
  console.log(`[audit] MD:   ${path.relative(PROJECT_ROOT, mdPath)}`);

  // Exit code: non-zero if HIGH risks found (CI-friendly)
  if (counts.HIGH > 0) {
    console.log('');
    console.log(`[audit] ⚠️  ${counts.HIGH} HIGH risk tools detected — review audit-results.md immediately`);
    process.exit(1);
  }
}

main();
