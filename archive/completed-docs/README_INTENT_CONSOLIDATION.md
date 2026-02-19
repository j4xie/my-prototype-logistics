# Intent Consolidation Analysis - Complete Documentation

**Analysis Date**: 2026-02-11  
**Project**: Cretas Food Traceability System  
**Status**: Ready for Implementation

---

## Overview

This directory contains a comprehensive semantic analysis of 179 intents in the AI-powered natural language understanding system. The analysis identifies **6 high-priority intents for consolidation**, plus 4 optional cleanups.

**Key Finding**: Two perfect duplicates and four generic alerts can be safely merged, reducing the intent space from **179 → 173** without any loss of functionality.

---

## Documents Included

### 1. `INTENT_CONSOLIDATION_SUMMARY.txt` (Executive Summary)
- **Purpose**: High-level overview for stakeholders
- **Content**: 
  - Findings by priority tier
  - Recommendations
  - Execution checklist
  - Expected outcomes
  - Risk assessment
- **Audience**: Project managers, QA leads, decision makers
- **Key Takeaway**: 3-5 hours to implement Phase 1+2, LOWEST risk

### 2. `INTENT_MERGE_ANALYSIS.md` (Detailed Technical Analysis)
- **Purpose**: In-depth reasoning for each merge decision
- **Content**:
  - Perfect duplicates analysis
  - High-priority alert consolidation
  - Medium-priority overlaps review
  - Domain-level structure assessment
  - Implementation plan (4 phases)
  - Rollback procedure
  - Quality gate checklist
- **Audience**: ML engineers, backend developers
- **Key Takeaway**: Clear semantic justification for each merge

### 3. `INTENT_MERGE_MAPPING.json` (Machine-Readable Specification)
- **Purpose**: Structured data for programmatic processing
- **Content**:
  - Phase-by-phase merge specifications
  - Training row counts
  - Status flags (READY, DEFER)
  - Risk assessment matrix
  - Validation scripts
- **Audience**: Automation tools, CI/CD pipelines
- **Key Takeaway**: Ready for script-driven consolidation

---

## Quick Start

### For Project Managers

1. Read: `INTENT_CONSOLIDATION_SUMMARY.txt` (5 min)
2. Review: Execution checklist (Phase 1 + Phase 2 only)
3. Estimate: 3-5 hours + 1-2 hours testing

### For ML Engineers

1. Read: `INTENT_MERGE_ANALYSIS.md` (15 min)
2. Review: `INTENT_MERGE_MAPPING.json` for phase specifications
3. Execute: Follow implementation steps in summary document

### For QA/Testing

1. Review: Expected outcomes section
2. Run: Validation script (validates label mapping)
3. Check: All intents removed from backend code

---

## Recommended Action Plan

### IMMEDIATE (This Sprint)

**Phase 1 + Phase 2**: Merge 6 intents
- 2 perfect duplicates (HR_EMPLOYEE_DELETE, NOTIFICATION_WECHAT_SEND)
- 4 generic alerts (ALERT_ACKNOWLEDGE, ALERT_LIST, ALERT_RESOLVE, ALERT_STATS)

**Effort**: 3-5 hours  
**Risk**: LOWEST  
**Result**: 179 → 173 intents

### OPTIONAL (Future Sprint)

**Phase 3 + Phase 4**: Additional cleanups (-4 intents)
- Filter consolidation (EXCLUDE_SELECTED family)
- Shipment update (SHIPMENT_STATUS_UPDATE)

**Effort**: 3-4 hours  
**Risk**: MEDIUM (Phase 3) to LOW (Phase 4)  
**Result**: 173 → 169 intents

---

## Implementation Steps

### Prerequisites

```bash
# Backup current state
git tag backup-v1.0-179intents
cp scripts/finetune/data/label_mapping.json label_mapping.json.bak
cp scripts/finetune/data/training_data.jsonl training_data.jsonl.bak
```

### Phase 1 + 2 (Combined)

**1. Edit label_mapping.json**
- Delete: HR_EMPLOYEE_DELETE
- Delete: NOTIFICATION_WECHAT_SEND
- Delete: ALERT_ACKNOWLEDGE
- Delete: ALERT_LIST
- Delete: ALERT_RESOLVE
- Delete: ALERT_STATS

