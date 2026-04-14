/**
 * Generate large CSV fixtures for upload 500MB E2E tests.
 *
 * Idempotent: if file exists and |size - target| < 512KB, skip.
 * Outputs to tests/e2e-comprehensive/fixtures/
 *
 * Usage:
 *   node tests/e2e-comprehensive/scripts/gen-upload-fixtures.mjs
 *   node tests/e2e-comprehensive/scripts/gen-upload-fixtures.mjs --force
 *   node tests/e2e-comprehensive/scripts/gen-upload-fixtures.mjs --only pos_60mb
 *
 * Fixtures (keep in sync with plan §5):
 *   - pos_55mb.csv  (R1-L3-1/L3-2 medium, crosses old 50MB cap)
 *   - pos_60mb.csv  (R1-L4-1 deep, 60MB CSV → chat cost_rigidity)
 *   - pos_oversize.csv (R3-L4-1 negative deep, 501MB — only when --include-oversize)
 */

import { mkdirSync, existsSync, statSync, createWriteStream, writeFileSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../fixtures');

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const INCLUDE_OVERSIZE = ARGS.includes('--include-oversize');
const ONLY_IDX = ARGS.indexOf('--only');
const ONLY = ONLY_IDX >= 0 ? ARGS[ONLY_IDX + 1] : null;

// CSV schema — POS transaction stream (realistic restaurant data)
const CSV_HEADER = 'order_id,store_id,store_name,dish_code,dish_name,category,unit_price,quantity,subtotal,pay_method,pay_time,table_no,waiter,guest_count\n';

// Average row size ≈ 130 bytes. 55MB ≈ 440_000 rows, 60MB ≈ 480_000 rows.
// We use a row generator that produces deterministic but varied data.

const STORES = [
  { id: 'S001', name: '青花椒·人民广场店' },
  { id: 'S002', name: '青花椒·徐家汇店' },
  { id: 'S003', name: '青花椒·陆家嘴店' },
  { id: 'S004', name: '青花椒·静安寺店' },
  { id: 'S005', name: '青花椒·五角场店' },
];
const DISHES = [
  { code: 'D001', name: '毛肚',       cat: '锅底配菜', price: 68 },
  { code: 'D002', name: '鸭血',       cat: '锅底配菜', price: 28 },
  { code: 'D003', name: '黄喉',       cat: '锅底配菜', price: 58 },
  { code: 'D004', name: '肥牛卷',     cat: '肉类',    price: 88 },
  { code: 'D005', name: '羊肉卷',     cat: '肉类',    price: 78 },
  { code: 'D006', name: '虾滑',       cat: '海鲜',    price: 98 },
  { code: 'D007', name: '午餐肉',     cat: '加工品',  price: 38 },
  { code: 'D008', name: '冬瓜',       cat: '蔬菜',    price: 18 },
  { code: 'D009', name: '豆皮',       cat: '豆制品',  price: 22 },
  { code: 'D010', name: '川辣锅底',   cat: '锅底',    price: 48 },
];
const PAY_METHODS = ['微信', '支付宝', '现金', '银行卡', '美团'];

function genRow(seq) {
  // Deterministic pseudo-random via seq, so re-runs produce identical files
  const storeIdx = seq % STORES.length;
  const dishIdx = (seq * 7 + 3) % DISHES.length;
  const payIdx = (seq * 11) % PAY_METHODS.length;
  const store = STORES[storeIdx];
  const dish = DISHES[dishIdx];
  const qty = 1 + ((seq * 13) % 5);
  const subtotal = dish.price * qty;
  // Dates across 2026-01 to 2026-04 to give cost_rigidity analyzer real period coverage
  const day = 1 + ((seq * 17) % 90);
  const hour = 11 + ((seq * 3) % 12);
  const min = (seq * 7) % 60;
  const date = new Date(2026, 0, day, hour, min, 0);
  const payTime = date.toISOString().replace('T', ' ').slice(0, 19);
  const tableNo = 'T' + String(100 + ((seq * 19) % 80));
  const waiter = '服务员' + String(1 + ((seq * 5) % 30));
  const guest = 2 + ((seq * 23) % 6);

  return [
    'O' + String(1000000 + seq),
    store.id,
    store.name,
    dish.code,
    dish.name,
    dish.cat,
    dish.price.toFixed(2),
    qty,
    subtotal.toFixed(2),
    PAY_METHODS[payIdx],
    payTime,
    tableNo,
    waiter,
    guest,
  ].join(',') + '\n';
}

async function writeCsv(filePath, targetBytes) {
  const stream = createWriteStream(filePath);
  const hash = createHash('sha256');

  // Header
  stream.write(CSV_HEADER);
  hash.update(CSV_HEADER);

  let bytesWritten = Buffer.byteLength(CSV_HEADER, 'utf8');
  let rows = 0;
  const CHUNK_ROWS = 5000; // flush every N rows to keep memory low

  while (bytesWritten < targetBytes) {
    let chunk = '';
    for (let i = 0; i < CHUNK_ROWS && bytesWritten + chunk.length < targetBytes; i++) {
      chunk += genRow(rows++);
    }
    stream.write(chunk);
    hash.update(chunk);
    bytesWritten += Buffer.byteLength(chunk, 'utf8');

    if (rows % 50000 === 0) {
      const mb = (bytesWritten / 1024 / 1024).toFixed(1);
      process.stdout.write(`\r  writing ${filePath.split(/[\\/]/).pop()}: ${mb}MB / ${rows} rows`);
    }
  }

  stream.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  const finalSize = statSync(filePath).size;
  const sha = hash.digest('hex');
  process.stdout.write(`\r  ✓ ${filePath.split(/[\\/]/).pop()}: ${(finalSize / 1024 / 1024).toFixed(2)}MB / ${rows} rows / sha256=${sha.slice(0, 12)}...\n`);
  return { size: finalSize, rows, sha256: sha };
}

async function ensureXlsxFixture(name, targetRows, minBytes) {
  if (ONLY && !name.includes(ONLY)) return null;
  const filePath = resolve(FIXTURES_DIR, name);
  if (!FORCE && existsSync(filePath)) {
    const existing = statSync(filePath).size;
    if (existing >= minBytes * 0.9) {
      console.log(`  ⏭  ${name}: exists (${(existing / 1024 / 1024).toFixed(2)}MB), skip`);
      return { size: existing, skipped: true };
    }
  }
  console.log(`  → ${name}: generating ~${targetRows} rows xlsx (target ≥${(minBytes / 1024 / 1024).toFixed(0)}MB)...`);

  // Dynamic import from web-admin's installed xlsx (mjs build)
  const xlsxMjs = resolve(__dirname, '../../../web-admin/node_modules/xlsx/xlsx.mjs');
  const xlsxUrl = 'file:///' + xlsxMjs.replace(/\\/g, '/');
  const xlsxMod = await import(xlsxUrl);
  const XLSX = xlsxMod.default || xlsxMod;

  const header = ['order_id','store_id','store_name','dish_code','dish_name','category','unit_price','quantity','subtotal','pay_method','pay_time','table_no','waiter','guest_count'];
  const rows = [header];
  for (let seq = 0; seq < targetRows; seq++) {
    const store = STORES[seq % STORES.length];
    const dish = DISHES[(seq * 7 + 3) % DISHES.length];
    const qty = 1 + ((seq * 13) % 5);
    const day = 1 + ((seq * 17) % 90);
    const hour = 11 + ((seq * 3) % 12);
    const min = (seq * 7) % 60;
    const date = new Date(2026, 0, day, hour, min, 0);
    rows.push([
      'O' + (1000000 + seq),
      store.id, store.name,
      dish.code, dish.name, dish.cat,
      dish.price, qty, dish.price * qty,
      PAY_METHODS[(seq * 11) % PAY_METHODS.length],
      date.toISOString().replace('T', ' ').slice(0, 19),
      'T' + (100 + ((seq * 19) % 80)),
      '服务员' + (1 + ((seq * 5) % 30)),
      2 + ((seq * 23) % 6),
    ]);
    if (seq % 100000 === 0 && seq > 0) {
      process.stdout.write(`\r  building xlsx rows: ${seq}/${targetRows}`);
    }
  }
  process.stdout.write(`\r  building xlsx sheet...                                  `);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'POS');
  process.stdout.write(`\r  writing xlsx file...                                     `);
  // XLSX.writeFile requires fs via its internal resolver which fails under pure ESM
  // dynamic-import; use .write() to get a buffer and writeFileSync it ourselves.
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  writeFileSync(filePath, buf);

  const finalSize = statSync(filePath).size;
  const hash = createHash('sha256');
  hash.update(buf);
  const sha = hash.digest('hex');
  process.stdout.write(`\r  ✓ ${name}: ${(finalSize / 1024 / 1024).toFixed(2)}MB / ${targetRows} rows / sha256=${sha.slice(0, 12)}...\n`);
  return { size: finalSize, rows: targetRows, sha256: sha };
}

