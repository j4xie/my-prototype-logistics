const automator = require('miniprogram-automator');

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
  console.log('=== 店铺装修功能 E2E 测试 ===\n');
  const results = [];

  function check(name, pass, detail) {
    results.push({ name, pass, detail: detail || '' });
    console.log((pass ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
  }

  // 进入店铺装修页
  await mp.reLaunch('/pages/merchant-center/shop-design/index');
  await new Promise(r => setTimeout(r, 4000));
  const page = await mp.currentPage();
  let data = await page.data();

  // ========== 1. 页面初始化 ==========
  console.log('--- 1. 页面初始化 ---');
  check('loading 完成', data.loading === false);
  check('主题列表加载', data.themes.length === 15, data.themes.length + '套主题');
  check('当前主题存在', data.currentTheme !== null, JSON.stringify(data.currentTheme).substring(0, 60));
  check('行业选项', data.industryOptions.length === 8, data.industryOptions.map(i => i.name).join('/'));
  console.log('');

  // ========== 2. 主题选择功能 ==========
  console.log('--- 2. 主题选择 ---');
  // 通过 callMethod 模拟选择主题
  const theme3 = data.themes[2]; // 第3个主题: 田园绿
  await page.callMethod('selectTheme', { currentTarget: { dataset: { theme: theme3 } } });
  await new Promise(r => setTimeout(r, 1000));
  data = await page.data();

  check('选择主题-ID 更新', data.selectedThemeId === theme3.id, '选中: ' + theme3.name);
  check('选择主题-预览样式生成', data.previewStyle.length > 0, data.previewStyle.substring(0, 50));
  check('选择主题-预览开启', data.showPreview === true);

  // 换一个主题: 经典金
  const theme4 = data.themes[3];
  await page.callMethod('selectTheme', { currentTarget: { dataset: { theme: theme4 } } });
  await new Promise(r => setTimeout(r, 1000));
  data = await page.data();

  check('切换主题', data.selectedThemeId === theme4.id, '切换到: ' + theme4.name);
  check('预览样式更新', data.previewStyle.includes(theme4.primaryColor), data.previewStyle.substring(0, 50));

  // 关闭预览
  await page.callMethod('closePreview');
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();
  check('关闭预览', data.showPreview === false);
  console.log('');

  // ========== 3. AI 推荐功能 ==========
  console.log('--- 3. AI 推荐 ---');
  // 输入提示词
  await page.callMethod('onAiPromptInput', { detail: { value: '我是卖海鲜水产的，想要清爽的感觉' } });
  data = await page.data();
  check('AI 输入', data.aiPrompt === '我是卖海鲜水产的，想要清爽的感觉');

  // 提交 AI 分析 (会走本地 localMatch 降级)
  await page.callMethod('submitAiAnalysis');
  await new Promise(r => setTimeout(r, 3000));
  data = await page.data();

  check('AI 分析完成', data.aiLoading === false);
  check('AI 结果', data.aiResult !== null, data.aiResult ? ('推荐: ' + (data.aiResult.recommendedTheme || data.aiResult.message || '').substring(0, 30)) : '无结果');

  // 如果有匹配主题，应用推荐
  if (data.aiResult && data.aiResult.matchedTheme) {
    await page.callMethod('applyAiRecommendation');
    await new Promise(r => setTimeout(r, 500));
    data = await page.data();
    check('应用 AI 推荐', data.showPreview === true, '推荐主题: ' + data.aiResult.matchedTheme.name);
    await page.callMethod('closePreview');
  } else {
    check('AI 本地匹配', data.aiResult && data.aiResult.recommendedTheme !== undefined, 'localMatch 降级');
  }
  console.log('');

  // ========== 4. 引导式装修向导 ==========
  console.log('--- 4. 引导式向导 ---');
  await page.callMethod('startGuideFlow');
  await new Promise(r => setTimeout(r, 1000));
  data = await page.data();

  check('向导开启', data.showGuideWizard === true);
  check('向导步骤1', data.guideStep === 1);
  check('向导数据重置', data.guideData.industry === '');

  // Step 1: 选择行业 — 海鲜水产
  const seafoodIndustry = data.industryOptions.find(i => i.code === 'seafood');
  await page.callMethod('selectIndustry', { currentTarget: { dataset: { industry: seafoodIndustry } } });
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();

  check('选择行业', data.guideData.industry === 'seafood', data.guideData.industryName);
  check('风格选项加载', data.styleOptions.length > 0, data.styleOptions.length + '个风格');
  check('可以进入下一步', data.canProceed === true);

  // 进入 Step 2
  await page.callMethod('guideNextStep');
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();
  check('进入步骤2', data.guideStep === 2);

  // Step 2: 选择风格 — 海洋清爽
  const oceanStyle = data.styleOptions.find(s => s.code === 'ocean') || data.styleOptions[0];
  await page.callMethod('selectStyle', { currentTarget: { dataset: { style: oceanStyle } } });
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();

  check('选择风格', data.guideData.style === oceanStyle.code, data.guideData.styleName);

  // 进入 Step 3
  await page.callMethod('guideNextStep');
  await new Promise(r => setTimeout(r, 1000));
  data = await page.data();
  check('进入步骤3', data.guideStep === 3);
  check('推荐主题加载', data.recommendedThemes.length > 0, data.recommendedThemes.map(t => t.name).join('/'));

  // 默认会选中第一个推荐主题
  check('默认选中主题', data.guideData.themeCode.length > 0, data.guideData.themeName);

  // 切换到第2个推荐主题
  if (data.recommendedThemes.length > 1) {
    const altTheme = data.recommendedThemes[1];
    await page.callMethod('selectGuideTheme', { currentTarget: { dataset: { theme: altTheme } } });
    await new Promise(r => setTimeout(r, 500));
    data = await page.data();
    check('切换推荐主题', data.guideData.themeCode === altTheme.code, data.guideData.themeName);
  }

  // 进入 Step 4: 确认
  await page.callMethod('guideNextStep');
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();
  check('进入步骤4(确认)', data.guideStep === 4);
  check('预览样式生成', data.guidePreviewStyle.length > 0);

  // 返回上一步测试
  await page.callMethod('guidePrevStep');
  await new Promise(r => setTimeout(r, 500));
  data = await page.data();
  check('返回步骤3', data.guideStep === 3);

  // 再回到 Step 4
  await page.callMethod('guideNextStep');
  await new Promise(r => setTimeout(r, 500));

  // 完成向导（应用配置）
  await page.callMethod('finishGuideFlow');
  await new Promise(r => setTimeout(r, 3000));
  data = await page.data();

  check('向导完成-关闭', data.showGuideWizard === false);
  check('向导完成-主题已应用', data.currentTheme !== null);
  console.log('');

  // ========== 5. 遍历全部15套主题 ==========
  console.log('--- 5. 全部主题切换 ---');
  let allThemesOk = true;
  for (let i = 0; i < data.themes.length; i++) {
    const t = data.themes[i];
    await page.callMethod('selectTheme', { currentTarget: { dataset: { theme: t } } });
    await new Promise(r => setTimeout(r, 300));
    const d = await page.data();
    if (d.selectedThemeId !== t.id || !d.previewStyle.includes(t.primaryColor)) {
      console.log('  FAIL 主题 ' + t.name + ' (id=' + t.id + ')');
      allThemesOk = false;
    }
    await page.callMethod('closePreview');
    await new Promise(r => setTimeout(r, 200));
  }
  check('15 套主题全部可切换', allThemesOk);
  console.log('');

  // ========== 6. 行业-风格全组合 ==========
  console.log('--- 6. 行业风格组合 ---');
  let combosOk = true;
  let comboCount = 0;
  for (const ind of data.industryOptions) {
    await page.callMethod('selectIndustry', { currentTarget: { dataset: { industry: ind } } });
    await new Promise(r => setTimeout(r, 200));
    const d = await page.data();
    if (d.styleOptions.length === 0) {
      console.log('  FAIL 行业 ' + ind.name + ' 无风格选项');
      combosOk = false;
    }
    comboCount += d.styleOptions.length;
  }
  check('8 行业全部有风格选项', combosOk, comboCount + '个行业×风格组合');

  // ========== 汇总 ==========
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  const total = results.length;

  console.log('\n' + '='.repeat(50));
  console.log('结果: ' + passed + '/' + total + ' PASS');
  if (failed.length > 0) {
    console.log('\n失败项:');
    failed.forEach(f => console.log('  FAIL ' + f.name + (f.detail ? ' — ' + f.detail : '')));
  } else {
    console.log('全部通过!');
  }
  console.log('='.repeat(50));

  await mp.disconnect();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch(e => {
  console.error('致命错误:', e.message);
  process.exit(1);
});