**2. Update training_data.jsonl**
```bash
python << 'PYEOF'
import json

deprecated = {
    'HR_EMPLOYEE_DELETE': 'HR_DELETE_EMPLOYEE',
    'NOTIFICATION_WECHAT_SEND': 'NOTIFICATION_SEND_WECHAT',
    'ALERT_ACKNOWLEDGE': 'EQUIPMENT_ALERT_ACKNOWLEDGE',
    'ALERT_LIST': 'EQUIPMENT_ALERT_LIST',
    'ALERT_RESOLVE': 'EQUIPMENT_ALERT_RESOLVE',
    'ALERT_STATS': 'EQUIPMENT_ALERT_STATS'
}

with open('scripts/finetune/data/training_data.jsonl') as f:
    lines = f.readlines()

updated = []
for line in lines:
    row = json.loads(line)
    if row['label'] in deprecated:
        row['label'] = deprecated[row['label']]
    updated.append(json.dumps(row, ensure_ascii=False))

with open('scripts/finetune/data/training_data.jsonl', 'w') as f:
    f.write('\n'.join(updated) + '\n')
PYEOF
```

**3. Validate**
```bash
# Check for undefined labels
python -c "
import json
with open('scripts/finetune/data/label_mapping.json') as f:
    valid = set(json.load(f)['label_to_id'].keys())

with open('scripts/finetune/data/training_data.jsonl') as f:
    for i, line in enumerate(f):
        if json.loads(line)['label'] not in valid:
            print(f'ERROR line {i}: undefined label')
"

# Check for hardcoded references in code
grep -r "HR_EMPLOYEE_DELETE" backend-java/src --include="*.java"
grep -r "NOTIFICATION_WECHAT_SEND" backend-java/src --include="*.java"
grep -r "ALERT_ACKNOWLEDGE" backend-java/src --include="*.java"
```

**4. Retrain**
```bash
cd scripts/finetune
python train.py --model baseline-next --epochs 3 --validation-split 0.1
```

**5. Commit**
```bash
git add scripts/finetune/data/{label_mapping.json,training_data.jsonl}
git commit -m "feat: consolidate 6 duplicate intents (Phase 1+2)

- Merge HR_EMPLOYEE_DELETE + HR_DELETE_EMPLOYEE
- Merge NOTIFICATION_WECHAT_SEND + NOTIFICATION_SEND_WECHAT
- Deprecate generic ALERT_* in favor of EQUIPMENT_ALERT_*
- Remove redundant alert intents (ACKNOWLEDGE, LIST, RESOLVE, STATS)
- Result: 179 → 173 intents

Co-Authored-By: Intent Consolidation Analysis <2026-02-11>"
```

---

## Validation Checklist

Before merging to main:

- [ ] label_mapping.json is valid JSON
- [ ] No undefined labels in training_data.jsonl
- [ ] Grep confirms zero hardcoded references to removed intents
- [ ] Model validation accuracy ≥ baseline
- [ ] All E2E tests pass
- [ ] CHANGELOG.md updated
- [ ] Git history clean and tagged

---

## Risk Assessment

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Undefined labels | VERY LOW | Validation script catches all |
| Model accuracy drop | VERY LOW | Clear duplicates, improved signal |
| Hardcoded references | LOW | Grep search before commit |
| Rollback needed | VERY LOW | Backup tagged and committed |

---

## Expected Outcomes

**After Phase 1 + 2**:
- Intents: 179 → 173 (6 removed)
- Training rows updated: ~130-230
- Model retraining time: 5-15 minutes
- Validation accuracy: ≥ baseline (+0-1%)
- Intent namespace: Cleaner, more semantic
- Training efficiency: Improved

---

## Questions?

Refer to specific documents:
- **Why this merge?** → See INTENT_MERGE_ANALYSIS.md
- **How to implement?** → See INTENT_CONSOLIDATION_SUMMARY.txt
- **What's the JSON?** → See INTENT_MERGE_MAPPING.json

---

## Success Criteria

✓ 6 intents consolidated  
✓ Model retrains successfully  
✓ Validation accuracy maintained  
✓ Zero runtime errors  
✓ All tests pass  
✓ Code clean, committed, documented

---

**Analysis completed by**: Claude Code Intent Analysis System  
**Date**: 2026-02-11  
**Ready for**: Implementation Phase
