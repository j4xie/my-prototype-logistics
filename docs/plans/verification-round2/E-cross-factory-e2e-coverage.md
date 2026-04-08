# Cross-Factory E2E 测试覆盖度审计

**审计日期**: 2026-04-07
**审计范围**: commit `7526a254` (factoryId 隔离) + `4c03b9d4` (Transfer 7 状态机)
**V3 W1 DoD 第 3 项**: "跨工厂 E2E 自动化回归用例覆盖率 100%"

---

## 1. 现状扫描

| 指标 | 数值 |
|------|------|
| Java 单测文件总数 (`*Test.java`) | **76** |
| 提及 `factoryId` / `F002` / `differentFactory` 的测试文件 | **8** |
| 其中真正做"跨工厂隔离"断言的 | **1** (`MultiFactoryDataIsolationTest`，仅 calibration 模块) |
| 涉及 `SampleApprove` / `InvoiceApprove` / `TransferDetail` 三个被修复 Tool 的测试 | **0** |
| 项目根 `test-*.mjs` 文件总数 | **36** |
| `test-*.mjs` 中提及 `factoryId` 的 | **14** (但全部使用同一个 factoryId, 不构造跨工厂场景) |
| 真正构造"用户A 跨访 工厂B 数据"的 E2E | **0** |

**结论**: V3 W1 DoD 第 3 项 **未达成**。除 `MultiFactoryDataIsolationTest` 覆盖 calibration 模块外，本次修复的 3 个 Tool + 7 个 Transfer 状态机方法 **零测试覆盖**。

---

## 2. 覆盖缺口清单

| 修复点 | Commit | 跨工厂单测 | 跨工厂 E2E | 状态 |
|---|---|---|---|---|
| `SampleApproveTool` factoryId 校验 | 7526a254 | ❌ 无 | ❌ 无 | **漏** |
| `InvoiceApproveTool` factoryId 校验 | 7526a254 | ❌ 无 | ❌ 无 | **漏** |
| `TransferDetailTool` factoryId 校验 | 7526a254 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.approveTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.rejectTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.shipTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.receiveTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.cancelTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.completeTransfer` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |
| `TransferService.getDetail` | 4c03b9d4 | ❌ 无 | ❌ 无 | **漏** |

**审计脚本** (`scripts/audit-cross-factory.sh`) 已加入 CI，但只能静态扫描代码 pattern，**不能验证运行时实际行为**。

---

## 3. 必写测试清单

### 单元测试 (Java, JUnit5 + Mockito)

#### 测试 1: `ProductSampleServiceTest#approveSample_crossFactory_throws`
```java
@Test
void approveSample_whenSampleBelongsToOtherFactory_throwsIllegalArgumentException() {
    // given
    ProductSample sample = ProductSample.builder()
        .id("sample-001").factoryId("F002").status("PENDING").build();
    when(sampleRepo.findById("sample-001")).thenReturn(Optional.of(sample));
    // when / then
    assertThrows(IllegalArgumentException.class,
        () -> service.approveSample("F001", "sample-001", "approver"));
    verify(sampleRepo, never()).save(any());
}
```

#### 测试 2: `InvoiceServiceTest#approveInvoice_crossFactory_throws`
同上结构, 替换 entity = `Invoice`。

#### 测试 3: `TransferServiceTest#getDetail_crossFactory_returnsNotFound`
```java
@Test
void getDetail_whenTransferBelongsToOtherFactory_throwsResourceNotFound() {
    Transfer t = Transfer.builder().id("tr-1").factoryId("F002").build();
    when(transferRepo.findById("tr-1")).thenReturn(Optional.of(t));
    assertThrows(ResourceNotFoundException.class,
        () -> service.getDetail("F001", "tr-1"));
}
```

#### 测试 4-9: `TransferServiceTest` 7 状态机方法各一个跨工厂 case
参数化测试覆盖 approve/reject/ship/receive/cancel/complete/getDetail 全部 7 个方法。

