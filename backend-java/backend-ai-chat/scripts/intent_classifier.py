"""
白垩纪食品溯源系统 - Intent 分类器
支持多意图识别、实体提取、上下文感知

混合方案: 规则引擎 + AI 增强
"""

from enum import Enum
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
import re
from datetime import datetime, timedelta
import os
from openai import OpenAI

# ==================== 意图类型定义 ====================
class IntentType(Enum):
    """用户意图类型"""

    # 查询类 (Query)
    QUERY_BATCH_STATUS = "query_batch_status"           # 查询批次状态
    QUERY_PRODUCTION_PROGRESS = "query_production"      # 查询生产进度
    QUERY_QUALITY_REPORT = "query_quality"              # 查询质量报告
    QUERY_COST_ANALYSIS = "query_cost"                  # 成本分析查询
    QUERY_SCHEDULE = "query_schedule"                   # 查询排程
    QUERY_WORKER_STATUS = "query_worker"                # 查询员工状态
    QUERY_MATERIAL_INVENTORY = "query_material"         # 查询物料库存

    # 操作类 (Action)
    CREATE_PLAN = "create_plan"                         # 创建生产计划
    UPDATE_SCHEDULE = "update_schedule"                 # 调整排程
    URGENT_INSERT = "urgent_insert"                     # 紧急插单
    CANCEL_PLAN = "cancel_plan"                         # 取消计划
    APPROVE_PLAN = "approve_plan"                       # 审批计划

    # 表单类 (Form)
    FORM_FILL = "form_fill"                             # 表单填充
    FORM_VALIDATE = "form_validate"                     # 表单验证
    FORM_SUGGEST = "form_suggest"                       # 表单建议

    # 分析类 (Analysis)
    ANALYZE_TREND = "analyze_trend"                     # 趋势分析
    COMPARE_PERFORMANCE = "compare_performance"         # 性能对比
    PREDICT_COMPLETION = "predict_completion"           # 完成预测
    OPTIMIZE_SUGGESTION = "optimize_suggestion"         # 优化建议
    ROOT_CAUSE_ANALYSIS = "root_cause_analysis"         # 根因分析

    # 通用类 (General)
    GREETING = "greeting"                               # 问候
    HELP = "help"                                       # 帮助
    THANKS = "thanks"                                   # 感谢
    CONFIRM = "confirm"                                 # 确认
    DENY = "deny"                                       # 否认
    UNKNOWN = "unknown"                                 # 未知意图


# ==================== 数据结构 ====================
@dataclass
class IntentResult:
    """意图识别结果"""
    primary_intent: IntentType                          # 主要意图
    confidence: float                                   # 置信度 (0-1)
    secondary_intents: List[Tuple[IntentType, float]] = field(default_factory=list)  # 次要意图
    entities: Dict[str, Any] = field(default_factory=dict)  # 提取的实体
    original_text: str = ""                             # 原始文本
    context_used: bool = False                          # 是否使用了上下文
    classification_method: str = "rule"                 # 分类方法: rule, ai, hybrid

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "primary_intent": self.primary_intent.value,
            "confidence": self.confidence,
            "secondary_intents": [(intent.value, conf) for intent, conf in self.secondary_intents],
            "entities": self.entities,
            "original_text": self.original_text,
            "context_used": self.context_used,
            "classification_method": self.classification_method
        }


