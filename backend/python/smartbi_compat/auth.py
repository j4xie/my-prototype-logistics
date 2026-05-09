"""JWT verification + cross-factory enforcement for SmartBI alias endpoints.

Used as a FastAPI Depends(...) on every alias route under
/api/mobile/{factory_id}/smart-bi/*. Verifies HS256-signed JWT against
shared secret, enforces:
  - bearer token present, signature valid, not expired
  - if token has factoryId, must equal URL path factory_id
  - if token has no factoryId, role must be in PRIVILEGED_ROLES
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import HTTPException, Request

JWT_ALGORITHM = "HS256"
PRIVILEGED_ROLES = frozenset({"platform_admin", "platform_super_admin"})


def _get_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET env var not set. systemd cretas-python.service must "
            "have EnvironmentFile=/www/wwwroot/cretas/.env.prod (Phase 2A T1)."
        )
    return secret


@dataclass(frozen=True)
class AuthContext:
    user_id: int
    username: str
    factory_id: str   # 始终非 None；null-factoryId token 时取 URL path 的值
    role: str


async def verify_jwt_and_factory(
    request: Request,
    factory_id: str,
) -> AuthContext:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token in Authorization header")
    token = auth_header[len("Bearer "):]

    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    token_factory: Optional[str] = payload.get("factoryId")
    role: str = payload.get("role") or ""

    if token_factory is None:
        if role not in PRIVILEGED_ROLES:
            raise HTTPException(
                403,
                "Token without factoryId requires platform_admin role for SmartBI access",
            )
    else:
        if token_factory != factory_id:
            raise HTTPException(
                403,
                f"Cross-factory access denied: token factoryId={token_factory} URL factoryId={factory_id}",
            )

    return AuthContext(
        user_id=int(payload["userId"]),
        username=payload.get("username") or "",
        factory_id=factory_id,
        role=role,
    )