```java
@ParameterizedTest
@MethodSource("transferStateMachineMethods")
void allStateMachineMethods_rejectCrossFactoryAccess(BiConsumer<TransferService,String> op) {
    Transfer t = Transfer.builder().id("tr-x").factoryId("F002").status("PENDING").build();
    when(transferRepo.findById("tr-x")).thenReturn(Optional.of(t));
    assertThrows(IllegalArgumentException.class, () -> op.accept(service, "F001"));
}
```

### E2E 测试 (Node, mjs)

#### 测试 10: `test-cross-factory-isolation.mjs` (新建)
覆盖完整 HTTP 请求路径，验证返回 403/404 而非 200。

```javascript
// 1. 准备: F001 用户 token, F002 中已存在 sampleId / invoiceId / transferId
// 2. F001 用户尝试以下请求, 期望 403/404:
const targets = [
  { method: 'POST', url: `/api/mobile/F001/samples/${F002_SAMPLE_ID}/approve` },
  { method: 'POST', url: `/api/mobile/F001/invoices/${F002_INVOICE_ID}/approve` },
  { method: 'GET',  url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/approve` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/reject` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/ship` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/receive` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/cancel` },
  { method: 'POST', url: `/api/mobile/F001/transfers/${F002_TRANSFER_ID}/complete` },
];
for (const t of targets) {
  const r = await fetch(BASE + t.url, { method: t.method, headers: f1Headers });
  assert([403, 404].includes(r.status), `${t.url} should be denied, got ${r.status}`);
}
```

#### 测试 11: `test-cross-factory-ai-intent.mjs` (新建)
通过 AI 意图入口验证 Tool 层防护（绕过 Controller 校验）：
- F001 用户对话 "审批 F002 的样品 sample-xxx" → 应明确拒绝
- F001 用户对话 "查询调拨单 transfer-xxx (F002)" → 应明确拒绝

---

## 4. CI 门禁建议

| 项目 | 状态 |
|---|---|
| 静态 audit 脚本 (`audit-cross-factory.sh`) | ✅ 已加 |
| Java 单测 (上述 4-9) | ❌ 待补 |
| E2E 跨工厂 mjs (上述 10-11) | ❌ 待补 |
| CI workflow 加 `node test-cross-factory-isolation.mjs` 步骤 | ❌ 待补 |
| 测试数据 fixture: 至少 2 个 factoryId (F001/F002) 且各有 sample/invoice/transfer | ⚠️ 需要 seed 脚本 |

**建议 PR 门禁**: 任何修改 `*ApproveTool` / `Transfer*Service` 的 PR, 必须新增/更新对应的 cross-factory test, 否则 CI 阻断。

---

## 5. 风险评分: **8/10** (高)

理由:
- 修复后零运行时测试 → 任何 regression 都不会被发现
- 静态 audit 只能查 pattern, 无法验证实际 SQL 是否带 factoryId 条件
- 现有 36 个 mjs E2E 全部用单一 factoryId, 形成"虚假覆盖"幻觉
- `MultiFactoryDataIsolationTest` 仅覆盖 calibration 模块, 不能外推
- V3 W1 DoD 第 3 项明确要求 100%, 实际接近 0%

降低到 **3/10** 的条件: 完成上述 11 个测试 + 加入 CI 门禁。

---

## 6. 估算工时

| 任务 | 工时 |
|---|---|
| 新建 Test fixture seed (F002 数据) | 1.5h |
| 单测 1-3 (Sample/Invoice/Transfer.getDetail) | 2h |
| 参数化单测 4-9 (7 个状态机方法) | 1.5h |
| E2E `test-cross-factory-isolation.mjs` | 2h |
| E2E `test-cross-factory-ai-intent.mjs` | 1.5h |
| CI workflow 接入 + 调试 | 1h |
| 文档 + PR review | 0.5h |
| **合计** | **10h (~1.5 人天)** |
