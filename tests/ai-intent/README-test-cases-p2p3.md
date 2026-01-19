# AI Intent Recognition Test Cases - P2+P3 (165 Cases)

## 📊 Overview

Complete test suite for AI Intent Recognition system with **165 test cases** covering P2 (operational configurations) and P3 (special scenarios) priorities.

**File**: `test-cases-p2p3-complete-165.json`
**Generated**: 2026-01-16
**Version**: 2.0.0

---

## 🎯 Test Case Distribution

### P2 - Operational Configuration (95 cases)

| Category | Intent Codes | Count | Range |
|----------|-------------|-------|-------|
| **ATTENDANCE** | `CLOCK_IN`, `CLOCK_OUT`, `ATTENDANCE_TODAY`, `ATTENDANCE_HISTORY` | 28 | TC-P2-CLOCK-003 ~ 030 |
| **USER** | `USER_CREATE`, `USER_UPDATE`, `USER_DISABLE`, `USER_QUERY` | 24 | TC-P2-USER-002 ~ 025 |
| **CRM** | `CUSTOMER_LIST`, `CUSTOMER_SEARCH`, `CUSTOMER_CREATE`, `CUSTOMER_STATS` | 20 | TC-P2-CRM-001 ~ 020 |
| **CONFIG** | `CONFIG_GET`, `CONFIG_UPDATE`, `CONFIG_LIST` | 15 | TC-P2-CONFIG-001 ~ 015 |
| **CAMERA** | `CAMERA_STATUS`, `CAMERA_CONFIG`, `CAMERA_LIST` | 9 | TC-P2-CAMERA-001 ~ 009 |

### P3 - Special Scenarios (70 cases)

| Category | Focus | Count | Range |
|----------|-------|-------|-------|
| **CONVERSATION** | Multi-turn dialogue with parameter clarification | 18 | TC-P3-CONVERSATION-003 ~ 020 |
| **COLLOQUIAL** | Colloquial expression variants (5-10 variants per case) | 23 | TC-P3-COLLOQUIAL-003 ~ 025 |
| **BOUNDARY** | Edge cases, input validation, security tests | 19 | TC-P3-BOUNDARY-002 ~ 020 |
| **EXCEPTION** | LLM fallback, low confidence, ambiguous intent | 9 | TC-P3-EXCEPTION-001 ~ 009 |

---

## 📋 Test Case Structure

### Basic Fields

```json
{
  "id": "TC-P2-CLOCK-003",
  "priority": "P2",
  "category": "ATTENDANCE",
  "intentCode": "CLOCK_IN",
  "testType": "OPERATION",
  "description": "验证正常签到操作-上午时段",
  "userInput": "签到上班"
}
```

### Expected Intent

```json
"expectedIntent": {
  "intentCode": "CLOCK_IN",
  "confidence": 1.0,
  "matchMethod": "FUSION",
  "questionType": "OPERATIONAL_COMMAND"
}
```

**Match Methods**:
- `FUSION`: Multi-source fusion matching
- `PHRASE`: Phrase mapping from IntentKnowledgeBase
- `SEMANTIC`: Semantic understanding
- `COLLOQUIAL`: Colloquial expression mapping
- `LLM_FALLBACK`: Fallback to LLM when confidence is low

### Test Data Setup

```json
"testDataSetup": {
  "sql": "INSERT INTO ...",
  "factoryId": "F001",
  "userId": 2,
  "cleanup": "DELETE FROM ..."
}
```

### Validation

```json
"validation": {
  "responseAssertion": {
    "status": "COMPLETED",
    "intentRecognized": true,
    "operationSuccess": true
  },
  "operationVerification": {
    "type": "RECORD_CREATED",
    "checkSql": "SELECT COUNT(*) ...",
    "expectedCount": 1
  },
  "semanticCheck": {
    "enabled": true,
    "llmPrompt": "Validation prompt for LLM"
  }
}
```

**Verification Types**:
- `RECORD_CREATED`: Verify new record created
- `FIELD_UPDATED`: Verify field value changed
- `STATUS_CHANGED`: Verify status transition
- `QUANTITY_DECREASE`: Verify quantity reduced
- `LIST_COUNT`: Verify result count
- `AGGREGATED_DATA`: Verify aggregated statistics

---

## 🔄 P3 Multi-Turn Conversation Format

```json
{
  "id": "TC-P3-CONVERSATION-003",
  "testType": "MULTI_TURN",
  "conversationRounds": [
    {
      "round": 1,
      "userInput": "使用批次BATCH-001",
      "expectedResponse": {
        "status": "CONVERSATION_CONTINUE",
        "sessionIdNotNull": true,
        "messagePattern": "请提供|数量"
      }
    },
    {
      "round": 2,
      "userInput": "200公斤",
      "sessionIdRequired": true,
      "expectedResponse": {
        "status": "COMPLETED",
        "intentCode": "MATERIAL_BATCH_USE",
        "operationSuccess": true
      }
    }
  ],
  "validation": {
    "multiTurnValidation": {
      "enabled": true,
      "checkSessionContinuity": true,
      "checkParameterExtraction": true
    }
  }
}
```

