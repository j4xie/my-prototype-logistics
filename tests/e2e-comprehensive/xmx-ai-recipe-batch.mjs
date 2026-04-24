// Call AI draft API for xmx top dishes and save via batch-import endpoint
import { execSync } from 'child_process';

const SERVER = 'root@47.100.235.168';
function ssh(cmd) {
  const b64 = Buffer.from(cmd, 'utf-8').toString('base64');
  return execSync(`ssh ${SERVER} "echo ${b64} | base64 -d | bash"`, { encoding: 'utf-8' });
}

const secret = ssh(`grep INTERNAL_API_SECRET /www/wwwroot/cretas/.env.prod | cut -d= -f2`).trim();

// Top 10 by revenue from xlsx
const dishes = [
  { name: '团餐', hint: '兰州牛肉面套餐' },
  { name: '西北羊肉串', hint: '烤羊肉串' },
  { name: '唏嘛香牛肉面(二细)', hint: '兰州牛肉面' },
  { name: '加面', hint: '加面团加量' },
  { name: '唏嘛香牛肉面(细的)', hint: '兰州牛肉面' },
  { name: '唏嘛香牛肉面(毛细)', hint: '兰州牛肉面' },
  { name: '西北大拌菜', hint: '凉拌菜' },
  { name: '兰州细钎羊肉串5串', hint: '烤羊肉串' },
  { name: '牛肉炒拉条', hint: '兰州炒拉条' },
  { name: '唏嘛香牛肉面(三细)', hint: '兰州牛肉面' },
];

const allRows = [];
for (const d of dishes) {
  console.log(`Calling AI for: ${d.name} ...`);
  const body = JSON.stringify({ dish_name: d.name, hint: d.hint });
  const bodyB64 = Buffer.from(body, 'utf-8').toString('base64');
  const cmd = `curl -s --max-time 45 -X POST -H 'Content-Type: application/json' -H "X-Internal-Secret: ${secret}" -H 'X-Factory-Id: R_XMX_CHAIN' -d "$(echo ${bodyB64} | base64 -d)" 'http://localhost:8083/api/smartbi/restaurant-ops/recipes/ai-draft'`;
  try {
    const out = ssh(cmd);
    const parsed = JSON.parse(out);
    if (parsed.success && parsed.data) {
      console.log(`  → ${parsed.data.ingredients.length} ingredients, cost ratio ${parsed.data.estimatedCostRatio}`);
      for (const ing of parsed.data.ingredients) {
        // Infer price based on ingredient — use approximate values
        const priceGuess = inferPrice(ing.name);
        allRows.push({
          菜品名称: d.name,
          食材名称: ing.name,
          用量: ing.qty,
          单位: ing.unit,
          食材单价: priceGuess,
          是否主料: ing.is_main ? '是' : '否',
        });
      }
    } else {
      console.log(`  ERR: ${parsed.message}`);
    }
  } catch (e) {
    console.log(`  EXC: ${e.message}`);
  }
}

function inferPrice(name) {
  const map = {
    '牛肉': 100, '羊肉': 80, '鸡肉': 22, '鸡腿': 22, '鸡胸': 18,
    '羊肉串': 80, '兰州拉面': 8, '面粉': 5, '面条': 6, '拉面': 6,
    '牛骨': 40, '牛骨汤': 30, '面团': 5, '高汤': 15,
    '白萝卜': 5, '胡萝卜': 5, '萝卜': 5, '白菜': 4, '黄瓜': 6,
    '香菜': 30, '葱': 8, '蒜': 10, '姜': 10, '生姜': 10,
    '辣椒': 20, '花椒': 80, '花椒粉': 80, '辣椒油': 25, '辣椒粉': 25,
    '盐': 3, '酱油': 15, '醋': 10, '油': 12, '食用油': 12,
    '豆瓣酱': 15, '番茄': 10, '洋葱': 6,
    '鸡蛋': 12, '豆腐': 8, '土豆': 5, '粉丝': 12,
    '孜然': 40, '孜然粉': 40, '五香粉': 30,
    '竹签': 1, '签子': 1,
    '火腿': 30, '酸菜': 15,
  };
  for (const [k, v] of Object.entries(map)) {
    if (name.includes(k)) return v;
  }
  return 15; // default
}

console.log(`\n=== Total recipe rows: ${allRows.length} ===`);

// Now write CSV and POST to batch-import
import fs from 'fs';
import path from 'path';
const OUT = 'tests/xmx_ai_batch.csv';
const cols = ['菜品名称', '食材名称', '用量', '单位', '食材单价', '是否主料'];
let csv = '﻿' + cols.join(',') + '\n';
for (const r of allRows) csv += cols.map(c => String(r[c] ?? '')).join(',') + '\n';
fs.writeFileSync(OUT, csv, 'utf-8');
console.log(`CSV written to ${OUT}, size ${csv.length} bytes`);

// Upload
const scpRes = execSync(`scp ${OUT} ${SERVER}:/tmp/xmx_ai_batch.csv`, { encoding: 'utf-8' });
console.log('uploaded to server');

const uploadCmd = `curl -s --max-time 60 -X POST -H "X-Internal-Secret: ${secret}" -H 'X-Factory-Id: R_XMX_CHAIN' -F "file=@/tmp/xmx_ai_batch.csv" 'http://localhost:8083/api/smartbi/restaurant-ops/recipes/batch-import'`;
const uploadResult = ssh(uploadCmd);
console.log('\n=== Import result ===\n' + uploadResult);

// ETL
const etlCmd = `curl -s --max-time 60 -X POST -H "X-Internal-Secret: ${secret}" -H 'X-Factory-Id: R_XMX_CHAIN' 'http://localhost:8083/api/smartbi/restaurant-ops/etl'`;
console.log('\n=== ETL ===\n' + ssh(etlCmd));

// Check new coverage
const covCmd = `curl -s -H "X-Internal-Secret: ${secret}" -H 'X-Factory-Id: R_XMX_CHAIN' 'http://localhost:8083/api/smartbi/restaurant-ops/gross-margin?days=365'`;
const cov = JSON.parse(ssh(covCmd)).data;
console.log(`\n=== XMX COVERAGE AFTER AI SEED ===`);
console.log(`菜品: ${cov.coverage.totalDishCount}, 有配方: ${cov.coverage.dishCount}, 营收覆盖: ${(cov.coverage.revenueRatio*100).toFixed(1)}%`);
console.log(`总营收: ¥${cov.totalRevenue.toLocaleString()}, 总毛利: ¥${cov.totalProfit.toLocaleString()}, 平均毛利率: ${(cov.avgRate*100).toFixed(1)}%`);
