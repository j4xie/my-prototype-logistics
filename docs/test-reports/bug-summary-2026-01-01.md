# BUG Summary - Controller Testing

**Date**: 2026-01-01
**Controllers Tested**: QualityDispositionController, QualityCheckItemController
**Total BUGs Found**: 11
**Fixed**: 11 ✅ (2026-01-02 Phase 2.1 BUG 批量修复)

---

## ✅ 修复状态更新 (2026-01-02)

所有 11 个 BUG 已在 Phase 2.1 批量修复中解决：

| 修复方式 | 说明 |
|----------|------|
| EntityNotFoundException | 创建自定义异常，返回 HTTP 404 |
| ValidationException | 创建验证异常，返回 HTTP 400 |
| GlobalExceptionHandler | 全局异常处理器捕获并返回正确状态码 |

**修复文件**:
- `QualityCheckItemServiceImpl.java` - 替换所有 RuntimeException → EntityNotFoundException
- `QualityDispositionServiceImpl.java` - 添加实体存在性检查
- `GlobalExceptionHandler.java` - 添加 @ExceptionHandler 处理自定义异常

---

## Quick Reference Table

| BUG ID | Controller | Endpoint | Method | Priority | Description | Status |
|--------|------------|----------|--------|----------|-------------|--------|
| BUG-1007 | QualityDisposition | `/execute` | POST | Medium | Execute disposition fails with internal error | ✅ Fixed |
| BUG-1009 | QualityDisposition | `/{id}/approve` | POST | Medium | Approve disposition returns 500 for invalid ID | ✅ Fixed |
| BUG-1017 | QualityCheckItem | `/category/{category}` | GET | Critical | Cannot query items by category | ✅ Fixed |
| BUG-1019 | QualityCheckItem | `/` | POST | Critical | Cannot create quality check item | ✅ Fixed |
| BUG-1020 | QualityCheckItem | `/{itemId}` | GET | Medium | Get item returns 500 for invalid ID | ✅ Fixed |
| BUG-1021 | QualityCheckItem | `/{itemId}` | PUT | Medium | Update item returns 500 for invalid ID | ✅ Fixed |
| BUG-1022 | QualityCheckItem | `/{itemId}` | DELETE | Medium | Delete item returns 500 for invalid ID | ✅ Fixed |
| BUG-1025 | QualityCheckItem | `/bindings` | POST | Critical | Cannot create item-product binding | ✅ Fixed |
| BUG-1027 | QualityCheckItem | `/bindings/{id}` | PUT | Low | Update binding returns 500 for invalid ID | ✅ Fixed |
| BUG-1028 | QualityCheckItem | `/bindings/{id}` | DELETE | Low | Delete binding returns 500 for invalid ID | ✅ Fixed |
| BUG-1031 | QualityCheckItem | `/{id}/validate` | POST | Low | Validate value returns 500 for invalid ID | ✅ Fixed |

---

## BUG Details

### BUG-1007: Execute Disposition Fails
- **Severity**: Medium
- **Type**: Error Handling
- **Root Cause**: QualityInspection record not found, throws unhandled exception
- **Expected**: 404 with message "Quality inspection not found: 1"
- **Actual**: 500 with message "系统内部错误，请联系管理员"
- **Fix**: Add try-catch in QualityDispositionController.executeDisposition()

### BUG-1009: Approve Disposition Returns 500
- **Severity**: Medium
- **Type**: Error Handling
- **Root Cause**: DecisionAuditLog not found for ID "test-id"
- **Expected**: 404 with message "Disposition application not found: test-id"
- **Actual**: 500 with message "系统内部错误，请联系管理员"
- **Fix**: Change orElseThrow() to return ApiResponse.error() with 404 status

### BUG-1017: Cannot Query Items by Category
- **Severity**: Critical
- **Type**: Service Layer Exception
- **Root Cause**: Likely QualityCheckItemService.getByCategory() throws exception
- **Expected**: Return empty list or items for category APPEARANCE
- **Actual**: 500 error
- **Fix**: Check service implementation and add error handling
- **Files to Check**:
  - `/backend-java/src/main/java/com/cretas/aims/service/impl/QualityCheckItemServiceImpl.java`
  - `/backend-java/src/main/java/com/cretas/aims/repository/QualityCheckItemRepository.java`

### BUG-1019: Cannot Create Quality Check Item
- **Severity**: Critical
- **Type**: Database Constraint / Validation
- **Root Cause**: Missing userId from HttpServletRequest or database constraint violation
- **Request**: `{"itemCode":"TEST001","itemName":"Test","category":"APPEARANCE",...}`
- **Expected**: Create item and return with ID
- **Actual**: 500 error
- **Fix**:
  1. Ensure userId is properly extracted from JWT token
  2. Check database constraints on quality_check_items table
  3. Add proper validation error messages
- **Files to Check**:
  - `QualityCheckItemController.create()` - line 40-48
  - `QualityCheckItemService.createQualityCheckItem()`

### BUG-1020/1021/1022: CRUD Operations Return 500 for Invalid ID
- **Severity**: Medium
- **Type**: Error Handling Pattern
- **Root Cause**: Using .orElseThrow() without custom exception handling
- **Expected**: 404 with "Quality check item not found: {id}"
- **Actual**: 500 error
- **Fix**: Implement custom NotFoundException and global exception handler
- **Pattern to Apply**:
```java
@GetMapping("/{itemId}")
public ResponseEntity<ApiResponse<QualityCheckItemDTO>> getById(
        @PathVariable String factoryId,
        @PathVariable String itemId) {
    try {
        QualityCheckItemDTO item = qualityCheckItemService.getQualityCheckItem(factoryId, itemId);
        return ResponseEntity.ok(ApiResponse.success(item));
    } catch (EntityNotFoundException e) {
        return ResponseEntity.status(404).body(ApiResponse.error("Quality check item not found: " + itemId));
    }
}
```