async function ensureFixture(name, targetBytes) {
  if (ONLY && !name.includes(ONLY)) return null;
  const filePath = resolve(FIXTURES_DIR, name);
  if (!FORCE && existsSync(filePath)) {
    const existing = statSync(filePath).size;
    if (Math.abs(existing - targetBytes) < 512 * 1024) {
      console.log(`  ⏭  ${name}: exists (${(existing / 1024 / 1024).toFixed(2)}MB), skip (pass --force to regen)`);
      return { size: existing, skipped: true };
    }
  }
  console.log(`  → ${name}: generating ~${(targetBytes / 1024 / 1024).toFixed(0)}MB...`);
  return writeCsv(filePath, targetBytes);
}

(async () => {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

  console.log('=== Upload E2E Fixture Generator ===');
  console.log(`Fixtures dir: ${FIXTURES_DIR}`);
  console.log(`Force:        ${FORCE}`);
  console.log(`Oversize:     ${INCLUDE_OVERSIZE}`);
  console.log();

  const results = {};

  results.pos_55mb = await ensureFixture('pos_55mb.csv', 55 * 1024 * 1024);
  results.pos_60mb = await ensureFixture('pos_60mb.csv', 60 * 1024 * 1024);

  // xlsx fixture for /upload-and-analyze (which rejects CSV).
  // Note: xlsx is zip-compressed, so 100k rows ≈ 3-5MB on disk. We want a small but
  // parseable fixture for L4-1 deep (chain roundtrip proof). Size threshold already
  // covered by L3-1 server-local 55MB CSV upload.
  results.pos_xlsx = await ensureXlsxFixture('pos_5mb.xlsx', 80000, 2 * 1024 * 1024);

  if (INCLUDE_OVERSIZE) {
    results.pos_oversize = await ensureFixture('pos_oversize.csv', 501 * 1024 * 1024);
  }

  console.log('\n=== Summary ===');
  for (const [name, r] of Object.entries(results)) {
    if (!r) continue;
    if (r.skipped) console.log(`  ${name}: skipped`);
    else console.log(`  ${name}: ${(r.size / 1024 / 1024).toFixed(2)}MB, sha256=${r.sha256?.slice(0, 16)}...`);
  }

  console.log('\nDone.');
})().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
