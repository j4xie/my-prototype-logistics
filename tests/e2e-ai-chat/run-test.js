/**
 * AI Chat E2E Test - Plain JS Playwright script
 * Run: node run-test.js
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://cretaceousfuture.com';
const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots/ai-chat');

let passCount = 0;
let failCount = 0;
const issues = [];

async function ss(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function pass(name) { passCount++; console.log(`  ✅ ${name}`); }
function fail(name, detail) { failCount++; issues.push(`${name}: ${detail}`); console.log(`  ❌ ${name}: ${detail}`); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // ===== TEST 1: Page Load & Initial State =====
  console.log('\n🧪 Test 1: Page Load & Initial State');
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  const title = await page.title();
  title.includes('AI智能对话') ? pass('Page title') : fail('Page title', title);

  const header = await page.textContent('.page-header h1');
  header && header.includes('食品安全') ? pass('Header text') : fail('Header text', header || 'missing');

  const welcome = await page.textContent('.msg.ai .msg-bubble');
  welcome && welcome.includes('白垩纪AI智能助手') ? pass('Welcome message') : fail('Welcome message', 'missing');

  const input = await page.isVisible('#chatInput');
  input ? pass('Input visible') : fail('Input visible', 'not found');

  const sendBtn = await page.isVisible('.send-btn');
  sendBtn ? pass('Send button visible') : fail('Send button visible', 'not found');

  await ss(page, '01-initial-state');

  // ===== TEST 2: Navigation =====
  console.log('\n🧪 Test 2: Navigation Links');
  const activeNav = await page.textContent('.nav-link.active');
  activeNav && activeNav.includes('AI对话') ? pass('Active nav link') : fail('Active nav link', activeNav || 'missing');

  const homeLink = await page.isVisible('a.nav-link[href="/"]');
  homeLink ? pass('Home link') : fail('Home link', 'missing');

  await ss(page, '02-nav');

  // ===== TEST 3: Tab Switching =====
  console.log('\n🧪 Test 3: Suggested Question Tabs');
  await page.click('.tab-btn[data-tab="factory"]');
  await page.waitForTimeout(200);
  let factoryActive = await page.$eval('#tab-factory', el => el.classList.contains('active'));
  factoryActive ? pass('Factory tab switch') : fail('Factory tab switch', 'not active');

  await page.click('.tab-btn[data-tab="ai"]');
  await page.waitForTimeout(200);
  let aiActive = await page.$eval('#tab-ai', el => el.classList.contains('active'));
  aiActive ? pass('AI tab switch') : fail('AI tab switch', 'not active');

  await page.click('.tab-btn[data-tab="food"]');
  await ss(page, '03-tabs');

  // ===== TEST 4: Food Knowledge Query (HACCP) =====
  console.log('\n🧪 Test 4: Food Knowledge Query');
  await page.click('.suggest-btn:has-text("HACCP体系关键控制点有哪些")');

  // Check user message appeared
  await page.waitForSelector('.msg.user', { timeout: 3000 });
  pass('User message sent');

  // Check typing indicator shows
  await page.waitForTimeout(300);
  const typingVisible = await page.isVisible('.typing.show');
  typingVisible ? pass('Typing indicator shows') : fail('Typing indicator', 'not shown');

  await ss(page, '04-typing-indicator');

  // Wait for response
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  // Count AI messages (should be 2: welcome + response)
  const aiMsgCount = await page.locator('.msg.ai').count();
  aiMsgCount >= 2 ? pass(`AI messages: ${aiMsgCount}`) : fail('AI messages', `only ${aiMsgCount}`);

  // Check intent tag
  const intentTag = await page.isVisible('.intent-tag');
  intentTag ? pass('Intent tag visible') : fail('Intent tag', 'missing');

  if (intentTag) {
    const intentText = await page.textContent('.intent-tag');
    console.log(`  📋 Intent: ${intentText}`);
  }

  // Check confidence bar
  const confBar = await page.isVisible('.confidence-bar');
  confBar ? pass('Confidence bar visible') : fail('Confidence bar', 'missing');

  if (confBar) {
    const confText = await page.textContent('.confidence-bar');
    console.log(`  📋 Confidence: ${confText}`);
  }

  // Check match method
  const matchTag = await page.isVisible('.match-tag');
  matchTag ? pass('Match method tag') : fail('Match method tag', 'missing');

  if (matchTag) {
    const matchText = await page.textContent('.match-tag');
    console.log(`  📋 Match: ${matchText}`);
  }

  // Check feedback buttons
  const fbUp = await page.isVisible('.feedback-btn.up');
  fbUp ? pass('Feedback buttons') : fail('Feedback buttons', 'missing');

  await ss(page, '04-haccp-response');

  // Scroll to bottom
  await page.locator('.messages').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  await ss(page, '04-haccp-scrolled');

  // ===== TEST 5: Markdown Rendering Quality =====
  console.log('\n🧪 Test 5: Markdown Rendering');
  const lastBubble = page.locator('.msg.ai .msg-bubble').last();
  const bubbleHtml = await lastBubble.innerHTML();
  const bubbleText = await lastBubble.textContent();

  console.log(`  📋 Response length: ${bubbleText.length} chars`);
  console.log(`  📋 HTML length: ${bubbleHtml.length} chars`);

  // Check for raw markdown artifacts
  const rawDoubleAsterisk = (bubbleHtml.match(/\*\*/g) || []).length;
  const renderedStrong = (bubbleHtml.match(/<strong>/g) || []).length;
  console.log(`  📋 Raw **: ${rawDoubleAsterisk}, <strong>: ${renderedStrong}`);

  if (rawDoubleAsterisk > 0 && renderedStrong === 0) {
    fail('Markdown bold', `${rawDoubleAsterisk} raw ** not rendered`);
  } else if (renderedStrong > 0) {
    pass(`Markdown bold: ${renderedStrong} <strong> tags`);
  } else {
    console.log('  ℹ️ No bold markdown in response');
  }

  // Check for raw \n in rendered text
  const rawNewlines = bubbleHtml.includes('\\n');
  rawNewlines ? fail('Raw \\n visible', 'literal \\n in output') : pass('No raw \\n');

  // Check for <br> or block elements
  const hasBr = bubbleHtml.includes('<br>');
  const hasLi = bubbleHtml.includes('<li>');
  const hasUl = bubbleHtml.includes('<ul>');
  console.log(`  📋 Line handling: <br>=${hasBr}, <li>=${hasLi}, <ul>=${hasUl}`);
  (hasBr || hasLi) ? pass('Newline rendering') : fail('Newline rendering', 'no line breaks found');

  // Check for citations
  const hasCitations = await page.isVisible('.citations');
  console.log(`  📋 Citations block: ${hasCitations}`);

  await ss(page, '05-markdown-check');

  // ===== TEST 6: Factory Data Query =====
  console.log('\n🧪 Test 6: Factory Data Query');
  await page.click('.tab-btn[data-tab="factory"]');
  await page.waitForTimeout(200);
  await page.click('.suggest-btn:has-text("今天的生产批次有多少")');
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  const aiMsgs6 = await page.locator('.msg.ai').count();
  aiMsgs6 >= 3 ? pass(`Factory query response (${aiMsgs6} AI msgs)`) : fail('Factory query', `${aiMsgs6} AI msgs`);

  // Check intent tag for production
  const lastIntent = page.locator('.intent-tag').last();
  const lastIntentText = await lastIntent.textContent();
  console.log(`  📋 Factory Intent: ${lastIntentText}`);

  await page.locator('.messages').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  await ss(page, '06-factory-query');

  // ===== TEST 7: Check for Streaming =====
  console.log('\n🧪 Test 7: Streaming Check');
  await page.fill('#chatInput', '巴氏杀菌的温度和时间要求');

  // Set up mutation observer
  await page.evaluate(() => {
    window.__streamLog = [];
    window.__streamObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          window.__streamLog.push({ t: Date.now(), type: 'add', count: m.addedNodes.length });
        }
        if (m.type === 'characterData') {
          window.__streamLog.push({ t: Date.now(), type: 'text' });
        }
      }
    });
    window.__streamObs.observe(document.getElementById('messages'), { childList: true, subtree: true, characterData: true });
  });

  await page.click('.send-btn');

  // Check typing indicator during request
  await page.waitForTimeout(1000);
  const typingDuring = await page.isVisible('.typing.show');
  console.log(`  📋 Typing indicator during request: ${typingDuring}`);

  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  const streamLog = await page.evaluate(() => {
    window.__streamObs.disconnect();
    return window.__streamLog;
  });

  console.log(`  📋 DOM mutations during response: ${streamLog.length}`);
  if (streamLog.length > 0) {
    const timeSpan = streamLog[streamLog.length - 1].t - streamLog[0].t;
    console.log(`  📋 Mutation time span: ${timeSpan}ms`);
    // If all mutations happen within ~100ms, it's not streaming
    if (timeSpan < 200) {
      issues.push('NOT STREAMING: Response rendered all at once (batch fetch, not SSE). Consider implementing streaming for better UX.');
      console.log('  ⚠️ NOT STREAMING: All mutations within ' + timeSpan + 'ms → response rendered in one batch');
    } else {
      pass('Possible streaming detected (mutations span ' + timeSpan + 'ms)');
    }
  }

  await ss(page, '07-streaming-check');

  // ===== TEST 8: Interrupt/Abort =====
  console.log('\n🧪 Test 8: Interrupt/Abort Capability');
  await page.fill('#chatInput', '帮我分析一下生产效率趋势');
  await page.click('.send-btn');
  await page.waitForTimeout(500);

  const btnDisabled = await page.isDisabled('.send-btn');
  btnDisabled ? pass('Send button disabled during processing') : fail('Button state', 'not disabled');

  // Look for cancel/stop button
  const cancelExists = await page.isVisible('[class*="cancel"], [class*="stop"], [class*="abort"], button:has-text("停止"), button:has-text("取消")');
  if (cancelExists) {
    pass('Cancel/stop button found');
  } else {
    issues.push('NO INTERRUPT: No cancel/stop button exists. User cannot abort a pending request.');
    console.log('  ⚠️ NO INTERRUPT: No cancel/stop button available during AI response');
  }

  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });
  await ss(page, '08-no-interrupt');

  // ===== TEST 9: Multi-turn Session =====
  console.log('\n🧪 Test 9: Multi-turn Session');
  const totalAi = await page.locator('.msg.ai').count();
  const totalUser = await page.locator('.msg.user').count();
  console.log(`  📋 Total: ${totalAi} AI msgs, ${totalUser} user msgs`);
  totalUser >= 4 ? pass('Multi-turn accumulates') : fail('Multi-turn', `only ${totalUser} user msgs`);

  await page.locator('.messages').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  await ss(page, '09-multiturn');

  // ===== TEST 10: Mobile Layout =====
  console.log('\n🧪 Test 10: Mobile Viewport');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  const navHidden = !(await page.isVisible('.nav-links'));
  navHidden ? pass('Desktop nav hidden on mobile') : console.log('  ℹ️ Nav links still visible on mobile');

  const cw = await page.$eval('.chat-container', el => el.getBoundingClientRect().width);
  cw <= 400 ? pass(`Container fits mobile: ${Math.round(cw)}px`) : fail('Mobile width', `${Math.round(cw)}px`);

  await ss(page, '10-mobile-initial');

  // Send query on mobile
  await page.fill('#chatInput', 'HACCP关键控制点');
  await page.click('.send-btn');
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  await page.locator('.messages').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  await ss(page, '10-mobile-response');

  // ===== TEST 11: XSS Safety =====
  console.log('\n🧪 Test 11: XSS Safety');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  await page.fill('#chatInput', '<img src=x onerror=alert(1)>');
  await page.click('.send-btn');

  const userBubbleHtml = await page.$eval('.msg.user .msg-bubble', el => el.innerHTML);
  if (userBubbleHtml.includes('<img')) {
    fail('XSS prevention', 'unescaped <img> tag');
  } else {
    pass('XSS escaped');
  }

  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });
  await ss(page, '11-xss-test');

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${passCount} PASS, ${failCount} FAIL`);
  if (issues.length > 0) {
    console.log('\n⚠️  Issues & Improvements Needed:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }
  console.log('='.repeat(60));

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
