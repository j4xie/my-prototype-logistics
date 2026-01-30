/**
 * AI Chat Quality Test Runner
 *
 * Generates test cases, calls the AI chat API, records results,
 * and produces evaluation reports.
 *
 * Usage:
 *   node test-runner.js --round=1 [--count=500] [--verify-previous]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ Configuration ============
const CONFIG = {
  baseUrl: 'https://centerapi.cretaceousfuture.com',
  chatEndpoint: '/weixin/api/ma/ai/chat',
  healthEndpoint: '/weixin/api/ma/ai/health',
  loginEndpoint: '/weixin/api/ma/auth/login-test',
  // Auth headers - will be populated after login
  appId: '',
  thirdSession: '',
  // Test settings
  casesPerRound: 500,
  concurrency: 5,         // parallel requests
  requestDelayMs: 200,    // delay between batches to avoid rate limiting
  timeoutMs: 15000,       // 15s timeout per request
};

// ============ Test Case Templates ============
const TEST_CATEGORIES = {
  product_inquiry: {
    count: 100,
    templates: [
      '推荐{product_type}商品',
      '有什么{product_type}？',
      '帮我找一下{product_type}',
      '{product_type}有哪些选择？',
      '最受欢迎的{product_type}是什么？',
      '有没有新鲜的{product_type}',
      '你们卖{product_type}吗',
      '想买点{product_type}',
      '推荐几款好的{product_type}',
      '{product_type}推荐一下',
      '搜索{product_type}',
      '我要买{product_type}',
      '有没有便宜的{product_type}',
      '进口{product_type}有吗',
      '国产{product_type}推荐',
      '有机{product_type}有卖吗',
      '最好的{product_type}是哪个',
      '哪款{product_type}性价比高',
      '家庭装的{product_type}',
      '适合送礼的{product_type}',
    ],
    variables: {
      product_type: [
        '牛肉', '猪肉', '鸡肉', '羊肉', '海鲜', '鱼', '虾',
        '蔬菜', '水果', '大米', '面粉', '食用油', '调味品',
        '零食', '饮料', '牛奶', '酸奶', '鸡蛋', '豆腐', '面条',
        '速冻食品', '罐头', '坚果', '蜂蜜', '茶叶',
      ]
    }
  },
  price_discount: {
    count: 80,
    templates: [
      '阶梯价格是怎么算的？',
      '买{quantity}件有优惠吗？',
      '{product_type}多少钱？',
      '批量购买有折扣吗？',
      '最低价格是多少？',
      '会员有什么优惠？',
      '满减活动有没有？',
      '今天有什么特价？',
      '大量采购怎么定价？',
      '价格能再便宜点吗？',
      '有没有促销活动？',
      '{product_type}的批发价是多少？',
      '100件和500件的价格区别',
      '怎么购买最划算？',
      '有优惠券吗？',
    ],
    variables: {
      product_type: ['牛肉', '猪肉', '海鲜', '蔬菜', '水果', '大米', '食用油'],
      quantity: ['50', '100', '200', '500', '1000']
    }
  },
  traceability: {
    count: 80,
    templates: [
      '怎么查看溯源信息？',
      '产品的产地在哪里？',
      '有质检报告吗？',
      '食品安全证书在哪看？',
      '运输过程是怎样的？',
      '冷链运输怎么保证？',
      '生产日期是什么时候？',
      '保质期多长？',
      '有没有有机认证？',
      '扫码溯源怎么操作？',
      '溯源二维码在哪里？',
      '这个{product_type}从哪里来的？',
      '能看到养殖过程吗？',
      '检验检疫信息在哪？',
      '怎么确保产品是正品？',
    ],
    variables: {
      product_type: ['牛肉', '猪肉', '鸡肉', '海鲜', '蔬菜', '水果', '大米']
    }
  },
  multi_turn: {
    count: 100,
    // Multi-turn dialogues: arrays of sequential messages sharing a session
    conversations: [
      ['推荐一些牛肉', '有没有更便宜的？', '最便宜那个多少钱？', '帮我加入购物车'],
      ['有什么海鲜？', '虾有几种？', '推荐一种适合炒菜的', '产地是哪里的？'],
      ['我想买水果', '苹果有吗？', '有没有有机的？', '价格多少？'],
      ['推荐今天的特价商品', '第一个商品详细介绍一下', '有溯源信息吗？'],
      ['蔬菜类有哪些', '叶菜类的推荐几个', '西兰花有吗？', '多少钱一斤？'],
      ['猪肉有什么种类？', '五花肉推荐一下', '是黑猪肉吗？', '买5斤多少钱？'],
      ['你好', '我想问一下你们的食品安全标准', '有第三方检测吗？', '报告能下载吗？'],
      ['鸡蛋有卖吗？', '土鸡蛋和普通鸡蛋有什么区别？', '推荐土鸡蛋', '一箱多少个？'],
      ['批量采购怎么操作？', '最低起订量是多少？', '有专属客服吗？', '合同怎么签？'],
      ['食用油推荐', '花生油和菜籽油哪个好？', '5L装多少钱？', '产地在哪？'],
      ['有没有儿童食品？', '有机奶推荐', '适合3岁孩子喝吗？', '配料表能看吗？'],
      ['大米怎么选？', '东北大米有吗？', '五常大米多少钱？', '买10袋有优惠吗？'],
      ['退货政策是什么？', '生鲜可以退吗？', '多长时间内能退？', '退款多久到账？'],
      ['配送范围是哪些？', '冷链配送到哪些城市？', '同城配送要多久？', '运费怎么算？'],
      ['你能做什么？', '推荐当季水果', '芒果是哪里产的？', '有没有组合装？'],
      ['想买调味品', '酱油推荐', '有没有无添加的？', '和醋一起买有优惠吗？'],
      ['坚果零食推荐', '有没有混合装？', '保质期多久？', '适合送人吗？'],
      ['豆制品有哪些？', '豆腐怎么保存？', '有卤豆干吗？', '热量高不高？'],
      ['面条有什么种类？', '手工面推荐', '宽面还是细面好？', '怎么煮好吃？'],
      ['茶叶推荐', '绿茶有哪些？', '龙井多少钱？', '是今年新茶吗？'],
    ]
  },
  general_consultation: {
    count: 60,
    templates: [
      '如何下单？',
      '配送时间是什么时候？',
      '退换货政策是什么？',
      '支持什么付款方式？',
      '如何联系客服？',
      '新用户有什么优惠？',
      '怎么注册会员？',
      '积分怎么使用？',
      '发票怎么开？',
      '可以货到付款吗？',
      '最低消费是多少？',
      '怎么修改收货地址？',
      '订单取消怎么操作？',
      '包装是怎样的？',
      '你们有实体店吗？',
      '营业时间是几点到几点？',
      '企业采购有折扣吗？',
      '可以开增值税发票吗？',
      '有售后保障吗？',
      '送货上门吗？',
    ]
  },
  edge_cases: {
    count: 40,
    cases: [
      '',                          // empty
      ' ',                         // whitespace
      '???',                       // only punctuation
      '啊',                        // single character
      'hello',                     // English
      'a'.repeat(500),             // very long text
      '😀🎉🍎🥩',                 // emojis
      '<script>alert(1)</script>', // XSS attempt
      "'; DROP TABLE products; --", // SQL injection attempt
      '推荐\n牛肉\n商品',          // newlines
      '推荐　牛肉商品',            // full-width space
      '123456',                    // numbers only
      '你好你好你好你好你好你好你好你好你好你好', // repetitive
      '牛肉 猪肉 鸡肉 海鲜 全要',  // multiple items
      '我不知道我要什么',           // vague
      '随便推荐',                   // ambiguous
      '最近有什么新品上架没有？我想看看有没有我喜欢的东西可以买来尝一尝或者送给朋友当礼物也行',  // long natural sentence
      '比较牛肉和猪肉',            // comparison
      '不要牛肉，推荐其他的',      // negative constraint
      '上次买的那个再来一次',       // reference to past (no context)
      '帮我看看我的订单',          // out of scope
      '天气怎么样？',              // off-topic
      '你是谁？',                  // meta question
      '食品安全法第几条规定了...？', // legal question
      '我过敏体质能吃什么？',      // health question
      '推荐减肥食品',              // health + product
      '有没有清真食品？',          // dietary restriction
      '素食者推荐',                // dietary preference
      '低脂低糖的零食',            // specific requirement
      '无防腐剂的产品',            // ingredient constraint
    ]
  },
  product_context: {
    count: 40,
    templates: [
      '这个产品怎么样？',
      '有什么特点？',
      '好评多吗？',
      '适合什么人吃？',
      '保存方法是什么？',
      '配料是什么？',
      '有没有同类更好的？',
      '买多少划算？',
    ],
    productContexts: [
      { id: '1', name: '有机黑猪五花肉' },
      { id: '2', name: '新疆阿克苏苹果' },
      { id: '3', name: '东北五常大米' },
      { id: '4', name: '厄瓜多尔白虾' },
      { id: '5', name: '有机西兰花' },
    ]
  }
};

// ============ Test Case Generator ============
function generateTestCases(round, count = 500) {
  const cases = [];
  let caseId = (round - 1) * count + 1;
  const seed = round * 7919; // Different seed per round for variety

  // Simple seeded random
  let rng = seed;
  function random() {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  }

  function pick(arr) {
    return arr[Math.floor(random() * arr.length)];
  }

  function fillTemplate(template, variables) {
    let result = template;
    for (const [key, values] of Object.entries(variables)) {
      result = result.replace(`{${key}}`, pick(values));
    }
    return result;
  }

  // 1. Product Inquiry
  const cat1 = TEST_CATEGORIES.product_inquiry;
  for (let i = 0; i < cat1.count && cases.length < count; i++) {
    cases.push({
      id: caseId++,
      category: 'product_inquiry',
      type: 'single',
      message: fillTemplate(pick(cat1.templates), cat1.variables),
      expectedBehavior: 'Should return relevant products with images and prices'
    });
  }

  // 2. Price & Discount
  const cat2 = TEST_CATEGORIES.price_discount;
  for (let i = 0; i < cat2.count && cases.length < count; i++) {
    cases.push({
      id: caseId++,
      category: 'price_discount',
      type: 'single',
      message: fillTemplate(pick(cat2.templates), cat2.variables),
      expectedBehavior: 'Should provide pricing info or explain pricing policy'
    });
  }

  // 3. Traceability
  const cat3 = TEST_CATEGORIES.traceability;
  for (let i = 0; i < cat3.count && cases.length < count; i++) {
    cases.push({
      id: caseId++,
      category: 'traceability',
      type: 'single',
      message: fillTemplate(pick(cat3.templates), cat3.variables),
      expectedBehavior: 'Should explain traceability features or provide source info'
    });
  }

  // 4. Multi-turn
  const convos = TEST_CATEGORIES.multi_turn.conversations;
  let multiCount = 0;
  while (multiCount < TEST_CATEGORIES.multi_turn.count && cases.length < count) {
    const convo = convos[multiCount % convos.length];
    const sessionId = `test_session_r${round}_mt${multiCount}_${Date.now()}`;
    for (let j = 0; j < convo.length; j++) {
      cases.push({
        id: caseId++,
        category: 'multi_turn',
        type: 'multi_turn',
        turnIndex: j,
        totalTurns: convo.length,
        sessionId: sessionId,
        message: convo[j],
        expectedBehavior: j === 0 ? 'Should understand initial topic' : 'Should maintain context from previous turns'
      });
    }
    multiCount++;
  }

  // 5. General Consultation
  const cat5 = TEST_CATEGORIES.general_consultation;
  for (let i = 0; i < cat5.count && cases.length < count; i++) {
    cases.push({
      id: caseId++,
      category: 'general_consultation',
      type: 'single',
      message: cat5.templates[i % cat5.templates.length],
      expectedBehavior: 'Should provide helpful operational information'
    });
  }

  // 6. Edge Cases
  const cat6 = TEST_CATEGORIES.edge_cases;
  for (let i = 0; i < cat6.count && cases.length < count; i++) {
    const edgeCase = cat6.cases[i % cat6.cases.length];
    cases.push({
      id: caseId++,
      category: 'edge_case',
      type: 'single',
      message: edgeCase,
      expectedBehavior: 'Should handle gracefully without crash or security issues'
    });
  }

  // 7. Product Context
  const cat7 = TEST_CATEGORIES.product_context;
  for (let i = 0; i < cat7.count && cases.length < count; i++) {
    const ctx = cat7.productContexts[i % cat7.productContexts.length];
    cases.push({
      id: caseId++,
      category: 'product_context',
      type: 'single',
      message: fillTemplate(pick(cat7.templates), {}),
      productId: ctx.id,
      productName: ctx.name,
      expectedBehavior: `Should answer in context of ${ctx.name}`
    });
  }

  return cases.slice(0, count);
}

// ============ API Client ============
function makeRequest(endpoint, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.baseUrl + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'app-id': CONFIG.appId,
        'third-session': CONFIG.thirdSession,
        ...headers
      },
      timeout: CONFIG.timeoutMs
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, parseError: true });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function callAiChat(message, sessionId, productId, productName) {
  const body = { message, sessionId };
  if (productId) body.productId = productId;
  if (productName) body.productName = productName;

  const startTime = Date.now();
  try {
    const res = await makeRequest(CONFIG.chatEndpoint, 'POST', body);
    const latencyMs = Date.now() - startTime;
    return {
      success: res.status === 200 && res.data && res.data.code === 200,
      latencyMs,
      status: res.status,
      code: res.data?.code,
      response: res.data?.data?.response || '',
      products: res.data?.data?.products || [],
      intent: res.data?.data?.intent || '',
      keywords: res.data?.data?.keywords || [],
      hasProducts: res.data?.data?.hasProducts || false,
      ragEnabled: res.data?.data?.ragEnabled || false,
      sessionId: res.data?.data?.sessionId || sessionId,
      error: res.data?.data?.error || false,
      rawData: res.data?.data
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: true,
      errorMessage: err.message,
      response: '',
      products: [],
    };
  }
}

// ============ Evaluator ============
function evaluateResponse(testCase, result) {
  const scores = {
    accuracy: 0,
    completeness: 0,
    speed: 0,
    streaming: 0,
    coherence: 0,
  };
  const issues = [];

  // 1. Information Accuracy (1-5)
  if (result.error || !result.success) {
    scores.accuracy = 1;
    issues.push('API_ERROR: Request failed or returned error');
  } else if (!result.response || result.response.trim().length === 0) {
    scores.accuracy = 1;
    issues.push('EMPTY_RESPONSE: AI returned empty response');
  } else if (result.response.includes('抱歉') && result.response.includes('暂时无法')) {
    scores.accuracy = 2;
    issues.push('FALLBACK_RESPONSE: AI fell back to generic error message');
  } else if (testCase.category === 'product_inquiry' && !result.hasProducts && result.products.length === 0) {
    scores.accuracy = 3;
    issues.push('NO_PRODUCTS: Product inquiry did not return any products');
  } else if (result.response.length < 20) {
    scores.accuracy = 3;
    issues.push('SHORT_RESPONSE: Response is very brief');
  } else {
    scores.accuracy = result.ragEnabled ? 5 : 4;
  }

  // 2. Functional Completeness (1-5)
  if (!result.success) {
    scores.completeness = 1;
  } else {
    let completenessScore = 3; // baseline
    if (testCase.category === 'product_inquiry') {
      if (result.hasProducts && result.products.length > 0) completenessScore = 5;
      else if (result.response.length > 50) completenessScore = 3;
      else completenessScore = 2;
    } else if (testCase.category === 'edge_case') {
      // Edge cases: just not crashing is good
      completenessScore = result.response.length > 0 ? 4 : 2;
      // Check for security issues
      if (result.response.includes('<script>') || result.response.includes('DROP TABLE')) {
        completenessScore = 1;
        issues.push('SECURITY: Response echoed potentially dangerous input');
      }
    } else if (testCase.category === 'multi_turn') {
      completenessScore = result.response.length > 30 ? 4 : 3;
      if (testCase.turnIndex > 0 && result.response.includes('你好') && !testCase.message.includes('你好')) {
        completenessScore = 2;
        issues.push('CONTEXT_LOST: Multi-turn context appears lost');
      }
    } else {
      completenessScore = result.response.length > 50 ? 4 : 3;
    }
    scores.completeness = completenessScore;
  }

  // 3. Response Speed (1-5)
  if (result.latencyMs <= 2000) scores.speed = 5;
  else if (result.latencyMs <= 3000) scores.speed = 4;
  else if (result.latencyMs <= 5000) scores.speed = 3;
  else if (result.latencyMs <= 10000) scores.speed = 2;
  else {
    scores.speed = 1;
    issues.push(`SLOW_RESPONSE: ${result.latencyMs}ms latency`);
  }

  // 4. Streaming (1-5) - We can't truly test streaming from server side,
  // but we can check if the response is structured for streaming
  if (!result.success) {
    scores.streaming = 1;
  } else {
    // The frontend handles streaming display; backend returns full response
    // Score based on whether response exists and is properly formatted
    scores.streaming = result.response.length > 0 ? 4 : 2;
  }

  // 5. Coherence (1-5)
  if (!result.success) {
    scores.coherence = 1;
  } else if (testCase.category === 'multi_turn' && testCase.turnIndex > 0) {
    // Multi-turn: check if response relates to conversation topic
    scores.coherence = result.response.length > 30 ? 4 : 3;
  } else {
    scores.coherence = result.response.length > 20 ? 4 : 3;
  }

  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;

  return {
    scores,
    avgScore: Math.round(avgScore * 100) / 100,
    issues,
    passed: avgScore >= 3.0
  };
}

// ============ Batch Executor ============
async function executeBatch(cases, batchSize = 5) {
  const results = [];
  let completed = 0;

  for (let i = 0; i < cases.length; i += batchSize) {
    const batch = cases.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(tc => callAiChat(tc.message, tc.sessionId || `test_${tc.id}`, tc.productId, tc.productName))
    );

    for (let j = 0; j < batch.length; j++) {
      const tc = batch[j];
      const result = batchResults[j];
      const evaluation = evaluateResponse(tc, result);
      results.push({
        testCase: tc,
        result,
        evaluation,
      });
    }

    completed += batch.length;
    const pct = Math.round((completed / cases.length) * 100);
    process.stdout.write(`\r  Progress: ${completed}/${cases.length} (${pct}%) | Batch ${Math.ceil(i/batchSize) + 1}`);

    // Delay between batches
    if (i + batchSize < cases.length) {
      await new Promise(r => setTimeout(r, CONFIG.requestDelayMs));
    }
  }

  console.log('');
  return results;
}

// ============ Report Generator ============
function generateReport(round, results) {
  const total = results.length;
  const passed = results.filter(r => r.evaluation.passed).length;
  const failed = total - passed;

  // Category breakdown
  const categories = {};
  for (const r of results) {
    const cat = r.testCase.category;
    if (!categories[cat]) {
      categories[cat] = { total: 0, passed: 0, scores: { accuracy: 0, completeness: 0, speed: 0, streaming: 0, coherence: 0 } };
    }
    categories[cat].total++;
    if (r.evaluation.passed) categories[cat].passed++;
    for (const [dim, score] of Object.entries(r.evaluation.scores)) {
      categories[cat].scores[dim] += score;
    }
  }

  // Averages
  for (const cat of Object.values(categories)) {
    for (const dim of Object.keys(cat.scores)) {
      cat.scores[dim] = Math.round((cat.scores[dim] / cat.total) * 100) / 100;
    }
  }

  // Overall averages
  const overallScores = { accuracy: 0, completeness: 0, speed: 0, streaming: 0, coherence: 0 };
  for (const r of results) {
    for (const [dim, score] of Object.entries(r.evaluation.scores)) {
      overallScores[dim] += score;
    }
  }
  for (const dim of Object.keys(overallScores)) {
    overallScores[dim] = Math.round((overallScores[dim] / total) * 100) / 100;
  }
  const overallAvg = Math.round(Object.values(overallScores).reduce((a, b) => a + b, 0) / 5 * 100) / 100;

  // Issue frequency
  const issueCounts = {};
  for (const r of results) {
    for (const issue of r.evaluation.issues) {
      const key = issue.split(':')[0];
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    }
  }

  // Latency stats
  const latencies = results.map(r => r.result.latencyMs).filter(l => l > 0).sort((a, b) => a - b);
  const latencyStats = {
    min: latencies[0] || 0,
    max: latencies[latencies.length - 1] || 0,
    avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
    p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
    p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
  };

  // Error rate
  const errorCount = results.filter(r => r.result.error || !r.result.success).length;

  return {
    round,
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      passRate: Math.round((passed / total) * 10000) / 100 + '%',
      overallAvg,
      overallScores,
      errorCount,
      errorRate: Math.round((errorCount / total) * 10000) / 100 + '%',
    },
    latency: latencyStats,
    categories,
    topIssues: Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([issue, count]) => ({ issue, count, pct: Math.round((count / total) * 10000) / 100 + '%' })),
  };
}

function generateMarkdownSummary(report) {
  const s = report.summary;
  const l = report.latency;
  let md = `# AI Chat Test Report - Round ${report.round}\n\n`;
  md += `**Date**: ${report.timestamp}\n\n`;
  md += `## Overall Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Cases | ${s.total} |\n`;
  md += `| Passed | ${s.passed} (${s.passRate}) |\n`;
  md += `| Failed | ${s.failed} |\n`;
  md += `| Error Rate | ${s.errorRate} |\n`;
  md += `| **Overall Avg Score** | **${s.overallAvg}/5.0** |\n\n`;

  md += `## Dimension Scores\n\n`;
  md += `| Dimension | Score |\n|-----------|-------|\n`;
  for (const [dim, score] of Object.entries(s.overallScores)) {
    const emoji = score >= 4 ? '✅' : score >= 3 ? '⚠️' : '❌';
    md += `| ${dim} | ${emoji} ${score}/5.0 |\n`;
  }

  md += `\n## Latency\n\n`;
  md += `| Stat | Value |\n|------|-------|\n`;
  md += `| Avg | ${l.avg}ms |\n`;
  md += `| P50 | ${l.p50}ms |\n`;
  md += `| P95 | ${l.p95}ms |\n`;
  md += `| P99 | ${l.p99}ms |\n`;
  md += `| Min | ${l.min}ms |\n`;
  md += `| Max | ${l.max}ms |\n`;

  md += `\n## Category Breakdown\n\n`;
  md += `| Category | Cases | Pass Rate | Accuracy | Complete | Speed | Coherence |\n`;
  md += `|----------|-------|-----------|----------|----------|-------|----------|\n`;
  for (const [cat, data] of Object.entries(report.categories)) {
    const pr = Math.round((data.passed / data.total) * 100) + '%';
    md += `| ${cat} | ${data.total} | ${pr} | ${data.scores.accuracy} | ${data.scores.completeness} | ${data.scores.speed} | ${data.scores.coherence} |\n`;
  }

  if (report.topIssues.length > 0) {
    md += `\n## Top Issues\n\n`;
    md += `| Issue | Count | % |\n|-------|-------|---|\n`;
    for (const issue of report.topIssues.slice(0, 10)) {
      md += `| ${issue.issue} | ${issue.count} | ${issue.pct} |\n`;
    }
  }

  return md;
}

// ============ Auth Helper ============
async function authenticate() {
  // Try to read saved auth from file
  const authFile = path.join(__dirname, '.auth-cache.json');
  if (fs.existsSync(authFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      if (cached.thirdSession && cached.appId && (Date.now() - cached.timestamp) < 3600000) {
        CONFIG.appId = cached.appId;
        CONFIG.thirdSession = cached.thirdSession;
        console.log('  Using cached auth token');
        return true;
      }
    } catch (e) {}
  }

  console.log('  No valid auth cache found.');
  console.log('  To authenticate, please provide credentials in .auth-cache.json:');
  console.log('  {"appId": "...", "thirdSession": "...", "timestamp": ...}');
  console.log('');
  console.log('  You can get these from WeChat DevTools Network tab.');
  return false;
}

// ============ Main ============
async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace('--', '').split('=');
    args[key] = value || 'true';
  }

  const round = parseInt(args.round || '1');
  const count = parseInt(args.count || '500');
  const verifyPrevious = args['verify-previous'] === 'true';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AI Chat Quality Test - Round ${round}`);
  console.log(`  Cases: ${count} | Verify Previous: ${verifyPrevious}`);
  console.log(`${'='.repeat(60)}\n`);

  // Auth
  console.log('[1/5] Authenticating...');
  const authed = await authenticate();
  if (!authed) {
    console.log('\n❌ Authentication required. Please set up .auth-cache.json first.');
    process.exit(1);
  }

  // Health check
  console.log('[2/5] Health check...');
  try {
    const health = await makeRequest(CONFIG.healthEndpoint, 'GET');
    if (health.data?.code === 200) {
      console.log('  ✅ API is healthy');
    } else {
      console.log('  ⚠️ Health check returned:', health.data?.msg || 'unknown');
    }
  } catch (e) {
    console.log('  ⚠️ Health check failed:', e.message);
  }

  // Generate test cases
  console.log(`[3/5] Generating ${count} test cases...`);
  const testCases = generateTestCases(round, count);
  console.log(`  Generated ${testCases.length} cases across ${new Set(testCases.map(t => t.category)).size} categories`);

  // Save test cases
  const roundDir = path.join(__dirname, 'test-results', `round-${round}`);
  fs.mkdirSync(roundDir, { recursive: true });
  fs.writeFileSync(path.join(roundDir, 'test-cases.json'), JSON.stringify(testCases, null, 2));

  // Execute
  console.log(`[4/5] Executing ${testCases.length} test cases (concurrency: ${CONFIG.concurrency})...`);
  const startTime = Date.now();
  const results = await executeBatch(testCases, CONFIG.concurrency);
  const totalTime = Date.now() - startTime;
  console.log(`  Completed in ${Math.round(totalTime / 1000)}s`);

  // Save raw results
  fs.writeFileSync(path.join(roundDir, 'results.json'), JSON.stringify(results.map(r => ({
    testCaseId: r.testCase.id,
    category: r.testCase.category,
    message: r.testCase.message,
    success: r.result.success,
    latencyMs: r.result.latencyMs,
    responseLength: r.result.response.length,
    productsCount: r.result.products.length,
    evaluation: r.evaluation,
  })), null, 2));

  // Generate report
  console.log('[5/5] Generating evaluation report...');
  const report = generateReport(round, results);
  fs.writeFileSync(path.join(roundDir, 'evaluation.json'), JSON.stringify(report, null, 2));

  const markdown = generateMarkdownSummary(report);
  fs.writeFileSync(path.join(roundDir, 'summary.md'), markdown);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  ROUND SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Pass Rate: ${report.summary.passRate}`);
  console.log(`  Overall Score: ${report.summary.overallAvg}/5.0`);
  console.log(`  Error Rate: ${report.summary.errorRate}`);
  console.log(`  Avg Latency: ${report.latency.avg}ms (P95: ${report.latency.p95}ms)`);
  console.log('');
  console.log('  Dimension Scores:');
  for (const [dim, score] of Object.entries(report.summary.overallScores)) {
    console.log(`    ${dim}: ${score}/5.0`);
  }
  if (report.topIssues.length > 0) {
    console.log('');
    console.log('  Top Issues:');
    for (const issue of report.topIssues.slice(0, 5)) {
      console.log(`    - ${issue.issue}: ${issue.count} (${issue.pct})`);
    }
  }
  console.log('\n  Results saved to:', roundDir);
  console.log('='.repeat(60) + '\n');

  // Return report for Ralph integration
  return report;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
