"""R2 RBAC sweep — 12 endpoints × 3 roles = 36 cells.

Spec: docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md
Parent: docs/qa-specs/2026-05-12-smartbi-python-port-deep-e2e-spec.md §5 R2

Verifies PR #423 (Java @PriceSensitive strip) + PR #435 (Python KPI strip) +
PR #443 (Jackson method-target NPE fix, conditional) cover the 12 critical
price-bearing endpoints across factory_super_admin / warehouse_manager /
operator roles.

Usage:
    python scripts/qa/r2_rbac_sweep.py \\
        --factory F001 \\
        --base-java http://47.100.235.168:10011 \\
        --base-python http://47.100.235.168:8084 \\
        --output docs/qa-evidence/r2-rbac-sweep/

    # Dry-run a single cell (admin × E1):
    python scripts/qa/r2_rbac_sweep.py --dry-run-cell C1-admin --factory F001 ...

Acceptance: 0 FAIL verdicts. WARN / NEEDS_REVIEW explained in report.md.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys

# Force UTF-8 on Windows console so emojis don't crash gbk encoder.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", line_buffering=True)
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    print("ERROR: `requests` library required. Install: pip install requests", file=sys.stderr)
    sys.exit(2)


# ─────────────────────────────────────────────────────────────────────────
# Spec constants — mirror docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md
# ─────────────────────────────────────────────────────────────────────────

ROLES = ["admin", "warehouse_mgr", "operator"]

# Default test credentials. Override via env vars to keep secrets out of repo.
DEFAULT_USERS = {
    "admin": ("factory_admin1", os.environ.get("R2_PW_ADMIN", "123456")),
    "warehouse_mgr": ("warehouse_mgr1", os.environ.get("R2_PW_WAREHOUSE", "123456")),
    "operator": ("f001_operator", os.environ.get("R2_PW_OPERATOR", "123456")),
}

# Endpoints — (cell_prefix, http_method, path_template, backend, expected_per_role)
# Path template uses {factoryId} for Java, {factory_id} for Python (both substituted from --factory).
# {batchId}/{orderId} are resolved at runtime from the admin run of the parent list endpoint.
#
# expected per role:
#   "REAL"  → 200, price fields non-null
#   "STRIP" → 200, price fields all null
#   "403"   → 403 module deny
#   "500_KNOWN_443" → 500 if PR #443 unmerged, STRIP if merged
#   "NEEDS_REVIEW" → 200 stripped, but flagged for Steve (E5 only)
ENDPOINTS = [
    # cell, method, path, backend, expectations (admin, warehouse, operator)
    ("C1", "GET", "/api/mobile/{factoryId}/material-batches?page=1&size=10", "java", ("REAL", "STRIP", "STRIP")),
    ("C2", "GET", "/api/mobile/{factoryId}/material-batches/{batchId}", "java", ("REAL", "STRIP", "STRIP")),
    ("C3", "GET", "/api/mobile/{factoryId}/material-batches/expiring?days=30", "java", ("REAL", "STRIP", "STRIP")),
    ("C4", "GET", "/api/mobile/{factoryId}/material-batches/low-stock", "java", ("REAL", "STRIP", "STRIP")),
    ("C5", "GET", "/api/mobile/{factoryId}/material-batches/inventory/valuation", "java", ("REAL", "NEEDS_REVIEW", "NEEDS_REVIEW")),
    ("C6", "GET", "/api/mobile/{factoryId}/purchase/orders?page=1&size=10", "java", ("REAL", "STRIP", "403")),
    ("C7", "GET", "/api/mobile/{factoryId}/purchase/orders/{purchaseOrderId}", "java", ("REAL", "STRIP", "403")),
    ("C8", "GET", "/api/mobile/{factoryId}/purchase/receives?page=1&size=10", "java", ("REAL", "STRIP", "403")),
    ("C9", "GET", "/api/mobile/{factoryId}/sales/orders?page=1&size=10", "java", ("REAL", "500_KNOWN_443", "403")),
    ("C10", "GET", "/api/mobile/{factoryId}/sales/orders/{salesOrderId}", "java", ("REAL", "500_KNOWN_443", "403")),
    ("C11", "GET", "/api/mobile/{factory_id}/smart-bi/analysis/finance?periodType=MONTH&startDate=2025-01-01&endDate=2025-12-31", "python", ("REAL", "STRIP", "STRIP")),
    ("C12", "GET", "/api/mobile/{factory_id}/smart-bi/dashboard/executive?period=month", "python", ("REAL", "STRIP", "STRIP")),
]

# Java entity-level price field names (per §4.4 of spec).
# Recursive walk: any leaf at any depth whose key matches this set must be null in STRIP.
JAVA_PRICE_FIELDS = frozenset({
    # Order-level
    "totalAmount", "taxAmount", "discountAmount",
    # Item-level
    "unitPrice", "costUnitPrice", "taxRate", "discountRate",
    # MaterialBatch
    "totalPrice", "totalValue",
    # Computed getters (PR #443 — conditional)
    "payableAmount", "lineAmount", "lineAmountWithTax", "costTotal",
})

# Latent leak fields (PR #444 audit, not yet annotated). Detection: WARN, not FAIL.
JAVA_LATENT_LEAK_FIELDS = frozenset({
    "shippingFee", "actualShippedAmount", "estimatedCost", "estimatedProfit",
    "invoicedAmount", "paidAmount",
})

# Python KPI strip pattern — mirror _rbac_strip.py MONEY_CARD_PATTERN.
# We detect by inspecting node title/key/unit. Same regex as helper.
MONEY_CARD_KEYS = frozenset({"value", "rawValue", "change", "targetValue"})
MONEY_PATTERN = re.compile(r"元|金额|收入|成本|利润|总额|采购|销售额|应收|应付|GMV|gmv", re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────
# Result types
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class CellResult:
    cell_id: str
    endpoint: str
    role: str
    expected: str
    actual_status: int
    verdict: str  # PASS / FAIL / WARN / NEEDS_REVIEW / ERROR
    leak_fields: list[dict[str, Any]] = field(default_factory=list)
    warn_fields: list[dict[str, Any]] = field(default_factory=list)
    rationale: str = ""
    raw_response_path: str = ""


# ─────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────

def login(base_java: str, factory_id: str, username: str, password: str) -> str | None:
    """Return access token or None on failure.

    Login endpoint is rate-limited to 5 attempts/60s/IP. On 429 we back off
    once (sleep 65s) and retry — covers the common case of multiple sweep
    runs in close succession.
    """
    import time
    url = f"{base_java}/api/mobile/auth/unified-login"
    payload = {"username": username, "password": password, "factoryId": factory_id}
    resp = requests.post(url, json=payload, timeout=10)
    if resp.status_code == 429:
        print(f"  [LOGIN-RATE-LIMIT] {username}: HTTP 429 — sleeping 65s for window reset...", file=sys.stderr)
        time.sleep(65)
        resp = requests.post(url, json=payload, timeout=10)
    if resp.status_code != 200:
        print(f"  [LOGIN-FAIL] {username}: HTTP {resp.status_code} body={resp.text[:200]}", file=sys.stderr)
        return None
    body = resp.json()
    if not body.get("success"):
        print(f"  [LOGIN-FAIL] {username}: success=false message={body.get('message')}", file=sys.stderr)
        return None
    data = body.get("data") or {}
    # LoginResponse exposes both `token` and (via @JsonProperty) `accessToken`.
    token = data.get("accessToken") or data.get("token")
    if not token:
        print(f"  [LOGIN-FAIL] {username}: no token in response keys={list(data)}", file=sys.stderr)
        return None
    print(f"  [LOGIN-OK] {username} → token...{token[-12:]}")
    return token


# ─────────────────────────────────────────────────────────────────────────
# Leak detection
# ─────────────────────────────────────────────────────────────────────────

def walk_java_payload(node: Any, found_real: list[dict], found_latent: list[dict],
                       path: str = "$") -> None:
    """Recursive walk, collecting non-null annotated price fields + latent leak fields."""
    if isinstance(node, dict):
        for key, value in node.items():
            sub_path = f"{path}.{key}"
            if isinstance(value, (dict, list)):
                walk_java_payload(value, found_real, found_latent, sub_path)
            else:
                if key in JAVA_PRICE_FIELDS and value is not None:
                    found_real.append({"path": sub_path, "field": key, "value": value})
                elif key in JAVA_LATENT_LEAK_FIELDS and value is not None:
                    found_latent.append({"path": sub_path, "field": key, "value": value})
    elif isinstance(node, list):
        for i, item in enumerate(node):
            walk_java_payload(item, found_real, found_latent, f"{path}[{i}]")


def walk_python_kpi(node: Any, found_real: list[dict], path: str = "$") -> None:
    """Walk Python composite. For any dict that looks like a KPI card, check money carriers."""
    if isinstance(node, dict):
        # Is this a money card? Heuristic: has at least one of (key, title, label, unit)
        # that matches the money pattern, AND has at least one of MONEY_CARD_KEYS.
        identity_blob = " ".join(str(node.get(k, "")) for k in ("key", "title", "label", "unit", "name"))
        if MONEY_PATTERN.search(identity_blob):
            for ck in MONEY_CARD_KEYS:
                if ck in node and node[ck] is not None:
                    found_real.append({"path": f"{path}.{ck}", "field": ck, "value": node[ck],
                                       "card_identity": identity_blob.strip()})
        # Recurse regardless — cards can be nested in cards.
        for key, value in node.items():
            walk_python_kpi(value, found_real, f"{path}.{key}")
    elif isinstance(node, list):
        for i, item in enumerate(node):
            walk_python_kpi(item, found_real, f"{path}[{i}]")


# ─────────────────────────────────────────────────────────────────────────
# Cell execution
# ─────────────────────────────────────────────────────────────────────────

def resolve_path(template: str, factory_id: str, ctx_ids: dict[str, str]) -> str | None:
    """Substitute {factoryId}/{factory_id}/{batchId}/{orderId} placeholders.

    Returns None if a required ID isn't in ctx_ids (caller skips cell).
    """
    path = template.replace("{factoryId}", factory_id).replace("{factory_id}", factory_id)
    for placeholder, ctx_key in (("{batchId}", "batchId"),
                                  ("{purchaseOrderId}", "purchaseOrderId"),
                                  ("{salesOrderId}", "salesOrderId")):
        if placeholder in path:
            value = ctx_ids.get(ctx_key)
            if not value:
                return None
            path = path.replace(placeholder, value)
    return path


def run_cell(cell_id: str, method: str, path: str, backend: str, expected: str,
             role: str, token: str, base_java: str, base_python: str,
             pr443_merged: bool, output_dir: Path) -> CellResult:
    base = base_java if backend == "java" else base_python
    url = f"{base}{path}"
    headers = {"Authorization": f"Bearer {token}"}

    # Resolve dynamic expectation
    effective_expected = expected
    if expected == "500_KNOWN_443":
        effective_expected = "STRIP" if pr443_merged else "500"

    try:
        resp = requests.request(method, url, headers=headers, timeout=15)
    except requests.RequestException as e:
        return CellResult(cell_id, path, role, effective_expected, 0,
                          verdict="ERROR", rationale=f"network exception: {e}")

    raw_path = output_dir / "raw" / f"{cell_id}-{role}.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        body = resp.json()
        raw_path.write_text(json.dumps(body, ensure_ascii=False, indent=2, default=str),
                            encoding="utf-8")
    except ValueError:
        body = None
        raw_path.write_text(resp.text, encoding="utf-8")

    result = CellResult(cell_id, path, role, effective_expected, resp.status_code,
                        verdict="?", raw_response_path=str(raw_path.relative_to(output_dir.parent)
                                                            if output_dir.parent in raw_path.parents
                                                            else raw_path))

    # ── Verdict ───────────────────────────────────────────────────────
    if effective_expected == "REAL":
        if resp.status_code != 200:
            result.verdict = "FAIL"
            result.rationale = f"admin expected 200, got {resp.status_code}"
        elif body is None:
            result.verdict = "FAIL"
            result.rationale = "admin expected JSON body, got non-JSON"
        else:
            # Walk and require ≥1 non-null price field (otherwise factory has no data
            # and the cell is uninformative — we WARN rather than PASS).
            real_fields: list[dict] = []
            latent_fields: list[dict] = []
            walk_java_payload(body, real_fields, latent_fields)
            if backend == "python":
                python_kpi: list[dict] = []
                walk_python_kpi(body, python_kpi)
                real_fields.extend(python_kpi)
            if not real_fields:
                result.verdict = "WARN"
                result.rationale = "admin got 200 but payload has no price fields visible — possibly empty factory data, cell uninformative"
            else:
                result.verdict = "PASS"
                result.rationale = f"admin sees {len(real_fields)} non-null price field(s) (sampled: {real_fields[0]['path']}={real_fields[0]['value']})"
            result.warn_fields = latent_fields  # admin sees latent leaks too — log informationally

    elif effective_expected == "STRIP":
        if resp.status_code != 200:
            result.verdict = "FAIL"
            result.rationale = f"{role} expected 200 stripped, got {resp.status_code}"
        elif body is None:
            result.verdict = "FAIL"
            result.rationale = f"{role} expected JSON body, got non-JSON"
        else:
            real_fields = []
            latent_fields = []
            walk_java_payload(body, real_fields, latent_fields)
            if backend == "python":
                python_kpi = []
                walk_python_kpi(body, python_kpi)
                real_fields.extend(python_kpi)
            result.leak_fields = real_fields
            result.warn_fields = latent_fields
            if real_fields:
                result.verdict = "FAIL"
                result.rationale = f"🔴 {role} sees {len(real_fields)} non-null price field(s) that should be stripped (first: {real_fields[0]['path']}={real_fields[0]['value']})"
            else:
                result.verdict = "PASS"
                latent_note = f" — also flagged {len(latent_fields)} latent-leak field(s) per PR #444" if latent_fields else ""
                result.rationale = f"{role} sees all annotated price fields stripped{latent_note}"

    elif effective_expected == "403":
        if resp.status_code == 403:
            result.verdict = "PASS"
            msg = (body or {}).get("message", "(no message)") if isinstance(body, dict) else "(non-JSON)"
            result.rationale = f"{role} correctly denied: {msg}"
        elif resp.status_code == 200:
            result.verdict = "FAIL"
            result.rationale = f"🔴 {role} expected 403 but got 200 — module gate missing"
        else:
            result.verdict = "FAIL"
            result.rationale = f"{role} expected 403, got {resp.status_code}"

    elif effective_expected == "500":
        # PR #443 unmerged case — 500 on warehouse C9/C10 is KNOWN, not FAIL.
        if resp.status_code == 500:
            result.verdict = "WARN"
            result.rationale = "💥 500 NPE as expected pre-PR #443 (computed getter NPE) — not a new bug"
        elif resp.status_code == 200:
            result.verdict = "WARN"
            result.rationale = "unexpected: expected 500-KNOWN but got 200 — PR #443 may have merged; rerun with detection"
        else:
            result.verdict = "FAIL"
            result.rationale = f"expected 500-KNOWN, got {resp.status_code}"

    elif effective_expected == "NEEDS_REVIEW":
        # E5 valuation — capture response shape, defer verdict to Steve.
        if resp.status_code == 200:
            real_fields = []
            latent_fields = []
            walk_java_payload(body, real_fields, latent_fields)
            result.leak_fields = real_fields
            result.verdict = "NEEDS_REVIEW"
            result.rationale = (f"E5 valuation: {role} sees {len(real_fields)} non-null price field(s). "
                                f"Strip-only design per §5.2 — Steve decides if whole-endpoint deny needed.")
        elif resp.status_code == 403:
            result.verdict = "NEEDS_REVIEW"
            result.rationale = f"E5 valuation: {role} got 403 — endpoint already gated; spec §5.2 Option B in effect."
        else:
            result.verdict = "FAIL"
            result.rationale = f"E5 unexpected status: {resp.status_code}"

    return result


# ─────────────────────────────────────────────────────────────────────────
# Setup: resolve context IDs (batchId, orderIds) from admin pre-run
# ─────────────────────────────────────────────────────────────────────────

def fetch_first_id(base_java: str, factory_id: str, token: str, path_template: str,
                   id_field: str) -> str | None:
    """Hit a list endpoint as admin, return first record's `id` (or specified field)."""
    url = f"{base_java}{path_template.replace('{factoryId}', factory_id)}"
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if resp.status_code != 200:
        print(f"  [CTX-FAIL] {path_template}: HTTP {resp.status_code}", file=sys.stderr)
        return None
    try:
        body = resp.json()
    except ValueError:
        return None
    data = body.get("data") or {}
    content = data.get("content") if isinstance(data, dict) else None
    if isinstance(content, list) and content:
        first = content[0]
        return str(first.get(id_field) or first.get("id") or "") or None
    if isinstance(data, list) and data:
        first = data[0]
        return str(first.get(id_field) or first.get("id") or "") or None
    return None