# ==================== Intent Classifier ====================
class IntentClassifier:
    """意图分类器 - 规则引擎 + AI 增强"""

    def __init__(self, use_ai: bool = True, confidence_threshold: float = 0.6):
        """
        初始化意图分类器

        Args:
            use_ai: 是否使用 AI 增强分类 (DashScope)
            confidence_threshold: 置信度阈值，低于此值时使用 AI 增强
        """
        self.use_ai = use_ai
        self.confidence_threshold = confidence_threshold
        self._load_patterns()
        self._init_ai_client()

    def _init_ai_client(self):
        """初始化 AI 客户端"""
        dashscope_api_key = os.environ.get('DASHSCOPE_API_KEY', '')
        if self.use_ai and dashscope_api_key:
            self.ai_client = OpenAI(
                api_key=dashscope_api_key,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
            self.ai_model = os.environ.get('DASHSCOPE_MODEL', 'qwen-turbo')  # 使用快速模型
        else:
            self.ai_client = None

    def _load_patterns(self):
        """加载规则模式"""
        self.patterns = {
            # 查询类
            IntentType.QUERY_BATCH_STATUS: [
                r"查询?.*(批次|batch).*(状态|情况|进度)",
                r"(批次|batch).*(怎么样|如何|咋样|进展)",
                r"(查看|看看|查一下|看下).*(批次|batch)",
                r"(B-?\d{3,}|批次\s*[\d\-]+).*(状态|情况|怎么样)",
            ],
            IntentType.QUERY_PRODUCTION_PROGRESS: [
                r"(生产|产量|产出).*(进度|情况|多少|如何)",
                r"今天.*(生产|产|做)了.*(多少|几)",
                r"(完成|完工)了.*(多少|几)",
                r"(当前|现在).*(生产|进度)",
            ],
            IntentType.QUERY_QUALITY_REPORT: [
                r"(质检|质量|检验).*(报告|结果|情况)",
                r"(合格率|不良率|检测).*(怎么样|如何|多少)",
                r"(查看|查询|看看).*(质检|质量)",
            ],
            IntentType.QUERY_COST_ANALYSIS: [
                r"(成本|费用|开销).*(分析|统计|多少)",
                r"(花了|用了|消耗).*(多少|几)",
                r"(成本|费用).*(控制|优化)",
            ],
            IntentType.QUERY_SCHEDULE: [
                r"(排程|计划|安排).*(是什么|怎么样|如何)",
                r"(查看|查询|看看).*(排程|计划)",
                r"(今天|明天|本周).*(计划|安排)",
            ],
            IntentType.QUERY_WORKER_STATUS: [
                r"(员工|工人|人员).*(状态|情况|在岗)",
                r"(出勤|考勤).*(情况|统计)",
                r"(谁|哪些人).*(在|上班|工作)",
            ],
            IntentType.QUERY_MATERIAL_INVENTORY: [
                r"(物料|原料|材料).*(库存|剩余|还有)",
                r"(还有|剩).*(多少|几).*(物料|原料)",
                r"(库存|仓库).*(情况|统计)",
            ],

            # 操作类
            IntentType.URGENT_INSERT: [
                r"(紧急|加急|插单|临时|急).*(订单|生产|计划)",
                r"(插|加)一个.*(急|紧|单)",
                r"(能不能|可以).*(插单|加急)",
            ],
            IntentType.CREATE_PLAN: [
                r"(创建|新建|添加).*(计划|排程)",
                r"(安排|制定).*(生产|计划)",
                r"(要|需要).*(生产|做)",
            ],
            IntentType.UPDATE_SCHEDULE: [
                r"(调整|修改|更改).*(排程|计划|安排)",
                r"(换|改).*(时间|顺序)",
                r"(延后|提前|推迟)",
            ],
            IntentType.CANCEL_PLAN: [
                r"(取消|删除|作废).*(计划|排程|订单)",
                r"(不做|不要|停止).*(这个|那个)",
            ],
            IntentType.APPROVE_PLAN: [
                r"(审批|批准|同意|确认).*(计划|排程)",
                r"(通过|ok|可以).*(这个|那个).*(计划|排程)",
            ],

            # 表单类
            IntentType.FORM_FILL: [
                r"(填|写|录入).*(表单|信息|数据|记录)",
                r"(帮我|帮忙).*(填|补|录)",
                r"(自动).*(填|生成)",
            ],
            IntentType.FORM_VALIDATE: [
                r"(检查|验证|校验).*(表单|数据|信息)",
                r"(对不对|正确|有问题).*(表单|数据)",
            ],
            IntentType.FORM_SUGGEST: [
                r"(建议|推荐|应该).*(填|写).*(什么|多少)",
                r"(这里|这个).*(怎么填|填什么)",
            ],

            # 分析类
            IntentType.ANALYZE_TREND: [
                r"(趋势|走向|变化).*(分析|如何|怎么样)",
                r"(最近|这段时间).*(表现|情况|趋势)",
                r"(上升|下降|增长|减少|升|降)",
            ],
            IntentType.COMPARE_PERFORMANCE: [
                r"(对比|比较).*(性能|效率|数据)",
                r"(和|与).*(对比|比较)",
                r"(哪个|谁).*(更|比较).*(好|快|高)",
            ],
            IntentType.PREDICT_COMPLETION: [
                r"(预测|预计|估计).*(完成|完工|做完)",
                r"(什么时候|多久|几天).*(能|可以).*(完成|做完)",
                r"(还需要|还要|还).*(多久|多长时间)",
                r"多久.*(能|可以).*(完成|做完)",
            ],
            IntentType.OPTIMIZE_SUGGESTION: [
                r"(优化|改进|提升).*(建议|方案|方法)",
                r"(怎么|如何).*(提高|降低|优化)",
                r"(有什么|有没有).*(办法|方法|建议)",
            ],
            IntentType.ROOT_CAUSE_ANALYSIS: [
                r"(为什么|原因|怎么).*(这么|那么).*(高|低|慢|快)",
                r"(根因|根本原因|问题).*(分析|是什么)",
                r"(导致|造成).*(原因|因素)",
            ],

            # 通用类
            IntentType.GREETING: [
                r"^(你好|您好|hi|hello|嗨|早|晚上好|上午好|下午好)",
                r"^(在吗|在不在)",
            ],
            IntentType.HELP: [
                r"(帮助|help|怎么用|怎么操作)",
                r"(能做|可以做|功能).*什么",
                r"(教我|告诉我).*(怎么|如何)",
            ],
            IntentType.THANKS: [
                r"(谢谢|感谢|多谢|thanks|thank you)",
                r"(太好了|很好|不错)",
            ],
            IntentType.CONFIRM: [
                r"^(是|对|yes|确定|确认|好的|嗯|行)",
            ],
            IntentType.DENY: [
                r"^(不|否|no|取消|算了)",
            ],
        }

        # 实体提取模式
        self.entity_patterns = {
            'batch_id': [
                r'(B-?\d{3,})',                     # B001, B-123
                r'批次\s*([\d\-]+)',                 # 批次001
            ],
            'date': [
                r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',   # 2025-01-01
                r'(今天|昨天|明天|后天|前天)',
                r'(本周|上周|下周|这周)',
                r'(本月|上月|下月|这个月)',
            ],
            'time': [
                r'(\d{1,2}:\d{2})',                 # 14:30
                r'(\d{1,2}点)',                     # 14点
            ],
            'quantity': [
                r'(\d+)\s*(个|件|箱|吨|kg|公斤|克)',
            ],
            'person_name': [
                r'(张|王|李|刘|陈|杨|赵|黄|周|吴|徐|孙|马|朱|胡|郭|何|高|林|罗|郑|梁|谢|宋|唐|许|韩|冯|邓|曹|彭|曾|萧|田|董|袁|潘|于|蒋|蔡|余|杜|叶|程|苏|魏|吕|丁|任|沈|姚|卢|姜|崔|钟|谭|陆|汪|范|金|石|廖|贾|夏|韦|付|方|白|邹|孟|熊|秦|邱|江|尹|薛|闫|段|雷|侯|龙|史|陶|黎|贺|顾|毛|郝|龚|邵|万|钱|严|覃|武|戴|莫|孔|向|常)[\u4e00-\u9fa5]{1,2}',
            ],
            'product_type': [
                r'(虾|鱼|肉|蔬菜|水果)',
            ],
            'number': [
                r'(\d+(?:\.\d+)?)',                 # 数字（整数或小数）
            ],
        }

    def classify(self, text: str, context: Optional[Dict] = None) -> IntentResult:
        """
        分类用户意图

        Args:
            text: 用户输入文本
            context: 对话上下文 {
                "last_intent": IntentType,
                "last_entities": Dict,
                "conversation_history": List[str]
            }

        Returns:
            IntentResult 包含主意图、置信度、次要意图和实体
        """
        # 1. 规则匹配
        rule_result = self._rule_based_classify(text, context)

        # 2. AI 增强 (如果规则置信度低)
        if self.use_ai and self.ai_client and rule_result.confidence < self.confidence_threshold:
            ai_result = self._ai_classify(text, context)
            merged_result = self._merge_results(rule_result, ai_result)
            merged_result.classification_method = "hybrid"
            return merged_result

        return rule_result

    def _rule_based_classify(self, text: str, context: Optional[Dict] = None) -> IntentResult:
        """基于规则的分类"""
        text = text.strip()
        text_lower = text.lower()

        # 匹配所有模式，计算得分
        intent_scores: Dict[IntentType, float] = {}

        for intent_type, patterns in self.patterns.items():
            max_score = 0.0
            for pattern in patterns:
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    # 匹配长度占比作为得分
                    match_length = len(match.group(0))
                    text_length = len(text)
                    score = match_length / text_length
                    max_score = max(max_score, score)

            if max_score > 0:
                intent_scores[intent_type] = max_score

        # 如果没有匹配，检查上下文
        if not intent_scores and context:
            context_intent = self._infer_from_context(text, context)
            if context_intent:
                intent_scores[context_intent] = 0.5
                context_used = True
            else:
                intent_scores[IntentType.UNKNOWN] = 0.3
                context_used = False
        elif not intent_scores:
            intent_scores[IntentType.UNKNOWN] = 0.3
            context_used = False
        else:
            context_used = False

        # 排序得分
        sorted_intents = sorted(intent_scores.items(), key=lambda x: x[1], reverse=True)

        # 提取实体
        entities = self._extract_entities(text, sorted_intents[0][0])

        # 构建结果
        return IntentResult(
            primary_intent=sorted_intents[0][0],
            confidence=sorted_intents[0][1],
            secondary_intents=sorted_intents[1:3] if len(sorted_intents) > 1 else [],
            entities=entities,
            original_text=text,
            context_used=context_used,
            classification_method="rule"
        )

    def _ai_classify(self, text: str, context: Optional[Dict] = None) -> IntentResult:
        """AI 增强分类"""
        try:
            # 构建 AI 提示
            prompt = self._build_ai_prompt(text, context)

            completion = self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[
                    {"role": "system", "content": "你是一个意图分类专家，专门分析生产管理系统的用户意图。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3,
            )

            response = completion.choices[0].message.content
            return self._parse_ai_response(response, text)

        except Exception as e:
            print(f"[WARN] AI 分类失败: {e}")
            # 返回低置信度的未知意图
            return IntentResult(
                primary_intent=IntentType.UNKNOWN,
                confidence=0.2,
                original_text=text,
                classification_method="ai"
            )

    def _build_ai_prompt(self, text: str, context: Optional[Dict]) -> str:
        """构建 AI 分类提示"""
        intent_list = "\n".join([f"- {intent.value}: {intent.name}" for intent in IntentType])

        prompt = f"""请分析以下用户输入的意图，从以下类型中选择最合适的：

{intent_list}

用户输入: "{text}"
"""

        if context:
            prompt += f"\n上下文: {context}"

        prompt += """

请返回JSON格式：
{
    "primary_intent": "intent_value",
    "confidence": 0.85,
    "entities": {"batch_id": "B001", "date": "今天"}
}
"""
        return prompt

    def _parse_ai_response(self, response: str, original_text: str) -> IntentResult:
        """解析 AI 响应"""
        try:
            import json
            # 提取 JSON 部分
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                intent_value = data.get("primary_intent", "unknown")

                # 查找对应的 IntentType
                primary_intent = IntentType.UNKNOWN
                for intent in IntentType:
                    if intent.value == intent_value:
                        primary_intent = intent
                        break

                return IntentResult(
                    primary_intent=primary_intent,
                    confidence=data.get("confidence", 0.5),
                    entities=data.get("entities", {}),
                    original_text=original_text,
                    classification_method="ai"
                )
        except Exception as e:
            print(f"[WARN] AI 响应解析失败: {e}")

        return IntentResult(
            primary_intent=IntentType.UNKNOWN,
            confidence=0.2,
            original_text=original_text,
            classification_method="ai"
        )

    def _merge_results(self, rule_result: IntentResult, ai_result: IntentResult) -> IntentResult:
        """合并规则和 AI 结果"""
        # 如果 AI 置信度更高，使用 AI 结果
        if ai_result.confidence > rule_result.confidence:
            return ai_result

        # 否则使用规则结果，但合并实体
        merged_entities = {**rule_result.entities, **ai_result.entities}

        return IntentResult(
            primary_intent=rule_result.primary_intent,
            confidence=max(rule_result.confidence, ai_result.confidence * 0.8),
            secondary_intents=rule_result.secondary_intents,
            entities=merged_entities,
            original_text=rule_result.original_text,
            context_used=rule_result.context_used,
            classification_method="hybrid"
        )

    def _infer_from_context(self, text: str, context: Dict) -> Optional[IntentType]:
        """从上下文推断意图"""
        last_intent = context.get("last_intent")

        # 简单的上下文推断逻辑
        if last_intent:
            # 如果上一个意图是查询，当前可能是补充信息
            if "query" in last_intent.lower():
                return IntentType.QUERY_BATCH_STATUS
            # 如果上一个意图是操作，当前可能是确认
            elif any(x in last_intent.lower() for x in ["create", "update", "urgent"]):
                if re.search(r'^(是|对|确定|好)', text):
                    return IntentType.CONFIRM
                elif re.search(r'^(不|否|取消)', text):
                    return IntentType.DENY

        return None

    def _extract_entities(self, text: str, intent: IntentType) -> Dict[str, Any]:
        """提取实体"""
        entities = {}

        for entity_type, patterns in self.entity_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text)
                if match:
                    value = match.group(1) if match.groups() else match.group(0)
                    entities[entity_type] = value
                    break  # 每种实体类型只取第一个匹配

        # 日期解析
        if 'date' in entities:
            entities['date_parsed'] = self._parse_date(entities['date'])

        return entities

    def _parse_date(self, date_str: str) -> str:
        """解析日期字符串为标准格式"""
        today = datetime.now()

        date_mapping = {
            '今天': today,
            '昨天': today - timedelta(days=1),
            '明天': today + timedelta(days=1),
            '后天': today + timedelta(days=2),
            '前天': today - timedelta(days=2),
        }

        if date_str in date_mapping:
            return date_mapping[date_str].strftime('%Y-%m-%d')

        # 尝试解析标准格式
        for fmt in ['%Y-%m-%d', '%Y/%m/%d']:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        return date_str


# ==================== 单例和便捷函数 ====================
_classifier_instance: Optional[IntentClassifier] = None


def get_classifier(use_ai: bool = True, confidence_threshold: float = 0.6) -> IntentClassifier:
    """获取分类器单例"""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = IntentClassifier(use_ai=use_ai, confidence_threshold=confidence_threshold)
    return _classifier_instance


def classify_intent(text: str, context: Optional[Dict] = None, use_ai: bool = True) -> IntentResult:
    """
    便捷函数 - 分类用户意图

    Args:
        text: 用户输入文本
        context: 对话上下文
        use_ai: 是否使用 AI 增强

    Returns:
        IntentResult
    """
    classifier = get_classifier(use_ai=use_ai)
    return classifier.classify(text, context)


# ==================== 测试代码 ====================
if __name__ == "__main__":
    # 测试用例
    test_cases = [
        "查询批次B001的状态",
        "今天生产了多少",
        "有个紧急订单需要插单",
        "帮我填一下表单",
        "为什么良品率这么低",
        "预计什么时候能完成",
        "你好",
        "谢谢",
    ]

    classifier = IntentClassifier(use_ai=False)

    print("=" * 60)
    print("Intent Classifier 测试")
    print("=" * 60)

    for text in test_cases:
        result = classifier.classify(text)
        print(f"\n输入: {text}")
        print(f"意图: {result.primary_intent.value} (置信度: {result.confidence:.2f})")
        if result.entities:
            print(f"实体: {result.entities}")
        if result.secondary_intents:
            print(f"次要意图: {[(i.value, f'{c:.2f}') for i, c in result.secondary_intents]}")
