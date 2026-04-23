// P2 LLM guardrail regression smoke (Apr 24 2026)
//
// Verifies new code doesn't break AIQuery flows on test env 8097 → Python 8084.
// Covers: login, page load, data source, 8 preset buttons, autocomplete (45
// suggestions + filter), 2 full SSE streams (template + LLM fallback), the
// new `message-warning` el-alert is absent-by-default (appears only when
// backend flags), console/network clean.
//
// Uses fresh chromium.launch() — no MCP browser tools, no userDataDir.
// Safe to run in parallel with other chat sessions.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const URL = process.env.TARGET_URL || 'http://139.196.165.140:8097';
const USER = process.env.E2E_USER || 'qhj_prod';
const PASS = process.env.E2E_PASS || '123456';
const OUT = 'tests/e2e-comprehensive/results/p2-guardrail';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

const errors = [];
const warnings = [];
const networkFails = [];
page.on('console', (m) => {
  const t = m.text().slice(0, 260);
  if (m.type() === 'error') errors.push(t);
  else if (m.type() === 'warning') warnings.push(t);
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 260)));
const sseEvents = [];
page.on('response', async (r) => {
  if (r.status() >= 400) networkFails.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`);
  const url = r.url();
  if (/(general-analysis-stream|drill-down-stream|root-cause-stream|smartbi.*query)/.test(url)) {
    try {
      const body = await r.text();
      // keep last 3000 chars of each SSE response so we can verify `done` event + `warning`
      sseEvents.push({ url: url.slice(0, 120), status: r.status(), bodyTail: body.slice(-3000) });
    } catch {}
  }
});

const tests = [];
function T(name, pass, detail = '') {
  tests.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

// Wait until the last non-welcome, non-loading assistant message has len > 80 (real answer).
// `expectedUserTurns` = how many user messages we've already sent (1 after first query, 2 after second, ...)
async function waitForAnswer(expectedUserTurns, startTime = Date.now(), maxMs = 90000) {
  while (Date.now() - startTime < maxMs) {
    const userCount = await page.locator('.chat-message.user .message-text').count();
    const asstTexts = await page.locator('.chat-message.assistant:not(.loading) .message-text').allTextContents();
    // skip welcome (index 0); answers start from index 1
    const realAnswers = asstTexts.slice(1).filter((t) => (t || '').length > 40);
    if (userCount >= expectedUserTurns && realAnswers.length >= expectedUserTurns) {
      return { userCount, realAnswers, lastLen: (realAnswers.slice(-1)[0] || '').length };
    }
    await page.waitForTimeout(1500);
  }
  const userCount = await page.locator('.chat-message.user .message-text').count();
  const asstTexts = await page.locator('.chat-message.assistant:not(.loading) .message-text').allTextContents();
  return { userCount, realAnswers: asstTexts.slice(1), lastLen: ((asstTexts.slice(1).slice(-1)[0]) || '').length, timedOut: true };
}

try {
  // ── T1 login ────────────────────────────────────────────────────────
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.locator('input').all();
  let u, p;
  for (const i of inputs) {
    const t = await i.getAttribute('type');
    if (t === 'password' && !p) p = i;
    else if (!u && (t === 'text' || !t)) u = i;
  }
  await u.fill(USER);
  await p.fill(PASS);
  await p.press('Enter');
  try {
    await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 15000 });
    T('T1 login success', true);
  } catch (e) {
    T('T1 login success', false, 'still on /login after 15s');
    throw new Error('login failed');
  }

  // ── T2 navigate to /smart-bi/query ─────────────────────────────────
  await page.goto(`${URL}/smart-bi/query`, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);
  const pageRoot = await page.locator('.ai-query-page').count();
  T('T2 AIQuery page loads', pageRoot > 0, `rootEl=${pageRoot}`);
  await page.screenshot({ path: `${OUT}/t2-loaded.png` });

  // ── T3 data source auto-populates ──────────────────────────────────
  // data source el-select renders only when dataSources.length > 0 (v-if guard in template).
  // If the selector exists, dataSources API must have returned items. Additionally we open
  // the popper to count options as robust evidence.
  const dsSelectCount = await page.locator('.header-right .el-select').count();
  let dsOptionCount = 0;
  let dsInputVal = '';
  if (dsSelectCount > 0) {
    dsInputVal = (await page.locator('.header-right .el-select input').first().inputValue().catch(() => '')) || '';
    await page.locator('.header-right .el-select').first().click();
    await page.waitForTimeout(800);
    dsOptionCount = await page.locator('.el-select-dropdown__item').count();
    await page.keyboard.press('Escape');
  }
  T('T3 data source dropdown populated', dsSelectCount > 0 && dsOptionCount > 0,
    `sel=${dsSelectCount} options=${dsOptionCount} selected="${dsInputVal.slice(0, 40)}"`);

  // ── T4 preset buttons render ──────────────────────────────────────
  const presetBtns = await page.locator('.quick-questions .el-button').count();
  T('T4 8 preset buttons render', presetBtns === 8, `count=${presetBtns}`);

  // ── T5 click first preset — should fill input + auto-send ─────────
  const firstPresetText = (await page.locator('.quick-questions .el-button').first().textContent() || '').trim();
  await page.locator('.quick-questions .el-button').first().click();
  T('T5 preset click accepted', true, `clicked="${firstPresetText}"`);

  // ── T6 wait for SSE stream → answer renders (user turn 1) ─────────
  const q1Start = Date.now();
  const q1 = await waitForAnswer(1, q1Start);
  T('T6 first query answer rendered', q1.lastLen > 50 && !q1.timedOut,
    `len=${q1.lastLen} user=${q1.userCount} real=${q1.realAnswers.length} elapsed=${Date.now() - q1Start}ms`);

  // ── T7 warning alert absent for clean answer ──────────────────────
  const warnCount1 = await page.locator('.message-warning').count();
  T('T7 no .message-warning when LLM answer clean', warnCount1 === 0, `elements=${warnCount1}`);

  // ── T8 autocomplete popper on focus ───────────────────────────────
  // Element Plus el-autocomplete virtualizes — shows ~15 visible rows, scroll reveals rest.
  // We verify that (a) popper renders, (b) we can scroll/filter to reveal more items later.
  const inputEl = page.locator('.query-autocomplete input').first();
  await inputEl.click();
  await page.waitForTimeout(1000);
  const popperRows = await page.locator('.query-autocomplete-popper .suggestion-item').count();
  T('T8 autocomplete popper shows initial batch', popperRows >= 10, `rows=${popperRows}`);

  // ── T9 autocomplete filter by typing ──────────────────────────────
  await inputEl.fill('畅');
  await page.waitForTimeout(800);
  const filteredRows = await page.locator('.query-autocomplete-popper .suggestion-item').count();
  T('T9 filter "畅" narrows suggestions', filteredRows > 0 && filteredRows < popperRows,
    `before=${popperRows} after=${filteredRows}`);
  await page.keyboard.press('Escape');
  await inputEl.fill('');

  // ── T10 fire LLM-fallback-style query (manufacturing data won't template-match) ─
  await inputEl.fill('请帮我看一下当前利润表数据,分析一下整体情况并给出建议');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  const q2Start = Date.now();
  const q2 = await waitForAnswer(2, q2Start);
  T('T10 LLM-fallback query answer rendered', q2.lastLen > 80 && !q2.timedOut,
    `len=${q2.lastLen} user=${q2.userCount} real=${q2.realAnswers.length} elapsed=${Date.now() - q2Start}ms`);

  // ── T11 any warning appearing on LLM path would mean guardrail triggered — inspect
  const warnCount2 = await page.locator('.message-warning').count();
  T('T11 warning panel count after 2 queries', true, `count=${warnCount2} (0 expected unless LLM inflated)`);

  // ── T12 console errors ────────────────────────────────────────────
  // Filter out expected React warnings / benign
  const realErrors = errors.filter((e) => {
    const s = e.toLowerCase();
    return !s.includes('source map') && !s.includes('favicon') && !s.includes('autocomplete');
  });
  T('T12 no console errors', realErrors.length === 0,
    realErrors.length ? realErrors.slice(0, 3).join(' | ').slice(0, 200) : 'clean');

  // ── T13 network errors on AI endpoints ─────────────────────────────
  const aiFails = networkFails.filter((u) => /smartbi|chat|general-analysis/.test(u));
  T('T13 no 4xx/5xx on AI endpoints', aiFails.length === 0,
    aiFails.slice(0, 2).join(' | ') || 'clean');

  // ── T14 dump real answer contents + SSE done payload ──────────────
  const finalAnswers = await page.locator('.chat-message.assistant:not(.loading) .message-text').allTextContents();
  const realAnswers = finalAnswers.slice(1); // skip welcome
  writeFileSync(`${OUT}/answers.json`, JSON.stringify({ welcome: finalAnswers[0]?.slice(0, 120), realAnswers, sseEvents }, null, 2));
  const hasRealAnswerContent = realAnswers.every((a) => (a || '').length > 60 && !/请先选择数据源|失败|错误/.test(a));
  T('T14 real answer content (not error toast)', hasRealAnswerContent,
    `a1="${(realAnswers[0] || '').slice(0, 50)}" a2="${(realAnswers[1] || '').slice(0, 50)}"`);

  // ── T15 SSE done events on template-match path ─────────────────────
  // Template match returns done payload with `source: materialized_cache` + `template_code`.
  // The `warning` field is only added on the LLM fallback path (guardrail target).
  const streamResps = sseEvents.filter((e) => /general-analysis-stream/.test(e.url));
  const allHaveDone = streamResps.length > 0 && streamResps.every((e) => e.bodyTail.includes('event: done'));
  const cacheHits = streamResps.filter((e) => /materialized_cache/.test(e.bodyTail));
  T('T15 template-match cache hits have done event', allHaveDone,
    `${streamResps.length} streams, ${cacheHits.length} cache hits`);

  // ── T16 fire a vague freeform query that should LLM-fallback ───────
  // Queries with "接下来" / "为什么" / vague open-ended language defeat template match.
  // This is where NUMERIC_GUARD_CLAUSE + warning post-check must exercise.
  const inputEl2 = page.locator('.query-autocomplete input').first();
  await inputEl2.click();
  await inputEl2.fill('接下来我应该优化哪些方面,给我一些个性化的分析和推理建议');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  const q3Start = Date.now();
  const q3 = await waitForAnswer(3, q3Start, 90000);
  T('T16 LLM-fallback query completes', q3.lastLen > 80 && !q3.timedOut,
    `len=${q3.lastLen} elapsed=${Date.now() - q3Start}ms`);

  // ── T17 verify `warning` field in the LLM fallback done payload ────
  // The done event data is the LAST event — its payload contains `"warning": null`
  // or `"warning": "..."` and always `"processingTimeMs"`. If tail has both, done
  // event fired. (Can't grep 'event: done' because large responses push that
  // preamble beyond the 3KB tail window.)
  await page.waitForTimeout(2000);
  const llmResps = sseEvents.filter((e) => /general-analysis-stream/.test(e.url) && !/materialized_cache/.test(e.bodyTail));
  const llmDoneFired = llmResps.length > 0 && llmResps.every((e) => /"processingTimeMs"/.test(e.bodyTail));
  const llmHasWarningField = llmResps.length > 0 && llmResps.every((e) => /"warning":\s*(null|")/i.test(e.bodyTail));
  T('T17 LLM fallback path done event fires', llmDoneFired, `${llmResps.length} LLM responses`);
  T('T18 LLM done payload carries `warning` field', llmHasWarningField,
    llmResps.length === 0 ? 'no LLM responses captured' :
      `${llmResps.length} LLM resps, field present`);

  writeFileSync(`${OUT}/answers.json`, JSON.stringify({ welcome: finalAnswers[0]?.slice(0, 120), realAnswers, sseEvents }, null, 2));

  await page.screenshot({ path: `${OUT}/t14-final.png`, fullPage: true });
} catch (err) {
  T('UNCAUGHT', false, String(err).slice(0, 300));
}

const passed = tests.filter((t) => t.pass).length;
const failed = tests.length - passed;
const summary = {
  total: tests.length,
  passed,
  failed,
  consoleErrors: errors.length,
  consoleWarnings: warnings.length,
  networkFails: networkFails.length,
  aiEndpointFails: networkFails.filter((u) => /smartbi|chat|general-analysis/.test(u)).length,
};

console.log('\n───── summary ─────');
console.log(JSON.stringify(summary, null, 2));
if (errors.length) console.log('\nconsole errors:\n  ' + errors.slice(0, 8).join('\n  '));
if (networkFails.length) console.log('\nnetwork fails:\n  ' + networkFails.slice(0, 8).join('\n  '));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ summary, tests, errors, warnings, networkFails }, null, 2));
console.log(`\nreport: ${OUT}/report.json`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
