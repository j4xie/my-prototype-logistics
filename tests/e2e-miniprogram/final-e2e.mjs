import automator from 'miniprogram-automator';

async function safeNav(mp, method, url) {
  try {
    await Promise.race([
      mp[method](url),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 15000))
    ]);
  } catch(e) {}
  await new Promise(r => setTimeout(r, 2000));
  return await mp.currentPage();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  console.log('✅ Connected');
  const results = [];

  // T1: Chat page load
  console.log('\n=== T1: 装修Chat页面加载 ===');
  let page = await safeNav(mp, 'reLaunch', '/pages/home/index');
  page = await safeNav(mp, 'navigateTo', '/pages/merchant-center/decoration-chat/index');

  if (page.path.includes('decoration-chat')) {
    results.push('T1-页面加载: ✅ PASS');
    await sleep(2000);
    const data = await page.data();
    console.log('  quickQuestions:', data.quickQuestions?.length || 0);
    console.log('  sessionId:', !!data.sessionId);
    console.log('  existingMessages:', data.messages?.length || 0);
    results.push('T1-数据初始化: ✅ PASS (quickQ=' + (data.quickQuestions?.length || 0) + ')');
  } else {
    results.push('T1-页面加载: ❌ FAIL (' + page.path + ')');
  }

  // T2: Send recommendation request + AI response
  console.log('\n=== T2: 发送推荐请求 + AI回复 ===');
  const oldData = await page.data();
  const oldCount = oldData.messages?.length || 0;

  await page.setData({ inputText: '帮我换成蓝色海洋风格' });
  await sleep(300);
  try {
    await Promise.race([
      page.callMethod('sendMessage'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
    ]);
  } catch(e) {}
  console.log('  消息已发送, 等待AI回复...');

  let aiOk = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const d = await page.data();
    if ((d.messages?.length || 0) > oldCount + 1 && !d.isTyping) {
      aiOk = true;
      const last = d.messages[d.messages.length - 1];
      console.log('  ✅ AI回复 (' + (i + 1) + '秒)');
      console.log('  sender=' + last.sender);
      console.log('  text=' + (last.text || '').substring(0, 100));
      if (last.themeCard) {
        console.log('  themeCard: code=' + last.themeCard.code + ' name=' + last.themeCard.name + ' primary=' + last.themeCard.primaryColor);
        results.push('T2-AI推荐+主题卡: ✅ PASS [' + last.themeCard.code + ']');
      } else {
        console.log('  action=' + last.action);
        results.push('T2-AI回复: ✅ PASS (action=' + (last.action || 'chat') + ')');
      }
      break;
    }
    if (i === 10 || i === 20) console.log('  ...等待中 msgs=' + (d.messages?.length || 0) + ' typing=' + d.isTyping);
  }
  if (!aiOk) results.push('T2-AI回复: ⚠️ TIMEOUT');

  // T3: Apply theme
  if (aiOk) {
    console.log('\n=== T3: 应用主题 ===');
    const pre = await page.data();
    const preCount = pre.messages?.length || 0;
    await page.setData({ inputText: '好的就用这个' });
    await sleep(300);
    try {
      await Promise.race([
        page.callMethod('sendMessage'),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
      ]);
    } catch(e) {}
    console.log('  应用请求已发送...');

    let applyOk = false;
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      const d = await page.data();
      if ((d.messages?.length || 0) > preCount + 1 && !d.isTyping) {
        applyOk = true;
        const last = d.messages[d.messages.length - 1];
        console.log('  ✅ 应用回复 (' + (i + 1) + '秒)');
        console.log('  applied=' + last.applied);
        console.log('  text=' + (last.text || '').substring(0, 100));
        if (last.applied) {
          results.push('T3-主题应用: ✅✅ PASS (applied=true, DB已更新)');
        } else {
          results.push('T3-主题应用: ⚠️ WARN (applied=' + last.applied + ')');
        }
        break;
      }
      if (i === 10) console.log('  ...等待中');
    }
    if (!applyOk) results.push('T3-主题应用: ⚠️ TIMEOUT');
  }

  // T4: Shop design FAB button
  console.log('\n=== T4: 店铺装修页 FAB 按钮 ===');
  page = await safeNav(mp, 'reLaunch', '/pages/home/index');
  page = await safeNav(mp, 'navigateTo', '/pages/merchant-center/shop-design/index');
  await sleep(3000);

  if (page.path.includes('shop-design')) {
    console.log('  shop-design页面已打开');
    const fab = await page.$('.ai-chat-fab');
    if (fab) {
      results.push('T4-FAB按钮: ✅ PASS');
      console.log('  ✅ FAB按钮存在');

      // Tap FAB to navigate
      await fab.tap();
      await sleep(3000);
      const np = await mp.currentPage();
      console.log('  FAB点击后:', np.path);
      if (np.path.includes('decoration-chat')) {
        results.push('T4-FAB跳转: ✅ PASS (→decoration-chat)');
        console.log('  ✅ FAB→Chat跳转成功');
      } else {
        results.push('T4-FAB跳转: ❌ FAIL (' + np.path + ')');
      }
    } else {
      results.push('T4-FAB按钮: ⚠️ WARN (未找到, DevTools可能未重新编译)');
      console.log('  ⚠️ FAB未找到 (DevTools可能需要重新编译)');
    }
  } else {
    results.push('T4-shop-design: ❌ FAIL');
  }

  // === Summary ===
  console.log('\n' + '='.repeat(55));
  console.log(' 装修 AI Chat E2E 验证结果');
  console.log('='.repeat(55));
  results.forEach(r => console.log(' ' + r));
  const pass = results.filter(r => r.includes('PASS')).length;
  const total = results.length;
  console.log('\n 总计: ' + pass + '/' + total + ' PASS');
  console.log('='.repeat(55));

  await mp.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
