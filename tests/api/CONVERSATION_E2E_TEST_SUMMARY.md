# Multi-Round Conversation E2E Test - Summary

## Problem Fixed

**Original Issue**: Test expected conversation system to be triggered with `metadata.sessionId`, but the input "我想查一下东西" matched MATERIAL_BATCH_QUERY with confidence > 30%, so it bypassed conversation and went to handler, which returned NEED_MORE_INFO (missing parameters) without sessionId.

## Solution Applied

**Approach**: Changed test input to use a truly ambiguous query with random suffix that won't match any intent well (confidence < 30%).

### Key Changes

1. **Randomized Test Input** (Line 91-92):
   ```bash
   RANDOM_SUFFIX=$RANDOM
   TEST_INPUT="我要操作${RANDOM_SUFFIX}"
   ```
   - Ensures each test run uses a unique input
   - Prevents learning pollution from previous test runs
   - Guarantees confidence < 30% for conversation trigger

2. **Improved Test Validation** (Test 2):
   - Now checks for `CONVERSATION_CONTINUE` status
   - Validates sessionId continuity
   - Provides clearer error messages

3. **Clearer Success Criteria** (Test 3 & 4):
   - Test 3: Validates intent recognition after conversation completes
   - Test 4: Validates learning effect - input now directly recognized

## Test Flow Verified

### Test 1: Low Confidence Input Triggers Conversation
```json
{
  "status": "NEED_CLARIFICATION",
  "metadata": {
    "sessionId": "ff46b5ae-3f22-4597-af44-9e3fbd998bac",
    "needMoreInfo": true,
    "conversationMessage": "您提到的'操作21225'不太明确..."
  }
}
```
✅ Successfully triggered conversation system

### Test 2: Conversation Continues
```json
{
  "status": "CONVERSATION_CONTINUE",
  "metadata": {
    "sessionId": "ff46b5ae-3f22-4597-af44-9e3fbd998bac",
    "currentRound": 2,
    "candidates": [...]
  }
}
```
✅ Multi-round conversation working correctly

### Test 3: Intent Recognized
```json
{
  "intentCode": "MATERIAL_BATCH_QUERY",
  "status": "NEED_MORE_INFO",
  "message": "请提供批次ID (batchId) 或原材料类型ID (materialTypeId)"
}
```
✅ Successfully transitioned from conversation to handler

### Test 4: Learning Verified
```json
{
  "intentCode": "MATERIAL_BATCH_QUERY",
  "status": "NEED_MORE_INFO",
  "metadata": null  // No sessionId - bypassed conversation!
}
```
✅ Learning system works - same input now directly recognized

## Key Code References

### Conversation Trigger Threshold
**File**: `/backend-java/src/main/java/com/cretas/aims/service/impl/AIIntentServiceImpl.java:443-473`

```java
// Layer 5: 多轮对话 (置信度 < 30% 时自动触发)
if (bestConfidence < 0.30 && userId != null) {
    log.info("低置信度 ({}) 自动触发多轮对话: intent={}, factoryId={}, userId={}",
            bestConfidence, bestEntry.config.getIntentCode(), factoryId, userId);

    ConversationService.ConversationResponse conversationResp =
            conversationService.startConversation(factoryId, userId, userInput);

    if (conversationResp != null && conversationResp.getSessionId() != null) {
        // 返回带会话信息的结果
        IntentMatchResult conversationResult = result.toBuilder()
                .sessionId(conversationResp.getSessionId())
                .conversationMessage(conversationResp.getMessage())
                .requiresConfirmation(true)
                .build();
        return conversationResult;
    }
}
```

### Response Mapping
**File**: `/backend-java/src/main/java/com/cretas/aims/service/impl/IntentExecutorServiceImpl.java:171-177`

```java
// 添加会话信息到元数据
Map<String, Object> metadata = new HashMap<>();
metadata.put("sessionId", conversationResp.getSessionId());
metadata.put("currentRound", conversationResp.getCurrentRound());
metadata.put("maxRounds", conversationResp.getMaxRounds());
metadata.put("status", conversationResp.getStatus() != null ?
    conversationResp.getStatus().name() : null);
```

## Test Execution

```bash
bash tests/api/test_conversation_e2e.sh
```

**Expected Output**:
- ✅ Test 1: Low confidence input triggers conversation
- ✅ Test 2: Conversation continues with candidate suggestions
- ✅ Test 3: Intent successfully identified
- ✅ Test 4: Learning effect verified

## Status States

| State | Description | Has sessionId? |
|-------|-------------|----------------|
| `NEED_CLARIFICATION` | Initial conversation trigger | ✅ Yes |
| `CONVERSATION_CONTINUE` | Multi-round conversation ongoing | ✅ Yes |
| `NEED_MORE_INFO` | Handler-level parameter request | ❌ No |

## Notes

1. **Random Suffix**: Using `$RANDOM` ensures test repeatability without database cleanup
2. **Learning Delay**: Test 4 waits 3 seconds for async learning task to complete
3. **Two Types of NEED_MORE_INFO**:
   - **Conversation-level**: Has sessionId, triggers multi-round clarification
   - **Handler-level**: No sessionId, requests specific parameters after intent is recognized

## Verification Checklist

- [x] Low confidence input triggers conversation system
- [x] SessionId generated and maintained across conversation rounds
- [x] Metadata contains needMoreInfo and conversationMessage
- [x] Conversation continues with candidate suggestions
- [x] Intent recognition completes after clarification
- [x] Learning system associates user expression with recognized intent
- [x] Learned expression bypasses conversation on subsequent use
