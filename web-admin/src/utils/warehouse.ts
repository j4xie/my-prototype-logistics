/**
 * Warehouse code → customer-facing display label.
 *
 * D1 UI label policy (PR #346 audit, 2026-05-11): the customer's transcript
 * uses 线边仓 / 总仓 for the two warehouse types. Internal code (DB columns
 * factory_warehouses.code, Java constants) stays WH-WKS / WH-LOG, but UI
 * labels are aligned with customer 原话.
 *
 * Customer transcript references:
 *   - 线边仓 mentioned 3 times in transcript line 41 — factory-side warehouse
 *     that clears daily (legacy aliases: 鲜棉仓 / 工位仓 / workshop warehouse)
 *   - 总仓 mentioned in transcript lines 39 + 41 — persistent inventory,
 *     sales fulfillment source
 *
 * Glossary: docs/architecture/2026-05-11-warehouse-label-glossary.md
 *
 * Usage:
 *   import { warehouseDisplayLabel } from '@/utils/warehouse';
 *   const label = warehouseDisplayLabel(row.warehouseCode); // "线边仓" / "总仓" / fallback
 */
export function warehouseDisplayLabel(code: string | null | undefined): string {
  if (!code) return '-';
  if (code === 'WH-WKS') return '线边仓';
  if (code === 'WH-LOG') return '总仓';
  return code; // fallback: surface raw code (forward-compat for future warehouse types)
}

/**
 * Combine warehouse name (server-provided) with display label fallback.
 *
 * Cases:
 *   - name provided + code is known WH-WKS/WH-LOG → use customer-aligned label
 *   - name provided + code unknown                → use server name
 *   - name absent  + code known                   → use display label
 *   - both absent                                 → "-"
 *
 * Rationale: server-side `factory_warehouses.name` may be customer-configured
 * and could drift; we always prefer the canonical customer-aligned label
 * when the code maps to a well-known type, so the UI never diverges from
 * the transcript regardless of seed data.
 */
export function warehouseDisplayName(
  name: string | null | undefined,
  code: string | null | undefined,
): string {
  if (code === 'WH-WKS') return '线边仓';
  if (code === 'WH-LOG') return '总仓';
  if (name) return name;
  if (code) return code;
  return '-';
}