### BUG-1025: Cannot Create Binding
- **Severity**: Critical
- **Type**: Foreign Key Constraint
- **Root Cause**: productTypeId "PT001" or qualityCheckItemId "QCI001" do not exist in database
- **Request**: `{"productTypeId":"PT001","qualityCheckItemId":"QCI001",...}`
- **Expected**: 400 with "Product type PT001 not found" or "Quality check item QCI001 not found"
- **Actual**: 500 error
- **Fix**:
  1. Add validation to check if referenced entities exist before creating binding
  2. Catch SQLException and parse constraint violation message
  3. Return user-friendly error message

### BUG-1027/1028: Binding Operations Return 500
- **Severity**: Low
- **Type**: Error Handling
- **Root Cause**: Same as BUG-1020/1021/1022
- **Fix**: Same pattern - return 404 instead of 500

### BUG-1031: Validate Value Returns 500
- **Severity**: Low
- **Type**: Error Handling
- **Root Cause**: Item not found or validation logic exception
- **Fix**: Add proper error handling in validation logic

---

## Root Cause Analysis

### Primary Issues
1. **Inadequate Error Handling**: 10 out of 11 bugs are due to unhandled exceptions returning 500 instead of proper HTTP status codes
2. **Missing Validation**: No pre-flight checks for foreign key constraints
3. **Poor Exception Messages**: Generic "系统内部错误" instead of specific messages

### Pattern Analysis
```
Common Pattern:
entity = repository.findById(id)
    .orElseThrow(() -> new RuntimeException("...")); // ← Throws 500

Should Be:
entity = repository.findById(id)
    .orElseThrow(() -> new EntityNotFoundException("...", 404)); // ← Returns 404
```

---

## Recommended Fixes

### 1. Create Custom Exceptions
```java
// File: backend-java/src/main/java/com/cretas/aims/exception/EntityNotFoundException.java
public class EntityNotFoundException extends RuntimeException {
    private final int statusCode;

    public EntityNotFoundException(String message) {
        super(message);
        this.statusCode = 404;
    }
}

// File: backend-java/src/main/java/com/cretas/aims/exception/ValidationException.java
public class ValidationException extends RuntimeException {
    private final int statusCode;

    public ValidationException(String message) {
        super(message);
        this.statusCode = 400;
    }
}
```

### 2. Add Global Exception Handler
```java
// File: backend-java/src/main/java/com/cretas/aims/config/GlobalExceptionHandler.java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<?>> handleNotFound(EntityNotFoundException e) {
        return ResponseEntity.status(404)
            .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<?>> handleValidation(ValidationException e) {
        return ResponseEntity.status(400)
            .body(ApiResponse.error(e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleGeneral(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(500)
            .body(ApiResponse.error("系统内部错误，请联系管理员"));
    }
}
```

### 3. Update Repository Methods
```java
// Change from:
.orElseThrow(() -> new RuntimeException("Not found"));

// To:
.orElseThrow(() -> new EntityNotFoundException("Quality check item not found: " + id));
```

---

## Test Coverage Gaps

### Missing Test Scenarios
1. Create item with valid data and verify creation
2. Test category filtering with existing data
3. Test binding creation with valid foreign keys
4. Test pagination with large datasets
5. Test concurrent updates
6. Test soft delete behavior

### Suggested Integration Tests
```java
@Test
public void testCreateQualityCheckItem_Success() {
    // Given
    CreateQualityCheckItemRequest request = new CreateQualityCheckItemRequest();
    request.setItemCode("TEST001");
    request.setItemName("Test Item");
    request.setCategory(QualityCheckCategory.APPEARANCE);

    // When
    ResponseEntity<ApiResponse<QualityCheckItemDTO>> response =
        controller.create("F001", request, mockRequest);

    // Then
    assertEquals(200, response.getStatusCodeValue());
    assertTrue(response.getBody().isSuccess());
    assertNotNull(response.getBody().getData().getId());
}

@Test
public void testGetQualityCheckItem_NotFound() {
    // When
    ResponseEntity<ApiResponse<QualityCheckItemDTO>> response =
        controller.getById("F001", "nonexistent-id");

    // Then
    assertEquals(404, response.getStatusCodeValue());
    assertFalse(response.getBody().isSuccess());
    assertEquals("Quality check item not found: nonexistent-id",
        response.getBody().getMessage());
}
```

---

## Priority Matrix

| Priority | BUG IDs | Impact | Effort | When to Fix |
|----------|---------|--------|--------|-------------|
| Critical | 1017, 1019, 1025 | High | Medium | Immediately |
| High | 1007, 1009 | Medium | Low | This Sprint |
| Medium | 1020, 1021, 1022 | Low | Low | This Sprint |
| Low | 1027, 1028, 1031 | Low | Low | Next Sprint |

---

## Estimated Fix Time

- **Critical BUGs (3)**: 4-6 hours
- **High Priority (2)**: 2-3 hours
- **Medium Priority (3)**: 2-3 hours
- **Low Priority (3)**: 1-2 hours
- **Global Exception Handler**: 2-3 hours
- **Integration Tests**: 4-6 hours

**Total Estimated Time**: 15-23 hours (2-3 days)

---

**Report Generated**: 2026-01-01
**Next Review**: After fixes are implemented
