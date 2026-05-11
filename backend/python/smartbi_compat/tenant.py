"""Tenant-type detection for restaurant vs factory semantic branching.

Mirrors Java ``SmartBIServiceImpl.java:434-435`` predicate (verified
2026-05-12). Used by Phase B T6.6 ``/analysis/production`` +
``/analysis/quality`` endpoints (Q4 + Q5 Option B per PR #330) and any
future polymorphic endpoint that varies output shape by tenant type.

Source of truth: ``cretas_db.factories.type`` (PostgreSQL enum-as-VARCHAR).

Java predicate (canonical):

    f.getType() == FactoryType.RESTAURANT || f.getType() == FactoryType.BRANCH

The Java enum has 5 values; for tenant-typed envelope (Q-DEC-8 Option A
discriminator) we collapse to 2 logical groups:

    RESTAURANT, BRANCH                 → restaurant semantics
    FACTORY, HEADQUARTERS, CENTRAL_KITCHEN, unknown, missing → factory semantics

Spec: docs/superpowers/specs/2026-05-11-q4-q5-restaurant-analysis-impl-spec.md §2.2
First consumer: ``smartbi_compat.api.analysis_production`` (chat-A1, 2026-05-12).
Co-consumer: ``smartbi_compat.api.analysis_quality`` (chat-B1).
"""
from __future__ import annotations

from enum import Enum
from typing import Optional


class TenantType(str, Enum):
    """Mirror Java ``com.cretas.aims.entity.enums.FactoryType``.

    String values match Java enum names exactly so
    ``TenantType(db_row["type"])`` parses ``cretas_db.factories.type``
    column directly.

    Note: HEADQUARTERS + CENTRAL_KITCHEN are treated as factory for Q4/Q5
    per Java precedent — Java ``isRestaurantTenant`` only matches
    RESTAURANT + BRANCH.
    """

    FACTORY = "FACTORY"
    RESTAURANT = "RESTAURANT"
    HEADQUARTERS = "HEADQUARTERS"
    BRANCH = "BRANCH"
    CENTRAL_KITCHEN = "CENTRAL_KITCHEN"

    @property
    def is_restaurant_tenant(self) -> bool:
        """Return True iff this tenant uses restaurant analytical semantics.

        Mirror Java ``SmartBIServiceImpl.isRestaurantTenant`` line 432-435:
        only ``RESTAURANT`` and ``BRANCH`` route through restaurant
        branches in Q4/Q5 polymorphic endpoints.
        """
        return self in (TenantType.RESTAURANT, TenantType.BRANCH)

    @property
    def is_factory_tenant(self) -> bool:
        """Return True iff this tenant uses factory analytical semantics.

        Convenience inverse of ``is_restaurant_tenant``. Covers FACTORY,
        HEADQUARTERS, CENTRAL_KITCHEN.
        """
        return not self.is_restaurant_tenant

    @property
    def envelope_discriminator(self) -> str:
        """Tenant-type string for Option A response envelope (Q-DEC-8).

        Per spec §1.2 the envelope ``tenantType`` field is the binary
        discriminator ``"FACTORY"`` | ``"RESTAURANT"`` — HEADQUARTERS /
        CENTRAL_KITCHEN collapse into ``"FACTORY"`` per Java precedent.
        """
        return "RESTAURANT" if self.is_restaurant_tenant else "FACTORY"

    @classmethod
    def from_db_value(cls, value: Optional[str]) -> "TenantType":
        """Parse ``cretas_db.factories.type`` VARCHAR column.

        Defensive: None / empty / unknown → ``FACTORY`` (matches Java
        ``isRestaurantTenant`` returning ``false`` on missing rows /
        repository failures).
        """
        if not value:
            return cls.FACTORY
        try:
            return cls(value.upper())
        except ValueError:
            return cls.FACTORY


async def get_tenant_type(factory_id: str, conn) -> TenantType:
    """Query ``cretas_db.factories`` to determine the tenant type.

    Parameters
    ----------
    factory_id : str
        External factory_id (e.g. ``"F001"``, ``"R_ILTEATRO_REAL"``).
    conn : asyncpg.Connection
        Connection bound to ``cretas_db`` (NOT ``smartbi_db``). The
        ``factories`` table lives in the main app DB.

    Returns
    -------
    TenantType
        Defaults to ``FACTORY`` when the row is missing — matches Java
        ``isRestaurantTenant`` which returns ``false`` (i.e. factory
        branch) on missing rows, preserving legacy manufacturing path.
    """
    row = await conn.fetchrow(
        "SELECT type FROM factories WHERE factory_id = $1",
        factory_id,
    )
    if row is None:
        return TenantType.FACTORY
    return TenantType.from_db_value(row["type"])
