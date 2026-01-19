# AI 意图识别 v7.0 完整测试计划

## 测试环境

| 环境 | URL | 说明 |
|------|-----|------|
| 后端 API | `http://139.196.165.140:10010` | 生产服务器 |
| 测试端点 | `/api/public/ai-demo/execute` | 无需认证 |

---

## 一、后端 API 测试

### 1.1 意图识别修复测试 (Phase 1)

**目标**: 验证短语映射已移到语义匹配之后，"创建"动词能被正确识别

| 测试ID | 输入 | 期望意图 | 期望状态 | 验证点 |
|--------|------|----------|----------|--------|
| T1.1 | "创建原料批次" | MATERIAL_BATCH_CREATE | NO_PERMISSION | 语义识别"创建"动词 |
| T1.2 | "查询原料批次" | MATERIAL_BATCH_QUERY | SUCCESS | 查询正常执行 |
| T1.3 | "新建一个原料批次" | MATERIAL_BATCH_CREATE | NO_PERMISSION | "新建"同义词 |
| T1.4 | "添加原料批次" | MATERIAL_BATCH_CREATE | NO_PERMISSION | "添加"同义词 |
| T1.5 | "原料批次列表" | MATERIAL_BATCH_QUERY | SUCCESS | 无动词默认查询 |
| T1.6 | "帮我录入原料批次" | MATERIAL_BATCH_CREATE | NO_PERMISSION | "录入"动词 |

**测试脚本**:
```bash
# T1.1 - 创建原料批次
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d '{"userInput": "创建原料批次"}' | jq '.data.intentCode, .data.status'

# 期望输出: "MATERIAL_BATCH_CREATE" "NO_PERMISSION"

# T1.2 - 查询原料批次
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d '{"userInput": "查询原料批次"}' | jq '.data.intentCode, .data.status'

# 期望输出: "MATERIAL_BATCH_QUERY" "SUCCESS"
```

---

### 1.2 分析路由测试 (Phase 2)

**目标**: 验证 GENERAL_QUESTION + 业务关键词 能触发分析流程

| 测试ID | 输入 | 期望行为 | 验证点 |
|--------|------|----------|--------|
| T2.1 | "产品状态怎么样" | 分析路由 → 调用Tool → 综合报告 | 包含数据和行业建议 |
| T2.2 | "库存情况如何" | 分析路由 → 库存数据分析 | 包含库存周转建议 |
| T2.3 | "今天出货情况" | 分析路由 → 出货数据分析 | 包含出货统计 |
| T2.4 | "质检结果怎么样" | 分析路由 → 质检数据分析 | 包含合格率统计 |
| T2.5 | "天气怎么样" | NOT_RECOGNIZED | 非业务问题拒绝 |
| T2.6 | "你好" | CONVERSATIONAL | 普通对话响应 |

**测试脚本**:
```bash
# T2.1 - 产品状态分析
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d '{"userInput": "产品状态怎么样"}' | jq '.data.formattedText'

# 验证: 返回包含数据统计和行业建议的分析报告

# T2.5 - 非业务问题
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d '{"userInput": "天气怎么样"}' | jq '.data.intentCode'

# 期望输出: "NOT_RECOGNIZED" 或通用回复
```

---

### 1.3 复杂度路由测试 (Phase 3)

**目标**: 验证不同复杂度的查询被路由到正确的处理模式

| 测试ID | 输入 | 期望模式 | 验证点 |
|--------|------|----------|--------|
| T3.1 | "查一下原料库存" | FAST | 简单查询 |
| T3.2 | "产品状态怎么样" | ANALYSIS | 需要数据整合 |
| T3.3 | "对比本周和上周的产量" | MULTI_AGENT | 多维度分析 |
| T3.4 | "分析产量下降的原因并给出改进建议" | DEEP_REASONING | 因果分析+建议 |

---

### 1.4 评分互斥测试 (防过拟合)

**目标**: 验证短语匹配和关键词匹配不会叠加过度加分

| 测试ID | 输入 | 期望行为 | 验证点 |
|--------|------|----------|--------|
| T4.1 | "创建原料批次信息" | 置信度 ≤ 0.95 | 不会因短语+关键词双重加分超过阈值 |
| T4.2 | "查询所有原料批次记录" | 置信度合理 | 评分在合理范围 |

---

## 二、前端集成测试

### 2.1 测试环境准备

```bash
# 启动前端开发服务器
cd frontend/CretasFoodTrace
npm start
```

### 2.2 AI 助手界面测试

