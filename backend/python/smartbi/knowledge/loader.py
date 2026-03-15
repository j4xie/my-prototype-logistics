"""
Industry Knowledge Base Loader

Loads YAML-based benchmarks and playbooks, with sub-sector merge logic.
Replaces hardcoded benchmark dicts in benchmark.py and insight_generator.py.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)

_KB_ROOT = Path(__file__).parent


class IndustryKnowledgeBase:
    """Load and query industry benchmarks and playbooks from YAML files."""

    def __init__(self, industry: str = "restaurant"):
        """
        Args:
            industry: "restaurant" or "factory"
        """
        self.industry = industry
        self.base_path = _KB_ROOT / industry
        self._benchmarks_cache: Dict[str, dict] = {}
        self._common_cache: Optional[dict] = None
        self._playbooks_cache: Dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Benchmarks
    # ------------------------------------------------------------------

    def get_benchmark(self, sub_sector: str) -> dict:
        """
        Get merged benchmark for a sub-sector.
        Merges _common.yaml (base) with sub-sector-specific yaml.
        Returns dict with metrics, each having range/median/unit/source.
        """
        if sub_sector in self._benchmarks_cache:
            return self._benchmarks_cache[sub_sector]

        common = self._load_common_benchmarks()
        specific = self._load_yaml(self.base_path / "benchmarks" / f"{sub_sector}.yaml")

        merged = self._merge_benchmarks(common, specific, sub_sector)
        self._benchmarks_cache[sub_sector] = merged
        return merged

    def get_all_sub_sectors(self) -> List[str]:
        """List available sub-sector benchmark files."""
        benchmarks_dir = self.base_path / "benchmarks"
        if not benchmarks_dir.exists():
            return []
        return [
            f.stem for f in benchmarks_dir.glob("*.yaml")
            if f.stem != "_common"
        ]

    def _load_common_benchmarks(self) -> dict:
        if self._common_cache is not None:
            return self._common_cache
        self._common_cache = self._load_yaml(
            self.base_path / "benchmarks" / "_common.yaml"
        )
        return self._common_cache

    def _merge_benchmarks(
        self, common: dict, specific: dict, sub_sector: str
    ) -> dict:
        """
        Merge common benchmarks with sub-sector overrides.
        Sub-sector values override common values for the same metric key.
        """
        result = {
            "sub_sector": sub_sector,
            "industry": self.industry,
            "source": specific.get("source", common.get("source", "")),
            "year": specific.get("year", common.get("year", 2024)),
            "metrics": {},
        }

        # Start with common metrics
        for key, metric in common.get("metrics", {}).items():
            result["metrics"][key] = dict(metric)

        # Override/add from specific
        for key, metric in specific.get("metrics", {}).items():
            if key in result["metrics"]:
                result["metrics"][key].update(metric)
            else:
                result["metrics"][key] = dict(metric)

        return result

    # ------------------------------------------------------------------
    # Playbooks (operational recommendations)
    # ------------------------------------------------------------------

    def get_playbook(self, diagnosis_code: str) -> Optional[dict]:
        """
        Load a playbook by diagnosis code (e.g., 'food_cost_high').
        Returns None if not found.
        """
        if diagnosis_code in self._playbooks_cache:
            return self._playbooks_cache[diagnosis_code]

        path = self.base_path / "playbooks" / f"{diagnosis_code}.yaml"
        playbook = self._load_yaml(path)
        if playbook:
            self._playbooks_cache[diagnosis_code] = playbook
        return playbook or None

    def match_playbooks(
        self, diagnostics: Dict[str, str], sub_sector: str = ""
    ) -> List[dict]:
        """
        Match diagnosis results to available playbooks.

        Args:
            diagnostics: dict of {metric_key: status} e.g. {"food_cost_ratio": "偏高"}
            sub_sector: current sub-sector for sub-sector-specific notes

        Returns:
            List of matched playbooks with sub-sector notes injected.
        """
        matched = []
        playbooks_dir = self.base_path / "playbooks"
        if not playbooks_dir.exists():
            return matched

        for metric_key, status in diagnostics.items():
            if status not in ("偏高", "偏低", "异常"):
                continue

            # Convention: playbook filename = {metric_key}_{status_suffix}.yaml
            suffix = "high" if status == "偏高" else "low" if status == "偏低" else "abnormal"
            code = f"{metric_key}_{suffix}"
            playbook = self.get_playbook(code)
            if playbook:
                # Inject sub-sector-specific notes if available
                if sub_sector and "sub_sector_notes" in playbook:
                    notes = playbook["sub_sector_notes"].get(sub_sector)
                    if notes:
                        playbook["active_sub_sector_note"] = notes
                matched.append(playbook)

        return matched

    # ------------------------------------------------------------------
    # Prompt Generation (replaces hardcoded text in insight_generator.py)
    # ------------------------------------------------------------------

    def format_for_prompt(self, sub_sector: str) -> str:
        """
        Generate benchmark text for LLM prompt injection.
        Replaces the hardcoded strings in insight_generator.py:552.
        """
        bench = self.get_benchmark(sub_sector)
        metrics = bench.get("metrics", {})

        lines = [f"【{sub_sector}】行业对标基准（{bench.get('year', 2024)}年）："]

        metric_parts = []
        for key, m in metrics.items():
            r = m.get("range", [])
            name = m.get("name", key)
            unit = m.get("unit", "")
            if len(r) == 2:
                metric_parts.append(f"{name}{r[0]}-{r[1]}{unit}")
            elif "median" in m:
                metric_parts.append(f"{name}中位数{m['median']}{unit}")

        lines.append("、".join(metric_parts) + "。")

        # Add menu engineering if restaurant
        if self.industry == "restaurant":
            lines.append(
                "菜品四象限(Menu Engineering)：Star(高销量+高利润)=主推、"
                "Plow(高销量+低利润)=提价或缩份量、Puzzle(低销量+高利润)=加推广、"
                "Dog(低销量+低利润)=考虑下架。"
            )

        return "\n".join(lines)

    def format_dianping_for_prompt(self, sub_sector: str = "") -> str:
        """Generate Dianping standards text for prompt injection."""
        standards_path = self.base_path / "standards" / "dianping_rules.yaml"
        standards = self._load_yaml(standards_path)
        if not standards:
            return ""

        parts = ["大众点评上榜评估标准："]
        bichi = standards.get("必吃榜", {})
        if bichi:
            dims = bichi.get("dimensions", [])
            parts.append(f"必吃榜评选维度：{'、'.join(dims[:5])}")
            disq = bichi.get("disqualifiers", [])
            if disq:
                parts.append(f"淘汰项：{'、'.join(disq[:5])}")

        heizz = standards.get("黑珍珠", {})
        if heizz:
            dims = heizz.get("dimensions", [])
            parts.append(f"黑珍珠评选维度：{'、'.join(dims[:3])}")

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _load_yaml(path: Path) -> dict:
        """Load a YAML file, return empty dict if not found."""
        if not path.exists():
            logger.debug("Knowledge base file not found: %s", path)
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.warning("Failed to load knowledge base %s: %s", path, e)
            return {}


# ------------------------------------------------------------------
# Module-level convenience
# ------------------------------------------------------------------

_restaurant_kb: Optional[IndustryKnowledgeBase] = None
_factory_kb: Optional[IndustryKnowledgeBase] = None


def get_restaurant_kb() -> IndustryKnowledgeBase:
    """Get singleton restaurant knowledge base."""
    global _restaurant_kb
    if _restaurant_kb is None:
        _restaurant_kb = IndustryKnowledgeBase("restaurant")
    return _restaurant_kb


def get_factory_kb() -> IndustryKnowledgeBase:
    """Get singleton factory knowledge base."""
    global _factory_kb
    if _factory_kb is None:
        _factory_kb = IndustryKnowledgeBase("factory")
    return _factory_kb
