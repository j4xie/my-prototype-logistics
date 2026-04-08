"""4 层配置覆盖查找服务

查找优先级 (高 → 低):
  4. session-level 临时覆盖 (内存, 单次试算用)
  3. 门店级覆盖 (DB: business_config_overrides where store_id IS NOT NULL)
  2. 工厂级覆盖 (DB: business_config_overrides where store_id IS NULL)
  1. 系统默认 (knowledge/{domain}/...yaml, 由调用方传入)

domain 严格隔离:
  - 必填 'restaurant' 或 'factory'
  - config_key 必须以 domain 前缀开头, 否则 ValueError
  - 不允许跨 domain 查找

使用示例:
    >>> resolver = DynamicConfigResolver(factory_id="F001", domain="restaurant")
    >>> resolver.set_session_override("restaurant.cogs.美团外卖", 0.42)
    >>> result = resolver.resolve("restaurant.cogs.美团外卖", yaml_fallback=0.43)
    >>> assert result.value == 0.42
    >>> assert result.source == "session"
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ── Type aliases ────────────────────────────────────────────

Domain = Literal["restaurant", "factory"]
"""严格隔离: 必填 'restaurant' 或 'factory', 不允许 None / 跨 domain 值"""

ConfigSource = Literal["session", "store", "factory", "yaml_default"]
"""配置值来源, 4 层优先级"""

Confidence = Literal["high", "medium", "low"]
"""配置值置信度"""


# ── Result types ────────────────────────────────────────────

@dataclass
class ConfigValue:
    """带 provenance 的配置查找结果

    Attributes:
        value: 实际配置值 (可以是 number / string / dict)
        source: 4 层中哪一层命中
        confidence: 置信度 (yaml_default 通常 'medium', sku_form 通常 'high')
        config_key: 原始 config_key (回显, 便于调试)
        last_updated: DB 中最后更新时间 (yaml_default 时为 None)
        notes: 来源说明文本, 用于前端透明度展示
    """
    value: Any
    source: ConfigSource
    confidence: Confidence
    config_key: str
    last_updated: Optional[datetime] = None
    notes: Optional[str] = None


# ── Main resolver ───────────────────────────────────────────

class DynamicConfigResolver:
    """跨 domain 通用的 4 层配置查找器

    每个 (factory_id, domain) 组合应该实例化一个 resolver, 共享 session 级缓存.

    线程安全性: session_overrides 是实例级状态, 不同请求应使用不同实例.
    """

    def __init__(
        self,
        factory_id: str,
        domain: Domain,
        db_session: Optional[Session] = None,
    ):
        """
        Args:
            factory_id: 工厂 ID, 必填
            domain: 'restaurant' 或 'factory', 必填, 不允许 None
            db_session: SQLAlchemy session. 如果为 None, 跳过 DB 查找 (仅返回 session/yaml_default)

        Raises:
            ValueError: domain 不在合法值内
        """
        if domain not in ("restaurant", "factory"):
            raise ValueError(
                f"domain 必须是 'restaurant' 或 'factory', 收到 {domain!r}. "
                f"跨 domain 查找会导致数据污染, 拒绝执行."
            )
        if not factory_id:
            raise ValueError("factory_id 不能为空")

        self.factory_id = factory_id
        self.domain: Domain = domain
        self.db = db_session
        self._session_overrides: dict[str, Any] = {}

    # ── 主查找接口 ─────────────────────────────────────

    def resolve(
        self,
        config_key: str,
        store_id: Optional[str] = None,
        yaml_fallback: Any = None,
    ) -> ConfigValue:
        """按 4 层优先级查找配置值

        查找顺序:
          1. session 临时覆盖 (内存)
          2. 门店级 DB 覆盖 (如果传入 store_id)
          3. 工厂级 DB 覆盖
          4. yaml_fallback (调用方传入的 YAML 默认值)

        Args:
            config_key: 必须以 domain 前缀开头, 例如 'restaurant.cogs.美团外卖'
            store_id: 可选门店 ID, 提供时启用门店级查找
            yaml_fallback: YAML 默认值, 用于第 4 层兜底

        Returns:
            ConfigValue: 含 value + source + confidence

        Raises:
            ValueError: config_key 不带 domain 前缀, 或前缀不匹配当前 resolver 的 domain
        """
        self._validate_config_key(config_key)

        # Layer 4: session 临时覆盖
        if config_key in self._session_overrides:
            return ConfigValue(
                value=self._session_overrides[config_key],
                source="session",
                confidence="high",
                config_key=config_key,
                notes="会话级临时覆盖 (单次试算)",
            )

        # Layer 3: 门店级
        if store_id and self.db is not None:
            store_value = self._query_db(config_key, store_id=store_id)
            if store_value is not None:
                return store_value

        # Layer 2: 工厂级
        if self.db is not None:
            factory_value = self._query_db(config_key, store_id=None)
            if factory_value is not None:
                return factory_value

        # Layer 1: YAML 默认
        return ConfigValue(
            value=yaml_fallback,
            source="yaml_default",
            confidence="medium",
            config_key=config_key,
            notes="行业基准默认值, 客户上传数据后会升级精度",
        )

    # ── Session 级覆盖 (单次试算) ──────────────────────

    def set_session_override(self, config_key: str, value: Any) -> None:
        """设置会话级临时覆盖, 不持久化

        用途: 客户在前端做"如果美团费率改成 18% 会怎样"这类 what-if 试算时,
        临时覆盖, 不污染持久化数据.

        Args:
            config_key: 必须带 domain 前缀
            value: 任意 JSON-serializable 值

        Raises:
            ValueError: config_key 校验失败
        """
        self._validate_config_key(config_key)
        self._session_overrides[config_key] = value
        logger.debug(
            f"[{self.domain}] session override set: {config_key} = {value} "
            f"(factory={self.factory_id})"
        )

    def clear_session_overrides(self) -> None:
        """清空所有 session 级覆盖"""
        self._session_overrides.clear()

    # ── 持久化覆盖 (写 DB) ─────────────────────────────

    def persist_factory_override(
        self,
        config_key: str,
        value: Any,
        source: str,
        confidence: Confidence = "medium",
        created_by: Optional[str] = None,
        effective_from: Optional[datetime] = None,
    ) -> None:
        """工厂级持久化覆盖 (UPSERT 到 business_config_overrides)

        Args:
            config_key: 必须带 domain 前缀
            value: 配置值, 会被序列化为 JSONB
            source: 来源标识 ('manual_input'/'monthly_upload'/'audit_confirmed' 等)
            confidence: 置信度
            created_by: 操作人
            effective_from: 生效日期 (None 时立即生效)

        Raises:
            ValueError: config_key 校验失败
            RuntimeError: 没有 db_session
        """
        self._validate_config_key(config_key)
        if self.db is None:
            raise RuntimeError("DynamicConfigResolver 未初始化 db_session, 无法持久化")

        sql = text("""
            INSERT INTO business_config_overrides
                (factory_id, store_id, domain, config_key, config_value,
                 source, confidence, effective_from, created_by, created_at, updated_at)
            VALUES
                (:factory_id, NULL, :domain, :config_key, CAST(:config_value AS JSONB),
                 :source, :confidence, :effective_from, :created_by, NOW(), NOW())
            ON CONFLICT (factory_id, domain, config_key, COALESCE(store_id, ''),
                         COALESCE(effective_from, '1900-01-01'::DATE))
            WHERE deleted_at IS NULL
            DO UPDATE SET
                config_value = EXCLUDED.config_value,
                source = EXCLUDED.source,
                confidence = EXCLUDED.confidence,
                created_by = EXCLUDED.created_by,
                updated_at = NOW()
        """)

        import json
        self.db.execute(sql, {
            "factory_id": self.factory_id,
            "domain": self.domain,
            "config_key": config_key,
            "config_value": json.dumps(value, ensure_ascii=False),
            "source": source,
            "confidence": confidence,
            "effective_from": effective_from,
            "created_by": created_by,
        })
        self.db.commit()
        logger.info(
            f"[{self.domain}] factory override persisted: {config_key} "
            f"(source={source}, factory={self.factory_id})"
        )

    def persist_store_override(
        self,
        config_key: str,
        store_id: str,
        value: Any,
        source: str,
        confidence: Confidence = "medium",
        created_by: Optional[str] = None,
    ) -> None:
        """门店级持久化覆盖

        Args:
            config_key: 必须带 domain 前缀
            store_id: 门店 ID, 必填
            value: 配置值
            source: 来源
            confidence: 置信度
            created_by: 操作人
        """
        self._validate_config_key(config_key)
        if not store_id:
            raise ValueError("门店级覆盖必须提供 store_id, 否则应使用 persist_factory_override")
        if self.db is None:
            raise RuntimeError("DynamicConfigResolver 未初始化 db_session, 无法持久化")

        sql = text("""
            INSERT INTO business_config_overrides
                (factory_id, store_id, domain, config_key, config_value,
                 source, confidence, created_by, created_at, updated_at)
            VALUES
                (:factory_id, :store_id, :domain, :config_key, CAST(:config_value AS JSONB),
                 :source, :confidence, :created_by, NOW(), NOW())
            ON CONFLICT (factory_id, domain, config_key, COALESCE(store_id, ''),
                         COALESCE(effective_from, '1900-01-01'::DATE))
            WHERE deleted_at IS NULL
            DO UPDATE SET
                config_value = EXCLUDED.config_value,
                source = EXCLUDED.source,
                confidence = EXCLUDED.confidence,
                created_by = EXCLUDED.created_by,
                updated_at = NOW()
        """)

        import json
        self.db.execute(sql, {
            "factory_id": self.factory_id,
            "store_id": store_id,
            "domain": self.domain,
            "config_key": config_key,
            "config_value": json.dumps(value, ensure_ascii=False),
            "source": source,
            "confidence": confidence,
            "created_by": created_by,
        })
        self.db.commit()
        logger.info(
            f"[{self.domain}] store override persisted: {config_key} "
            f"(store={store_id}, source={source})"
        )

    # ── 列表查询 (审核 UI 用) ───────────────────────────

    def list_all_overrides(
        self,
        store_id: Optional[str] = None,
        config_key_prefix: Optional[str] = None,
    ) -> list[dict]:
        """列出当前 (factory, domain) 的所有覆盖, 用于审核 UI

        Args:
            store_id: 如果提供, 只返回该门店的覆盖
            config_key_prefix: 如果提供, 只返回 key 以此为前缀的覆盖
                              (例如 'restaurant.cogs.' 只看 COGS 相关)

        Returns:
            [{config_key, store_id, value, source, confidence, updated_at}, ...]
        """
        if self.db is None:
            return []

        where_clauses = ["factory_id = :factory_id", "domain = :domain", "deleted_at IS NULL"]
        params: dict[str, Any] = {"factory_id": self.factory_id, "domain": self.domain}

        if store_id is not None:
            where_clauses.append("store_id = :store_id")
            params["store_id"] = store_id

        if config_key_prefix:
            self._validate_config_key(config_key_prefix + "_")  # 校验前缀本身
            where_clauses.append("config_key LIKE :prefix")
            params["prefix"] = f"{config_key_prefix}%"

        sql = text(f"""
            SELECT id, config_key, store_id, config_value, source,
                   confidence, effective_from, effective_to, updated_at
            FROM business_config_overrides
            WHERE {" AND ".join(where_clauses)}
            ORDER BY config_key, store_id NULLS FIRST
        """)

        rows = self.db.execute(sql, params).fetchall()
        return [
            {
                "id": row.id,
                "config_key": row.config_key,
                "store_id": row.store_id,
                "value": row.config_value,
                "source": row.source,
                "confidence": row.confidence,
                "effective_from": row.effective_from,
                "effective_to": row.effective_to,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]

    def delete_override(self, override_id: int) -> None:
        """软删除覆盖, 回退到上一层

        Args:
            override_id: business_config_overrides.id
        """
        if self.db is None:
            raise RuntimeError("无 db_session")
        self.db.execute(
            text("UPDATE business_config_overrides SET deleted_at = NOW() WHERE id = :id AND factory_id = :fid AND domain = :d"),
            {"id": override_id, "fid": self.factory_id, "d": self.domain},
        )
        self.db.commit()

    # ── 内部方法 ───────────────────────────────────────

    def _validate_config_key(self, config_key: str) -> None:
        """校验 config_key 必须以当前 domain 前缀开头

        Raises:
            ValueError: 前缀不匹配
        """
        if not config_key:
            raise ValueError("config_key 不能为空")

        expected_prefix = f"{self.domain}."
        if not config_key.startswith(expected_prefix):
            raise ValueError(
                f"config_key 必须以 {expected_prefix!r} 开头 (当前 domain={self.domain}), "
                f"收到 {config_key!r}. 跨 domain 配置写入会污染数据, 拒绝执行."
            )

    def _query_db(
        self,
        config_key: str,
        store_id: Optional[str],
    ) -> Optional[ConfigValue]:
        """查询单条 DB 覆盖

        Args:
            config_key: 必须已通过校验
            store_id: None = 工厂级, 非 None = 门店级

        Returns:
            ConfigValue 或 None (没找到)
        """
        if self.db is None:
            return None

        if store_id is None:
            sql = text("""
                SELECT config_value, source, confidence, updated_at
                FROM business_config_overrides
                WHERE factory_id = :factory_id
                  AND domain = :domain
                  AND config_key = :config_key
                  AND store_id IS NULL
                  AND deleted_at IS NULL
                  AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
                  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                ORDER BY updated_at DESC
                LIMIT 1
            """)
            params = {
                "factory_id": self.factory_id,
                "domain": self.domain,
                "config_key": config_key,
            }
            source_label: ConfigSource = "factory"
            notes_text = "工厂级覆盖 (适用于本工厂所有门店)"
        else:
            sql = text("""
                SELECT config_value, source, confidence, updated_at
                FROM business_config_overrides
                WHERE factory_id = :factory_id
                  AND domain = :domain
                  AND config_key = :config_key
                  AND store_id = :store_id
                  AND deleted_at IS NULL
                  AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
                  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                ORDER BY updated_at DESC
                LIMIT 1
            """)
            params = {
                "factory_id": self.factory_id,
                "domain": self.domain,
                "config_key": config_key,
                "store_id": store_id,
            }
            source_label = "store"
            notes_text = f"门店级覆盖 (店 {store_id})"

        row = self.db.execute(sql, params).fetchone()
        if row is None:
            return None

        return ConfigValue(
            value=row.config_value,
            source=source_label,
            confidence=row.confidence or "medium",
            config_key=config_key,
            last_updated=row.updated_at,
            notes=notes_text,
        )
