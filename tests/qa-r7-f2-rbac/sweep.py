"""R7 Path F3 — 5×5 RBAC negative regression sweep.

Per docs/qa-specs/2026-05-14-r7-deep-e2e-spec-draft.md §5.3 F3.
Per docs/qa-specs/2026-05-12-r2-rbac-sweep-matrix.md §4 (canonical endpoint set).

Scope adjustment (chat5 dispatch, Steve sign-off 2026-05-14):
  3 restaurant factories only have admin accounts → 12 of 25 cells N/A.
  13 cells are real (F001×5 + F006×5 + 3 restaurant admins).

Output:
  tokens.json     — captured JWTs per account
  cells.json      — per-cell response shape (HTTP, leak detection)
  matrix.md       — human-readable verdict table

This script is idempotent: re-run = re-test (tokens cached on disk).
"""
from __future__ import annotations
import json
import time
import sys
import re
import pathlib
import urllib.request
import urllib.error

BASE = "http://139.196.165.140:8086"
LOGIN_PATH = "/api/mobile/auth/unified-login"
DEVICE = {"deviceId": "qa-r7-f2-chat5", "deviceModel": "chat",
          "platform": "WEB", "osVersion": "1.0"}

OUT_DIR = pathlib.Path(__file__).parent
TOKEN_FILE = OUT_DIR / "tokens.json"
CELLS_FILE = OUT_DIR / "cells.json"
EVIDENCE_DIR = OUT_DIR / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# 13 (factory, role, username) cells. Restaurants admin-only.
CELLS = [
    ("F001", "factory_super_admin", "factory_admin1"),
    ("F001", "warehouse_manager",   "f001_warehouse_mgr"),
    ("F001", "finance_manager",     "f001_finance_mgr"),
    ("F001", "sales_manager",       "f001_sales_mgr"),
    ("F001", "operator",            "f001_operator"),
    ("F006", "factory_super_admin", "f006_admin"),
    ("F006", "warehouse_manager",   "f006_warehouse_mgr"),
    ("F006", "finance_manager",     "f006_finance_mgr"),
    ("F006", "sales_manager",       "f006_sales_mgr"),
    ("F006", "operator",            "f006_worker1"),
    ("RES_3101_009", "factory_super_admin", "qhj_prod"),
    ("R_GML_DEMO",   "factory_super_admin", "gml_admin"),
    ("R_XMX_CHAIN",  "factory_super_admin", "xmx_admin"),
]

PASSWORD = "123456"  # documented in reference_f006_liutengmen_prod_accounts.md

# 7-endpoint subset of R2 spec §4.2.
# (label, method, path_template, body) — path uses {fid} substitution.
ENDPOINTS = [
    ("E1_material_batches_list",     "GET",  "/api/mobile/{fid}/material-batches?page=1&size=5",     None),
    ("E5_inventory_valuation",       "GET",  "/api/mobile/{fid}/material-batches/inventory/valuation", None),
    ("E6_purchase_orders_list",      "GET",  "/api/mobile/{fid}/purchase/orders?page=1&size=5",      None),
    ("E8_purchase_receives_list",    "GET",  "/api/mobile/{fid}/purchase/receives?page=1&size=5",    None),
    ("E9_sales_orders_list",         "GET",  "/api/mobile/{fid}/sales/orders?page=1&size=5",         None),
    ("E11_smartbi_analysis_finance", "GET",  "/api/mobile/{fid}/smart-bi/analysis/finance?periodType=MONTH&startDate=2025-01-01&endDate=2025-12-31", None),
    ("E12_smartbi_dashboard_exec",   "GET",  "/api/mobile/{fid}/smart-bi/dashboard/executive?period=month", None),
]

# Price field names per R2 §4.4 (Java endpoints — order/item-level).
JAVA_PRICE_KEYS = {
    "totalAmount", "taxAmount", "discountAmount", "shippingFee", "actualShippedAmount",
    "unitPrice", "costUnitPrice", "taxRate", "discountRate",
    "totalPrice", "totalValue",
    "payableAmount", "lineAmount", "lineAmountWithTax", "costTotal",
}
# Money pattern for Python KPI cards (per _rbac_strip.py keyword set).
MONEY_PAT = re.compile(r"(元|金额|收入|成本|利润|总额|价|价格|amount|price|revenue|cost)", re.I)
KPI_VALUE_KEYS = {"value", "rawValue", "change", "targetValue", "totalAmount"}


