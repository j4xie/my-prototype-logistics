# Mini-C "Review-Aware Default Upload Picker" — VERIFIED on F001 Test Env

**Date**: 2026-04-25
**Branch**: `e2e/v1-framework`
**Source commit**: `feb3703d4` (Apr 24 — review-aware AIQuery default)
**Verifier**: subagent E1, F001 test env (`http://139.196.165.140:8097`)
**Status**: WORKING

## Background

Apr 25 C-quality audit could not verify Mini-C on prod because RES_3101_009 has
no review xlsx uploaded. F001 test env has 15+ review-keyword files plus a much
larger non-review POS file (200K rows), making it the perfect test environment.

## Code Under Test

`web-admin/src/views/smart-bi/AIQuery.vue` lines 326-349 (mounted hook):

```ts
const REVIEW_KEYWORDS = ['评价', '评论', '大众点评', '美团评价', '评分', 'review', 'comment'];
const isReviewFile = (d: any) => {
  const name = (d.fileName || d.originalFileName || '').toLowerCase();
  return REVIEW_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
};
const reviewCands = candidates.filter(isReviewFile);
const sortByRows = (a: any, b: any) => (b.rowCount || 0) - (a.rowCount || 0);
const sorted = reviewCands.length > 0
  ? [...reviewCands].sort(sortByRows)
  : [...candidates].sort(sortByRows);
selectedUploadId.value = sorted[0].id;
```

## Test Setup

- **Web-admin**: `http://139.196.165.140:8097` (test env)
- **Backend**: `47.100.235.168:10011` (Java test) via nginx reverse proxy
- **User**: `qhj_prod` / `123456` / Factory `F001`
- **Total uploads (F001 COMPLETED)**: 200
- **Largest non-review**: id=3970 `qhj_order_detail.csv`, **200,003 rows**
- **Review-keyword candidates**: **15 files** (Chinese-named `评价XXX.xlsx` + English `qhj_reviews_qN.xlsx`)
- All review candidates have rowCount of 12,903 or less

## Test Method

`tests/e2e-comprehensive/mini-c-picker-verify-test.mjs` (Playwright):

1. Login to test web-admin as `qhj_prod` / F001
2. Navigate to `/smart-bi/query` (AIQuery page)
3. Wait 8s for `onMounted()` hook to fire `getUploadHistory` + auto-select
4. Read the visible el-select trigger text
5. Read the chat welcome message ("当前数据源：...")
6. Run the EXACT Mini-C picker logic in-browser via `page.evaluate()` to confirm
   what the JS V8 engine actually decides

## Results

### Visible dropdown text
`评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx · 表1 · 12903行`

### Chat welcome message
`当前数据源：评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx`

### API call sequence
```
200 GET /api/mobile/F001/smart-bi/uploads?page=0&size=200&status=COMPLETED
200 GET /api/smartbi/analytics/cached/3975
```
The follow-up `cached/3975` call confirms the picker chose **id=3975**.

### In-browser Mini-C simulation
```json
{
  "totalItems": 200,
  "nonAutoSync": 194,
  "reviewCands": 15,
  "winner": {
    "id": 3975,
    "fileName": "评价下载2025.07.01-2025.09.30_1328220_1773721054386.xlsx",
    "rowCount": 12903
  },
  "winnerKeywordMatches": [
    { "kw": "评价",     "hit": true  },
    { "kw": "评论",     "hit": false },
    { "kw": "大众点评", "hit": false },
    { "kw": "美团评价", "hit": false },
    { "kw": "评分",     "hit": false },
    { "kw": "review",   "hit": false },
    { "kw": "comment",  "hit": false }
  ],
  "chosenGroup": "REVIEW"
}
```

The keyword `'评价'` correctly matches the Chinese filename `评价下载...xlsx`. The
review group has 15 entries; sorted by rowCount desc; id=3975 wins (the largest
review xlsx — note that id=3975 appears earlier in the API response order than
3964/3966/3967, and JavaScript `Array.sort` is stable so the first-seen 12903-row
review file wins among ties).

## Counterfactual: without Mini-C (legacy path)

If `reviewCands.length === 0` had been true, the picker would fall through to
`[...candidates].sort(sortByRows)`, picking id=3970 `qhj_order_detail.csv` (200,003
rows). The fact that id=3975 (12,903 rows) is selected is **proof that the
review-aware branch fired**.

## Conclusion

Mini-C "review-aware default upload picker" works correctly on F001:

- Detection of review xlsx works for both Chinese (`评价`) and English (`review`) keywords.
- Review group is preferred over the much larger POS table (`qhj_order_detail.csv` 200K rows).
- Within the review group, the highest-rowCount file wins.
- Auto-load of the chosen upload's analytics is triggered (`/api/smartbi/analytics/cached/3975`).
- The chat welcome message correctly displays the chosen file name.

**No code changes required.** Mini-C is production-ready and was already shipped in
commit `feb3703d4`.

## Notes for prod verification (RES_3101_009)

To re-verify on prod after a customer uploads a review xlsx:
1. User uploads any xlsx with file name containing `评价 / 评论 / 大众点评 / 美团评价 / 评分 / review / comment`
2. Re-open AIQuery page
3. The default-selected upload should be the review xlsx (largest among reviews)
4. NOT the largest POS table

If you want to test before customer uploads, manually upload one of the existing
F001 review xlsx files (e.g., `qhj_reviews_q3.xlsx`) into RES_3101_009.

## Artifacts

- Test script: `tests/e2e-comprehensive/mini-c-picker-verify-test.mjs`
- Raw observations: `tests/e2e-comprehensive/results/page-audit/mini-c-picker-verify-result.txt`
- Screenshot: `tests/e2e-comprehensive/results/page-audit/mini-c-aiquery-initial.png`
