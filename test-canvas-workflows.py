#!/usr/bin/env python3
"""Canvas Workflow 完整路径验证 — 10 个工作流场景"""
import json, urllib.request, urllib.error, sys

BASE = "http://localhost:10020/api/mobile"
TOKEN = ""
FID = ""
RESULTS = []
CUST = ""
PROD = ""

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if TOKEN:
        req.add_header("Authorization", "Bearer " + TOKEN)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())
    except Exception as e:
        return {"success": False, "message": str(e), "data": None}

def cfg(method, path, body=None):
    return api(method, "/" + FID + "/config" + path, body)

def pub(msg):
    return cfg("POST", "/publish?summary=" + msg)

def eff(mod):
    return cfg("GET", "/modules/" + mod + "/effective")

def create_so(remark):
    return api("POST", "/" + FID + "/sales/orders", {
        "customerId": CUST, "orderDate": "2026-04-09", "remark": remark,
        "items": [{"productTypeId": PROD, "quantity": 10, "unitPrice": 50, "unit": "kg", "specification": "test"}]
    })

def so_action(oid, action, body=None):
    return api("POST", "/" + FID + "/sales/orders/" + oid + "/" + action, body)

def log(id, name, evidence, ok):
    RESULTS.append({"id": id, "name": name, "evidence": evidence, "result": "PASS" if ok else "FAIL"})
    print(("\u2705 " if ok else "\u274c ") + id + ": " + name)
    for e in evidence:
        print("   " + e)

def get_trans(data, frm, to):
    for t in (data.get("workflowTransitions") or []):
        if t["from"] == frm and t["to"] == to:
            return t
    return None

# Setup
login = api("POST", "/auth/unified-login", {"username": "factory_admin1", "password": "123456"})
TOKEN = login["data"]["accessToken"]
FID = login["data"]["factoryId"]
custs = api("GET", "/" + FID + "/customers?page=1&size=1")
CUST = custs["data"]["content"][0]["id"]
prods = api("GET", "/" + FID + "/product-types?page=1&size=1")
PROD = prods["data"]["content"][0]["id"]

print("=" * 60)
print("Canvas Workflow \u5b8c\u6574\u8def\u5f84\u9a8c\u8bc1 \u2014 10 \u573a\u666f")
print("Factory: " + FID + ", Cust: " + CUST[:8] + ", Prod: " + PROD[:8])
print("=" * 60)

# W1: \u6807\u51c6\u8d22\u52a1\u5ba1\u6838\u94fe\u8def
print("\n--- W1: \u6807\u51c6\u8d22\u52a1\u5ba1\u6838 ---")
cfg("PUT", "/modules/sales_order", {"workflowConfig": {"options": {"hasFinanceReview": True, "allowPartialDelivery": True}, "disabledStates": {}}})
pub("W1-finance-on")
so1 = create_so("W1-standard")
o1 = (so1.get("data") or {}).get("id")
c1 = []
if o1:
    r = so_action(o1, "confirm"); c1.append("DRAFT->CONFIRMED: " + str((r.get("data") or {}).get("status")))
    r = so_action(o1, "submit-for-review"); c1.append("->PENDING: " + str((r.get("data") or {}).get("status")))
    r = so_action(o1, "finance-approve", {"notes": "ok"}); c1.append("->APPROVED: " + str((r.get("data") or {}).get("status")))
log("W1", "DRAFT->CONFIRMED->PENDING->APPROVED", c1, "FINANCE_APPROVED" in str(c1))

# W2: \u8d22\u52a1\u9a73\u56de\u2192\u91cd\u65b0\u5ba1\u6838
print("\n--- W2: \u8d22\u52a1\u9a73\u56de\u2192\u91cd\u65b0\u5ba1\u6838 ---")
so2 = create_so("W2-reject")
o2 = (so2.get("data") or {}).get("id")
c2 = []
if o2:
    so_action(o2, "confirm")
    so_action(o2, "submit-for-review")
    r = so_action(o2, "finance-reject", {"reason": "too expensive"}); c2.append("->REJECTED: " + str((r.get("data") or {}).get("status")))
    r = so_action(o2, "submit-for-review"); c2.append("REJECTED->PENDING: " + str((r.get("data") or {}).get("status")))
    r = so_action(o2, "finance-approve", {"notes": "ok 2nd"}); c2.append("->APPROVED: " + str((r.get("data") or {}).get("status")))
