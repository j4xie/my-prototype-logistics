/**
 * AI Chat E2E Test - Standalone Playwright script
 * Run: cd tests/e2e-smartbi && npx ts-node ../e2e-ai-chat/run-test.ts
 */
import { chromium, Page } from 'playwright';
import * as path from 'path';

const BASE_URL = 'https://cretaceousfuture.com';
const SCREENSHOT_DIR = path.resolve(__dirname, '../../screenshots/ai-chat');

let passCount = 0;
let failCount = 0;
const issues: string[] = [];

async function ss(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
  console.log(`  📸 ${name}.png`);
}

function log(msg: string) { console.log(msg); }
function pass(name: string) { passCount++; console.log(`  ✅ ${name}`); }
function fail(name: string, detail: string) { failCount++; issues.push(`${name}: ${detail}`); console.log(`  ❌ ${name}: ${detail}`); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // ===== TEST 1: Page Load & Initial State =====
  log('\n🧪 Test 1: Page Load & Initial State');
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  const title = await page.title();
  title.includes('AI智能对话') ? pass('Page title') : fail('Page title', title);

  const header = await page.textContent('.page-header h1');
  header?.includes('食品安全') ? pass('Header text') : fail('Header text', header || 'missing');

  const welcome = await page.textContent('.msg.ai .msg-bubble');
  welcome?.includes('白垩纪AI智能助手') ? pass('Welcome message') : fail('Welcome message', 'missing');

  const input = await page.isVisible('#chatInput');
  input ? pass('Input visible') : fail('Input visible', 'not found');

  const sendBtn = await page.isVisible('.send-btn');
  sendBtn ? pass('Send button visible') : fail('Send button visible', 'not found');

  await ss(page, '01-initial-state');

  // ===== TEST 2: Navigation =====
  log('\n🧪 Test 2: Navigation Links');
  const activeNav = await page.textContent('.nav-link.active');
  activeNav?.includes('AI对话') ? pass('Active nav link') : fail('Active nav link', activeNav || 'missing');

  const homeLink = await page.isVisible('a.nav-link[href="/"]');
  homeLink ? pass('Home link') : fail('Home link', 'missing');

  await ss(page, '02-nav');

  // ===== TEST 3: Tab Switching =====
  log('\n🧪 Test 3: Suggested Question Tabs');
  await page.click('.tab-btn[data-tab="factory"]');
  await page.waitForTimeout(200);
  const factoryActive = await page.$eval('#tab-factory', el => el.classList.contains('active'));
  factoryActive ? pass('Factory tab switch') : fail('Factory tab switch', 'not active');

  await page.click('.tab-btn[data-tab="ai"]');
  await page.waitForTimeout(200);
  const aiActive = await page.$eval('#tab-ai', el => el.classList.contains('active'));
  aiActive ? pass('AI tab switch') : fail('AI tab switch', 'not active');

  await page.click('.tab-btn[data-tab="food"]');
  await ss(page, '03-tabs');

  // ===== TEST 4: Food Knowledge Query (HACCP) =====
  log('\n🧪 Test 4: Food Knowledge Query');
  await page.click('.suggest-btn:has-text("HACCP体系关键控制点有哪些")');

  // Check user message appeared
  await page.waitForSelector('.msg.user', { timeout: 3000 });
  pass('User message sent');

  // Check typing indicator shows
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

  // Get intent tag text
  if (intentTag) {
    const intentText = await page.textContent('.intent-tag');
    log(`  📋 Intent: ${intentText}`);
  }

  // Check confidence bar
  const confBar = await page.isVisible('.confidence-bar');
  confBar ? pass('Confidence bar visible') : fail('Confidence bar', 'missing');

  if (confBar) {
    const confText = await page.textContent('.confidence-bar');
    log(`  📋 Confidence: ${confText}`);
  }

  // Check match method
  const matchTag = await page.isVisible('.match-tag');
  matchTag ? pass('Match method tag') : fail('Match method tag', 'missing');

  // Check feedback buttons
  const fbUp = await page.isVisible('.feedback-btn.up');
  fbUp ? pass('Feedback up button') : fail('Feedback up', 'missing');

  // ===== TEST 5: Markdown Rendering Quality =====
  log('\n🧪 Test 5: Markdown Rendering');
  const lastBubble = page.locator('.msg.ai .msg-bubble').last();
  const bubbleHtml = await lastBubble.innerHTML();
  const bubbleText = await lastBubble.textContent();

  // Check for raw markdown artifacts
  const rawDoubleAsterisk = (bubbleHtml.match(/\*\*/g) || []).length;
  const renderedStrong = (bubbleHtml.match(/<strong>/g) || []).length;
  log(`  📋 Raw **: ${rawDoubleAsterisk}, <strong>: ${renderedStrong}`);

  if (rawDoubleAsterisk > 0 && renderedStrong === 0) {
    fail('Markdown bold', `${rawDoubleAsterisk} raw ** not rendered`);
  } else {
    pass('Markdown bold rendering');
  }

  // Check for raw \n in rendered text
  const rawNewlines = bubbleHtml.includes('\\n');
  rawNewlines ? fail('Raw \\n visible', 'literal \\n in output') : pass('No raw \\n');

  // Check for <br> or block elements (proper newline handling)
  const hasBr = bubbleHtml.includes('<br>');
  const hasLi = bubbleHtml.includes('<li>');
  const hasP = bubbleHtml.includes('<p>');
  log(`  📋 <br>: ${hasBr}, <li>: ${hasLi}, <p>: ${hasP}`);
  (hasBr || hasLi || hasP) ? pass('Newline rendering') : fail('Newline rendering', 'no line breaks found');

  await ss(page, '05-markdown-check');

  // Scroll messages to bottom
  await page.locator('.messages').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  await ss(page, '05-markdown-scrolled');

  // ===== TEST 6: Check for Streaming =====
  log('\n🧪 Test 6: Streaming Check');
  // Send another query and monitor how the response appears
  await page.fill('#chatInput', '巴氏杀菌的温度和时间要求');

  // Set up a mutation observer to detect if text is added incrementally
  await page.evaluate(() => {
    (window as any).__streamChunks = [];
    (window as any).__streamObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' || m.type === 'characterData') {
          (window as any).__streamChunks.push({
            time: Date.now(),
            type: m.type,
            text: (m.target as Element).textContent?.substring(0, 50) || ''
          });
        }
      }
    });
    (window as any).__streamObserver.observe(
      document.getElementById('messages')!,
      { childList: true, subtree: true, characterData: true }
    );
  });

  await page.click('.send-btn');
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  const chunks = await page.evaluate(() => {
    (window as any).__streamObserver.disconnect();
    return (window as any).__streamChunks;
  });

  // Analyze: if response appeared in one chunk = non-streaming. Multiple text chunks = streaming
  const textChunks = chunks.filter((c: any) => c.type === 'characterData' || c.type === 'childList');
  log(`  📋 DOM mutations during response: ${textChunks.length}`);
  if (textChunks.length <= 5) {
    issues.push('NOT STREAMING: Response appears all at once (single fetch, not SSE/streaming)');
    log('  ⚠️ NOT STREAMING: Response rendered all at once');
  } else {
    pass('Streaming detected');
  }

  await ss(page, '06-streaming-check');

  // ===== TEST 7: Interrupt/Abort Check =====
  log('\n🧪 Test 7: Interrupt/Abort Capability');
  // Send a query and try to interrupt
  await page.fill('#chatInput', '帮我分析一下生产效率趋势');
  await page.click('.send-btn');

  // Wait a moment for request to start
  await page.waitForTimeout(500);

  // Check if send button is disabled during processing
  const btnDisabled = await page.isDisabled('.send-btn');
  btnDisabled ? pass('Send button disabled during processing') : fail('Button state', 'not disabled during request');

  // Check if there's any cancel/stop button
  const cancelBtn = await page.isVisible('button:has-text("停止"), button:has-text("取消"), .cancel-btn, .stop-btn, .abort-btn');
  if (cancelBtn) {
    pass('Cancel button found');
  } else {
    issues.push('NO INTERRUPT: No cancel/stop/abort button exists during AI response generation');
    log('  ⚠️ NO INTERRUPT: No cancel/stop button visible during processing');
  }

  // Wait for response to finish
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });
  await ss(page, '07-no-interrupt-btn');

  // ===== TEST 8: Multi-turn Conversation =====
  log('\n🧪 Test 8: Multi-turn Conversation');
  await page.fill('#chatInput', '冷链温度是否正常');
  await page.click('.send-btn');
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });

  const totalAi = await page.locator('.msg.ai').count();
  const totalUser = await page.locator('.msg.user').count();
  log(`  📋 Total messages: ${totalAi} AI, ${totalUser} user`);
  totalUser >= 4 ? pass('Multi-turn messages accumulate') : fail('Multi-turn', `only ${totalUser} user msgs`);

  await ss(page, '08-multiturn');

  // ===== TEST 9: Mobile Layout =====
  log('\n🧪 Test 9: Mobile Viewport');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  // Check nav links hidden on mobile
  const navLinksVisible = await page.isVisible('.nav-links');
  !navLinksVisible ? pass('Desktop nav hidden on mobile') : log('  ℹ️ Nav links still visible on mobile');

  // Check chat container fits
  const containerWidth = await page.$eval('.chat-container', el => el.getBoundingClientRect().width);
  containerWidth <= 390 ? pass(`Container fits: ${containerWidth}px`) : fail('Mobile width', `${containerWidth}px > 390`);

  await ss(page, '09-mobile-initial');

  // Send a query on mobile
  await page.fill('#chatInput', 'HACCP关键控制点');
  await page.click('.send-btn');
  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });
  await ss(page, '09-mobile-response');

  // ===== TEST 10: XSS Safety =====
  log('\n🧪 Test 10: XSS Safety');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE_URL}/ai-chat.html`, { waitUntil: 'networkidle', timeout: 30000 });

  await page.fill('#chatInput', '<script>alert("xss")</script>');
  await page.click('.send-btn');

  const userMsg = await page.textContent('.msg.user .msg-bubble');
  const msgHtml = await page.$eval('.msg.user .msg-bubble', el => el.innerHTML);
  if (msgHtml.includes('<script>')) {
    fail('XSS prevention', 'Raw <script> tag in HTML');
  } else {
    pass('XSS escaped');
  }

  await page.waitForFunction(() => !document.querySelector('.typing.show'), { timeout: 45000 });
  await ss(page, '10-xss-test');

  // ===== SUMMARY =====
  log('\n' + '='.repeat(60));
  log(`📊 Test Results: ${passCount} PASS, ${failCount} FAIL`);
  if (issues.length > 0) {
    log('\n⚠️ Issues Found:');
    issues.forEach((issue, i) => log(`  ${i + 1}. ${issue}`));
  }
  log('='.repeat(60));

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
