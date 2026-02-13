# 食品知识库 RAG 系统 3 项改进方案 — Agent Team 研究报告

**日期**: 2026-02-13
**模式**: Full (5 agents)
**语言**: Chinese

---

## 执行摘要

针对食品知识库 RAG 系统 3 个改进方向进行了深度研究，当前系统状态：
- **检索质量**: MRR=0.9640, nDCG=0.9704, 2 个 miss (beverage CIP, catering 管理人员)
- **回答质量**: 4.29/5.00, citation_quality=3.70/5 (最弱维度)
- **反馈机制**: 后端 API 已部署, 前端未集成

### 核心建议

| 优先级 | 改进 | 预期收益 | 工时 |
|--------|------|---------|------|
| P0 | 补充 3 篇靶向文档 + 修复引用 prompt | MRR→0.98+, citation→4.2+ | 4-6h |
| P1 | 补充 8 篇弱分类文档 + RN 反馈组件 | 覆盖 8 弱分类 | 8-12h |
| P2 | Vue 反馈集成 + 完整日志分析 | 闭环持续优化 | 12-16h |

---

## 方向 A: 文档补充 (修复 2 个 miss + 8 个弱分类)

### 问题诊断

| Miss | 查询 | 当前匹配 | 相似度 | 根因 |
|------|------|---------|--------|------|
| 1 | "饮料生产线CIP清洗系统设计与验证" | 通用CIP文档 | 0.8287 | 缺饮料专用CIP文档 |
| 2 | "餐饮服务单位食品安全管理人员配备要求" | 通用管理员文档 | 0.7779 | 缺餐饮专用管理人员文档 |

### P0 文档设计 (3 篇, 4h)

#### 文档 A1: 饮料生产线 CIP 清洗系统
```
分类: process
标题: 饮料生产线CIP清洗系统设计与验证规范
内容要点:
- CIP 系统组成: 碱液罐(NaOH 1.5-2.5%)、酸液罐(HNO3 0.8-1.5%)、热水罐(85-95°C)、清水罐
- 饮料专用参数:
  * 含乳饮料: 碱洗 75°C/20min → 酸洗 65°C/15min → 热水冲洗 85°C/10min
  * 果汁饮料: 碱洗 70°C/15min → 热水冲洗 80°C/10min (无酸洗)
  * 碳酸饮料: 碱洗 65°C/15min → 清水冲洗 → 消毒(200ppm ClO₂/10min)
- 验证要求: ATP检测 <100 RLU, 电导率 <50 μS/cm, 微生物 <10 CFU/mL
- 法规依据: GB 12695-2016 饮料生产卫生规范
关键词: CIP, 清洗, 饮料, 碱洗, 酸洗, 验证, ATP, 管路清洗
字数: ~1500
```

#### 文档 A2: 餐饮服务食品安全管理人员配备
```
分类: regulation
标题: 餐饮服务食品安全管理人员配备与职责要求
内容要点:
- 法规依据: 《餐饮服务食品安全操作规范》(2018)、《食品安全法》第33条
- 配备标准:
  * 特大型餐饮(>3000㎡): ≥2名专职, 持高级食品安全管理员证
  * 大型(500-3000㎡): ≥1名专职
  * 中型(150-500㎡): ≥1名兼职
  * 小型(<150㎡): 经营者兼任
- 职责: 进货查验、从业人员健康管理、食品留样、设备维护、应急处理
- 培训: 每年≥40学时, 抽查考核≥90分
- 学校/养老机构: 必须配备专职, 且持证上岗
关键词: 餐饮, 管理人员, 配备, 专职, 兼职, 培训, 学校食堂
字数: ~1200
```

#### 文档 A3: 水产品冷链物流温度控制 (弱分类 aquatic)
```
分类: process
标题: 水产品冷链物流全程温度控制规范
内容要点:
- 鲜活水产: 运输水温控制, 充氧, 密度要求
- 冷鲜水产: 0-4°C, 货架期 3-7天
- 冷冻水产: -18°C以下, 温度波动 ≤±2°C
- 金枪鱼等深海鱼: -60°C超低温
- 法规: GB 31621-2014, SC/T 9001
关键词: 水产, 冷链, 温度, 运输, 鲜活, 冷冻
字数: ~1000
```

### P1 文档设计 (8 篇, 8h)

| # | 分类 | 标题 | 目标弱分类 |
|---|------|------|-----------|
| 4 | process | 啤酒发酵工艺参数与质量控制 | beverage |
| 5 | process | 碳酸饮料灌装线卫生管理 | beverage |
| 6 | regulation | 学校食堂食品安全管理规范 | catering |
| 7 | sop | 餐饮单位食品安全应急处置预案 | catering |
| 8 | process | 食用油精炼脱色脱臭工艺控制 | edible_oil |
| 9 | process | 烘焙制品微生物控制与货架期管理 | bakery |
| 10 | process | 粮食仓储害虫防治与熏蒸规范 | grain |
| 11 | haccp | 食品接触材料迁移测试方法 | contact_material |

