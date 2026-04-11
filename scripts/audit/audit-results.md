# factoryId 隔离审计报告

**生成时间**: 2026-04-11T05:30:37.328Z
**审计脚本**: scripts/audit/tool-factory-isolation-audit.mjs
**扫描目录**: backend/java/cretas-api/src/main/java/com/cretas/aims/ai/tool/impl/

## 总览

- **Total Tools 扫描数**: 362
- 🔴 **HIGH 风险**: 0
- 🟡 **MEDIUM 风险**: 0
- 🟢 **LOW 风险**: 343
- ⚪ **EXEMPT（白名单豁免）**: 11
- ⚪ **NON_BUSINESS（非业务 Tool）**: 8

## 按 Domain 分组

| Domain | Total | HIGH | MEDIUM | LOW | EXEMPT | NON_BIZ |
|--------|-------|------|--------|-----|--------|---------|
| alert | 9 | 0 | 0 | 9 | 0 | 0 |
| system | 23 | 0 | 0 | 20 | 3 | 0 |
| dataop | 19 | 0 | 0 | 19 | 0 | 0 |
| hr | 14 | 0 | 0 | 14 | 0 | 0 |
| material | 27 | 0 | 0 | 27 | 0 | 0 |
| camera | 11 | 0 | 0 | 9 | 2 | 0 |
| canvas | 15 | 0 | 0 | 14 | 1 | 0 |
| quality | 12 | 0 | 0 | 12 | 0 | 0 |
| config | 3 | 0 | 0 | 3 | 0 | 0 |
| crm | 24 | 0 | 0 | 24 | 0 | 0 |
| dahua | 3 | 0 | 0 | 3 | 0 | 0 |
| report | 34 | 0 | 0 | 34 | 0 | 0 |
| equipment | 15 | 0 | 0 | 15 | 0 | 0 |
| finance | 12 | 0 | 0 | 12 | 0 | 0 |
| foodknowledge | 1 | 0 | 0 | 1 | 0 | 0 |
| form | 1 | 0 | 0 | 1 | 0 | 0 |
| decoration | 3 | 0 | 0 | 3 | 0 | 0 |
| isapi | 3 | 0 | 0 | 3 | 0 | 0 |
| factory | 3 | 0 | 0 | 3 | 0 | 0 |
| pagedesign | 4 | 0 | 0 | 4 | 0 | 0 |
| sales | 5 | 0 | 0 | 5 | 0 | 0 |
| processing | 17 | 0 | 0 | 17 | 0 | 0 |
| production | 1 | 0 | 0 | 1 | 0 | 0 |
| purchase | 6 | 0 | 0 | 6 | 0 | 0 |
| shipment | 16 | 0 | 0 | 15 | 1 | 0 |
| rd | 3 | 0 | 0 | 3 | 0 | 0 |
| restaurant | 27 | 0 | 0 | 27 | 0 | 0 |
| returnorder | 5 | 0 | 0 | 5 | 0 | 0 |
| warehouse | 4 | 0 | 0 | 4 | 0 | 0 |
| scale | 13 | 0 | 0 | 11 | 2 | 0 |
| scheduling | 3 | 0 | 0 | 3 | 0 | 0 |
| sop | 3 | 0 | 0 | 3 | 0 | 0 |
| governance | 3 | 0 | 0 | 1 | 2 | 0 |
| transfer | 5 | 0 | 0 | 5 | 0 | 0 |
| user | 3 | 0 | 0 | 3 | 0 | 0 |
| workreport | 4 | 0 | 0 | 4 | 0 | 0 |
| root | 5 | 0 | 0 | 0 | 0 | 5 |
| dictionary | 3 | 0 | 0 | 0 | 0 | 3 |

## 🔴 HIGH 风险清单（立即修复）

_无 HIGH 风险 Tool。_

## 🟡 MEDIUM 风险清单（人工复核）

_无 MEDIUM 风险 Tool。_

## 详情（HIGH + MEDIUM）

## ⚠️ 非 BusinessTool 但引用了 factoryId（建议人工 review）

| # | Domain | File | factoryId 引用次数 |
|---|--------|------|-------------------|
| 1 | root | `CreateIntentTool.java` | 2 |
| 2 | dictionary | `DictionaryAddTool.java` | 7 |
| 3 | dictionary | `DictionaryBatchImportTool.java` | 6 |
| 4 | dictionary | `DictionaryListTool.java` | 5 |
| 5 | root | `TestIntentMatchingTool.java` | 7 |
| 6 | root | `UpdateIntentTool.java` | 2 |

---

## 建议后续动作

1. **HIGH 风险**: 立即逐项修复并提交 PR，建议双人 review。
2. **MEDIUM 风险**: 人工复核每一条可疑模式，修复确认的真实漏洞。
3. **跨工厂 E2E 回归测试**: 建议每个 Repository 的 by-factory finder 加单元测试，确保跨工厂查询返回空。
4. **定期审计**: 建议 CI 增加 `node scripts/audit/tool-factory-isolation-audit.mjs` 作为门禁，发现 HIGH 立即阻塞合并。
