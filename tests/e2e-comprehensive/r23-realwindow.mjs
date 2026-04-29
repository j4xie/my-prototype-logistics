#!/usr/bin/env node
// R23 Phase 3 — real-window deep tests for canvas-dynamic R17-R23 arc.
// Per docs/plans/2026-04-26-R23-phase3-handoff.md.
// Runs against test env (10011). API + DB level (real backend, real DB, real auth).

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.env.R23_BASE || 'http://localhost:10011';  // SSH tunnel: ssh -fN -L 10011:localhost:10011 root@47.100.235.168
const RESULTS_DIR = './tests/e2e-comprehensive/results/r23-realwindow';
const F1 = 'F001';
const F2 = 'F002';

mkdirSync(RESULTS_DIR, { recursive: true });

const tests = [];
let testIdx = 0;
function record(group, id, name, status, evidence) {
  // Evidence may contain a `status` HTTP code; rename to httpStatus to avoid clobbering test verdict
  const { status: httpStatus, ...rest } = evidence || {};
  tests.push({
    group, id, name,
    depth: evidence?.depth || 'medium',
    timestamp: new Date().toISOString(),
    ...rest,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    status,  // last so it wins
  });
  const symbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${symbol} [${group}] ${id} ${name} → ${status}${evidence.depth ? ` (${evidence.depth})` : ''}`);
  if (status === 'FAIL') console.log(`     ${JSON.stringify(evidence).slice(0, 300)}`);
}

// SSH-driven psql query helper.
function sql(q) {
  const cmd = `ssh root@47.100.235.168 "sudo -iu postgres psql -d cretas_db -t -A -F '|' -c \\"${q.replace(/"/g, '\\\\"')}\\""`;
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

// Login helper (returns JWT)
async function login(username, password = '123456') {
  const r = await fetch(`${BASE}/api/mobile/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json();
  const tok = j.data?.token || j.data?.accessToken || j.data?.tokens?.token;
  if (!j.success || !tok) throw new Error(`Login failed for ${username}: ${JSON.stringify(j).slice(0, 300)}`);
  return tok;
}

// Extract list from various response shapes (data.content[] / data.list[] / data[])
function extractList(body) {
  if (!body || !body.data) return [];
  const d = body.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.content)) return d.content;  // Spring PageResponse
  if (Array.isArray(d.list)) return d.list;
  if (Array.isArray(d.records)) return d.records;
  return [];
}

// API call wrapper — returns { status, body, ok }
async function api(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j;
  try { j = await r.json(); } catch { j = { __nonjson: true, text: await r.text() }; }
  return { status: r.status, body: j, ok: r.ok };
}

// ============== Test Data ==============
const TOKENS = {};
const TEST_DATA = {
  F001_DRAFT_SO: '12bffc73-c880-47c3-a83a-bb7336611658',     // SO-20260424-0009
  F001_CANCELLED_SO: '7f8bf52c-eabf-4925-9bb2-3b7642eb32f6', // SO-20260409-0003
  F001_CONFIRMED_SO: '43c05cf4-05a0-4fc6-8ce5-6b6b26c81377', // SO-20260424-0011
  F001_DRAFT_FOR_PFR: '1f0e1cc6-40ba-4faa-a2e1-2f08c5898827',  // SO-20260424-0017 — temp UPDATE for B9
  F001_FINAPPROVED_SO: null, // discovered at runtime
  F002_SO: null,             // discovered at runtime — for C14 cross-tenant
  F001_DRAFT_PO: '3f45be8e-274d-4b4a-8142-ff6775a3bc06',
  F002_APPROVED_PO: 'F002-PO-002',
  F002_DRAFT_PO: 'F002-PO-001',
};

// ============== Group A — Dropdown regression (6 tests) ==============
async function groupA() {
  console.log('\n=== Group A: Dropdown regression ===');

  // A1 — Canvas DYNAMIC SO create form: customerId/productTypeId/salesperson dropdowns ≥1
  // Real-window equivalent: hit /reference-data/{customers,products,employees} that the form would call.
  const t = TOKENS.f1super;
  const customers = await api('GET', `/api/mobile/${F1}/reference-data/customers?usage=active`, t);
  const products = await api('GET', `/api/mobile/${F1}/reference-data/products?usage=active`, t);
  const employees = await api('GET', `/api/mobile/${F1}/reference-data/employees`, t);
  const cCount = (extractList(customers.body)).length;
  const pCount = (extractList(products.body)).length;
  const eCount = (extractList(employees.body)).length;
  record('A', 'A1', 'so_form_dropdowns_nonempty',
    cCount >= 1 && pCount >= 1 && eCount >= 1 ? 'PASS' : 'FAIL',
    { depth: 'medium', cCount, pCount, eCount, customersStatus: customers.status, productsStatus: products.status, employeesStatus: employees.status });

  // A2 — AR invoice request form: salesOrderId dropdown returns ONLY post-finance-approved SOs.
  const dropdown = await api('GET', `/api/mobile/${F1}/reference-data/sales-orders?usage=invoiceable`, t);
  const sqlCount = parseInt(sql(`SELECT COUNT(*) FROM sales_orders WHERE factory_id='${F1}' AND status IN ('FINANCE_APPROVED','PROCESSING','PARTIAL_DELIVERED','COMPLETED') AND deleted_at IS NULL`));
  const dropdownList = extractList(dropdown.body);
  const dropdownCount = dropdownList.length;
  record('A', 'A2', 'ar_invoice_so_dropdown_invoiceable_only',
    dropdownCount === sqlCount ? 'PASS' : 'FAIL',
    { depth: 'deep', dropdownCount, sqlCount, dropdownStatus: dropdown.status, sample: dropdownList.slice(0, 3) });

  // A3 — typo `?usage=plannble` (typo) → S1 fail-secure to invoiceable
  const typo = await api('GET', `/api/mobile/${F1}/reference-data/sales-orders?usage=plannble`, t);
  const typoList = extractList(typo.body);
  record('A', 'A3', 'failsecure_typo_to_invoiceable',
    typoList.length === sqlCount ? 'PASS' : 'FAIL',
    { depth: 'deep', typoCount: typoList.length, expected: sqlCount, status: typo.status });

  // A4 — `?usage=plannable` → CONFIRMED + PENDING_FINANCE_REVIEW + ... present
  const plannable = await api('GET', `/api/mobile/${F1}/reference-data/sales-orders?usage=plannable`, t);
  const plannableList = extractList(plannable.body);
  const plannableSqlCount = parseInt(sql(`SELECT COUNT(*) FROM sales_orders WHERE factory_id='${F1}' AND status IN ('CONFIRMED','PENDING_FINANCE_REVIEW','FINANCE_APPROVED','PROCESSING','PARTIAL_DELIVERED') AND deleted_at IS NULL`));
  record('A', 'A4', 'plannable_includes_confirmed_pending',
    plannableList.length === plannableSqlCount ? 'PASS' : 'FAIL',
    { depth: 'deep', dropdownCount: plannableList.length, sqlCount: plannableSqlCount, status: plannable.status });

  // A5 — `?usage=all` → everything except DRAFT/CANCELLED/FINANCE_REJECTED
  const all = await api('GET', `/api/mobile/${F1}/reference-data/sales-orders?usage=all`, t);
  const allList = extractList(all.body);
  const allSqlCount = parseInt(sql(`SELECT COUNT(*) FROM sales_orders WHERE factory_id='${F1}' AND status NOT IN ('DRAFT','CANCELLED','FINANCE_REJECTED') AND deleted_at IS NULL`));
  record('A', 'A5', 'all_excludes_draft_cancelled',
    allList.length === allSqlCount ? 'PASS' : 'FAIL',
    { depth: 'deep', dropdownCount: allList.length, sqlCount: allSqlCount, status: all.status });

  // A6 — same suite for purchase orders (one canonical PO test instead of full repeat)
  const poInvoiceable = await api('GET', `/api/mobile/${F1}/reference-data/purchase-orders?usage=invoiceable`, t);
  const poInvoiceableList = extractList(poInvoiceable.body);
  const poSqlCount = parseInt(sql(`SELECT COUNT(*) FROM purchase_orders WHERE factory_id='${F1}' AND status IN ('FINANCE_APPROVED','PARTIAL_RECEIVED','COMPLETED','CLOSED') AND deleted_at IS NULL`));
  record('A', 'A6', 'po_invoiceable_dropdown',
    poInvoiceableList.length === poSqlCount ? 'PASS' : 'FAIL',
    { depth: 'deep', dropdownCount: poInvoiceableList.length, sqlCount: poSqlCount, status: poInvoiceable.status });
}

// ============== Group B — Write-path invariants (6 tests) ==============
async function groupB() {
  console.log('\n=== Group B: Write-path invariants ===');
  const t = TOKENS.f1super;

  // First, find FINANCE_APPROVED SO + its customer for B10
  const finApproved = sql(`SELECT id, customer_id, total_amount FROM sales_orders WHERE factory_id='${F1}' AND status='FINANCE_APPROVED' AND deleted_at IS NULL ORDER BY id LIMIT 1`);
  const [finApprovedId, finApprovedCustomer, finApprovedAmount] = finApproved.split('|');
  TEST_DATA.F001_FINAPPROVED_SO = finApprovedId;

  // B7 — DRAFT SO → POST /finance/receivable → 409
  const r7 = await api('POST', `/api/mobile/${F1}/finance/receivable`, t, {
    counterpartyId: 'CUS-F001-001', orderId: TEST_DATA.F001_DRAFT_SO,
    amount: 100, dueDate: '2026-12-31', remark: 'B7-test',
  });
  record('B', 'B7', 'draft_so_receivable_409',
    r7.status === 409 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r7.status, message: r7.body?.message, hint: r7.body?.hint, soId: TEST_DATA.F001_DRAFT_SO });

  // B8 — CANCELLED SO → 409
  const r8 = await api('POST', `/api/mobile/${F1}/finance/receivable`, t, {
    counterpartyId: 'CUS-F001-001', orderId: TEST_DATA.F001_CANCELLED_SO,
    amount: 100, dueDate: '2026-12-31', remark: 'B8-test',
  });
  record('B', 'B8', 'cancelled_so_receivable_409',
    r8.status === 409 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r8.status, message: r8.body?.message });

  // B9 — PENDING_FINANCE_REVIEW SO → 409. Temp-flip a DRAFT SO to PENDING_FINANCE_REVIEW.
  sql(`UPDATE sales_orders SET status='PENDING_FINANCE_REVIEW' WHERE id='${TEST_DATA.F001_DRAFT_FOR_PFR}'`);
  try {
    const r9 = await api('POST', `/api/mobile/${F1}/finance/receivable`, t, {
      counterpartyId: 'CUS-F001-001', orderId: TEST_DATA.F001_DRAFT_FOR_PFR,
      amount: 100, dueDate: '2026-12-31', remark: 'B9-test',
    });
    record('B', 'B9', 'pending_finance_review_so_409',
      r9.status === 409 ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r9.status, message: r9.body?.message });
  } finally {
    sql(`UPDATE sales_orders SET status='DRAFT' WHERE id='${TEST_DATA.F001_DRAFT_FOR_PFR}'`);
  }

  // B10 — FINANCE_APPROVED SO → 200 with AR_INVOICE created (uniqueness constraint may apply)
  if (!finApprovedId || finApprovedId === '') {
    record('B', 'B10', 'fin_approved_so_receivable_200', 'WARN',
      { depth: 'medium', reason: 'no FINANCE_APPROVED SO available' });
  } else {
    // Check if AR_INVOICE already exists
    const existingInv = sql(`SELECT id FROM ar_ap_transactions WHERE factory_id='${F1}' AND sales_order_id='${finApprovedId}' AND transaction_type='AR_INVOICE' AND deleted_at IS NULL`);
    const arInvoiceCountBefore = sql(`SELECT COUNT(*) FROM ar_ap_transactions WHERE factory_id='${F1}' AND sales_order_id='${finApprovedId}' AND transaction_type='AR_INVOICE' AND deleted_at IS NULL`);
    const r10 = await api('POST', `/api/mobile/${F1}/finance/receivable`, t, {
      counterpartyId: finApprovedCustomer, orderId: finApprovedId,
      amount: parseFloat(finApprovedAmount) || 100, dueDate: '2026-12-31', remark: 'B10-test',
    });
    const arInvoiceCountAfter = sql(`SELECT COUNT(*) FROM ar_ap_transactions WHERE factory_id='${F1}' AND sales_order_id='${finApprovedId}' AND transaction_type='AR_INVOICE' AND deleted_at IS NULL`);
    // Either 200 created NEW, OR 400/409 from app-level dup-check (ArApServiceImpl line 119) / V20260426_02 unique constraint
    const passOk200 = r10.status === 200 && parseInt(arInvoiceCountAfter) > parseInt(arInvoiceCountBefore);
    const dupMsg = r10.body?.message || '';
    const passOkDup = (r10.status === 400 || r10.status === 409) &&
                     (dupMsg.includes('已生成应收') || dupMsg.includes('唯一') || dupMsg.includes('duplicate'));
    record('B', 'B10', 'fin_approved_so_receivable_200_or_dup_block',
      (passOk200 || passOkDup) ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r10.status, message: r10.body?.message,
        arInvoiceCountBefore, arInvoiceCountAfter, existingInv,
        passReason: passOk200 ? 'created new AR_INVOICE' : passOkDup ? 'dup-check fired (V20260426_02 / app-level)' : 'unexpected' });
  }

  // B11 — DRAFT PO → POST /finance/payable → 409
  const r11 = await api('POST', `/api/mobile/${F1}/finance/payable`, t, {
    counterpartyId: 'SUP-F001-001', orderId: TEST_DATA.F001_DRAFT_PO,
    amount: 100, dueDate: '2026-12-31', remark: 'B11-test',
  });
  record('B', 'B11', 'draft_po_payable_409',
    r11.status === 409 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r11.status, message: r11.body?.message,
      supplierUsed: 'SUP-F001-001', poUsed: TEST_DATA.F001_DRAFT_PO });

  // B12 — DRAFT SO → POST /finance/invoices/request → 409 (R18 path verification)
  const r12 = await api('POST', `/api/mobile/${F1}/finance/invoices/request`, t, {
    salesOrderId: TEST_DATA.F001_DRAFT_SO, amount: 100, remark: 'B12-test',
  });
  record('B', 'B12', 'draft_so_invoice_request_409',
    r12.status === 409 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r12.status, message: r12.body?.message, note: '409 expected for invariant fire' });
}

// ============== Group C — PaymentRecord cross-tenant (2 tests) ==============
async function groupC() {
  console.log('\n=== Group C: PaymentRecord cross-tenant + status (R22 C1 fix) ===');
  const t = TOKENS.f1super;

  // C13 — POST /finance/payments/record with DRAFT SO → 409 (post-R23) — pre-R23 was 200
  const r13 = await api('POST', `/api/mobile/${F1}/finance/payments/record`, t, {
    salesOrderId: TEST_DATA.F001_DRAFT_SO, amount: 100,
    paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-04-26',
    paymentReference: 'C13-test',
  });
  record('C', 'C13', 'payment_record_draft_so_409',
    r13.status === 409 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r13.status, message: r13.body?.message,
      severity: r13.body?.severity, hint: r13.body?.hint });

  // C14 — F001 user POSTs F002's SO → expect 404 "销售订单不存在"
  // Find F002 SO in DRAFT (any state acceptable for cross-tenant test)
  const f2so = sql(`SELECT id FROM sales_orders WHERE factory_id='${F2}' AND deleted_at IS NULL ORDER BY id LIMIT 1`);
  TEST_DATA.F002_SO = f2so;
  if (!f2so || f2so === '') {
    record('C', 'C14', 'cross_tenant_so_404', 'WARN',
      { depth: 'medium', reason: 'no F002 SO' });
  } else {
    const r14 = await api('POST', `/api/mobile/${F1}/finance/payments/record`, t, {
      salesOrderId: f2so, amount: 100, paymentMethod: 'BANK_TRANSFER',
    });
    // Pre-R23: would be 200 with leaked F002 customer data
    // Post-R23: 404 (factoryId filter strips the SO from findById result)
    record('C', 'C14', 'cross_tenant_so_404_no_leak',
      r14.status === 404 ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r14.status, message: r14.body?.message,
        f002SoUsed: f2so, expectedPre: 200, expectedPost: 404 });
  }
}

// ============== Group D — @RequireModule corrections (2 tests) ==============
async function groupD() {
  console.log('\n=== Group D: @RequireModule corrections ===');
  const t = TOKENS.f1super;

  // D15 — Disable finance_ap, keep finance_ar implicit. POST /payable → 400 "模块 finance_ap 未启用"
  // Pre-R23 the annotation was finance_ar, so disabling finance_ap had NO effect (200).
  // Post-R23 annotation is finance_ap, so disabling finance_ap → 400.
  sql(`INSERT INTO factory_module_configs (factory_id, module_code, config_version, enabled) VALUES ('${F1}', 'finance_ap', 1, false) ON CONFLICT (factory_id, module_code, config_version) DO UPDATE SET enabled=false, updated_at=now()`);
  try {
    // Wait briefly for cache invalidation if any
    await new Promise(r => setTimeout(r, 500));
    const r15 = await api('POST', `/api/mobile/${F1}/finance/payable`, t, {
      counterpartyId: '00000000-0000-0000-0000-000000000001', orderId: TEST_DATA.F001_DRAFT_PO,
      amount: 100, dueDate: '2026-12-31', remark: 'D15-test',
    });
    const wasModuleBlock = r15.status === 400 && (r15.body?.message?.includes('finance_ap') || r15.body?.message?.includes('未启用'));
    record('D', 'D15', 'disable_finance_ap_blocks_payable',
      wasModuleBlock ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r15.status, message: r15.body?.message,
        expected: '400 模块 finance_ap 未启用', sql: 'INSERT factory_module_configs finance_ap enabled=false' });
  } finally {
    sql(`DELETE FROM factory_module_configs WHERE factory_id='${F1}' AND module_code='finance_ap' AND config_version=1`);
  }

  // C15 (added per R23 P3 reviewer #13 Concern #1) — disable finance_ap, keep finance_ar.
  // POST /finance/payments/record → should be 409 (status-block on DRAFT SO), NOT 400 (wrong module).
  // Pre-fix: @RequireModule("finance_ap") wrongly blocked AR-only tenants from recording customer payments.
  sql(`INSERT INTO factory_module_configs (factory_id, module_code, config_version, enabled) VALUES ('${F1}', 'finance_ap', 1, false) ON CONFLICT (factory_id, module_code, config_version) DO UPDATE SET enabled=false, updated_at=now()`);
  try {
    await new Promise(r => setTimeout(r, 500));
    const r15p = await api('POST', `/api/mobile/${F1}/finance/payments/record`, t, {
      salesOrderId: TEST_DATA.F001_DRAFT_SO, amount: 100,
      paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-04-26', paymentReference: 'C15-test',
    });
    const wasNotModuleBlock = !(r15p.status === 400 && (r15p.body?.message?.includes('finance_ap') || r15p.body?.message?.includes('未启用')));
    record('D', 'C15', 'payment_record_uses_finance_ar_not_ap',
      (wasNotModuleBlock && r15p.status === 409) ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r15p.status, message: r15p.body?.message,
        expected: '409 (status-block) NOT 400 (module-block)' });
  } finally {
    sql(`DELETE FROM factory_module_configs WHERE factory_id='${F1}' AND module_code='finance_ap' AND config_version=1`);
  }

  // D16 — Disable finance_ar, keep finance_ap. POST /payable → should be 200/409 (status-related), NOT 400.
  // Verifies the @RequireModule was correctly moved off finance_ar for this endpoint.
  sql(`INSERT INTO factory_module_configs (factory_id, module_code, config_version, enabled) VALUES ('${F1}', 'finance_ar', 1, false) ON CONFLICT (factory_id, module_code, config_version) DO UPDATE SET enabled=false, updated_at=now()`);
  try {
    await new Promise(r => setTimeout(r, 500));
    const r16 = await api('POST', `/api/mobile/${F1}/finance/payable`, t, {
      counterpartyId: '00000000-0000-0000-0000-000000000001', orderId: TEST_DATA.F001_DRAFT_PO,
      amount: 100, dueDate: '2026-12-31', remark: 'D16-test',
    });
    // Should NOT 400-with-finance_ar — should be 409 (DRAFT) or 200 if PO was approved
    const wasNotModuleBlock = !(r16.status === 400 && r16.body?.message?.includes('finance_ar'));
    record('D', 'D16', 'disable_finance_ar_no_effect_on_payable',
      wasNotModuleBlock ? 'PASS' : 'FAIL',
      { depth: 'deep', status: r16.status, message: r16.body?.message,
        expected: 'NOT 400 finance_ar (annotation correctly points to finance_ap now)' });
  } finally {
    sql(`DELETE FROM factory_module_configs WHERE factory_id='${F1}' AND module_code='finance_ar' AND config_version=1`);
  }
}

// ============== Group E — PENDING_APPROVAL workflow (4 tests) ==============
async function groupE() {
  console.log('\n=== Group E: PENDING_APPROVAL workflow (R22 C2) ===');

  // E17 — sales_mgr1 (sales_manager, only finance:read) → POST /adjustment → 403
  const t17 = TOKENS.salesMgr;
  const r17 = await api('POST', `/api/mobile/${F1}/finance/adjustment?counterpartyType=CUSTOMER`, t17, {
    counterpartyId: 'CUS-F001-001', amount: -1000, remark: 'E17-test',
  });
  record('E', 'E17', 'salesperson_no_finance_write_403',
    r17.status === 403 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r17.status, message: r17.body?.message, code: r17.body?.code,
      asUser: 'sales_mgr1' });

  // E18 — factory_admin1 → POST /adjustment with positive amount → 200 PENDING, balance unchanged
  // Note: DTO has @Positive on amount — negative adjustments rejected at validation. R22 attack
  // scenario (zero out via negative) was already prevented; R23 PENDING_APPROVAL covers
  // positive-amount inflation attacks (incorrectly increase AR before someone notices).
  const t18 = TOKENS.f1super;
  const customerBefore = sql(`SELECT current_balance FROM customers WHERE id='CUS-F001-001'`);
  const balanceBefore = parseFloat(customerBefore) || 0;
  const r18 = await api('POST', `/api/mobile/${F1}/finance/adjustment?counterpartyType=CUSTOMER`, t18, {
    counterpartyId: 'CUS-F001-001', amount: 10000, remark: 'E18-test (R23 PENDING positive adjust)',
  });
  const customerAfter = sql(`SELECT current_balance FROM customers WHERE id='CUS-F001-001'`);
  const balanceAfter = parseFloat(customerAfter) || 0;
  const txn = r18.body?.data || {};
  const passE18 = r18.status === 200 && txn.approvalStatus === 'PENDING' && balanceBefore === balanceAfter;
  record('E', 'E18', 'adjustment_pending_balance_unchanged',
    passE18 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r18.status, message: r18.body?.message, transactionId: txn.id,
      approvalStatus: txn.approvalStatus, approvedBy: txn.approvedBy, approvedAt: txn.approvedAt,
      balanceBefore, balanceAfter, balanceDelta: balanceAfter - balanceBefore,
      asUser: 'factory_admin1' });

  // E19 — same user (factory_admin1) approves their own → 403 4-eye
  const transactionId = txn.id;
  if (!transactionId) {
    record('E', 'E19', 'self_approve_4eye_403', 'WARN',
      { depth: 'medium', reason: 'E18 no transactionId' });
    record('E', 'E20', 'different_user_approves_balance_changed', 'WARN',
      { depth: 'medium', reason: 'E18 no transactionId' });
    return;
  }
  const r19 = await api('POST', `/api/mobile/${F1}/finance/adjustment/${transactionId}/approve`, t18, {});
  // Service throws BusinessException with "审批人不能与提交人相同" → 400 BusinessException by global handler
  // OR 403 if interceptor decides (depending on how the impl raises it)
  const passE19 = (r19.status === 403 || r19.status === 400) && r19.body?.message?.includes('提交人');
  record('E', 'E19', 'self_approve_4eye_blocked',
    passE19 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r19.status, message: r19.body?.message,
      asUser: 'factory_admin1 (= submitter)', transactionId });

  // E20 — different super_admin (qhj_prod) approves → 200, balance now changed
  const t20 = TOKENS.f1superB;
  const r20 = await api('POST', `/api/mobile/${F1}/finance/adjustment/${transactionId}/approve`, t20, {});
  const customerFinal = sql(`SELECT current_balance FROM customers WHERE id='CUS-F001-001'`);
  const balanceFinal = parseFloat(customerFinal) || 0;
  const finalTxn = r20.body?.data || {};
  // E20 expects balance INCREASED by +10000 (since amount is positive in adjustment)
  const expectedDelta = 10000;
  const actualDelta = balanceFinal - balanceBefore;
  const passE20 = r20.status === 200 && finalTxn.approvalStatus === 'APPROVED' && Math.abs(actualDelta - expectedDelta) < 0.01;
  record('E', 'E20', 'different_user_approves_balance_changed',
    passE20 ? 'PASS' : 'FAIL',
    { depth: 'deep', status: r20.status, message: r20.body?.message, approvalStatus: finalTxn.approvalStatus,
      approvedBy: finalTxn.approvedBy, balanceBefore, balanceFinal, balanceDelta: actualDelta,
      expectedDelta, asUser: 'qhj_prod (≠ factory_admin1)' });

  // Cleanup: revert balance by inserting an AP_ADJUSTMENT or just leave it (won't affect later tests)
  console.log(`     E20 cleanup note: customer CUS-F001-001 balance increased by ${expectedDelta} (test transaction ${transactionId} APPROVED).`);
  console.log(`     To restore: UPDATE customers SET current_balance=${balanceBefore} WHERE id='CUS-F001-001'`);
}

// ============== Main ==============
(async () => {
  console.log(`R23 Phase 3 — Real-window deep tests`);
  console.log(`Target: ${BASE} (test env)`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Branch: e2e/v1-framework, HEAD ee78b0495 + 9ec19b738 (P1+P2 + handoff doc)`);

  console.log('\n=== Login ===');
  TOKENS.f1super = await login('factory_admin1');
  TOKENS.f1superB = await login('qhj_prod');
  TOKENS.salesMgr = await login('sales_mgr1');
  console.log(`  factory_admin1: ${TOKENS.f1super.slice(0, 20)}...`);
  console.log(`  qhj_prod: ${TOKENS.f1superB.slice(0, 20)}...`);
  console.log(`  sales_mgr1: ${TOKENS.salesMgr.slice(0, 20)}...`);

  for (const [name, fn] of [['A', groupA], ['B', groupB], ['C', groupC], ['D', groupD], ['E', groupE]]) {
    try { await fn(); }
    catch (e) {
      console.error(`!! Group ${name} aborted: ${e.message}\n${e.stack?.split('\n').slice(0, 5).join('\n')}`);
      record(name, `${name}-FATAL`, 'group_aborted', 'FAIL',
        { depth: 'n/a', error: e.message, stack: e.stack?.split('\n').slice(0, 5) });
    }
  }

  // Groups F + G — stretch goals deferred
  record('F', 'F19', 'concurrent_unique_constraint_race', 'DEFERRED',
    { depth: 'n/a', reason: 'stretch goal per handoff §F; V20260426_02 partial-unique-index already verified by Flyway success=t' });
  record('G', 'G20', 'soft_delete_race_during_form_submit', 'DEFERRED',
    { depth: 'n/a', reason: 'stretch goal per handoff §G; UX bug-class, not invariant; not blocking R23 close' });

  // Summary
  const pass = tests.filter(t => t.status === 'PASS').length;
  const fail = tests.filter(t => t.status === 'FAIL').length;
  const warn = tests.filter(t => t.status === 'WARN').length;
  const deferred = tests.filter(t => t.status === 'DEFERRED').length;

  const depthBreakdown = {
    deep: tests.filter(t => t.depth === 'deep').length,
    medium: tests.filter(t => t.depth === 'medium').length,
    smoke: tests.filter(t => t.depth === 'smoke').length,
    'n/a': tests.filter(t => t.depth === 'n/a').length,
  };

  const summary = {
    round: 'R23',
    phase: 'P3',
    target: BASE,
    timestamp: new Date().toISOString(),
    branch: 'e2e/v1-framework',
    head: 'ee78b0495 (R23 P1+P2)',
    counts: { total: tests.length, pass, fail, warn, deferred },
    depthBreakdown,
    pctPass: ((pass / (tests.length - deferred)) * 100).toFixed(1),
    pctDeep: ((depthBreakdown.deep / (tests.length - deferred)) * 100).toFixed(1),
    tests,
  };
  writeFileSync(`${RESULTS_DIR}/summary.json`, JSON.stringify(summary, null, 2));

  console.log(`\n=========================`);
  console.log(`R23 P3 Summary: ${pass}P / ${fail}F / ${warn}W / ${deferred}D (total ${tests.length})`);
  console.log(`Depth: deep=${depthBreakdown.deep}, medium=${depthBreakdown.medium}, smoke=${depthBreakdown.smoke}, n/a=${depthBreakdown['n/a']}`);
  console.log(`Pass rate (excluding deferred): ${summary.pctPass}%`);
  console.log(`Deep rate: ${summary.pctDeep}%`);
  console.log(`Results: ${RESULTS_DIR}/summary.json`);
  console.log(`=========================`);

  process.exit(fail > 0 ? 1 : 0);
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(2);
});