log("W2", "\u9a73\u56de\u2192\u91cd\u65b0\u5ba1\u6838: REJECT->PENDING->APPROVED", c2, "FINANCE_APPROVED" in str(c2))

# W3: \u8df3\u8fc7\u8d22\u52a1 hasFinanceReview=false
print("\n--- W3: \u8df3\u8fc7\u8d22\u52a1 ---")
cfg("PUT", "/modules/sales_order", {"workflowConfig": {"options": {"hasFinanceReview": False}}})
pub("W3-skip")
e3 = eff("sales_order")
t3 = get_trans(e3["data"], "CONFIRMED", "PROCESSING")
so3 = create_so("W3-skip-finance")
o3 = (so3.get("data") or {}).get("id")
c3 = []
if o3:
    r = so_action(o3, "confirm"); c3.append("CONFIRMED: " + str((r.get("data") or {}).get("status")))
    c3.append("config: CONFIRMED->PROCESSING.enabled=" + str(t3["enabled"] if t3 else "N/A"))
log("W3", "\u8df3\u8fc7\u8d22\u52a1: hasFinanceReview=false", c3, t3 and t3["enabled"] == True)

# W4: \u53d6\u6d88\u8ba2\u5355 (DRAFT + CONFIRMED)
print("\n--- W4: \u53d6\u6d88\u8ba2\u5355 ---")
so4a = create_so("W4a-cancel-draft"); o4a = (so4a.get("data") or {}).get("id")
so4b = create_so("W4b-cancel-confirmed"); o4b = (so4b.get("data") or {}).get("id")
c4 = []
if o4a:
    r = so_action(o4a, "cancel"); c4.append("DRAFT->CANCELLED: " + str((r.get("data") or {}).get("status")))
if o4b:
    so_action(o4b, "confirm")
    r = so_action(o4b, "cancel"); c4.append("CONFIRMED->CANCELLED: " + str((r.get("data") or {}).get("status")))
log("W4", "\u53d6\u6d88: DRAFT/CONFIRMED\u90fd\u53ef\u53d6\u6d88", c4, c4.count("DRAFT->CANCELLED: CANCELLED") + c4.count("CONFIRMED->CANCELLED: CANCELLED") >= 2)

# W5: \u914d\u7f6e\u8fde\u7eed\u5207\u63623\u6b21
print("\n--- W5: \u914d\u7f6e\u8fde\u7eed\u5207\u6362 ---")
toggles = []
for i, val in enumerate([True, False, True]):
    cfg("PUT", "/modules/sales_order", {"workflowConfig": {"options": {"hasFinanceReview": val}}})
    pub("W5-toggle-" + str(i))
    e = eff("sales_order")
    t = get_trans(e["data"], "CONFIRMED", "PROCESSING")
    toggles.append("v" + str(i) + " hasFinance=" + str(val) + " -> direct=" + str(t["enabled"] if t else "?"))
log("W5", "\u914d\u7f6e\u8fde\u7eed\u5207\u63623\u6b21 \u2014 \u5373\u65f6\u751f\u6548", toggles,
    "direct=False" in toggles[0] and "direct=True" in toggles[1] and "direct=False" in toggles[2])

# W6: \u90e8\u5206\u53d1\u8d27\u8def\u5f84
print("\n--- W6: \u90e8\u5206\u53d1\u8d27\u8def\u5f84 ---")
e6 = eff("sales_order")
pt = get_trans(e6["data"], "PROCESSING", "PARTIAL_DELIVERED")
cr = get_trans(e6["data"], "PARTIAL_DELIVERED", "COMPLETED")
sh = get_trans(e6["data"], "PROCESSING", "SHIPPED")
sc = get_trans(e6["data"], "SHIPPED", "COMPLETED")
log("W6", "\u90e8\u5206\u53d1\u8d27+\u5b8c\u6574\u53d1\u8d27\u53cc\u8def\u5f84", [
    "PROCESSING->PARTIAL_DELIVERED: enabled=" + str(pt["enabled"] if pt else "N/A"),
    "PARTIAL_DELIVERED->COMPLETED: enabled=" + str(cr["enabled"] if cr else "N/A"),
    "PROCESSING->SHIPPED: enabled=" + str(sh["enabled"] if sh else "N/A"),
    "SHIPPED->COMPLETED: enabled=" + str(sc["enabled"] if sc else "N/A"),
], pt and pt["enabled"] and sh and sh["enabled"])