**Key Features**:
- Validates session continuity across rounds
- Checks parameter extraction and context memory
- Verifies clarification question quality

---

## 🗣️ P3 Colloquial Variants Format

```json
{
  "id": "TC-P3-COLLOQUIAL-003",
  "testType": "COLLOQUIAL_VARIANTS",
  "description": "库存查询口语化",
  "inputVariants": [
    "还有多少货",
    "库存够不够",
    "剩多少了",
    "仓库里还有啥",
    "存货情况"
  ],
  "allShouldRecognizeAs": "MATERIAL_BATCH_QUERY",
  "validation": {
    "variantValidation": {
      "enabled": true,
      "allVariantsShouldRecognize": true,
      "expectedIntentCode": "MATERIAL_BATCH_QUERY"
    }
  }
}
```

**Key Features**:
- Tests 5-10 colloquial variants per case
- All variants should recognize as the same intent
- Maps to phraseToIntentMapping in IntentKnowledgeBase

---

## 🛡️ P3 Boundary & Security Tests

### Input Boundary Tests

| Test Type | Example Input | Expected Behavior |
|-----------|---------------|-------------------|
| Empty input | `""` | Error: "输入不能为空" |
| Extra long (500+ chars) | `"查询" + "..."*100` | Error: "输入过长" |
| Special characters | `"查询@#$%库存"` | Sanitized and processed |
| Pure numbers | `"12345"` | Error: "无法识别" |
| Mixed languages | `"query库存信息"` | Recognized correctly |

### Security Tests

| Attack Type | Example Input | Expected Behavior |
|-------------|---------------|-------------------|
| SQL Injection | `"查询'; DROP TABLE users;--"` | Error: "非法字符" |
| XSS Attack | `"<script>alert('xss')</script>"` | Error: "非法字符" |
| HTML Injection | `"<img src=x onerror=alert(1)>"` | Sanitized |

---

## 🚨 P3 Exception Handling

### LLM Fallback Scenarios

1. **Complex queries** - Multi-dimensional statistical analysis
2. **Mixed intents** - Multiple operations in one query
3. **Ambiguous references** - Vague pronouns like "that batch"

### Low Confidence Scenarios

1. **Similar intents** - Hard to distinguish between related intents
2. **Missing keywords** - Insufficient information
3. **Ambiguous expressions** - Multiple possible interpretations

### Unsupported Operations

1. **Out-of-domain** - Weather queries, small talk
2. **Dangerous operations** - "Delete all data"
3. **Unclear requests** - "Check information" (too vague)

---

## 🎯 Coverage Analysis

### By Intent Type

| Intent Type | Test Cases | Percentage |
|-------------|-----------|------------|
| **Query (查询)** | 85 | 51.5% |
| **Operation (操作)** | 60 | 36.4% |
| **Special (特殊)** | 20 | 12.1% |

### By Priority

| Priority | Test Cases | Percentage |
|----------|-----------|------------|
| **P2** | 95 | 57.6% |
| **P3** | 70 | 42.4% |

### By Test Type

| Test Type | Cases | Description |
|-----------|-------|-------------|
| **QUERY** | 70 | Data retrieval tests |
| **OPERATION** | 45 | Data modification tests |
| **MULTI_TURN** | 18 | Conversation flow tests |
| **COLLOQUIAL_VARIANTS** | 23 | Natural language variants |
| **BOUNDARY** | 19 | Edge case and security tests |
| **EXCEPTION** | 9 | Error handling tests |

---

## 🔧 How to Use

### 1. Load Test Cases

```python
import json

with open('test-cases-p2p3-complete-165.json', 'r', encoding='utf-8') as f:
    test_suite = json.load(f)

print(f"Total cases: {test_suite['totalCases']}")
for test_case in test_suite['testCases']:
    print(f"Running {test_case['id']}: {test_case['description']}")
```

### 2. Run Single Test

```python
def run_test_case(test_case):
    # 1. Setup test data
    if test_case['testDataSetup']['sql']:
        execute_sql(test_case['testDataSetup']['sql'])

    # 2. Call intent recognition API
    response = intent_api.recognize(
        user_input=test_case['userInput'],
        factory_id=test_case['testDataSetup']['factoryId']
    )

    # 3. Validate response
    assert response['intentCode'] == test_case['expectedIntent']['intentCode']
    assert response['confidence'] >= test_case['expectedIntent']['confidence']

    # 4. Verify operation if applicable
    if 'operationVerification' in test_case['validation']:
        verify_operation(test_case['validation']['operationVerification'])

    # 5. Cleanup
    if test_case['testDataSetup']['cleanup']:
        execute_sql(test_case['testDataSetup']['cleanup'])
```