def resolve_context_ids(base_java: str, factory_id: str, admin_token: str) -> dict[str, str]:
    ctx: dict[str, str] = {}
    print("[ctx] Resolving record IDs via admin pre-fetch...")
    ctx["batchId"] = fetch_first_id(base_java, factory_id, admin_token,
                                    "/api/mobile/{factoryId}/material-batches?page=1&size=10",
                                    "id") or ""
    ctx["purchaseOrderId"] = fetch_first_id(base_java, factory_id, admin_token,
                                            "/api/mobile/{factoryId}/purchase/orders?page=1&size=10",
                                            "id") or ""
    ctx["salesOrderId"] = fetch_first_id(base_java, factory_id, admin_token,
                                         "/api/mobile/{factoryId}/sales/orders?page=1&size=10",
                                         "id") or ""
    for k, v in ctx.items():
        print(f"  {k} = {v or '(not found — detail cells will skip)'}")
    return ctx


# ─────────────────────────────────────────────────────────────────────────
# PR #443 state
# ─────────────────────────────────────────────────────────────────────────

def detect_pr443_state() -> bool:
    """Return True if PR #443 is MERGED, else False."""
    try:
        result = subprocess.run(
            ["gh", "pr", "view", "443", "--json", "state,mergedAt"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            print(f"[pr443] gh pr view failed (rc={result.returncode}): {result.stderr.strip()}", file=sys.stderr)
            return False
        data = json.loads(result.stdout)
        state = data.get("state")
        merged = state == "MERGED" or bool(data.get("mergedAt"))
        print(f"[pr443] state={state} merged={merged}")
        return merged
    except (subprocess.SubprocessError, json.JSONDecodeError, FileNotFoundError) as e:
        print(f"[pr443] detection error: {e} — assuming OPEN", file=sys.stderr)
        return False


# ─────────────────────────────────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────────────────────────────────

def render_report(results: list[CellResult], pr443_merged: bool) -> str:
    verdict_emoji = {"PASS": "✅", "FAIL": "🔴", "WARN": "⚠️", "NEEDS_REVIEW": "🟡", "ERROR": "❓"}
    lines = [
        "# R2 RBAC Sweep — Result Report",
        "",
        f"PR #443 state: {'MERGED' if pr443_merged else 'OPEN'}",
        "",
        "## Verdict summary",
        "",
        "| Cell | Role | Expected | Status | Verdict | Rationale |",
        "|---|---|---|---|---|---|",
    ]
    for r in results:
        emoji = verdict_emoji.get(r.verdict, "?")
        lines.append(f"| {r.cell_id} | {r.role} | {r.expected} | {r.actual_status} | {emoji} {r.verdict} | {r.rationale} |")
    counts: dict[str, int] = {}
    for r in results:
        counts[r.verdict] = counts.get(r.verdict, 0) + 1
    lines.extend([
        "",
        "## Summary counts",
        "",
        *(f"- {verdict_emoji.get(v, '?')} {v}: {c}" for v, c in sorted(counts.items())),
        "",
        "## Acceptance",
        "",
        f"- 0 FAIL: {'✅' if counts.get('FAIL', 0) == 0 else '🔴 ' + str(counts.get('FAIL', 0)) + ' FAIL'}",
        f"- WARN/NEEDS_REVIEW need explanation: {counts.get('WARN', 0) + counts.get('NEEDS_REVIEW', 0)}",
        "",
        "## Per-cell leak detail",
        "",
    ])
    for r in results:
        if r.leak_fields or r.warn_fields:
            lines.append(f"### {r.cell_id}-{r.role}")
            lines.append("")
            if r.leak_fields:
                lines.append("**Real leaks (annotated fields with non-null values):**")
                for f in r.leak_fields[:20]:
                    lines.append(f"- `{f.get('path')}` = `{f.get('value')}`")
                if len(r.leak_fields) > 20:
                    lines.append(f"- ... and {len(r.leak_fields) - 20} more")
                lines.append("")
            if r.warn_fields:
                lines.append("**Latent leaks (PR #444 audit — expected, not P0):**")
                for f in r.warn_fields[:10]:
                    lines.append(f"- `{f.get('path')}` = `{f.get('value')}`")
                if len(r.warn_fields) > 10:
                    lines.append(f"- ... and {len(r.warn_fields) - 10} more")
                lines.append("")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--factory", default="F001", help="Factory ID (default F001)")
    parser.add_argument("--base-java", default="http://139.196.165.140:8097",
                        help="Java test backend base URL (nginx test vhost — proxies to 47:10011)")
    parser.add_argument("--base-python", default="http://139.196.165.140:8097",
                        help="Python test service base URL (same nginx vhost proxies smart-bi to 47:8084)")
    parser.add_argument("--output", default="docs/qa-evidence/r2-rbac-sweep/",
                        help="Output directory for matrix.json / report.md / raw/")
    parser.add_argument("--dry-run-cell", default=None,
                        help="Run a single cell only (e.g. C1-admin). Useful for script validation.")
    parser.add_argument("--assume-pr443-merged", action="store_true",
                        help="Skip gh-cli detection and assume PR #443 merged.")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    pr443_merged = True if args.assume_pr443_merged else detect_pr443_state()
    print(f"[init] factory={args.factory} java={args.base_java} python={args.base_python}")
    print(f"[init] PR #443 merged: {pr443_merged}")

    # ── Login all 3 roles ───────────────────────────────────────────────
    tokens: dict[str, str] = {}
    for role in ROLES:
        username, password = DEFAULT_USERS[role]
        print(f"[login] {role} ({username})...")
        token = login(args.base_java, args.factory, username, password)
        if token:
            tokens[role] = token
        else:
            print(f"  → SKIPPING {role} cells (login failed)", file=sys.stderr)

    # ── Resolve detail IDs ───────────────────────────────────────────────
    ctx_ids = resolve_context_ids(args.base_java, args.factory, tokens["admin"]) if "admin" in tokens else {}

    # ── Sweep ────────────────────────────────────────────────────────────
    results: list[CellResult] = []
    for cell_id, method, path_tmpl, backend, expectations in ENDPOINTS:
        path = resolve_path(path_tmpl, args.factory, ctx_ids)
        if path is None:
            print(f"[skip] {cell_id} — no context ID available for path template {path_tmpl}")
            for role, expected in zip(ROLES, expectations):
                results.append(CellResult(cell_id, path_tmpl, role, expected, 0,
                                          verdict="ERROR",
                                          rationale="context ID missing — admin pre-fetch returned no records"))
            continue
        for role, expected in zip(ROLES, expectations):
            label = f"{cell_id}-{role}"
            if args.dry_run_cell and args.dry_run_cell != label:
                continue
            if role not in tokens:
                results.append(CellResult(cell_id, path, role, expected, 0,
                                          verdict="ERROR", rationale="no token (login failed)"))
                continue
            print(f"[run] {label} GET {path}")
            result = run_cell(cell_id, method, path, backend, expected, role,
                              tokens[role], args.base_java, args.base_python,
                              pr443_merged, output_dir)
            print(f"  → {result.verdict}: {result.rationale}")
            results.append(result)

    # ── Output ───────────────────────────────────────────────────────────
    matrix_path = output_dir / "matrix.json"
    matrix_path.write_text(json.dumps([asdict(r) for r in results], ensure_ascii=False,
                                      indent=2, default=str), encoding="utf-8")
    print(f"[out] matrix → {matrix_path}")

    report = render_report(results, pr443_merged)
    report_path = output_dir / "report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"[out] report → {report_path}")

    # Exit code: nonzero iff any FAIL
    fail_count = sum(1 for r in results if r.verdict == "FAIL")
    if fail_count:
        print(f"\n🔴 {fail_count} FAIL cells — see {report_path}", file=sys.stderr)
        return 1
    print(f"\n✅ 0 FAIL ({len(results)} cells total)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
