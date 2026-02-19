# SmartBI P0-P2 修复方案数据准确性审查

**日期**: 2026-02-17
**方法**: Agent-Team Full Mode (3 Researchers + Analyst + Critic + Integrator)

## Executive Summary

- **CRITICAL**: DynamicKPIRow `isChangeRateValid()` 过滤 ≥100% changeRate — 与之前 ≥80% 过滤完全同类反模式
- **MEDIUM-HIGH**: `capMoMPercent()` 截断 ±999% — 食品行业春节可达 +5000% MoM
- **MEDIUM**: Hardcoded benchmarks (25-35% gross margin) — 食品行业跨度 6-43%，应改为可配置
- **SAFE**: P0.1 LLM prompt, P0.1b financial context, P0.3 column humanization, P2 annotations, P3-forecast

## Key Findings

### 1. DynamicKPIRow ≥100% Filter (CRITICAL)
- File: `web-admin/src/components/smartbi/DynamicKPIRow.vue`
- Line 34: `if (Math.abs(rate) >= 100) return '—';`
- Line 42: `return Math.abs(rate) < 100;`
- Impact: ALL changeRate ≥100% silently hidden, including real +150%, +500%, +5000% values
- Fix: Remove filter, show actual values

### 2. capMoMPercent ±999% Cap (MEDIUM-HIGH)
- File: `web-admin/src/api/smartbi.ts`
- `capMoMPercent()` returns 999 for >999%, losing real value
- `formatMoMDisplay()` shows ">+999%" (display OK) but raw value lost for downstream
- Fix: Keep display indicator but preserve raw value; add anomaly annotation

### 3. Hardcoded Benchmarks (MEDIUM)
- Files: `insight_generator.py`, `cross_sheet_aggregator.py`, `smartbi.ts`, `KPICard.vue`
- Food industry gross margins: poultry 6%, dairy 10-15%, prepared 15-25%, seasoning 35-43%
- Single benchmark (25-35%) wrong for most sub-sectors
- Fix: Make configurable via FactorySettings, show as "reference range"

## Action Items

### Immediate (Today)
1. Delete DynamicKPIRow isChangeRateValid() filter
2. Fix capMoMPercent to preserve raw value
3. Add anomaly annotation for extreme values

### Short-term (This week)
4. Make benchmarks configurable in FactorySettings
5. Update all hardcoded benchmark callers

### Conditional
6. P1 KPI sparkline fix (after capMoMPercent fix)
7. Cross-sheet benchmark config (after FactorySettings)
