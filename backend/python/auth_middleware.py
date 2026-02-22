"""
JWT Authentication Middleware for Python Services

Verifies JWT tokens issued by the Java backend (HS256).
Extracts factoryId and injects it into request.state for downstream endpoints.

Whitelist paths (no auth required):
- /health, /docs, /redoc, /openapi.json, / (root)
- /api/public/* (public endpoints)
- /api/chart/*, /api/smartbi/chart/* (stateless data processing)

Protected paths:
- /api/smartbi/excel/*, /api/insight/*, /api/forecast/*,
  /api/statistical/*, /api/chat/*, /api/analysis/*,
  /api/ml/*, /api/linucb/*, /api/finance/*, /api/food-kb/*
"""
from __future__ import annotations

import json
import logging
from typing import Optional, Set

import jwt as pyjwt
from fastapi import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

# Paths that do NOT require authentication
PUBLIC_PATHS: Set[str] = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
}

# Path prefixes that do NOT require authentication
PUBLIC_PREFIXES = (
    "/api/public/",
    "/api/ai/",          # AI proxy — called by Java backend internally
    "/api/classifier/",  # Classifier — called by Java backend internally
    "/api/client-requirement/",  # Client requirement wizard (public)
    "/api/chart/",       # Chart building — stateless data processing, no user context needed
    "/api/smartbi/chart/",  # SmartBI chart endpoints (same reason)
)


class JWTAuthMiddleware:
    """
    Pure ASGI middleware that validates JWT Bearer tokens on protected endpoints.

    Compatible with Java JwtUtil.java:
    - Algorithm: HS256
    - Claims: userId, factoryId, username, role
    - Secret: raw UTF-8 bytes (>=32 bytes for HS256)
    """

    def __init__(self, app: ASGIApp, jwt_secret: str, enabled: bool = True):
        self.app = app
        self.enabled = enabled
        # Match Java's key derivation: UTF-8 bytes, pad to 32 if shorter
        key_bytes = jwt_secret.encode("utf-8")
        if len(key_bytes) < 32:
            key_bytes = key_bytes + b"\x00" * (32 - len(key_bytes))
        self.jwt_secret = key_bytes
        logger.info(f"JWTAuthMiddleware initialized, enabled={enabled}")

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        # Skip auth if disabled
        if not self.enabled:
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # Skip public paths
        if path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return

        # Skip public prefixes
        if any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES):
            await self.app(scope, receive, send)
            return

        # Extract headers from scope
        headers = dict(
            (k.decode("latin-1").lower(), v.decode("latin-1"))
            for k, v in scope.get("headers", [])
        )

        # Allow legacy X-Internal-Secret for Java->Python internal calls
        internal_secret = headers.get("x-internal-secret", "")
        if internal_secret == "cretas-internal-2026":
            # Inject auth info into scope state
            if "state" not in scope:
                scope["state"] = {}
            scope["state"]["factory_id"] = None
            scope["state"]["user_id"] = None
            scope["state"]["auth_method"] = "internal"
            await self.app(scope, receive, send)
            return

        # Extract Bearer token
        auth_header = headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            await self._send_json_response(send, 401, {
                "success": False,
                "message": "Missing or invalid Authorization header",
                "code": "UNAUTHORIZED",
            })
            return

        token = auth_header[7:]  # Strip "Bearer "

        # Verify JWT
        claims = self._verify_token(token)
        if claims is None:
            await self._send_json_response(send, 401, {
                "success": False,
                "message": "Invalid or expired token",
                "code": "TOKEN_INVALID",
            })
            return

        # Inject claims into scope state for downstream access via request.state
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["factory_id"] = claims.get("factoryId")
        scope["state"]["user_id"] = claims.get("userId")
        scope["state"]["username"] = claims.get("sub")
        scope["state"]["role"] = claims.get("role")
        scope["state"]["auth_method"] = "jwt"

        await self.app(scope, receive, send)

    def _verify_token(self, token: str) -> Optional[dict]:
        """Verify JWT token and return claims, or None if invalid."""
        try:
            payload = pyjwt.decode(
                token,
                self.jwt_secret,
                algorithms=["HS256"],
                options={"verify_exp": True},
            )
            return payload
        except pyjwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None
        except pyjwt.InvalidTokenError as e:
            logger.warning(f"JWT verification failed: {e}")
            return None

    @staticmethod
    async def _send_json_response(send: Send, status_code: int, body: dict):
        """Send a JSON error response directly via ASGI."""
        body_bytes = json.dumps(body).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": status_code,
            "headers": [
                [b"content-type", b"application/json"],
                [b"access-control-allow-origin", b"*"],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body_bytes,
        })


def get_factory_id_from_request(request: Request) -> Optional[str]:
    """Helper to extract factory_id from request state (set by middleware)."""
    return getattr(request.state, "factory_id", None)


def require_factory_match(request: Request, factory_id: str) -> Optional[JSONResponse]:
    """
    Verify that the authenticated user's factoryId matches the requested factory_id.
    Returns a 403 JSONResponse if mismatch, or None if OK.

    Usage in endpoint:
        error = require_factory_match(request, body.factory_id)
        if error:
            return error
    """
    auth_method = getattr(request.state, "auth_method", None)

    # Internal calls (Java->Python) bypass factory check
    if auth_method == "internal":
        return None

    token_factory_id = getattr(request.state, "factory_id", None)

    # If token has no factoryId (e.g. platform_admin), allow all
    if not token_factory_id:
        return None

    # If request doesn't specify factory_id, allow (endpoint handles its own logic)
    if not factory_id:
        return None

    if token_factory_id != factory_id:
        logger.warning(
            f"Factory ID mismatch: token={token_factory_id}, request={factory_id}"
        )
        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "message": f"Access denied: you belong to {token_factory_id}, not {factory_id}",
                "code": "FACTORY_MISMATCH",
            },
        )

    return None