def _http(method: str, url: str, headers=None, body=None, timeout=20):
    """Minimal urllib wrapper returning (status, text)."""
    req = urllib.request.Request(
        url, method=method,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=(headers or {}) | {"Content-Type": "application/json; charset=utf-8"}
        if body is not None else (headers or {}),
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return -1, f"NET_ERR:{type(e).__name__}:{e}"


def login(username: str, max_wait=180) -> dict | None:
    """Login with rate-limit awareness; up to 3 retries on 429."""
    body = {"username": username, "password": PASSWORD, "deviceInfo": DEVICE}
    waited = 0
    while True:
        status, text = _http("POST", BASE + LOGIN_PATH, body=body)
        try:
            j = json.loads(text)
        except Exception:
            return {"ok": False, "raw": text[:300], "http": status}
        if status == 200 and j.get("success"):
            data = j.get("data") or {}
            return {
                "ok": True,
                "token": data.get("token") or data.get("accessToken"),
                "factoryId": data.get("factoryId"),
                "role": data.get("role"),
                "factoryType": data.get("factoryType"),
            }
        if j.get("code") == 429:
            if waited >= max_wait:
                return {"ok": False, "code": 429, "msg": j.get("message")}
            sleep_s = 65
            print(f"  [rate-limit] sleeping {sleep_s}s for {username}", flush=True)
            time.sleep(sleep_s)
            waited += sleep_s
            continue
        return {"ok": False, "code": j.get("code"), "msg": j.get("message")}


def collect_tokens() -> dict:
    """Login all 13 cells; cache to disk; reuse on re-run."""
    if TOKEN_FILE.exists():
        tokens = json.loads(TOKEN_FILE.read_text())
        # Re-login any cell with no token cached.
        need = [c for c in CELLS if c[2] not in tokens or not tokens[c[2]].get("ok")]
        if not need:
            print(f"[tokens] all 13 cached at {TOKEN_FILE}", flush=True)
            return tokens
    else:
        tokens = {}
    for fid, role, user in CELLS:
        if user in tokens and tokens[user].get("ok"):
            print(f"  [skip] {user} cached", flush=True)
            continue
        print(f"  [login] {user} ({fid}/{role})", flush=True)
        r = login(user)
        tokens[user] = r
        TOKEN_FILE.write_text(json.dumps(tokens, indent=2, ensure_ascii=False))
        time.sleep(2)  # gentle pacing to avoid burst rate-limit
    return tokens


def _walk_for_price_leak(payload, found: dict):
    """Recursively look for non-null values under price-sensitive keys."""
    if isinstance(payload, dict):
        for k, v in payload.items():
            if k in JAVA_PRICE_KEYS and v is not None and not isinstance(v, (dict, list)):
                found.setdefault(k, []).append(v)
            # KPI cards: if name/title matches money pattern AND value key has non-null
            if isinstance(v, (dict, list)):
                _walk_for_price_leak(v, found)
        # KPI-card style: this dict is a card if it has a money-pattern name/title
        title = str(payload.get("name") or payload.get("title") or "")
        if MONEY_PAT.search(title):
            for vk in KPI_VALUE_KEYS:
                if vk in payload and payload[vk] is not None:
                    found.setdefault(f"KPI_money_card:{title}:{vk}", []).append(payload[vk])
    elif isinstance(payload, list):
        for x in payload:
            _walk_for_price_leak(x, found)


def sweep_cell(token: str, fid: str) -> dict:
    """Run 7-endpoint probe; return per-endpoint result."""
    out = {}
    for label, method, path_tpl, body in ENDPOINTS:
        url = BASE + path_tpl.format(fid=fid)
        status, text = _http(method, url, headers={"Authorization": f"Bearer {token}"})
        result = {"http": status}
        try:
            j = json.loads(text)
            result["success"] = j.get("success")
            result["code"] = j.get("code")
            result["message"] = j.get("message")
            payload = j.get("data")
            leaks = {}
            if payload is not None:
                _walk_for_price_leak(payload, leaks)
            result["leaks"] = leaks
            # Row count signal
            if isinstance(payload, dict):
                content = payload.get("content")
                if isinstance(content, list):
                    result["rows"] = len(content)
                    result["total"] = payload.get("totalElements")
        except Exception as e:
            result["parse_err"] = str(e)
            result["body_head"] = text[:200]
        out[label] = result
        time.sleep(0.3)  # gentle pacing
    return out


def main():
    tokens = collect_tokens()
    ok_users = [u for u, t in tokens.items() if t.get("ok")]
    fail_users = [u for u, t in tokens.items() if not t.get("ok")]
    print(f"\n[tokens] {len(ok_users)}/{len(CELLS)} OK; fail={fail_users}\n", flush=True)

    if CELLS_FILE.exists():
        cells = json.loads(CELLS_FILE.read_text())
    else:
        cells = {}

    for fid, role, user in CELLS:
        if user in cells:
            print(f"  [skip cell] {user} cached", flush=True)
            continue
        t = tokens.get(user, {})
        if not t.get("ok"):
            cells[user] = {"_meta": {"factoryId": fid, "role": role, "token_err": t}}
        else:
            print(f"  [sweep] {user} ({fid}/{role})", flush=True)
            r = sweep_cell(t["token"], fid)
            cells[user] = {"_meta": {"factoryId": fid, "role": role,
                                     "tokenFactoryId": t.get("factoryId"),
                                     "tokenRole": t.get("role"),
                                     "factoryType": t.get("factoryType")}, **r}
        CELLS_FILE.write_text(json.dumps(cells, indent=2, ensure_ascii=False))

    print(f"\n[done] cells written to {CELLS_FILE}", flush=True)


if __name__ == "__main__":
    main()