### P2 文档设计 (11 篇, 后续补充)

覆盖: NFC果汁、功能饮料、养老机构餐饮、中央厨房配送、花生油黄曲霉、
面包酵母管理、稻谷储藏、水产品解冻、食用油掺假检测、接触材料检测认证

---

## 方向 B: LLM 引用质量优化 (citation_quality 3.70→4.2+)

### 问题诊断

**当前 prompt** (位于 `backend/python/food_kb/services/knowledge.py`):
```python
ANSWER_PROMPT = """基于以下参考文档回答用户问题。
要求:
1. 只使用参考文档中的信息
2. 如果文档不足以回答，明确说明
3. 回答要专业、准确、有条理

参考文档:
{context}

用户问题: {question}
"""
```

**根因分析**:
- prompt 中没有要求引用 `[文档N]` 标记
- `format_documents()` 函数没有给文档编号标记
- LLM 回答时没有引用线索可以参考

### 修复方案

#### Phase 1: Prompt 重写 (2h)

**文件**: `backend/python/food_kb/services/knowledge.py`

```python
SYSTEM_PROMPT = """你是一位食品安全领域的专业顾问，拥有食品科学硕士学位和10年食品安全咨询经验。
你的回答必须:
- 严格基于提供的参考文档
- 使用【文档N】格式标注每个事实的来源
- 如果参考文档不足以回答，明确说明哪些方面缺乏文档支持"""

ANSWER_PROMPT = """请基于以下参考文档回答用户问题。

★ 引用规则（必须遵守）:
1. 每个具体数值、标准号、法规条款后面必须标注来源，格式: 【文档N】
2. 同一段落引用多个文档时分别标注: ...【文档1】...【文档3】
3. 如果某条信息来自多个文档，标注所有来源: ...【文档1, 文档3】
4. 没有文档支持的推断必须标注"（基于专业经验，非文档内容）"

★ 回答格式:
- 先给出直接回答（1-2句话 + 引用）
- 再展开详细说明（每个要点都有引用）
- 最后给出实操建议

参考文档:
{context}

用户问题: {question}

请按上述规则回答，确保每个事实性陈述都有【文档N】引用标注。"""
```

**`format_documents()` 增强**:
```python
def format_documents(docs: list) -> str:
    parts = []
    for i, doc in enumerate(docs, 1):
        title = doc.get('title', '未知文档')
        content = doc.get('content', '')
        category = doc.get('category', '')
        parts.append(f"【文档{i}】{title} (分类: {category})\n{content}")

    parts.append("\n---\n引用指南: 回答中请使用【文档1】~【文档{n}】标注信息来源。".format(n=len(docs)))
    return "\n\n".join(parts)
```

#### Phase 2: 回答质量验证 (1h)

修改 `eval_answer_quality.py` 的评分维度权重:
```python
DIMENSION_WEIGHTS = {
    "accuracy": 0.30,      # 40% → 30%
    "hallucination": 0.20,  # 不变
    "completeness": 0.15,   # 20% → 15%
    "citation": 0.25,       # 10% → 25% ★ 大幅提升
    "actionability": 0.10   # 不变
}
```

### 关键风险 (Critic 指出)

> **答案生成位置不确定**: 需确认是 Python `knowledge.py` 还是 Java `FoodKnowledgeIntentHandler.java` 生成最终回答。如果 Java 端也有 prompt，则需要同步修改。

**验证步骤**:
1. 检查 Java `FoodKnowledgeIntentHandler.java` 是否包含自己的 answer prompt
2. 检查 Python `/api/food-kb/query` 端点返回的是最终回答还是原始文档
3. 确认端到端调用链: RN → Java → Python → LLM → 回答

---

## 方向 C: 用户反馈收集机制

### 当前状态

- **后端 API**: ✅ 已部署 (`food_kb_feedback` + `food_kb_query_log` 表)
- **Python endpoints**: ✅ `/api/food-kb/feedback` (POST) + `/api/food-kb/query-log` (POST)
- **Java 集成**: ❌ 未实现
- **前端 (RN)**: ❌ 未实现
- **前端 (Vue)**: ❌ 未实现

### Java 集成 (4h)

**新建**: `backend-java/src/main/java/com/cretas/aims/controller/FoodKBFeedbackController.java`
```java
@RestController
@RequestMapping("/api/mobile/{factoryId}/food-kb")
public class FoodKBFeedbackController {

    @Autowired
    private PythonSmartBIClient pythonClient;

    @PostMapping("/feedback")
    public ResponseEntity<?> submitFeedback(
            @PathVariable String factoryId,
            @RequestBody FeedbackRequest request,
            @AuthenticationPrincipal UserDetails user) {
        // 转发到 Python 食品知识库服务
        request.setUserId(user.getUsername());
        request.setFactoryId(factoryId);
        return pythonClient.submitFoodKBFeedback(request);
    }
}
```

**修改**: `PythonSmartBIClient.java` 添加 `submitFoodKBFeedback()` 方法

### RN 前端 (React Native) (8h)