| 测试ID | 操作步骤 | 期望结果 |
|--------|----------|----------|
| F1 | 打开 AI 助手页面 | 显示输入框和历史记录 |
| F2 | 输入 "创建原料批次" 并发送 | 显示无权限提示 |
| F3 | 输入 "查询原料批次" 并发送 | 显示原料批次列表 |
| F4 | 输入 "产品状态怎么样" 并发送 | 显示综合分析报告 |
| F5 | 输入 "你好" 并发送 | 显示问候回复 |

### 2.3 错误处理测试

| 测试ID | 场景 | 期望结果 |
|--------|------|----------|
| E1 | 网络断开时发送消息 | 显示网络错误提示 |
| E2 | 后端超时 (>30s) | 显示超时提示 |
| E3 | 后端返回错误 | 显示错误信息，不崩溃 |

---

## 三、多轮对话测试

### 3.1 上下文保持测试

| 轮次 | 用户输入 | 期望响应 | 验证点 |
|------|----------|----------|--------|
| 1 | "查询原料批次" | 显示批次列表 | 正常响应 |
| 2 | "第一条的详情" | 显示第一条批次详情 | 理解上下文"第一条" |
| 3 | "它的质检结果呢" | 显示该批次质检结果 | 理解代词"它" |
| 4 | "有问题吗" | 分析质检是否有异常 | 理解隐式主题 |

**测试脚本**:
```bash
# 多轮对话需要传递 conversationId
SESSION_ID="test-$(date +%s)"

# 轮次1
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d "{\"userInput\": \"查询原料批次\", \"conversationId\": \"$SESSION_ID\"}"

# 轮次2
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d "{\"userInput\": \"第一条的详情\", \"conversationId\": \"$SESSION_ID\"}"

# 轮次3
curl -X POST http://139.196.165.140:10010/api/public/ai-demo/execute \
  -H "Content-Type: application/json" \
  -d "{\"userInput\": \"它的质检结果呢\", \"conversationId\": \"$SESSION_ID\"}"
```

### 3.2 话题切换测试

| 轮次 | 用户输入 | 期望响应 | 验证点 |
|------|----------|----------|--------|
| 1 | "产品状态怎么样" | 产品状态分析 | 分析路由 |
| 2 | "库存呢" | 库存状态分析 | 话题切换到库存 |
| 3 | "回到刚才的产品" | 产品状态分析 | 恢复之前话题 |

### 3.3 澄清对话测试

| 轮次 | 用户输入 | 期望响应 | 验证点 |
|------|----------|----------|--------|
| 1 | "批次" | 询问"您是要查询还是创建批次？" | 模糊意图澄清 |
| 2 | "查询" | 显示批次列表 | 根据澄清执行 |

---

## 四、流程对比测试 (Before/After)

### 4.1 意图识别对比

| 输入 | v6.0 (修复前) | v7.0 (修复后) |
|------|---------------|---------------|
| "创建原料批次" | ❌ MATERIAL_BATCH_QUERY (短语优先匹配到"原料批次") | ✅ MATERIAL_BATCH_CREATE (语义识别"创建") |
| "新建原料批次" | ❌ MATERIAL_BATCH_QUERY | ✅ MATERIAL_BATCH_CREATE |
| "添加原料批次" | ❌ MATERIAL_BATCH_QUERY | ✅ MATERIAL_BATCH_CREATE |
| "录入原料批次" | ❌ MATERIAL_BATCH_QUERY | ✅ MATERIAL_BATCH_CREATE |

### 4.2 GENERAL_QUESTION 处理对比

| 输入 | v6.0 (修复前) | v7.0 (修复后) |
|------|---------------|---------------|
| "产品状态怎么样" | ❌ 返回预计算报告摘要 | ✅ 调用Tool获取实时数据 + 行业知识分析 |
| "库存情况如何" | ❌ 静态回复 | ✅ 实时库存统计 + 周转建议 |
| "质检结果怎么样" | ❌ 通用回答 | ✅ 实时质检数据 + 合格率分析 |

### 4.3 响应时间对比

| 场景 | v6.0 | v7.0 | 说明 |
|------|------|------|------|
| 简单查询 | ~200ms | ~200ms | 无明显变化 |
| 分析请求 | ~300ms | ~800ms | 增加了Tool调用和分析 |
| 复杂分析 | N/A | ~2000ms | 新增多Agent协作 |

---

## 五、自动化测试脚本

### 5.1 批量测试脚本

