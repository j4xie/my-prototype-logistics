# UX Observations — agg-strategy-realwindow-prod

Generated: 2026-04-24T07:19:04.346Z
Target: https://admin.cretaceousfuture.com
Tenant: qhj_prod / RES_3101_009

## Captured during run

- Navigation to /smart-bi/analysis took 4660ms (until smart-bi-analysis container visible)
- Upload switch to "qhj_q3_real" took 2865ms (1 of 360 options)
- Upload switch to "qhj_order_detail" took 2912ms (1 of 360 options)
- Console errors observed (1): enrichSheetAnalysis 失败: ApiError: timeout of 120000ms exceeded
    at https://admin.cretaceousfuture

## KPI strip review (upload 4172, qhj_q3_real.xlsx)

Titles (4): 评价门店 | 平均服务分 | 平均星级分 | 平均环境分

Values: 4,955 亿 | 4.83 分 | 4.83 分 | 4.82 分

Units seen: 亿, 分

## KPI strip POS (upload 4169, qhj_order_detail.csv)

(snapshot not captured — see test failure above)

## Notes for Task C (UX optimization audit)

- (manual notes to add after reviewing screenshots)
- Are the 平均X cards visually consistent? (font size, alignment, spacing)
- Is the "分" unit clear/unambiguous to a customer? (vs e.g. "星" for star ratings)
- Is the upload selector findable? Any visual hint that it is switchable?
- Are KPI cards rendered before or after CountUp animation completes?
- Visual hierarchy: titles vs values vs units — does anything compete for attention?

## Console / network health

Console errors: 1
Network 4xx/5xx: 0

First 3 console errors:
- enrichSheetAnalysis 失败: ApiError: timeout of 120000ms exceeded
    at https://admin.cretaceousfuture.com/assets/request-BDqxhjYk.js:6:2981
    at async j.request (https://admin.cretaceousfuture.com/as