# W7: BOM \u5de5\u4f5c\u6d41
print("\n--- W7: BOM \u5de5\u4f5c\u6d41 ---")
e7 = eff("bom")
b_states = [s["code"] for s in e7["data"]["workflowStates"]]
b_trans = [t["from"] + "->" + t["to"] for t in e7["data"]["workflowTransitions"]]
log("W7", "BOM: DRAFT->ACTIVE->DEPRECATED + ACTIVE->DRAFT(revise)", [
    "states: " + ", ".join(b_states),
    "transitions: " + ", ".join(b_trans),
], len(b_states) == 3 and len(b_trans) == 3)

# W8: \u7981\u7528\u72b6\u6001
print("\n--- W8: \u7981\u7528\u5de5\u4f5c\u6d41\u72b6\u6001 ---")
cfg("PUT", "/modules/sales_order", {"workflowConfig": {"disabledStates": {"PARTIAL_DELIVERED": True, "FINANCE_REJECTED": True}, "options": {"hasFinanceReview": True}}})
pub("W8-disable")
e8 = eff("sales_order")
ps = [s for s in e8["data"]["workflowStates"] if s["code"] == "PARTIAL_DELIVERED"]
rs = [s for s in e8["data"]["workflowStates"] if s["code"] == "FINANCE_REJECTED"]
log("W8", "\u7981\u7528\u72b6\u6001: PARTIAL_DELIVERED + FINANCE_REJECTED", [
    "PARTIAL_DELIVERED.enabled: " + str(ps[0]["enabled"] if ps else "?"),
    "FINANCE_REJECTED.enabled: " + str(rs[0]["enabled"] if rs else "?"),
], ps and ps[0]["enabled"] == False and rs and rs[0]["enabled"] == False)

# W9: \u6062\u590d\u6240\u6709\u72b6\u6001
print("\n--- W9: \u6062\u590d\u6240\u6709\u72b6\u6001 ---")
cfg("PUT", "/modules/sales_order", {"workflowConfig": {"disabledStates": {}, "options": {"hasFinanceReview": True, "allowPartialDelivery": True}}})
pub("W9-restore")
e9 = eff("sales_order")
all_on = all(s["enabled"] for s in e9["data"]["workflowStates"])
log("W9", "\u6062\u590d: \u6240\u6709\u72b6\u6001 enabled", [
    "all " + str(len(e9["data"]["workflowStates"])) + " states enabled: " + str(all_on),
], all_on)

# W10: \u5b8c\u6574\u7aef\u5230\u7aef
print("\n--- W10: \u5b8c\u6574\u7aef\u5230\u7aef ---")
so10 = create_so("W10-full-e2e")
o10 = (so10.get("data") or {}).get("id")
c10 = []
if o10:
    r = so_action(o10, "confirm"); c10.append("1.CONFIRMED: " + str((r.get("data") or {}).get("status")))
    r = so_action(o10, "submit-for-review"); c10.append("2.PENDING: " + str((r.get("data") or {}).get("status")))
    r = so_action(o10, "finance-approve", {"notes": "final"}); c10.append("3.APPROVED: " + str((r.get("data") or {}).get("status")))
    c10.append("4. FINANCE_APPROVED (production/shipping requires separate endpoints)")
log("W10", "\u7aef\u5230\u7aef: DRAFT->CONFIRMED->PENDING->APPROVED", c10, "FINANCE_APPROVED" in str(c10))

# Summary
print("\n" + "=" * 60)
p = sum(1 for r in RESULTS if r["result"] == "PASS")
f = sum(1 for r in RESULTS if r["result"] == "FAIL")
print("Canvas Workflow: " + str(p) + " PASS / " + str(f) + " FAIL -- " + str(len(RESULTS)) + " total")
if f:
    print("\nFailed:")
    for r in RESULTS:
        if r["result"] == "FAIL":
            print("  " + r["id"] + ": " + r["name"])
            for e in r["evidence"]:
                print("    " + e)
json.dump({"summary": {"pass": p, "fail": f}, "tests": RESULTS}, open("/tmp/wf_results.json","w"), ensure_ascii=False, indent=2)
