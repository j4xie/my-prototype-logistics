# 爬虫优化方案报告

## 关键发现（本地实测）

### 1. 小红书 MediaCrawler 实际成果比统计的多
- 110 个笔记文件夹 × 平均 4 张图 = **461 张图片**（之前统计漏了子文件夹）
- 第 1 个关键词成功，第 2 个立刻 CAPTCHA 461
- **根因**: MediaCrawler 默认 `CRAWLER_MAX_SLEEP_SEC=2`（2 秒间隔）太快
- **优化**: 改为 5-8 秒 + 每个关键词间隔 30-60 分钟

### 2. XHS-Downloader HTML 解析方案
- 直接 GET 笔记页面 → 470K HTML（SSR 渲染）
- 但 `__INITIAL_STATE__` 中的 `noteDetailMap` 为空（无 cookie 时）
- 有 cookie 时也为空 → XHS 改了 SSR 策略，不再在 HTML 中嵌入笔记数据
- **结论**: XHS-Downloader 的 HTML 解析方案可能已失效或需要特殊处理
- **仍然推荐 MediaCrawler CDP 模式**作为主力方案

### 3. 黑猫投诉 `field` 参数发现
- Feed API 支持 `field` 参数按行业筛选
- `field=6` 最接近食品/生活服务（3/10 条是食品相关）
- `field=1` 和 `field=10` 也有少量食品投诉
- **但** field=6 仍然混有非食品投诉，需要二次过滤

### 4. 黑猫投诉详情页无 SSR 数据
- 14K HTML 不包含任何投诉内容、图片 URL
- 必须通过 patchright 渲染 SPA 才能获取
- 图片 CDN: `s3anon.tousu.sina.com.cn/products/`

## 优化方案

### A. 小红书优化（目标：2000+ 张）

**策略：分批冷却 + 降低并发**

```python
# MediaCrawler config/base_config.py 修改
CRAWLER_MAX_SLEEP_SEC = 8        # 2 → 8 秒（笔记间隔）
CRAWLER_MAX_NOTES_COUNT = 100    # 200 → 100（每关键词减量）
MAX_CONCURRENCY_NUM = 1          # 保持单并发
```

**执行计划**:
- 每次只跑 1-2 个关键词
- 每批间隔 2 小时（XHS CAPTCHA 冷却期）
- 15 个关键词分 8 批，每批 2 个
- 预计总耗时：8 批 × 3 小时 = 24 小时（可以分 2-3 天完成）
- 每批预期：100 条 × 4 图/条 × 2 关键词 ≈ 800 张
- 总预期：8 批 × 400 张（去重后）≈ 3200 张

**立即可做的补充**:
- 把 MediaCrawler 已下载的 461 张图全部复制到 `complaint_v2/xiaohongshu/`
- 用 Bing 搜 `site:xiaohongshu.com 食品异物` 补充（icrawler 方式）

### B. 黑猫投诉优化（目标：500+ 张投诉照片）

**策略：field=6 筛选 + 多 type 并行 + patchright 批量渲染**

**Phase 1 优化**:
```python
# 只爬 field=6（生活服务类，食品投诉最密集）
# 4 种 type × field=6 × 50 页 = 200 页
# 间隔 10-18s，但不需要频繁休眠（因为总量小）
# 预计 200 页 × 14s ≈ 47 分钟
# 食品过滤率约 30% → 200 × 10 × 30% = 600 条食品投诉
```

**Phase 2 优化**:
```python
# patchright 不需要 wait_until="networkidle"
# SPA 内容在 3 秒内加载完成
# 改用 wait_until="domcontentloaded" + page.wait_for_timeout(3000)
# 图片提取用 page.evaluate() 一次性获取所有 s3anon URL
# 每页 5 秒足够（vs 当前的 8 秒）
```

**Phase 2 并行优化**:
- 图片 CDN (s3anon.tousu.sina.com.cn) 限制独立于网页
- 先收集所有图片 URL，然后用 10 线程并发下载
- 分离 "渲染提取 URL" 和 "下载图片" 两个步骤

### C. Deep Research 补充发现 (Mar 16)

**黑猫投诉**:
- `company/main_search` 和 `received_complaints` 端点都需要**不同的签名算法**（我们知道的 salt 只适用于 Feed API），搜索关键词被忽略
- `type` 参数是状态过滤（热/新/已回/已完成），不是行业分类
- 详情页是纯 CSR（非 SSR），无 `__INITIAL_STATE__`，必须完整渲染
- `launch_persistent_context` 比 `launch` 反检测效果更好
- `wait_until="domcontentloaded"` + `wait_for_selector` 比 `networkidle` 快 0.5-2s

**小红书**:
- MediaCrawler 对 461 **零处理**（直接崩溃），需要外部重试逻辑
- 社区共识：请求间隔 3-5s 是最低安全线，我们设 8s 是对的
- XHS-Downloader 的 `__INITIAL_STATE__` 解析在 2025+ 可能已失效
- Cookie 约 10 分钟过期，x-s 算法按季度更新
- 单日每 IP 安全上限 ≤100-300 条笔记

**结论**：黑猫投诉的 Feed API field=6 是目前唯一可行的无登录方案，company 端点全部需要不同签名。小红书 MediaCrawler CDP 仍然是唯一可行方案，但必须控制频率和分批冷却。

### D. 频率参数总结

| 平台 | 操作 | 安全间隔 | 批间休眠 |
|------|------|---------|---------|
| 小红书 搜索 | search API | 8-15s/请求 | 2 小时/关键词 |
| 小红书 笔记详情 | note detail API | 2-5s/请求 | — |
| 黑猫投诉 Feed | feed API | 10-18s/页 | 8-12 分钟/15 页 |
| 黑猫投诉 详情页 | patchright render | 5s/页 | 2 分钟/20 页 |
| 微博 搜索 | crawl4weibo | 2s/页 | 30s if 432 |
