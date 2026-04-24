// agg-strategy-prod-verify.mjs
//
// Verifies the persisted-agg_strategy refactor preserves Apr 24 behaviour:
//   - Review xlsx (qhj_q3): 4 rating cols return aggStrategy='mean'
//   - POS xlsx (qhj_order): legitimate measures keep aggStrategy='sum',
//                           IDs return aggStrategy='none'
//
// Uses API-level checks (not UI-level Playwright) because the wire shape
// is what matters — FE getSmartKPIs already keys on aggStrategy and works
// against any web-admin bundle.
//
// Usage:
//   ENV=test node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
//   ENV=prod node tests/e2e-comprehensive/agg-strategy-prod-verify.mjs
//
// Exit code 0 = all assertions pass. 1 = at least one assertion failed.

import { execSync } from 'child_process';

const ENV = process.env.ENV || 'test';
const CONFIG = ENV === 'prod' ? {
  jwt_url: 'http://localhost:10010/api/mobile/auth/unified-login',
  py_url: 'http://localhost:8083/api/insight/quick-summary',
  factory: 'RES_3101_009',
  reviewUploadId: 4172,
  posUploadId: 4169,
  ssh: true,
} : {
  jwt_url: 'http://localhost:10011/api/mobile/auth/unified-login',
  py_url: 'http://localhost:8084/api/insight/quick-summary',
  factory: 'F001',
  reviewUploadId: 3975,
  posUploadId: 3970,
  ssh: true,
};

const SERVER = 'root@47.100.235.168';
let exitCode = 0;
const FAIL = (msg) => { console.error(`X ${msg}`); exitCode = 1; };
const OK = (msg) => console.log(`OK ${msg}`);

function sshExec(remoteCmd) {
  // Run a remote command via ssh. To avoid local shell quoting hell with
  // nested single quotes, base64-encode the command and decode on the server.
  const b64 = Buffer.from(remoteCmd, 'utf-8').toString('base64');
  return execSync(`ssh ${SERVER} "echo ${b64} | base64 -d | bash"`, { encoding: 'utf-8' });
}

function getJWT() {
  const cmd = `curl -sf -X POST ${CONFIG.jwt_url} -H "Content-Type: application/json" -d '{"username":"qhj_prod","password":"123456","factoryId":"${CONFIG.factory}"}'`;
  const resp = sshExec(cmd);
  const data = JSON.parse(resp);
  if (!data.data || !data.data.accessToken) {
    throw new Error(`No JWT in response: ${resp.substring(0, 200)}`);
  }
  return data.data.accessToken;
}

function quickSummary(token, uploadId) {
  const cmd = `curl -sf -X POST ${CONFIG.py_url} -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"upload_id": ${uploadId}}'`;
  const resp = sshExec(cmd);
  return JSON.parse(resp);
}

function checkUpload(label, uploadId, expected) {
  console.log(`\n--- Checking ${label} (upload ${uploadId}) ---`);
  let data;
  try {
    const token = getJWT();
    data = quickSummary(token, uploadId);
  } catch (e) {
    FAIL(`${label}: API call failed: ${e.message}`);
    return;
  }

  if (!data.columns) {
    FAIL(`${label}: response missing 'columns' key — got: ${JSON.stringify(data).substring(0, 200)}`);
    return;
  }

  const ratings = data.columns.filter(c => c.aggStrategy === 'mean');
  const ids = data.columns.filter(c => c.aggStrategy === 'none');
  const sums = data.columns.filter(c => c.aggStrategy === 'sum');

  console.log(`  Total: ${data.columns.length}, mean: ${ratings.length}, sum: ${sums.length}, none: ${ids.length}`);

  for (const must of expected.minRatings ? [{count: expected.minRatings}] : []) {
    if (ratings.length >= must.count) {
      OK(`${label}: at least ${must.count} rating cols (got ${ratings.length})`);
      ratings.slice(0, 5).forEach(r => console.log(`    ${r.name}: mean=${r.mean?.toFixed?.(2) || r.mean}`));
    } else {
      FAIL(`${label}: expected >=${must.count} rating cols, got ${ratings.length}`);
    }
  }

  for (const minIds of expected.minIds ? [expected.minIds] : []) {
    if (ids.length >= minIds) {
      OK(`${label}: at least ${minIds} ID/none cols (got ${ids.length})`);
    } else {
      FAIL(`${label}: expected >=${minIds} 'none' cols, got ${ids.length}`);
    }
  }

  for (const minSums of expected.minSums ? [expected.minSums] : []) {
    if (sums.length >= minSums) {
      OK(`${label}: at least ${minSums} sum cols (got ${sums.length})`);
    } else {
      FAIL(`${label}: expected >=${minSums} sum cols, got ${sums.length}`);
    }
  }

  for (const forbiddenName of expected.forbiddenAsKpi || []) {
    const sumCard = sums.find(c => c.name === forbiddenName);
    if (sumCard) {
      FAIL(`${label}: column "${forbiddenName}" should NOT be aggStrategy='sum' but is`);
    } else {
      OK(`${label}: column "${forbiddenName}" correctly NOT in 'sum' bucket`);
    }
  }
}

console.log(`\n=== Agg-strategy verify (env=${ENV}) ===`);

checkUpload('Review xlsx', CONFIG.reviewUploadId, {
  minRatings: 4,             // 星级分, 口味分, 环境分, 服务分
  minIds: 1,                 // at least 1 ID col suppressed
  forbiddenAsKpi: ['评价ID', '团购ID', '门店美团ID'],
});

checkUpload('POS xlsx', CONFIG.posUploadId, {
  minSums: 5,                // POS data has many measures (营业额 etc.)
  forbiddenAsKpi: ['账单号', '外部单号'],  // POS IDs forbidden as 'sum'
});

if (exitCode === 0) {
  console.log('\nAll assertions passed');
} else {
  console.error('\nOne or more assertions failed');
}
process.exit(exitCode);
