from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass(frozen=True)
class RequiresSpec:
    """声明一个卡片/模板需要哪些 canonical 字段才能渲染."""

    all: List[str] = field(default_factory=list)
    """所有字段必须在 factory 可用集合中. 任一缺失则隐藏."""

    any: List[str] = field(default_factory=list)
    """至少一个字段在 factory 可用集合中. 全缺则隐藏. 默认空表示无 OR 约束."""

    description: Optional[str] = None
    """人类可读说明 (用于 admin 审计页 + CTA tooltip)"""

    def is_satisfied_by(self, available: set[str]) -> bool:
        """判断 factory 当前可用字段集合是否满足此 spec."""
        all_ok = all(f in available for f in self.all)
        any_ok = (not self.any) or any(f in available for f in self.any)
        return all_ok and any_ok

    def missing_fields(self, available: set[str]) -> List[str]:
        """列出缺失字段 (用于 CTA 提示)."""
        return [f for f in self.all if f not in available]
