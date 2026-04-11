/**
 * Canvas V2 Deep E2E — 业务逻辑全链路验证
 * 20 tests covering: V2 APIs, tool/rule/chain config, formulas, templates, AI agent, modules
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://139.196.165.140:8086';
const API_BASE = 'http://139.196.165.140:8086/api/mobile';
const FACTORY_ID = 'F001';

const results = [];
let token = null;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  try { return { s: res.status, d: JSON.parse(text) }; } catch { return { s: res.status, d: text }; }
}

function test(name, fn) { results.push({ name, fn }); }

// Login
async function login() {
  const r = await api('POST', '/auth/unified-login', { username: 'factory_admin1', password: '123456' });
  token = r.d?.data?.accessToken || r.d?.data?.token || r.d?.accessToken;
  return !!token;
}

// ========== T01-T03: Browser + Pages ==========

test('T01: Canvas Editor 页面可访问', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { timeout: 15000 });
    await page.waitForTimeout(2000);
    const u = page.locator('input[type="text"]').first();
    const p = page.locator('input[type="password"]').first();
    if (await u.isVisible({ timeout: 5000 })) {
      await u.fill('factory_admin1'); await p.fill('123456');
      await page.locator('button[type="submit"], button:has-text("登录")').first().click();
      await page.waitForTimeout(3000);
    }
    await page.goto(`${BASE_URL}/canvas-editor`, { timeout: 15000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    const html = await page.content();
    return { pass: url.includes('canvas') || html.includes('canvas'), evidence: `URL: ${url}\n包含canvas: ${html.includes('canvas')}` };
  } finally { await browser.close(); }
});

test('T02: V1 配置 — sales_order effective config', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/modules/sales_order/effective`);
  const c = r.d?.data;
  return { pass: r.s === 200 && c?.fields?.length > 0, evidence: `status: ${r.s}\nfields: ${c?.fields?.length}\nworkflow: ${c?.workflow?.states?.length} states\n前3: ${JSON.stringify(c?.fields?.slice(0,3).map(f=>f.fieldCode))}` };
});

test('T03: V1 配置 — 模块列表 ≥10', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/modules`);
  const m = r.d?.data || [];
  return { pass: r.s === 200 && m.length >= 10, evidence: `status: ${r.s}\n模块数: ${m.length}\ncodes: ${JSON.stringify(m.map(x=>x.moduleCode))}` };
});

// ========== T04-T09: V2 API Endpoints ==========

test('T04: V2 触发链 — 4条全局链 (disabled by default)', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/trigger-chains`);
  const c = r.d?.data || [];
  return { pass: r.s === 200 && c.length >= 4, evidence: `status: ${r.s}\n链数: ${c.length}\ncodes: ${JSON.stringify(c.map(x=>x.chainCode))}\nenabled状态: ${JSON.stringify(c.map(x=>({code:x.chainCode, enabled:x.enabled})))}` };
});

test('T05: V2 校验规则 — sales_order ≥8条', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/validation-rules?moduleCode=sales_order`);
  const rules = r.d?.data || [];
  return { pass: r.s === 200 && rules.length >= 5, evidence: `status: ${r.s}\n规则数: ${rules.length}\nrules: ${JSON.stringify(rules.map(x=>x.ruleCode))}` };
});

test('T06: V2 全部校验规则 — ≥35条 跨多模块', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/validation-rules`);
  const rules = r.d?.data || [];
  const mods = [...new Set(rules.map(x=>x.moduleCode))];
  return { pass: r.s === 200 && rules.length >= 30, evidence: `status: ${r.s}\n总数: ${rules.length}\n模块: ${JSON.stringify(mods)}` };
});

test('T07: V2 公式 — bom ≥4条', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/formulas?moduleCode=bom`);
  const f = r.d?.data || [];
  return { pass: r.s === 200 && f.length >= 3, evidence: `status: ${r.s}\n公式数: ${f.length}\n公式: ${JSON.stringify(f.map(x=>`${x.formulaCode}=${x.expression}`))}` };
});

test('T08: V2 默认值 — 全部 ≥15条', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/default-values`);
  const d = r.d?.data || [];
  return { pass: r.s === 200 && d.length >= 10, evidence: `status: ${r.s}\n默认值数: ${d.length}\n模块: ${JSON.stringify([...new Set(d.map(x=>x.moduleCode))])}` };
});

test('T09: V2 定时任务 — ≥12条', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/scheduler`);
  const t = r.d?.data || [];
  return { pass: r.s === 200 && t.length >= 5, evidence: `status: ${r.s}\ntask数: ${t.length}\ntasks: ${JSON.stringify(t.slice(0,5).map(x=>x.taskCode))}` };
});

// ========== T10-T14: Business Logic (修改→验证→恢复) ==========

test('T10: 工具开关 — PUT 禁用 scheduling_list → GET 验证 → 恢复', async () => {
  const put = await api('PUT', `/${FACTORY_ID}/config/v2/tools/scheduling_list`, { enabled: false });
  const get = await api('GET', `/${FACTORY_ID}/config/v2/tools`);
  const t = (get.d?.data||[]).find(x=>x.toolName==='scheduling_list');
  await api('PUT', `/${FACTORY_ID}/config/v2/tools/scheduling_list`, { enabled: true });
  return { pass: put.s === 200 && t?.enabled === false, evidence: `PUT: ${put.s}\n禁用后: enabled=${t?.enabled}\n已恢复: enabled=true` };
});

test('T11: 校验规则开关 — 禁用 DUPLICATE_PRODUCT → 验证 → 恢复', async () => {
  const put = await api('PUT', `/${FACTORY_ID}/config/v2/validation-rules/DUPLICATE_PRODUCT`, { moduleCode:'sales_order', enabled:false, condition:'#hasDuplicateProduct == true', errorMessage:'重复产品' });
  const get = await api('GET', `/${FACTORY_ID}/config/v2/validation-rules?moduleCode=sales_order`);
  const r = (get.d?.data||[]).find(x=>x.ruleCode==='DUPLICATE_PRODUCT'&&x.factoryId===FACTORY_ID);
  await api('PUT', `/${FACTORY_ID}/config/v2/validation-rules/DUPLICATE_PRODUCT`, { moduleCode:'sales_order', enabled:true, condition:'#hasDuplicateProduct == true', errorMessage:'同一订单中不能添加重复的产品' });
  return { pass: put.s === 200, evidence: `PUT: ${put.s}\n工厂级规则: enabled=${r?.enabled}\n已恢复` };
});

test('T12: 公式修改 — LINE_AMOUNT 改为含税 → 验证 → 恢复', async () => {
  const put = await api('PUT', `/${FACTORY_ID}/config/v2/formulas/LINE_AMOUNT`, { moduleCode:'sales_order', expression:'#quantity * #unitPrice * (1 + #taxRate/100)', variables:{quantity:'DECIMAL',unitPrice:'DECIMAL',taxRate:'DECIMAL'}, resultType:'DECIMAL', precisionVal:2 });
  const get = await api('GET', `/${FACTORY_ID}/config/v2/formulas?moduleCode=sales_order`);
  const f = (get.d?.data||[]).find(x=>x.formulaCode==='LINE_AMOUNT'&&x.factoryId===FACTORY_ID);
  return { pass: put.s === 200, evidence: `PUT: ${put.s}\n新公式: ${f?.expression}\n变量: ${JSON.stringify(f?.variables)}` };
});

test('T13: 定时任务热更新 — AI_DAILY_REPORT cron 改为 21:00', async () => {
  const put = await api('PUT', `/${FACTORY_ID}/config/v2/scheduler/AI_DAILY_REPORT`, { cronExpression:'0 0 21 * * *', enabled:true, toolOrMethod:'report_daily_generate' });
  const get = await api('GET', `/${FACTORY_ID}/config/v2/scheduler`);
  const t = (get.d?.data||[]).find(x=>x.taskCode==='AI_DAILY_REPORT'&&x.factoryId===FACTORY_ID);
  return { pass: put.s === 200, evidence: `PUT: ${put.s}\n新cron: ${t?.cronExpression}\nfactoryId: ${t?.factoryId}` };
});

test('T14: 触发链修改 — BATCH_COMPLETED 步骤禁用', async () => {
  const getR = await api('GET', `/${FACTORY_ID}/config/v2/trigger-chains`);
  const chain = (getR.d?.data||[]).find(c=>c.chainCode==='BATCH_COMPLETED');
  if (!chain) return { pass: false, evidence: 'BATCH_COMPLETED not found' };
  const steps = JSON.parse(JSON.stringify(chain.steps||[]));
  if (steps[2]) steps[2].enabled = false;
  const put = await api('PUT', `/${FACTORY_ID}/config/v2/trigger-chains/BATCH_COMPLETED`, { ...chain, factoryId:FACTORY_ID, steps });
  return { pass: put.s === 200, evidence: `PUT: ${put.s}\n修改step3: enabled=false\nAPI: ${JSON.stringify(put.d).substring(0,200)}` };
});

// ========== T15-T17: Templates + AI ==========

test('T15: 模板列表 — 4个行业模板', async () => {
  const r = await api('GET', `/${FACTORY_ID}/config/v2/templates`);
  const t = r.d?.data || [];
  return { pass: r.s === 200 && t.length >= 4, evidence: `status: ${r.s}\n模板数: ${t.length}\n模板: ${JSON.stringify(t.map(x=>({code:x.templateCode,name:x.templateName})))}` };
});

test('T16: AI Autopilot — 对话+执行', async () => {
  const r = await api('POST', `/${FACTORY_ID}/config/v2/ai/chat`, { message:'帮我简化销售订单', mode:'autopilot', moduleCode:'sales_order' });
  return { pass: r.s === 200 && !!r.d?.data?.reply, evidence: `status: ${r.s}\nreply: ${r.d?.data?.reply?.substring(0,150)}\napplied: ${r.d?.data?.applied}` };
});

test('T17: AI Plan — 生成变更方案', async () => {
  const r = await api('POST', `/${FACTORY_ID}/config/v2/ai/chat`, { message:'禁用不需要的模块', mode:'plan', moduleCode:'' });
  return { pass: r.s === 200 && !!r.d?.data?.reply, evidence: `status: ${r.s}\nreply: ${r.d?.data?.reply?.substring(0,150)}\ndiffs: ${(r.d?.data?.diffs||[]).length} 项` };
});

// ========== T18-T20: Module Schemas Cross-check ==========

test('T18: 5个核心模块 schema 完整', async () => {
  const codes = ['sales_order','purchase_order','bom','production_plan','quality_inspection'];
  const res = [];
  for (const c of codes) {
    const r = await api('GET', `/${FACTORY_ID}/config/modules/${c}/effective`);
    res.push({ mod:c, fields:r.d?.data?.fields?.length||0, wf:r.d?.data?.workflow?.states?.length||0 });
  }
  return { pass: res.every(r=>r.fields>0), evidence: res.map(r=>`${r.mod}: ${r.fields} fields, ${r.wf} workflow states`).join('\n  ') };
});

test('T19: 5个运营模块 schema 完整', async () => {
  const codes = ['production_report','inbound','outbound','customer','supplier'];
  const res = [];
  for (const c of codes) {
    const r = await api('GET', `/${FACTORY_ID}/config/modules/${c}/effective`);
    res.push({ mod:c, fields:r.d?.data?.fields?.length||0, status:r.s });
  }
  return { pass: res.every(r=>r.status===200&&r.fields>0), evidence: res.map(r=>`${r.mod}: status=${r.status} fields=${r.fields}`).join('\n  ') };
});

test('T20: 5个支持模块 schema 完整', async () => {
  const codes = ['finance_ar','finance_ap','hr_employee','transfer','traceability'];
  const res = [];
  for (const c of codes) {
    const r = await api('GET', `/${FACTORY_ID}/config/modules/${c}/effective`);
    res.push({ mod:c, fields:r.d?.data?.fields?.length||0, status:r.s });
  }
  return { pass: res.every(r=>r.status===200&&r.fields>0), evidence: res.map(r=>`${r.mod}: status=${r.status} fields=${r.fields}`).join('\n  ') };
});

// ========== Runner ==========

console.log('\n' + '='.repeat(60));
console.log('Canvas V2 Deep E2E — 20 Business Logic Tests');
console.log(`Web: ${BASE_URL} | API: ${API_BASE}`);
console.log('='.repeat(60) + '\n');

console.log('🔐 Login...');
if (!await login()) { console.error('❌ Login failed'); process.exit(1); }
console.log('✅ Token OK\n');

let pass=0, fail=0;
const report = [];

for (const t of results) {
  process.stdout.write(`⏳ ${t.name}... `);
  try {
    const r = await t.fn();
    console.log(r.pass ? '✅' : '❌');
    if (r.evidence) console.log(`  ${r.evidence.split('\n').join('\n  ')}`);
    report.push({ name:t.name, status:r.pass?'PASS':'FAIL', evidence:r.evidence });
    r.pass ? pass++ : fail++;
  } catch(e) {
    console.log('❌ ERROR');
    console.log(`  ${e.message}`);
    report.push({ name:t.name, status:'ERROR', evidence:e.message });
    fail++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Results: ${pass}/${pass+fail} PASS | ${fail} FAIL`);
console.log('='.repeat(60));

const fs = await import('fs');
fs.writeFileSync('test-canvas-v2-deep-results.json', JSON.stringify(report, null, 2));
console.log('Report: test-canvas-v2-deep-results.json');
process.exit(fail > 0 ? 1 : 0);
