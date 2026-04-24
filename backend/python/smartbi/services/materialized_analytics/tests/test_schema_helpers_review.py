"""Unit tests for review-domain helpers in restaurant/schema_helpers.py.

Test depth: smoke (per qa-prompt v2.4 Rule 1). Paired with end-to-end
re-materialize byte-match test for deep coverage.

Each helper is tested for:
  - happy path (qhj 大众点评 Q3 column name present)
  - multi-merchant variant (美团/抖音 plausible name present)
  - priority ordering (most-specific candidate wins when multiple present)
  - negative cases (ID-suffixed columns / unrelated columns / empty cols)
"""
from smartbi.services.materialized_analytics.restaurant import schema_helpers


# ─── STORE ───
class TestReviewStoreCol:
    def test_qhj_standard(self):
        assert schema_helpers.find_review_store_col(["评价时间", "具体门店", "星级"]) == "具体门店"

    def test_meituan_branch_variant(self):
        assert schema_helpers.find_review_store_col(["评价时间", "分店", "星级"]) == "分店"

    def test_dianping_alternate(self):
        assert schema_helpers.find_review_store_col(["评价时间", "评价门店", "星级"]) == "评价门店"

    def test_priority_specific_wins(self):
        # 具体门店 (priority-1) wins over 门店名称 (priority-3) when both present
        assert schema_helpers.find_review_store_col(["具体门店", "门店名称"]) == "具体门店"

    def test_only_id_returns_none(self):
        # qhj 3975 contains 门店分类ID — must NOT be picked as store col
        assert schema_helpers.find_review_store_col(["门店分类ID", "评价时间"]) is None

    def test_id_and_real_both_present(self):
        # ID suffix col + real store col → must return real store col
        assert schema_helpers.find_review_store_col(["门店分类ID", "具体门店"]) == "具体门店"

    def test_empty_cols(self):
        assert schema_helpers.find_review_store_col([]) is None

    def test_post_mapper_region_fallback(self):
        # Java/Python excel parser renames 分店 → "region" before persist.
        # T6 (Apr 24 2026) revealed this path. Helper must detect "region"
        # when no Chinese variant present.
        assert schema_helpers.find_review_store_col(["region", "评价ID"]) == "region"

    def test_chinese_wins_over_region(self):
        # If both Chinese variant AND mapper-renamed "region" present, Chinese wins
        # (priority order: Chinese variants > "region" fallback).
        assert schema_helpers.find_review_store_col(["region", "具体门店"]) == "具体门店"


# ─── STAR / RATING ───
class TestStarCol:
    def test_qhj_uses_star(self):
        assert schema_helpers.find_star_col(["星级", "口味分"]) == "星级"

    def test_qualified_priority(self):
        # _STAR_CANDIDATES = ("星级分", "评分", "星级") — most-qualified first
        assert schema_helpers.find_star_col(["星级", "评分", "星级分"]) == "星级分"

    def test_evaluation_score_variant(self):
        # 评分 alone (no 星级) — common 美团 variant
        assert schema_helpers.find_star_col(["评分", "口味"]) == "评分"

    def test_no_rating_col_returns_none(self):
        # No star/score col present
        assert schema_helpers.find_star_col(["评价时间", "用户昵称"]) is None


# ─── TASTE / ENV / SERVICE SCORES ───
class TestTasteScoreCol:
    def test_qhj_taste_score(self):
        assert schema_helpers.find_taste_score_col(["口味分", "口味标签"]) == "口味分"

    def test_only_tag_present_returns_none(self):
        # 口味标签 alone is csv tag list, NOT rating — must return None
        assert schema_helpers.find_taste_score_col(["口味标签"]) is None

    def test_reorder_does_not_affect(self):
        # Even with 口味标签 first in xlsx col order, helper picks 口味分
        assert schema_helpers.find_taste_score_col(["口味标签", "口味分", "环境分"]) == "口味分"


class TestEnvScoreCol:
    def test_qhj_env(self):
        assert schema_helpers.find_env_score_col(["环境分", "环境标签"]) == "环境分"

    def test_only_tag_returns_none(self):
        assert schema_helpers.find_env_score_col(["环境标签"]) is None


class TestServiceScoreCol:
    def test_qhj_service(self):
        assert schema_helpers.find_service_score_col(["服务分", "服务标签"]) == "服务分"

    def test_only_tag_returns_none(self):
        # 服务标签 (qhj has this) must NOT be picked as service rating
        assert schema_helpers.find_service_score_col(["服务标签"]) is None


