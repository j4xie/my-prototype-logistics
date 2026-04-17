# 36. 性能 + 压力测试

> **🟡 R18 QA Smoke (2026-04-17 07:03)**: 4 endpoints 100-row page load 耗时: SO 271ms / QC 281ms / users 287ms / finance/costs 404 (路径差异). 成功 endpoints 全部 ≤ 290ms 远低于 2s 基准 ✅. 未做 10K-row 压测, 未 LLM 并发压测.

**来源**: R3 Agent 2
**耗时**: 1 h (基础) / 0.5 天 (压测)
**工具**: Chrome DevTools Performance / Lighthouse / k6 / Locust

---

## 36.1 性能指标基线

| 场景 | 目标 | 测试 |
|------|------|------|
| 首屏加载 (Dashboard) | < 3s | Lighthouse + DevTools Network |
| 列表分页 (1000+ 条) | < 500ms | 翻页计时 |
| 表单提交 | < 1s | Network 时间 |
| BI 看板渲染 | < 10s | 演示数据生成 |
| AI 问答流式 | 首字 < 3s | WebSocket 监听 |
| 大文件上传 (60MB) | 不卡 UI | 拖拽测试 |
| 报表导出 (PDF) | < 2min | 下载完成计时 |

## 36.2 页面加载分析 (Lighthouse)

### 步骤
1. F12 → Lighthouse 面板
2. Mode=Navigation, Categories=Performance
3. Run

### 目标指标
- FCP (First Contentful Paint) < 1.8s
- LCP (Largest Contentful Paint) < 2.5s
- TTI (Time to Interactive) < 3.8s
- CLS (Cumulative Layout Shift) < 0.1

## 36.3 大数据分页性能
准备测试数据: 10000+ 订单
- 页 1: 响应时间
- 页 500: 响应时间 (应一致, 非 N+1)
- 最后页: 响应时间

### ✅ PASS
- 所有页响应时间 < 500ms
- 无 N+1 查询 (Backend log 检查)

## 36.4 并发测试 (可选, k6)
```javascript
// k6 script
import http from 'k6/http';
export const options = { vus: 100, duration: '30s' };
export default () => {
  http.get('https://www.cretaceousfuture.com/api/mobile/F001/sales/orders?page=1');
};
```

### 目标
- 100 用户并发, 95p 延迟 < 2s
- 错误率 < 1%
- CPU/内存后端不爆

## 36.5 N+1 查询检测
- 开后端 SQL 日志
- 进列表页观察
- 同一 SELECT 执行次数 > 列表项数 = N+1 bug

---

## 36.6 Checklist (12 项)

| # | 测试 | 目标 | 勾选 |
|---|------|------|------|
| 1 | Dashboard 首屏 | < 3s | ☐ |
| 2 | SO 列表分页 | < 500ms | ☐ |
| 3 | SO 提交 | < 1s | ☐ |
| 4 | 财务看板生成 | < 10s | ☐ |
| 5 | AI 问答首字 | < 3s | ☐ |
| 6 | 60MB 上传不卡 UI | - | ☐ |
| 7 | 导出 PDF | < 2min | ☐ |
| 8 | Lighthouse 综合 | 90+ | ☐ |
| 9 | 1000+ 条分页稳定 | - | ☐ |
| 10 | 100 用户并发 | 95p<2s | ☐ (可选) |
| 11 | 无 N+1 查询 | - | ☐ |
| 12 | 后端日志无慢 SQL (>1s) | - | ☐ |
