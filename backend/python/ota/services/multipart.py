"""Compose multipart/mixed responses per Expo Updates v1 protocol.

The protocol response is a multipart/mixed body with named parts:
- Normal update: parts `manifest` + `extensions`
- No-update / rollback: a single `directive` part

Each part has its own Content-Type and optional `expo-signature` header per
RFC 2046. Boundaries are random hex strings, fresh per response.
"""
from __future__ import annotations

import secrets

_CRLF = "\r\n"


def _random_boundary() -> str:
    """32 hex chars — plenty of entropy, won't clash with JSON content."""
    return secrets.token_hex(16)


def _format_part(
    *,
    boundary: str,
    name: str,
    body: str,
    content_type: str,
    extra_headers: dict[str, str] | None = None,
) -> str:
    lines = [
        f"--{boundary}",
        f'Content-Disposition: form-data; name="{name}"',
        f"Content-Type: {content_type}",
    ]
    if extra_headers:
        lines.extend(f"{k}: {v}" for k, v in extra_headers.items())
    lines.append("")  # blank line separator before body
    lines.append(body)
    return _CRLF.join(lines)


def build_normal_update_response(
    *,
    manifest_json: str,
    extensions_json: str,
    manifest_signature_header: str | None,
) -> tuple[bytes, str]:
    """Build a multipart/mixed body with manifest + extensions parts.

    Returns (body_bytes, content_type_header_value).

    `manifest_signature_header`, if provided, is added as an `expo-signature`
    header on the manifest part only (per spec §2.1).
    """
    boundary = _random_boundary()
    manifest_extra = (
        {"expo-signature": manifest_signature_header}
        if manifest_signature_header
        else None
    )
    parts = [
        _format_part(
            boundary=boundary,
            name="manifest",
            body=manifest_json,
            content_type="application/json; charset=utf-8",
            extra_headers=manifest_extra,
        ),
        _format_part(
            boundary=boundary,
            name="extensions",
            body=extensions_json,
            content_type="application/json",
        ),
    ]
    body_str = _CRLF.join(parts) + _CRLF + f"--{boundary}--" + _CRLF
    return body_str.encode("utf-8"), f"multipart/mixed; boundary={boundary}"


def build_directive_response(
    directive_json: str,
    *,
    signature_header: str | None = None,
) -> tuple[bytes, str]:
    """Build a multipart/mixed body with a single directive part.

    Used for both noUpdateAvailable and rollBackToEmbedded responses.
    """
    boundary = _random_boundary()
    extra = (
        {"expo-signature": signature_header} if signature_header else None
    )
    part = _format_part(
        boundary=boundary,
        name="directive",
        body=directive_json,
        content_type="application/json; charset=utf-8",
        extra_headers=extra,
    )
    body_str = part + _CRLF + f"--{boundary}--" + _CRLF
    return body_str.encode("utf-8"), f"multipart/mixed; boundary={boundary}"
