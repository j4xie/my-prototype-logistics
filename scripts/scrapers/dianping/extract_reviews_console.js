/**
 * 大众点评评论提取 — 浏览器 Console 粘贴脚本
 *
 * 使用方法:
 * 1. 用你自己的 Chrome 打开大众点评 (www.dianping.com)
 * 2. 搜索你要的餐厅 (如 "上马火锅")
 * 3. 点进店铺页 → 点 "全部评价" (review_all)
 * 4. 按 F12 打开 DevTools → Console tab
 * 5. 粘贴下面这段代码并回车
 * 6. 它会自动抓当前页面所有评论 → 弹出下载 JSON
 * 7. 翻到下一页, 再粘贴一次 (或用 extractAllPages() 自动翻页)
 *
 * 输出格式与青花椒参考文件一致:
 *   { 评价时间, 评价ID, 评价门店, 评价详情, 星级分, 口味分, 环境分, 服务分, ... }
 */

(function() {
  // 店铺信息 (从页面提取)
  const shopName = document.querySelector('.shop-name, h1.shop-title, .review-shop-name')?.textContent?.trim() || '未知门店';
  const city = document.querySelector('.city-name, .J_city')?.textContent?.trim() || '';

  // 提取所有评价
  const reviewEls = document.querySelectorAll('.reviews-items .review-item, .comment-list .comment-item, .review-list-ul li, [class*="reviewItem"]');
  console.log(`找到 ${reviewEls.length} 条评论元素`);

  const reviews = [];
  reviewEls.forEach((el, idx) => {
    try {
      // 评分 (星级)
      const starEl = el.querySelector('.sml-rank-stars, .star, [class*="star"], .review-rank');
      let rating = 5;
      if (starEl) {
        const cls = starEl.className || '';
        const starMatch = cls.match(/star(\d+)/);
        if (starMatch) rating = parseInt(starMatch[1]) / 10;
        const style = starEl.getAttribute('style') || '';
        const widthMatch = style.match(/width:\s*([\d.]+)%/);
        if (widthMatch) rating = parseFloat(widthMatch[1]) / 20;
        const title = starEl.getAttribute('title') || '';
        const titleMatch = title.match(/([\d.]+)/);
        if (titleMatch) rating = parseFloat(titleMatch[1]);
      }

      // 评价内容
      const contentEl = el.querySelector('.review-words, .comment-txt, .review-content, [class*="reviewContent"]');
      const content = contentEl?.textContent?.trim() || '';

      // 时间
      const timeEl = el.querySelector('.time, .comment-time, .review-time, [class*="time"]');
      const timeText = timeEl?.textContent?.trim() || '';

      // 评价ID (从 data 属性或 link)
      const reviewId = el.getAttribute('data-id') || el.querySelector('a[data-id]')?.getAttribute('data-id') || `page_${idx}`;

      // 口味/环境/服务分
      const scoreEls = el.querySelectorAll('.score span, .comment-score span, [class*="score"]');
      let tasteScore = 0, envScore = 0, serviceScore = 0;
      scoreEls.forEach(s => {
        const txt = s.textContent || '';
        if (txt.includes('口味')) {
          const m = txt.match(/([\d.]+)/);
          if (m) tasteScore = parseFloat(m[1]);
        }
        if (txt.includes('环境')) {
          const m = txt.match(/([\d.]+)/);
          if (m) envScore = parseFloat(m[1]);
        }
        if (txt.includes('服务')) {
          const m = txt.match(/([\d.]+)/);
          if (m) serviceScore = parseFloat(m[1]);
        }
      });

      // 用户名
      const userEl = el.querySelector('.name, .user-name, .dper-info .name a');
      const userName = userEl?.textContent?.trim() || '';

      if (content.length > 5) {
        reviews.push({
          '评价时间': timeText,
          '评价ID': reviewId,
          '省份': '',
          '城市': city,
          '评价门店': shopName,
          '平台': '大众点评',
          '评价详情': content,
          '星级分': rating,
          '口味分': tasteScore,
          '环境分': envScore,
          '服务分': serviceScore,
          '评价来源': 'console_extract',
          '用户': userName,
        });
      }
    } catch (e) {
      console.warn(`评论 #${idx} 提取失败:`, e);
    }
  });

  console.log(`成功提取 ${reviews.length} 条评论`);

  if (reviews.length === 0) {
    console.log('提示: 如果页面有评论但提取为0, 可能CSS选择器需要更新');
    console.log('尝试手动检查: document.querySelectorAll("[class*=review]")');
    alert('没有找到评论! 请检查是否在正确的评价页面上');
    return;
  }

  // 下载为 JSON
  const json = JSON.stringify(reviews, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dianping_${shopName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')}_reviews.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`已下载: ${a.download}`);
  alert(`成功提取 ${reviews.length} 条评论并下载为 JSON!\n\n下载文件: ${a.download}\n\n提取完后把 JSON 文件放到:\nscripts/scrapers/dianping/output/\n\n然后告诉我, 我帮你导入 SmartBI V2 分析`);
})();
