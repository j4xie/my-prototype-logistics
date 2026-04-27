/**
 * Provenance source-type → friendly Chinese label.
 * Per spec 04-C v1.4 §6.1 + §6.3 NC-4.
 *
 * P1.5-5 (post-D27 review extract): single source of truth for the label
 * map. Previously duplicated in TrustIndicator.vue (8 cases) and
 * cell-audit.vue (9 cases — they had drifted; cell-audit knew about
 * `pos_excel`, TrustIndicator didn't). Both consumers now import from here.
 *
 * Backend conflict_resolver.py keeps its own list (server-side concern with
 * priority semantics) — these labels are for UI rendering only.
 */
export function sourceLabel(source: string): string {
  switch (source) {
    case 'manual':
      return '客户手动确认';
    case 'bill_flow':
      return '账单流水';
    case 'product_summary':
      return '商品汇总';
    case 'review':
      return '评论数据';
    case 'inferred':
      return 'AI 推断';
    case 'industry_default':
      return '行业默认值';
    case 'system':
      return '系统生成';
    case 'pos_excel':
      return 'POS Excel 上传';
    default:
      // Fallback: surface the raw token so we never silently lose info.
      return source;
  }
}
