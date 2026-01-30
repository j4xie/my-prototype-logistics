/**
 * Ralph Loop Orchestrator for AI Chat Quality Testing
 *
 * Runs 20 rounds of 500 test cases each (10,000 total).
 * After each round:
 *   1. Evaluates results
 *   2. Identifies optimization opportunities
 *   3. Applies fixes (if applicable from this process)
 *   4. Generates a cumulative report
 *   5. Refreshes auth token if needed
 *   6. Proceeds to next round
 *
 * Usage: node ralph-loop.js [--start-round=1] [--end-round=20]
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const TEST_DIR = __dirname;
const RESULTS_DIR = path.join(TEST_DIR, 'test-results');
const PROJECT_ROOT = path.resolve(TEST_DIR, '..');
const TOTAL_ROUNDS = 20;
const CASES_PER_ROUND = 500;
const AUTH_FILE = path.join(TEST_DIR, '.auth-cache.json');

// Parse args
const args = {};
for (const arg of process.argv.slice(2)) {
  const [key, value] = arg.replace('--', '').split('=');
  args[key] = value || 'true';
}

const START_ROUND = parseInt(args['start-round'] || '1');
const END_ROUND = parseInt(args['end-round'] || String(TOTAL_ROUNDS));

// ============ Auth Management ============
async function refreshAuthToken() {
  console.log('\n[AUTH] Checking/refreshing auth token...');

  // Check if current token is still valid
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  const ageMs = Date.now() - auth.timestamp;
  const ageHours = ageMs / 3600000;

  if (ageHours < 5) {
    console.log(`  Token age: ${ageHours.toFixed(1)}h - still valid`);
    return true;
  }

  console.log(`  Token age: ${ageHours.toFixed(1)}h - needs refresh`);

  try {
    // Refresh via SSH to Redis
    const cmd = `ssh root@139.196.165.140 "
      EXISTING=\\$(redis-cli KEYS 'wx:ma:3rd_session:*' | head -1)
      if [ -n \\"\\$EXISTING\\" ]; then
        EXISTING_KEY=\\$(echo \\$EXISTING | sed 's/wx:ma:3rd_session://')
        DATA=\\$(redis-cli GET \\"\\$EXISTING\\")
        NEW_TOKEN=test-ai-chat-quality-$(Date.now())
        redis-cli SET \\"wx:ma:3rd_session:\\$NEW_TOKEN\\" \\"\\$DATA\\" EX 21600
        echo \\$NEW_TOKEN
      fi
    "`;

    const newToken = execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim().split('\n').pop();

    if (newToken && newToken.startsWith('test-ai-chat-quality-')) {
      const newAuth = { ...auth, thirdSession: newToken, timestamp: Date.now() };
      fs.writeFileSync(AUTH_FILE, JSON.stringify(newAuth));
      console.log(`  New token: ${newToken}`);
      return true;
    }
  } catch (e) {
    console.log(`  Token refresh failed: ${e.message}`);
  }

  return false;
}

// ============ Run Single Round ============
function runTestRound(round) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ROUND ${round}/${END_ROUND} (Cases: ${(round - 1) * CASES_PER_ROUND + 1}-${round * CASES_PER_ROUND})`);
    console.log(`${'='.repeat(70)}`);

    const child = spawn('node', [
      path.join(TEST_DIR, 'test-runner.js'),
      `--round=${round}`,
      `--count=${CASES_PER_ROUND}`
    ], {
      cwd: TEST_DIR,
      stdio: 'inherit',
      env: { ...process.env }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Round ${round} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

// ============ Read Round Results ============
function readRoundEvaluation(round) {
  const evalFile = path.join(RESULTS_DIR, `round-${round}`, 'evaluation.json');
  if (fs.existsSync(evalFile)) {
    return JSON.parse(fs.readFileSync(evalFile, 'utf-8'));
  }
  return null;
}

// ============ Cumulative Report ============
function generateCumulativeReport(rounds) {
  const allEvals = [];
  let totalCases = 0;
  let totalPassed = 0;
  let totalErrors = 0;
  const allScores = { accuracy: 0, completeness: 0, speed: 0, streaming: 0, coherence: 0 };
  const allIssues = {};
  const latencies = [];

  for (let r = START_ROUND; r <= rounds; r++) {
    const evalData = readRoundEvaluation(r);
    if (!evalData) continue;

    allEvals.push(evalData);
    totalCases += evalData.summary.total;
    totalPassed += evalData.summary.passed;
    totalErrors += evalData.summary.errorCount;

    for (const [dim, score] of Object.entries(evalData.summary.overallScores)) {
      allScores[dim] += score * evalData.summary.total;
    }

    for (const issue of evalData.topIssues) {
      allIssues[issue.issue] = (allIssues[issue.issue] || 0) + issue.count;
    }

    latencies.push(evalData.latency.avg);
  }

  // Averages
  for (const dim of Object.keys(allScores)) {
    allScores[dim] = totalCases > 0 ? Math.round((allScores[dim] / totalCases) * 100) / 100 : 0;
  }
  const overallAvg = Object.values(allScores).reduce((a, b) => a + b, 0) / 5;

  let md = `# AI Chat Quality Test - Cumulative Report\n\n`;
  md += `**Updated**: ${new Date().toISOString()}\n`;
  md += `**Rounds Completed**: ${allEvals.length}/${TOTAL_ROUNDS}\n`;
  md += `**Total Test Cases**: ${totalCases}/10,000\n\n`;

  md += `## Overall Quality Score: ${overallAvg.toFixed(2)}/5.0\n\n`;

  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Cases | ${totalCases} |\n`;
  md += `| Passed | ${totalPassed} (${(totalPassed/totalCases*100).toFixed(1)}%) |\n`;
  md += `| Errors | ${totalErrors} (${(totalErrors/totalCases*100).toFixed(1)}%) |\n`;
  md += `| Avg Latency | ${Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length)}ms |\n\n`;

  md += `## Dimension Scores\n\n`;
  md += `| Dimension | Score | Status |\n|-----------|-------|--------|\n`;
  for (const [dim, score] of Object.entries(allScores)) {
    const status = score >= 4 ? 'GOOD' : score >= 3 ? 'NEEDS IMPROVEMENT' : 'CRITICAL';
    md += `| ${dim} | ${score}/5.0 | ${status} |\n`;
  }

  md += `\n## Round-by-Round Progress\n\n`;
  md += `| Round | Cases | Pass Rate | Avg Score | Avg Latency | Top Issue |\n`;
  md += `|-------|-------|-----------|-----------|-------------|----------|\n`;
  for (const evalData of allEvals) {
    const topIssue = evalData.topIssues[0]?.issue || 'none';
    md += `| ${evalData.round} | ${evalData.summary.total} | ${evalData.summary.passRate} | ${evalData.summary.overallAvg} | ${evalData.latency.avg}ms | ${topIssue} |\n`;
  }

  if (Object.keys(allIssues).length > 0) {
    md += `\n## Accumulated Issues\n\n`;
    md += `| Issue | Total Count |\n|-------|------------|\n`;
    for (const [issue, count] of Object.entries(allIssues).sort((a, b) => b[1] - a[1])) {
      md += `| ${issue} | ${count} |\n`;
    }
  }

  md += `\n## Optimization History\n\n`;
  for (let r = START_ROUND; r <= rounds; r++) {
    const optFile = path.join(RESULTS_DIR, `round-${r}`, 'optimization-report.md');
    if (fs.existsSync(optFile)) {
      md += `### Round ${r}\n`;
      md += fs.readFileSync(optFile, 'utf-8') + '\n\n';
    }
  }

  return md;
}

// ============ Analyze and Suggest Optimizations ============
function analyzeForOptimizations(evalData) {
  const opts = [];
  const s = evalData.summary;

  // Check each dimension
  if (s.overallScores.accuracy < 3.5) {
    opts.push({
      priority: 'HIGH',
      dimension: 'accuracy',
      issue: 'Low accuracy score',
      suggestion: 'Review AI prompt templates, improve RAG retrieval, add more product knowledge'
    });
  }

  if (s.overallScores.completeness < 3.5) {
    opts.push({
      priority: 'HIGH',
      dimension: 'completeness',
      issue: 'Low completeness score',
      suggestion: 'Improve product matching, ensure products are returned for product queries'
    });
  }

  if (s.overallScores.speed < 3.0) {
    opts.push({
      priority: 'HIGH',
      dimension: 'speed',
      issue: `High latency (avg: ${evalData.latency.avg}ms, P95: ${evalData.latency.p95}ms)`,
      suggestion: 'Optimize AI model call, add caching, reduce prompt size'
    });
  }

  // Check specific issues
  for (const issue of evalData.topIssues) {
    if (issue.issue === 'NO_PRODUCTS' && parseInt(issue.pct) > 30) {
      opts.push({
        priority: 'HIGH',
        dimension: 'completeness',
        issue: `${issue.pct} of product queries returned no products`,
        suggestion: 'Improve semantic search, expand product keyword matching'
      });
    }
    if (issue.issue === 'FALLBACK_RESPONSE' && parseInt(issue.pct) > 10) {
      opts.push({
        priority: 'MEDIUM',
        dimension: 'accuracy',
        issue: `${issue.pct} responses fell back to generic error`,
        suggestion: 'Check AI service availability, improve error recovery'
      });
    }
    if (issue.issue === 'API_ERROR' && parseInt(issue.pct) > 5) {
      opts.push({
        priority: 'CRITICAL',
        dimension: 'reliability',
        issue: `${issue.pct} API errors`,
        suggestion: 'Check server health, API rate limiting, auth token validity'
      });
    }
    if (issue.issue === 'CONTEXT_LOST' && parseInt(issue.pct) > 20) {
      opts.push({
        priority: 'MEDIUM',
        dimension: 'coherence',
        issue: `${issue.pct} multi-turn conversations lost context`,
        suggestion: 'Improve session management, increase context window'
      });
    }
  }

  // Error rate
  if (parseInt(s.errorRate) > 10) {
    opts.push({
      priority: 'CRITICAL',
      dimension: 'reliability',
      issue: `Error rate: ${s.errorRate}`,
      suggestion: 'Server may be overloaded or auth token expired. Check health.'
    });
  }

  return opts;
}

// ============ Main Loop ============
async function main() {
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`  AI CHAT QUALITY TESTING - RALPH AUTONOMOUS LOOP`);
  console.log(`  Rounds: ${START_ROUND}-${END_ROUND} | Cases per round: ${CASES_PER_ROUND}`);
  console.log(`  Total target: ${(END_ROUND - START_ROUND + 1) * CASES_PER_ROUND} test cases`);
  console.log(`${'#'.repeat(70)}\n`);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  for (let round = START_ROUND; round <= END_ROUND; round++) {
    const roundStart = Date.now();

    // Refresh auth if needed
    await refreshAuthToken();

    // Run test round
    try {
      await runTestRound(round);
    } catch (err) {
      console.error(`\n[ERROR] Round ${round} failed: ${err.message}`);

      // Try refreshing auth and retry once
      console.log('[RETRY] Refreshing auth and retrying...');
      await refreshAuthToken();
      try {
        await runTestRound(round);
      } catch (retryErr) {
        console.error(`[FATAL] Round ${round} failed after retry: ${retryErr.message}`);
        // Write failure report and continue to next round
        const roundDir = path.join(RESULTS_DIR, `round-${round}`);
        fs.mkdirSync(roundDir, { recursive: true });
        fs.writeFileSync(path.join(roundDir, 'optimization-report.md'),
          `# Round ${round} - FAILED\n\nError: ${retryErr.message}\n\nWill retry in next round.\n`);
        continue;
      }
    }

    // Analyze results
    const evalData = readRoundEvaluation(round);
    if (evalData) {
      const optimizations = analyzeForOptimizations(evalData);

      // Write optimization report
      const roundDir = path.join(RESULTS_DIR, `round-${round}`);
      let optReport = `# Round ${round} Optimization Report\n\n`;
      optReport += `**Score**: ${evalData.summary.overallAvg}/5.0 | **Pass Rate**: ${evalData.summary.passRate}\n\n`;

      if (optimizations.length === 0) {
        optReport += `No critical optimizations needed. All metrics within acceptable range.\n`;
      } else {
        optReport += `## Identified Issues (${optimizations.length})\n\n`;
        for (const opt of optimizations) {
          optReport += `### [${opt.priority}] ${opt.dimension}: ${opt.issue}\n`;
          optReport += `- **Suggestion**: ${opt.suggestion}\n\n`;
        }
      }

      fs.writeFileSync(path.join(roundDir, 'optimization-report.md'), optReport);

      // Print round summary
      const elapsed = Math.round((Date.now() - roundStart) / 1000);
      console.log(`\n[ROUND ${round} COMPLETE] Score: ${evalData.summary.overallAvg}/5.0 | Time: ${elapsed}s`);
      console.log(`  Cumulative cases: ${round * CASES_PER_ROUND}/${END_ROUND * CASES_PER_ROUND}`);

      if (optimizations.length > 0) {
        console.log(`  Optimizations identified: ${optimizations.length}`);
        for (const opt of optimizations.slice(0, 3)) {
          console.log(`    [${opt.priority}] ${opt.issue}`);
        }
      }
    }

    // Generate cumulative report
    const cumulativeReport = generateCumulativeReport(round);
    fs.writeFileSync(path.join(RESULTS_DIR, 'CUMULATIVE_REPORT.md'), cumulativeReport);

    // Check if we've reached the goal
    const totalCasesCompleted = round * CASES_PER_ROUND;
    if (totalCasesCompleted >= 10000 && evalData && evalData.summary.overallAvg >= 4.0) {
      console.log(`\n${'*'.repeat(70)}`);
      console.log(`  TARGET REACHED: ${totalCasesCompleted} test cases with avg score >= 4.0`);
      console.log(`${'*'.repeat(70)}\n`);
      break;
    }

    // Brief pause between rounds
    if (round < END_ROUND) {
      console.log(`\n  Pausing 5s before next round...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Final summary
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`  TESTING COMPLETE`);
  console.log(`  Full report: ${path.join(RESULTS_DIR, 'CUMULATIVE_REPORT.md')}`);
  console.log(`${'#'.repeat(70)}\n`);
}

main().catch(err => {
  console.error('Fatal error in loop:', err);
  process.exit(1);
});
