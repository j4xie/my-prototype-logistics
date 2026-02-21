const fs = require("fs");
const p = "C:/Users/Steve/my-prototype-logistics/tests/e2e-smartbi/tests/finance_audit_v3.py";
const L = [];

// Header
L.push("import json, sys");
L.push("from playwright.sync_api import sync_playwright");
L.push("");
L.push("BASE = "http://47.100.235.168:8088"");
L.push("SD = "C:/Users/Steve/my-prototype-logistics/test-screenshots/audit-v3"");
L.push("");

fs.writeFileSync(p, L.join("
"), "utf8");
console.log("gen1 ok");