```bash
#!/bin/bash
# test_ai_intent_v7.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 测试函数
test_intent() {
    local input="$1"
    local expected_intent="$2"
    local expected_status="$3"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}")

    actual_intent=$(echo "$result" | jq -r '.data.intentCode')
    actual_status=$(echo "$result" | jq -r '.data.status')

    if [[ "$actual_intent" == "$expected_intent" ]]; then
        echo -e "${GREEN}✓${NC} 意图匹配: $input → $actual_intent"
        if [[ -n "$expected_status" && "$actual_status" == "$expected_status" ]]; then
            echo -e "  ${GREEN}✓${NC} 状态正确: $actual_status"
        elif [[ -n "$expected_status" ]]; then
            echo -e "  ${YELLOW}⚠${NC} 状态不匹配: 期望 $expected_status, 实际 $actual_status"
        fi
        return 0
    else
        echo -e "${RED}✗${NC} 意图不匹配: $input"
        echo -e "  期望: $expected_intent, 实际: $actual_intent"
        return 1
    fi
}

# 测试分析响应
test_analysis() {
    local input="$1"
    local keywords="$2"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}")

    formatted_text=$(echo "$result" | jq -r '.data.formattedText')

    if echo "$formatted_text" | grep -q "$keywords"; then
        echo -e "${GREEN}✓${NC} 分析包含关键词: $input → 包含 '$keywords'"
        return 0
    else
        echo -e "${RED}✗${NC} 分析缺少关键词: $input"
        echo -e "  期望包含: $keywords"
        echo -e "  实际响应: ${formatted_text:0:100}..."
        return 1
    fi
}

echo "=========================================="
echo "AI 意图识别 v7.0 自动化测试"
echo "=========================================="
echo ""

# Phase 1: 意图识别测试
echo "--- Phase 1: 意图识别修复测试 ---"
test_intent "创建原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "查询原料批次" "MATERIAL_BATCH_QUERY" "SUCCESS"
test_intent "新建一个原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "添加原料批次" "MATERIAL_BATCH_CREATE" "NO_PERMISSION"
test_intent "原料批次列表" "MATERIAL_BATCH_QUERY" "SUCCESS"
echo ""

# Phase 2: 分析路由测试
echo "--- Phase 2: 分析路由测试 ---"
test_analysis "产品状态怎么样" "状态"
test_analysis "库存情况如何" "库存"
echo ""

# Phase 3: 边界测试
echo "--- Phase 3: 边界测试 ---"
test_intent "天气怎么样" "NOT_RECOGNIZED" ""
test_intent "你好" "CONVERSATIONAL" ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
```

### 5.2 多轮对话测试脚本

```bash
#!/bin/bash
# test_multi_turn.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"
SESSION_ID="test-multi-turn-$(date +%s)"

echo "多轮对话测试 (Session: $SESSION_ID)"
echo "=========================================="

# 轮次1
echo "轮次1: 查询原料批次"
curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\": \"查询原料批次\", \"conversationId\": \"$SESSION_ID\"}" | jq '.data.formattedText'
echo ""

sleep 1

# 轮次2
echo "轮次2: 第一条的详情"
curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\": \"第一条的详情\", \"conversationId\": \"$SESSION_ID\"}" | jq '.data.formattedText'
echo ""

sleep 1

# 轮次3
echo "轮次3: 它的质检结果呢"
curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"userInput\": \"它的质检结果呢\", \"conversationId\": \"$SESSION_ID\"}" | jq '.data.formattedText'
echo ""

echo "=========================================="
echo "多轮对话测试完成"
```

### 5.3 性能测试脚本

```bash
#!/bin/bash
# test_performance.sh

API_URL="http://139.196.165.140:10010/api/public/ai-demo/execute"

test_latency() {
    local input="$1"
    local label="$2"

    start_time=$(date +%s%3N)
    curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"userInput\": \"$input\"}" > /dev/null
    end_time=$(date +%s%3N)

    latency=$((end_time - start_time))
    echo "$label: ${latency}ms"
}

echo "性能测试"
echo "=========================================="

test_latency "查询原料批次" "简单查询"
test_latency "产品状态怎么样" "分析请求"
test_latency "对比本周和上周的产量" "复杂分析"

echo "=========================================="
```

---

## 六、测试检查清单

### 6.1 上线前检查

- [ ] T1.1-T1.6: 意图识别修复测试全部通过
- [ ] T2.1-T2.6: 分析路由测试全部通过
- [ ] 多轮对话上下文保持正常
- [ ] 响应时间在可接受范围内
- [ ] 错误处理正常，不会崩溃

### 6.2 回归测试

- [ ] 原有功能未受影响
- [ ] 查询类意图正常工作
- [ ] 权限控制正常
- [ ] 日志记录正常

---

## 七、问题记录模板

```markdown
### 问题 #X

**发现时间**: YYYY-MM-DD HH:MM
**测试用例**: T1.1 / F2 / 等
**输入**: "用户输入内容"
**期望结果**: ...
**实际结果**: ...
**错误日志**: (如有)
**状态**: 待修复 / 已修复 / 已验证
```

---

## 八、联系方式

如有问题，请联系开发团队。
