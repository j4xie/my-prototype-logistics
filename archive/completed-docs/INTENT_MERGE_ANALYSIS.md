# Intent Consolidation Analysis

**Date**: 2026-02-11  
**Total Intents**: 179  
**Recommended Consolidations**: 8-12  
**Estimated Impact**: -4 to -6 intents (173-175 total)

---

## Executive Summary

The intent library contains **2 perfect duplicates** and **4-6 high-priority merges** that should be consolidated immediately. Additional ~14 medium-priority intents with 60%+ semantic overlap may warrant further review.

**Recommended immediate action**: Merge 2 perfect duplicates + deprecate 4 generic alerts in favor of equipment-specific variants.

---

## Perfect Duplicates (Jaccard = 1.0) - MERGE IMMEDIATELY

These have identical word sets, just different word order:

| ID | Intent A | Intent B | Recommendation |
|----|----------|----------|-----------------|
| 1 | HR_DELETE_EMPLOYEE | HR_EMPLOYEE_DELETE | Keep HR_DELETE_EMPLOYEE (alphabetical) |
| 2 | NOTIFICATION_SEND_WECHAT | NOTIFICATION_WECHAT_SEND | Keep NOTIFICATION_SEND_WECHAT (verb-first) |

**Impact**: -2 intents, -50-100 training rows to relabel

---

## High Priority: Generic Alerts vs Equipment Alerts (Jaccard = 0.67)

**Issue**: Generic ALERT_* intents completely overlap with EQUIPMENT_ALERT_* variants.

### Current state

| Category | Intents |
|----------|---------|
| Generic alerts | ALERT_ACKNOWLEDGE, ALERT_LIST, ALERT_RESOLVE, ALERT_STATS |
| Equipment-specific | EQUIPMENT_ALERT_ACKNOWLEDGE, EQUIPMENT_ALERT_LIST, EQUIPMENT_ALERT_RESOLVE, EQUIPMENT_ALERT_STATS |
| Domain-specific | MATERIAL_EXPIRING_ALERT, MATERIAL_LOW_STOCK_ALERT |

### Problem

Users can say both:
- "Show me all alerts" → ALERT_LIST
- "Show me equipment alerts" → EQUIPMENT_ALERT_LIST

Same meaning in practice, different training data split → model confusion and training inefficiency.

### Recommendation

**Deprecate generic ALERT_* (4 intents), keep EQUIPMENT_ALERT_***
- Alerts in the system are always equipment-scoped
- Material alerts handled separately via MATERIAL_*_ALERT
- Update training data: merge utterances into equipment variant
- Intents removed: 4
- Training data update: ~100-150 rows

---

## Medium Priority: Semantic Overlaps (Jaccard 0.6-0.8)

### 1. UI Filter Intents (0.75)

Candidates: EXCLUDE_SELECTED, FILTER_EXCLUDE_SELECTED, SYSTEM_FILTER_EXCLUDE_SELECTED, UI_EXCLUDE_SELECTED

**Recommendation**: Keep SYSTEM_FILTER_EXCLUDE_SELECTED (most specific), remove 3 variants (-3 intents)

### 2. Shipment Update Intents (0.67)

Candidates: SHIPMENT_UPDATE vs SHIPMENT_STATUS_UPDATE

**Recommendation**: Keep SHIPMENT_UPDATE, remove SHIPMENT_STATUS_UPDATE (-1 intent)

### 3. Equipment Control Intents (0.67)

Candidates: EQUIPMENT_START vs EQUIPMENT_CAMERA_START

**Recommendation**: Keep both (distinct semantics: general vs camera-specific) - NO MERGE

### 4. Scale Vision Intents (0.75)

Candidates: SCALE_ADD_DEVICE vs SCALE_ADD_DEVICE_VISION

**Recommendation**: Keep both (different tech: standard vs vision) - NO MERGE

### 5. Media Intents (0.67)

Candidates: MEDIA_PLAY vs MEDIA_PLAY_MUSIC

**Recommendation**: Keep both (music has distinct metadata/queue logic) - NO MERGE