### 3. Run Multi-Turn Conversation Test

```python
def run_multi_turn_test(test_case):
    session_id = None

    for round_data in test_case['conversationRounds']:
        response = intent_api.recognize(
            user_input=round_data['userInput'],
            session_id=session_id
        )

        # Validate round response
        assert response['status'] == round_data['expectedResponse']['status']

        # Save session ID for next round
        if response.get('sessionId'):
            session_id = response['sessionId']

        # Check if conversation should continue
        if round_data['expectedResponse']['status'] == 'CONVERSATION_CONTINUE':
            assert session_id is not None
        elif round_data['expectedResponse']['status'] == 'COMPLETED':
            assert response['intentCode'] == round_data['expectedResponse']['intentCode']
```

### 4. Run Colloquial Variants Test

```python
def run_colloquial_test(test_case):
    expected_intent = test_case['allShouldRecognizeAs']

    for variant in test_case['inputVariants']:
        response = intent_api.recognize(
            user_input=variant,
            factory_id=test_case['testDataSetup']['factoryId']
        )

        # All variants should recognize as the same intent
        assert response['intentCode'] == expected_intent, \
            f"Variant '{variant}' recognized as {response['intentCode']}, expected {expected_intent}"

        # Confidence should be reasonable
        assert response['confidence'] >= 0.7, \
            f"Variant '{variant}' has low confidence: {response['confidence']}"
```

---

## 📈 Success Criteria

### Overall Metrics

- **Intent Recognition Accuracy**: ≥ 92%
- **Confidence Threshold**: ≥ 0.75 for COMPLETED status
- **Multi-Turn Session Continuity**: 100%
- **Colloquial Variant Recognition**: ≥ 90%
- **Boundary Error Handling**: 100%
- **Security Test Pass Rate**: 100%

### P2 Test Targets

- **CLOCK (Attendance)**: 95% recognition accuracy
- **USER (User Management)**: 90% operation success
- **CRM (Customer)**: 90% query accuracy
- **CONFIG (Configuration)**: 90% operation success
- **CAMERA (Monitoring)**: 85% status query accuracy

### P3 Test Targets

- **CONVERSATION**: 100% session continuity, 90% parameter extraction
- **COLLOQUIAL**: 90% variant recognition across all expressions
- **BOUNDARY**: 100% proper error handling, no crashes
- **EXCEPTION**: 80% fallback success, graceful degradation

---

## 🔍 Known Issues & Notes

### Phase 1 Test Cases

The following test case IDs are reserved for Phase 1 P0/P1 tests (not included in this file):
- `TC-P0-*`: Core functionality tests (P0 priority)
- `TC-P1-*`: Important features (P1 priority)
- `TC-P2-CLOCK-001`, `TC-P2-CLOCK-002`: Already in Phase 1
- `TC-P2-USER-001`: Already in Phase 1
- `TC-P3-CONVERSATION-001`, `TC-P3-CONVERSATION-002`: Already in Phase 1
- `TC-P3-COLLOQUIAL-001`, `TC-P3-COLLOQUIAL-002`: Already in Phase 1
- `TC-P3-BOUNDARY-001`: Already in Phase 1

### Integration with IntentKnowledgeBase

All colloquial test cases are based on `phraseToIntentMapping` in:
```
backend-java/src/main/java/com/cretas/aims/config/IntentKnowledgeBase.java
```

When adding new colloquial expressions, update both:
1. IntentKnowledgeBase.java phraseToIntentMapping
2. Corresponding COLLOQUIAL test cases

### Database Requirements

Test execution requires:
- MySQL 5.7+ or 8.0+
- All tables from schema migrations
- Test user with CREATE/DROP privileges for cleanup

---

## 📚 Related Documents

- [PRD-功能与文件映射-v3.0.md](../../docs/prd/PRD-功能与文件映射-v3.0.md)
- [IntentKnowledgeBase.java](../../backend-java/src/main/java/com/cretas/aims/config/IntentKnowledgeBase.java)
- [Phase 1 Test Cases](./test-cases-phase1-30.json)

---

## 🎯 Next Steps

1. **Execute Test Suite**: Run all 165 test cases against the AI Intent API
2. **Analyze Results**: Generate test report with pass/fail statistics
3. **Fix Failures**: Address any failing test cases
4. **Optimize Performance**: Improve low-confidence scenarios
5. **Expand Coverage**: Add more edge cases based on production feedback

---

**Generated by**: Claude Opus 4.5
**Date**: 2026-01-16
**Version**: 2.0.0
