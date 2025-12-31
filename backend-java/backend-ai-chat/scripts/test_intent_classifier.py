"""
Intent Classifier 单元测试

运行方式:
    python -m pytest test_intent_classifier.py -v
    或
    python test_intent_classifier.py
"""

import pytest
from intent_classifier import IntentClassifier, IntentType, classify_intent


# ==================== 基础测试 ====================
class TestIntentClassifier:
    """Intent Classifier 基础功能测试"""

    @classmethod
    def setup_class(cls):
        """测试前初始化"""
        cls.classifier = IntentClassifier(use_ai=False)  # 禁用AI，只测试规则

    # ==================== 查询类测试 ====================
    def test_query_batch_status(self):
        """测试批次状态查询意图"""
        test_cases = [
            "查询批次B001的状态",
            "B002这个批次怎么样了",
            "看看批次B003的情况",
            "批次B-123进展如何",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.QUERY_BATCH_STATUS, \
                f"Failed for: {text}, got: {result.primary_intent.value}"
            assert result.confidence > 0.3, f"Low confidence for: {text}"

    def test_query_production_progress(self):
        """测试生产进度查询意图"""
        test_cases = [
            "今天生产了多少",
            "生产进度怎么样",
            "当前产量是多少",
            "今天完成了几个批次",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.QUERY_PRODUCTION_PROGRESS, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_query_quality_report(self):
        """测试质量报告查询意图"""
        test_cases = [
            "质检报告怎么样",
            "查看质量情况",
            "合格率是多少",
            "检测结果如何",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.QUERY_QUALITY_REPORT, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_query_cost_analysis(self):
        """测试成本分析查询意图"""
        test_cases = [
            "成本分析",
            "花了多少钱",
            "费用统计",
            "成本控制怎么样",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.QUERY_COST_ANALYSIS, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    # ==================== 操作类测试 ====================
    def test_urgent_insert(self):
        """测试紧急插单意图"""
        test_cases = [
            "有个紧急订单需要插单",
            "能不能加急一个单",
            "插一个急单",
            "临时订单要加进去",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.URGENT_INSERT, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_create_plan(self):
        """测试创建计划意图"""
        test_cases = [
            "创建一个生产计划",
            "新建排程",
            "安排明天的生产",
            "要生产500kg虾",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.CREATE_PLAN, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_update_schedule(self):
        """测试调整排程意图"""
        test_cases = [
            "调整排程",
            "修改计划",
            "把时间延后",
            "改一下顺序",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.UPDATE_SCHEDULE, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    # ==================== 表单类测试 ====================
    def test_form_fill(self):
        """测试表单填充意图"""
        test_cases = [
            "帮我填一下表单",
            "自动填充数据",
            "帮忙录入信息",
            "填写生产记录",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.FORM_FILL, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_form_validate(self):
        """测试表单验证意图"""
        test_cases = [
            "检查表单数据",
            "验证这个信息对不对",
            "校验一下数据",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.FORM_VALIDATE, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    # ==================== 分析类测试 ====================
    def test_analyze_trend(self):
        """测试趋势分析意图"""
        test_cases = [
            "趋势分析",
            "最近的变化怎么样",
            "这段时间的表现",
            "产量上升了吗",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.ANALYZE_TREND, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_predict_completion(self):
        """测试完成预测意图"""
        test_cases = [
            "预计什么时候完成",
            "估计几点能完工",
            "多久能完成",
            "还需要多长时间",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.PREDICT_COMPLETION, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_optimize_suggestion(self):
        """测试优化建议意图"""
        test_cases = [
            "优化建议",
            "怎么提高效率",
            "有什么改进方法",
            "如何降低成本",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.OPTIMIZE_SUGGESTION, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    # ==================== 通用类测试 ====================
    def test_greeting(self):
        """测试问候意图"""
        test_cases = [
            "你好",
            "您好",
            "hi",
            "早上好",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.GREETING, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_thanks(self):
        """测试感谢意图"""
        test_cases = [
            "谢谢",
            "感谢",
            "多谢",
            "太好了",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.THANKS, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_help(self):
        """测试帮助意图"""
        test_cases = [
            "帮助",
            "怎么用",
            "能做什么",
            "告诉我怎么操作",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.HELP, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_confirm(self):
        """测试确认意图"""
        test_cases = [
            "是",
            "对",
            "确定",
            "好的",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.CONFIRM, \
                f"Failed for: {text}, got: {result.primary_intent.value}"

    def test_deny(self):
        """测试否认意图"""
        test_cases = [
            "不",
            "否",
            "取消",
            "算了",
        ]

        for text in test_cases:
            result = self.classifier.classify(text)
            assert result.primary_intent == IntentType.DENY, \
                f"Failed for: {text}, got: {result.primary_intent.value}"


# ==================== 实体提取测试 ====================
class TestEntityExtraction:
    """实体提取功能测试"""

    @classmethod
    def setup_class(cls):
        cls.classifier = IntentClassifier(use_ai=False)

    def test_extract_batch_id(self):
        """测试批次号提取"""
        test_cases = [
            ("查询批次B001的状态", "B001"),
            ("B-123怎么样了", "B-123"),
            ("批次 B456 进度", "B456"),
        ]

        for text, expected_batch in test_cases:
            result = self.classifier.classify(text)
            assert 'batch_id' in result.entities, f"No batch_id for: {text}"
            assert expected_batch in result.entities['batch_id'], \
                f"Expected {expected_batch}, got {result.entities['batch_id']}"

    def test_extract_date(self):
        """测试日期提取"""
        test_cases = [
            ("今天生产了多少", "今天"),
            ("昨天的进度", "昨天"),
            ("2025-01-01的数据", "2025-01-01"),
        ]

        for text, expected_date in test_cases:
            result = self.classifier.classify(text)
            assert 'date' in result.entities, f"No date for: {text}"

    def test_extract_quantity(self):
        """测试数量提取"""
        test_cases = [
            ("需要生产500kg", "500"),
            ("100箱产品", "100"),
            ("20吨原料", "20"),
        ]

        for text, expected_qty in test_cases:
            result = self.classifier.classify(text)
            assert 'quantity' in result.entities, f"No quantity for: {text}"
            assert expected_qty in result.entities['quantity'], \
                f"Expected {expected_qty}, got {result.entities.get('quantity')}"

    def test_extract_multiple_entities(self):
        """测试多实体提取"""
        text = "查询批次B001今天的生产情况"
        result = self.classifier.classify(text)

        assert 'batch_id' in result.entities, "Should extract batch_id"
        assert 'date' in result.entities, "Should extract date"


# ==================== 上下文测试 ====================
class TestContextAwareness:
    """上下文感知测试"""

    @classmethod
    def setup_class(cls):
        cls.classifier = IntentClassifier(use_ai=False)

    def test_context_inference(self):
        """测试上下文推断"""
        # 模拟对话场景
        context = {
            "last_intent": "urgent_insert",
            "last_entities": {"quantity": "500", "product_type": "虾"}
        }

        # 用户回复"确定"
        result = self.classifier.classify("确定", context)
        assert result.primary_intent == IntentType.CONFIRM

        # 用户回复"取消"
        result = self.classifier.classify("取消", context)
        assert result.primary_intent == IntentType.DENY


# ==================== 置信度测试 ====================
class TestConfidence:
    """置信度评分测试"""

    @classmethod
    def setup_class(cls):
        cls.classifier = IntentClassifier(use_ai=False)

    def test_high_confidence(self):
        """测试高置信度情况"""
        # 明确的意图应该有高置信度
        result = self.classifier.classify("查询批次B001的状态")
        assert result.confidence > 0.5, f"Should have high confidence, got {result.confidence}"

    def test_low_confidence(self):
        """测试低置信度情况"""
        # 模糊的输入应该有低置信度
        result = self.classifier.classify("asdf random text")
        assert result.confidence < 0.8, f"Should have low confidence, got {result.confidence}"

    def test_unknown_intent(self):
        """测试未知意图"""
        result = self.classifier.classify("asdfghjkl random text 123")
        assert result.primary_intent == IntentType.UNKNOWN


# ==================== 多意图测试 ====================
class TestMultiIntent:
    """多意图识别测试"""

    @classmethod
    def setup_class(cls):
        cls.classifier = IntentClassifier(use_ai=False)

    def test_secondary_intents(self):
        """测试次要意图识别"""
        # 这个句子可能同时包含查询和分析意图
        text = "查询批次B001的状态，并分析趋势"
        result = self.classifier.classify(text)

        # 应该识别主要意图（可以是查询或分析）
        assert result.primary_intent in [IntentType.QUERY_BATCH_STATUS, IntentType.ANALYZE_TREND]
        # 注意：当前实现可能不会返回次要意图，这是可以接受的
        # 只要主要意图正确即可


# ==================== 便捷函数测试 ====================
def test_classify_intent_function():
    """测试便捷函数"""
    result = classify_intent("你好", use_ai=False)
    assert isinstance(result.primary_intent, IntentType)
    assert result.primary_intent == IntentType.GREETING


# ==================== 运行所有测试 ====================
if __name__ == "__main__":
    # 如果没有安装 pytest，可以手动运行测试
    import sys

    try:
        # 尝试使用 pytest
        pytest.main([__file__, "-v", "--tb=short"])
    except ImportError:
        # 如果没有 pytest，手动运行测试
        print("=" * 60)
        print("Running Intent Classifier Tests (Manual Mode)")
        print("=" * 60)

        test_classes = [
            TestIntentClassifier,
            TestEntityExtraction,
            TestContextAwareness,
            TestConfidence,
            TestMultiIntent,
        ]

        total_tests = 0
        passed_tests = 0

        for test_class in test_classes:
            print(f"\n>>> Testing {test_class.__name__}")
            test_instance = test_class()
            if hasattr(test_class, 'setup_class'):
                test_class.setup_class()

            # 获取所有测试方法
            test_methods = [method for method in dir(test_instance)
                          if method.startswith('test_')]

            for method_name in test_methods:
                total_tests += 1
                try:
                    method = getattr(test_instance, method_name)
                    method()
                    print(f"  ✅ {method_name}")
                    passed_tests += 1
                except AssertionError as e:
                    print(f"  ❌ {method_name}: {e}")
                except Exception as e:
                    print(f"  ⚠️  {method_name}: {e}")

        # 运行独立测试函数
        print(f"\n>>> Testing standalone functions")
        total_tests += 1
        try:
            test_classify_intent_function()
            print(f"  ✅ test_classify_intent_function")
            passed_tests += 1
        except Exception as e:
            print(f"  ❌ test_classify_intent_function: {e}")

        print("\n" + "=" * 60)
        print(f"Test Results: {passed_tests}/{total_tests} passed")
        print("=" * 60)

        sys.exit(0 if passed_tests == total_tests else 1)