### 6. ISAPI Detection (0.60)

Candidates: ISAPI_CONFIG_FIELD_DETECTION vs ISAPI_CONFIG_LINE_DETECTION

**Recommendation**: Keep both (distinct CV tasks) - NO MERGE

---

## Implementation Plan

### Phase 1: Perfect Duplicates (1-2 hours) - IMMEDIATE

**Remove 2 intents**:
- HR_EMPLOYEE_DELETE → merge into HR_DELETE_EMPLOYEE
- NOTIFICATION_WECHAT_SEND → merge into NOTIFICATION_SEND_WECHAT

**Result**: 179 → 177 intents

### Phase 2: Deprecate Generic Alerts (2-3 hours) - HIGH PRIORITY

**Remove 4 intents**:
- ALERT_ACKNOWLEDGE → merge to EQUIPMENT_ALERT_ACKNOWLEDGE
- ALERT_LIST → merge to EQUIPMENT_ALERT_LIST
- ALERT_RESOLVE → merge to EQUIPMENT_ALERT_RESOLVE
- ALERT_STATS → merge to EQUIPMENT_ALERT_STATS

Keep: ALERT_ACTIVE, ALERT_BY_EQUIPMENT, ALERT_BY_LEVEL, ALERT_DIAGNOSE, ALERT_TRIAGE

**Result**: 177 → 173 intents

### Phase 3: Clean Up Filters (2-3 hours) - OPTIONAL

**Remove 3 intents**:
- EXCLUDE_SELECTED
- FILTER_EXCLUDE_SELECTED
- UI_EXCLUDE_SELECTED

Keep: SYSTEM_FILTER_EXCLUDE_SELECTED

**Result**: 173 → 170 intents

### Phase 4: Clean Up Shipment (1 hour) - OPTIONAL

**Remove 1 intent**:
- SHIPMENT_STATUS_UPDATE → merge to SHIPMENT_UPDATE

**Result**: 170 → 169 intents

---

## Files to Update

1. **scripts/finetune/data/label_mapping.json**
   - Delete deprecated intent keys

2. **scripts/finetune/data/training_data.jsonl**
   - Update labels for all rows referencing deleted intents
   - Merge utterances into consolidated intent

3. **Backend (grep for hardcoded references)**
   - backend-java/src/**/*.java
   - backend-java/src/main/resources/**/*.properties
   - backend-java/src/main/resources/**/*.yml

4. **Documentation**
   - Update INTENT_REFERENCE.md (if exists)
   - Add deprecation notice to CHANGELOG.md

---

## Testing Checklist

- [ ] label_mapping.json is valid JSON
- [ ] training_data.jsonl has no undefined labels
- [ ] No orphaned intent references in backend code
- [ ] Model retrains without errors
- [ ] Validation accuracy ≥ current baseline
- [ ] E2E: Test removed intent utterances map to new intents

---

## Validation Command

```bash
# Check for undefined labels
python -c "
import json
with open('scripts/finetune/data/label_mapping.json') as f:
    valid_labels = set(json.load(f)['label_to_id'].keys())

with open('scripts/finetune/data/training_data.jsonl') as f:
    for i, line in enumerate(f):
        row = json.loads(line)
        if row['label'] not in valid_labels:
            print(f'Line {i}: undefined label {row["label"]}')"
```

---

## Summary

| Action | Removed | Result | Priority | Effort |
|--------|---------|--------|----------|--------|
| Phase 1: Merge perfect duplicates | 2 | 177 intents | 🔴 High | 1-2h |
| Phase 2: Deprecate generic alerts | 4 | 173 intents | 🟡 Medium | 2-3h |
| Phase 3: Clean filters (optional) | 3 | 170 intents | 🟠 Low | 2-3h |
| Phase 4: Shipment cleanup (optional) | 1 | 169 intents | 🟠 Low | 1h |
| **Total** | **10** | **169 intents** | - | **6-9h** |

**Recommended**: Execute Phase 1 + Phase 2 (3-5 hours total) for 6-intent reduction + model clarity.