# ─── REVIEW TIME ───
class TestReviewTimeCol:
    def test_qhj_review_time(self):
        assert schema_helpers.find_review_time_col(["评价时间", "用户昵称"]) == "评价时间"

    def test_meituan_comment_time(self):
        assert schema_helpers.find_review_time_col(["评论时间", "用户昵称"]) == "评论时间"

    def test_priority_evaluation_over_creation(self):
        # _REVIEW_TIME_CANDIDATES = ("评价时间", "评论时间", "发表时间", "创建时间", "time_period")
        # Evaluation timestamp wins over generic creation timestamp
        assert schema_helpers.find_review_time_col(["创建时间", "评价时间"]) == "评价时间"

    def test_post_mapper_time_period_fallback(self):
        # Java/Python excel parser renames 评价时间 → "time_period" before persist.
        # T6 revealed this — helper must detect the post-mapper standard name.
        assert schema_helpers.find_review_time_col(["time_period", "评价ID"]) == "time_period"

    def test_chinese_wins_over_time_period(self):
        # Chinese variants take priority over post-mapper "time_period"
        assert schema_helpers.find_review_time_col(["time_period", "评价时间"]) == "评价时间"


# ─── REVIEW CONTENT ───
class TestReviewContentCol:
    def test_qhj_content(self):
        # qhj uses 评价内容 (older) and 评价详情 (newer)
        assert schema_helpers.find_review_content_col(["评价内容", "用户昵称"]) == "评价内容"

    def test_priority_detail_over_content(self):
        # _REVIEW_CONTENT_CANDIDATES = ("评价详情", "评价内容", "评论详情", "评论内容")
        assert schema_helpers.find_review_content_col(["评价内容", "评价详情"]) == "评价详情"


# ─── VIP FLAG ───
class TestVipFlagCol:
    def test_qhj_vip_lowercase(self):
        assert schema_helpers.find_vip_flag_col(["是否vip", "用户等级"]) == "是否vip"

    def test_uppercase_variant(self):
        assert schema_helpers.find_vip_flag_col(["是否VIP", "用户等级"]) == "是否VIP"

    def test_does_not_match_member_card(self):
        # 会员卡 is a POS measure column — must NOT be picked as VIP flag
        assert schema_helpers.find_vip_flag_col(["会员卡", "会员卡支付", "用户等级"]) is None


# ─── COMPLAINT STATUS ───
class TestComplaintStatusCol:
    def test_only_status_not_time_or_title(self):
        # qhj 3975 has 投诉时间 / 投诉标题 / 投诉内容 — must NOT pick those
        assert schema_helpers.find_complaint_status_col(["投诉时间", "投诉标题", "投诉内容"]) is None

    def test_status_present(self):
        assert schema_helpers.find_complaint_status_col(["投诉时间", "投诉状态", "投诉标题"]) == "投诉状态"


# ─── REVIEW PLATFORM ───
class TestReviewPlatformCol:
    def test_qhj_platform(self):
        assert schema_helpers.find_review_platform_col(["平台", "评价来源"]) == "平台"

    def test_priority_platform_over_source(self):
        # _REVIEW_PLATFORM_CANDIDATES = ("平台", "评价来源", "渠道", "来源")
        assert schema_helpers.find_review_platform_col(["来源", "平台"]) == "平台"

    def test_meituan_channel(self):
        assert schema_helpers.find_review_platform_col(["渠道", "用户昵称"]) == "渠道"


# ─── DISH TAG ───
class TestDishTagCol:
    def test_qhj_dish_tag(self):
        assert schema_helpers.find_dish_tag_col(["菜品标签", "口味标签"]) == "菜品标签"

    def test_no_dish_tag_returns_none(self):
        # 口味标签 / 服务标签 are NOT dish tags
        assert schema_helpers.find_dish_tag_col(["口味标签", "服务标签"]) is None


# ─── COMPLAINT TITLE ───
class TestComplaintTitleCol:
    def test_qhj_title(self):
        assert schema_helpers.find_complaint_title_col(["投诉标题", "投诉内容"]) == "投诉标题"

    def test_no_title_returns_none(self):
        # 投诉内容 / 投诉时间 / 投诉状态 are NOT titles
        assert schema_helpers.find_complaint_title_col(["投诉内容", "投诉时间"]) is None
