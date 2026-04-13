# 青花椒真实数据灌入 SmartBI 方案审计报告

**日期**: 2026-04-12 | **Mode**: Full (3 Researchers + Analyst + Critic)

## Executive Summary

方案技术可行但需 3 个前置修正: (1) 品牌分离 — 鲜行者占 20-26% 且不同菜系 (2) CSV 可直接上传 (auto-parse 原生支持, 无需转 XLSX) (3) revenue_col 列名需验证 field_aliases 自动映射。

## 覆盖度: 6 可激活 (17%) / 13 需补充 (36%) / 17 无数据 (47%)

## 执行方案

| Phase | 时间 | 操作 |
|---|---|---|
| 0. 品牌分离 | 30min | 过滤鲜行者 3 店 |
| 1. POS 上传 | 30min | CSV 直传 auto-parse (headerRowsOverride=4) |
| 2. 利润表 | 1h | XLS 上传 + financial_data 提取 |
| 3. 评价 | 1h | XLSX → JSON → upload_reviews |

## 关键修正 (Critic 发现)

1. CSV openpyxl BadZipFile 不是 blocker (auto-parse 有 pd.read_csv 分支)
2. Python 端点已有 JWT (Analyst 误判为无认证)
3. 鲜行者不是 "混入 3 家" 而是占 20-26% 的独立子品牌
4. 收入管理报表不是公式问题 (data_only=True/False 结果一致, 可能是模板文件)
5. xlsx/ 目录已有 CSV 转 XLSX 的现成文件