**新建**: `frontend/CretasFoodTrace/src/components/ai/FeedbackWidget.tsx`
```typescript
// 轻量反馈组件: 👍/👎 + 可选文字反馈
interface FeedbackWidgetProps {
  queryId: string;
  question: string;
  answer: string;
  onSubmit?: (feedback: FeedbackData) => void;
}

// 核心交互:
// 1. AI 回答后显示 👍 👎 按钮
// 2. 点击 👎 展开反馈表单 (多选: 不准确/不完整/不相关/其他 + 文本框)
// 3. 提交后显示"感谢反馈"
// 4. 数据发送到 /api/mobile/{factoryId}/food-kb/feedback
```

**集成位置**: 在现有 AI 聊天回答组件下方添加 `<FeedbackWidget />`

### Vue 前端 (Web Admin) (4h)

**修改**: `web-admin/src/views/smart-bi/AIQuery.vue`
- 在 AI 回答区域添加反馈工具栏
- 复用 Element Plus 的 Rate 组件做满意度评分
- 不满意时展开详细反馈表单

### 查询日志自动记录 (2h)

在 Java 端的 `FoodKnowledgeIntentHandler` 中，每次查询自动记录:
```java
// 查询完成后异步记录
asyncLogService.logFoodKBQuery(LogEntry.builder()
    .question(userQuery)
    .answer(llmResponse)
    .retrievedDocs(docIds)
    .responseTime(elapsed)
    .userId(currentUser)
    .build());
```

---

## Critic 核心挑战

### 挑战 1: "4h 修复 2 个 miss" 严重低估
> 文档编写需要查证权威数据 (GB标准具体参数)，不是拍脑袋写。每篇高质量文档需要 WebSearch 验证 + 结构化编写 + 入库 + 回归测试，实际需 6-8h。

**应对**: 接受。文档编写确实需要查证，时间调整为 4-6h (3篇P0)。

### 挑战 2: Prompt 修改位置可能错误
> 如果 Java 端 `FoodKnowledgeIntentHandler` 重新组装了 prompt 或后处理了回答，仅修改 Python 端 prompt 无效。

**应对**: ★ 这是 P0 阻塞项。实施前必须先确认端到端调用链。

### 挑战 3: 27h 跨 4 层修改的维护负担
> 对 1 人团队来说，同时修改 Python prompt + Java controller + RN component + Vue component 的维护负担过重。

**应对**: 分阶段实施。P0 只做 prompt 修改 (Python 2h)。P1 只做 RN 反馈 (8h)。Vue 反馈放 P2。

### 挑战 4: MRR 0.9586→0.9640 可能不显著
> 42 个分类只有 189 个查询，每个分类 ~4.5 个查询，单个查询的改善可能是随机波动。

**应对**: 有效观点。需要扩展评估集 (目标: 每分类 10+ 查询) 来确认改善是否稳定。

### 挑战 5: 引用格式可能降低可读性
> 过多 【文档N】 标记会打断阅读流。用户（食品企业工人）可能不关心引用。

**应对**: 平衡方案 — 关键数值必须引用，解释性内容可以不标注。添加用户偏好设置。

---

## 实施路线图

### 第 1 步: 确认调用链 (2h) ★ 阻塞项
```
RN/Vue → Java FoodKnowledgeIntentHandler → Python /api/food-kb/query → LLM
                    ↑                              ↑
            检查这里是否有 prompt           检查这里的 prompt
```

### 第 2 步: P0 实施 (6h)
1. 修复 Python `knowledge.py` 的 ANSWER_PROMPT + format_documents() (2h)
2. 编写 3 篇 P0 文档 (beverage CIP, catering 管理人员, aquatic 冷链) (3h)
3. 入库 + 回归测试 (1h)

### 第 3 步: P1 实施 (10h)
1. 编写 8 篇 P1 文档 (6h)
2. RN FeedbackWidget 组件 (4h)

### 第 4 步: P2 实施 (8h)
1. Vue 反馈集成 (4h)
2. Java FeedbackController (2h)
3. 查询日志自动记录 (2h)

---

## 预期效果

| 指标 | 当前 | P0 后 | P1 后 | P2 后 |
|------|------|-------|-------|-------|
| MRR | 0.9640 | 0.98+ | 0.99+ | 持续优化 |
| miss数 | 2 | 0 | 0 | 0 |
| citation_quality | 3.70 | 4.2+ | 4.2+ | 4.5+ (数据驱动) |
| 弱分类数 | 8 | 7 | 0 | 0 |
| 反馈收集 | 无 | 无 | RN端 | RN+Vue |
| 回答总分 | 4.29 | 4.5+ | 4.5+ | 4.7+ |

---

### Process Note
- Mode: Full (5 agents)
- Researchers deployed: 3 (haiku)
- Analyst: 1 (sonnet), Critic: 1 (sonnet), Integrator: 1 (haiku)
- Key disagreements: 2 resolved (时间估计调整, 分阶段实施), 1 unresolved (MRR 统计显著性)
- Phases completed: Research → Analysis → Critique → Integration
