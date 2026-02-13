# 生产报工系统下一阶段3方向评估报告

**生成时间**: 2026-02-12
**研究主题**: 评估生产报工系统下一阶段3个方向的实施方案

---

## Executive Summary

**推荐优先顺序**：A(SmartBI自动同步) → C(NFC签到) → B(RN E2E测试)

- A方向业务价值最高且基础设施相对完备，但工期需从原估的2-3周**修正至4-6周**（ExcelParseResponse适配层复杂度被低估、双数据源事务管理、前端数据源入口改造）
- C方向react-native-nfc-manager完全未安装（零NFC代码），NfcCheckinScreen实为纯QR扫描。需3-4周开发+2周现场试点。抗金属标签成本$0.50-2.00/个（非$0.10）
- B方向测试框架4-5/10就绪（@testing-library/react-native已装、jest.config.js已配置），仅缺测试文件。可与A/C并行搭建

---

## Comparison Matrix (修正后)

| 维度 | A: SmartBI同步 | B: E2E测试 | C: NFC签到 |
|------|---------------|-----------|-----------|
| **基础设施就绪度** | 6-7/10 (三表架构+管道有, 适配层缺) | 4-5/10 (框架有, 测试文件缺) | 2-3/10 (QR有, NFC零代码) |
| **技术风险** | Med (ExcelParseResponse适配+双数据源事务) | Med (Detox兼容性未验证) | Med-High (工厂环境NFC干扰) |
| **业务价值** | High (管理层实时数据仪表板) | Med (代码质量保障) | High (车间考勤效率) |
| **预估工期** | 4-6周 | 3-4周(可并行) | 3-4周+2周试点 |
| **并行可能性** | 可与B/C并行(不同文件) | 可与A/C并行(纯测试层) | 可与A/B并行(前端vs后端) |

---

## Detailed Analysis

### 方向A: SmartBI自动同步管道

**现状**:
- SmartBI三表JSONB架构(uploads→field_definitions→dynamic_data)稳定运行
- 前端enrichment管道(SSE→enrichSheetAnalysis→charts+KPI+AI)可复用
- `ProductionReportRepository`已有聚合查询(GROUP BY report_date+category/product)
- `WorkReportingController`已有`POST /sync-smartbi` stub

**关键挑战**:
1. **ExcelParseResponse适配层(高风险)**: `persistDynamic()`需要`ExcelParseResponse`（7+嵌套字段），从`ProductionReport`到此DTO需从零构建映射。原分析师引用的`processAndSaveSheetData()`不存在
2. **双数据源事务(高风险)**: `cretas_db`和`smartbi_db`使用不同TransactionManager，跨DB同步需Saga/MQ显式管理
3. **前端展示改造**: SmartBI前端围绕"上传Excel→按sheet展示"设计，需新建数据源入口+自动刷新+时间筛选器

**工期**: 4-6周
- Week 1: ExcelParseResponse适配层 + 事务方案设计
- Week 2-3: 同步服务 + 触发机制(@Scheduled+ApplicationEvent混合)
- Week 4: 前端数据源入口 + 自动刷新
- Week 5-6: 测试 + 优化

### 方向B: RN动态表单E2E测试

**现状**:
- `@testing-library/react-native` v13.2.2已安装
- `jest.config.js`已配置(preset, moduleNameMapper, coverage thresholds 70%)
- `draftReportStore`(Zustand+AsyncStorage)可用`jest-mock-zustand`测试
- DynamicReportScreen(355行)和NfcCheckinScreen(317行)结构清晰
- **零测试文件**, 无Detox/Maestro配置

**四阶段策略**:
1. Jest单元测试: hooks/stores (1周)
2. RNTL集成测试: Screen组件 (1周)
3. Detox/Maestro E2E: APK行为验证 (1-2周)
4. 性能基准: 表单渲染<500ms (可选)

**风险**: Detox与Expo 53 custom build兼容性未验证。**建议同时评估Maestro**(Expo官方推荐)

### 方向C: NFC签到集成

**现状**:
- `NfcCheckinScreen.tsx`是**纯QR扫描**，零NFC代码
- `react-native-nfc-manager`未安装
- 后端`POST /checkin`已接受`checkinMethod`参数，传入"NFC"即可
- 项目已用custom native build(支持EAS Build集成)

**实现路径**:
1. 安装+配置(3-5天): react-native-nfc-manager → Android manifest → iOS Info.plist
2. NfcCheckinModal.tsx(5-7天): detect→read→checkin→QR fallback
3. 标签管理Admin Screen(3-5天): CRUD标签→员工映射
4. 硬件试点(1-2周): 20-50个标签, 3个关键岗位

**风险**: 工厂金属环境NFC干扰(普通标签可能完全失败), iOS后台NFC限制, 抗金属标签成本$0.50-2.00

---

## Decision Framework

| 场景 | 推荐 |
|------|------|
| 管理层需数据可视化 | A先行 |
| 工厂代签问题严重 | C先行(但需试点验证) |
| 频繁迭代表单schema | B先行 |
| 有2名开发者 | A+B或A+C并行 |
| A适配过于复杂 | 改为直接写入dynamic_data，跳过enrichment |
| C试点NFC失败 | 保留QR-only，NFC后续增强 |
| Detox不兼容 | 降级至RNTL+Maestro |

---

## Actionable Recommendations

### 立即行动(本周)
- 确认生产报工数据量级(日均条数)和实时性要求
- 采购20-50个NTAG213抗金属标签(¥3-15/个)做试点准备
- A方向POC: 完成ProductionReport→ExcelParseResponse映射文档

### 短期行动(2-3周)
- A: SmartBiUploadService适配层 + 事务协调 + 前端数据源tab
- C(并行): NfcCheckinModal.tsx + 标签试点(5个工作日)
- B(并行,低优先级): Jest单元测试 + RNTL集成测试

### 条件行动
- IF C试点失败 → 保留QR方案，成本/工期大幅下降
- IF A适配>3周 → 改为直接写dynamic_data，快速交付v1
- IF Detox不兼容 → 降级至集成+Maestro UI测试

---

## Open Questions

1. 生产报工数据规模: 日均多少条? 需实时(<5min)还是批量同步?
2. 工厂设备NFC支持率: Android/iOS比例? 现场EMI环境?
3. SmartBI非Excel数据适配: 无"sheet"概念时如何组织虚拟表?
4. 跨DB事务方案: Saga vs MQ vs Eventually Consistent?
5. CI/CD中E2E测试环境: Android模拟器? 成本?

---

## Confidence Levels

| 结论 | 置信度 |
|------|--------|
| 推荐顺序A→C→B | ★★★★★ (全团队一致) |
| A方向4-6周工期 | ★★★★☆ (ExcelParseResponse复杂度确认) |
| B方向4-5/10就绪度 | ★★★★☆ (代码审查确认) |
| C方向需2周试点 | ★★★☆☆ (环境干扰数据缺失) |
| 跨DB事务是A最大风险 | ★★★★☆ (TransactionManager独立确认) |

---

## Process Note

- Mode: Full
- Researchers deployed: 3 (SmartBI架构, RN E2E, NFC集成)
- Total sources found: 24 findings across 3 researchers
- Key disagreements: 3 resolved (基础设施评分修正), 2 unresolved (跨DB事务方案, Detox可行性)
- Phases completed: Research → Analysis → Critique → Integration
