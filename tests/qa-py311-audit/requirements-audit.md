# `requirements.txt` audit: Python 3.11 compatibility

**Worktree:** `qa/py38-eol-audit-510` (Issue #510)
**Date:** 2026-05-13
**Source:** `backend/python/requirements.txt` @ origin/main

Compatibility verdicts below are based on PyPI metadata and project
knowledge as of Jan 2026 (assistant knowledge cutoff). Items marked
**VERIFY ON CUTOVER** should be confirmed with `pip install --dry-run`
on the test venv before live install.

---

## Verdicts at a glance

| Status | Count |
|---|---|
| ✅ Works on 3.11 with current pin | 36 |
| ⚠️ Marker must change before cutover | 1 (`torch`) |
| ⚠️ Marker can be simplified after cutover | 1 (`pydantic-settings`) |
| ⚠️ Upper-bound exists only for 3.8 — lift post-cutover | 2 (`prometheus-fastapi-instrumentator`, possibly `pandas`/`sqlalchemy`) |
| ❓ VERIFY ON CUTOVER | 1 (`onnxruntime` resolver pick) |

Total: 41 deps.

---

## Per-package detail

### 🚨 Must change before cutover

#### `torch==2.4.1 ; python_version == "3.8"`
**Problem.** The version marker `python_version == "3.8"` makes pip
**skip installation** on 3.11. Then `import torch` (at
`classifier/services/intent_classifier.py:13` and 3 other sites)
raises `ModuleNotFoundError`, which breaks `/api/classifier/health`
and floods the Java log with `BERT 分类器服务不可达` errors (see
warning comment lines 80-81 in `requirements.txt`).

**Fix.** Either drop the marker:
```
torch==2.4.1
```
or bump to a 3.11-supporting version with a relaxed pin:
```
torch>=2.4.1,<3.0   # 2.4-2.6 all support 3.8 through 3.12
```
PyTorch 2.4.1 already supports 3.8-3.12, so just removing the marker
is the minimal-risk choice. The intent classifier model checkpoint
was trained against torch 2.4 so we should keep the pin tight.

---

### ⚠️ Cleanup after cutover (not blocking)

#### `pydantic-settings>=2.0.0 ; python_version >= "3.9"`
On 3.8 the marker excludes the package, so `smartbi/config.py:10`
falls through to `from pydantic import BaseSettings` — which fails
on pydantic v2 (`>=2.5,<3` per line 27). This is a latent bug on 3.8
prod that 3.11 will fix.

**Action.** Once on 3.11, drop the marker:
```
pydantic-settings>=2.0.0
```

#### `prometheus-fastapi-instrumentator>=5.0.0,<6.0.0`
Inline comment notes the cap exists because **6.0+ requires Python
3.9+**. After cutover, can lift to `>=6.0,<8.0` (or current latest)
to pick up improvements.

#### `pandas>=1.3.0,<2.0.0` and `sqlalchemy>=1.4.0,<2.0.0`
These caps are project conservatism, not Python compat. Both `<2.0`
ranges work on 3.11. Post-cutover, the team can revisit whether to
bump:
- pandas 2.x has different `.append()` deprecation (already removed)
  and `numpy` 2.x interop concerns — separate migration.
- sqlalchemy 2.x is a larger semantic change (declarative-only,
  `select()` rewrite) — separate migration.

Recommendation: do NOT bundle these bumps with the venv migration.
Migrate venv first, run dict-eq parity gate, ship as standalone PR.

---

### ✅ Confirmed compatible on 3.11 with current pins

(36 of 41 packages.)

| Package | Current pin | 3.11 status |
|---|---|---|
| fastapi | `>=0.70.0,<1.0.0` | 0.95+ tested on 3.11; existing pin allows latest 0.x |
| cachetools | `>=5.3.0` | pure-python, all versions support 3.11 |
| uvicorn | `>=0.15.0,<1.0.0` | 0.20+ supports 3.11; pin allows |
| gunicorn | `>=21.2.0,<23.0.0` | 21.x and 22.x both support 3.11 |
| slowapi | `>=0.1.9,<1.0.0` | supports 3.11 |
| python-multipart | `>=0.0.5` | supports 3.11 |
| pandas | `>=1.3.0,<2.0.0` | 1.5.0+ supports 3.11; current pin will resolve 1.5.x |
| openpyxl | `>=3.0.0,<4.0.0` | 3.1+ supports 3.11 |
| numpy | `>=1.20.0,<2.0.0` | 1.23.2+ supports 3.11; pin allows 1.26.x |
| xlrd | `>=2.0.0,<3.0.0` | pure-python, supports 3.11 |
| statsmodels | `>=0.13.0,<1.0.0` | 0.14+ supports 3.11 |
| scipy | `>=1.7.0,<2.0.0` | 1.9.2+ supports 3.11 |
| httpx | `>=0.20.0,<1.0.0` | supports 3.11 |
| aiohttp | `>=3.8.0,<4.0.0` | 3.8.3+ supports 3.11 |
| openai | `>=1.0.0` | 1.0+ supports 3.7-3.12 |
| pydantic | `>=2.5,<3` | pydantic 2.5+ supports 3.11 fully |
| PyJWT | `>=2.6.0,<3.0.0` | supports 3.11 |
| cryptography | `>=42.0.0` | 42-47 all support 3.11. **Note:** see Issue #510 trigger — 48.0 will drop 3.8, this is the very reason for the migration |
| PyYAML | `>=6.0,<7.0.0` | 6.0+ supports 3.11 |
| python-dateutil | `>=2.8.0,<3.0.0` | supports 3.11 |
| typing-extensions | `>=3.7.4` | supports 3.11 |
| python-dotenv | `>=0.19.0` | supports 3.11 |
| sqlalchemy | `>=1.4.0,<2.0.0` | 1.4.40+ supports 3.11; pin resolves to 1.4.x |
| psycopg2-binary | `>=2.9.0,<3.0.0` | 2.9.5+ has 3.11 wheels |
| asyncpg | `>=0.27.0,<1.0.0` | 0.27 supports 3.7-3.11; 0.28+ adds 3.12 |
| grpcio | `>=1.59.0,<2.0.0` | 1.49+ supports 3.11 |
| grpcio-tools | `>=1.59.0,<2.0.0` | build-time only, supports 3.11 |
| pgvector | `>=0.2.4` | pure-python, supports 3.11 |
| python-pptx | `>=0.6.23` | supports 3.11 |
| reportlab | `>=4.0` | 4.0+ supports 3.7-3.11 |
| onnxruntime | `>=1.14.0,<2.0.0` | **see VERIFY note below** |
| Pillow | `>=9.0.0,<11.0.0` | 9.3.0+ supports 3.11 |
| transformers | `>=4.40,<5.0` | supports 3.8-3.12 |
| tokenizers | `>=0.20,<1.0` | supports 3.11 |
| safetensors | `>=0.4,<1.0` | supports 3.11 |
| huggingface-hub | `>=0.20,<1.0` | supports 3.11 |
| polars | `>=1.0.0,<2.0.0` | 1.0+ supports 3.8-3.12 |
| pytest-asyncio | `>=0.21.0` | supports 3.11 |

---

### ❓ VERIFY on test venv before live cutover

#### `onnxruntime>=1.14.0,<2.0.0`
The pin allows 1.14 through 1.x latest. **1.14 specifically supports
3.8-3.10 only** — the resolver may pick 1.14 first on 3.11 and then
fail import. Need to confirm pip picks 1.16+ (which adds 3.11) on
fresh venv311.

Pre-flight check during Phase 2 (test venv build):
```bash
venv311/bin/pip install --dry-run -r requirements.txt | grep onnxruntime
```
If the resolver picks <1.16, tighten the pin to `>=1.16.0,<2.0.0`.

YOLO foreign-object detection lives at
`foreign_object_detection/services/` — would fail with `cannot import
name 'InferenceSession'` style error if a wrong wheel installs.

---

## Net deps work on cutover

Before cutover, edit `requirements.txt`:
1. Change `torch==2.4.1 ; python_version == "3.8"` → `torch==2.4.1`
2. (Optional, post-soak) drop `; python_version >= "3.9"` from `pydantic-settings`
3. (Optional, post-soak) lift `prometheus-fastapi-instrumentator<6.0.0` cap

That is the only code-relevant requirements change required to make
the cutover work. Everything else is a `pip install` mechanical
re-resolve on the new interpreter.

---

## Cross-reference: memory + project rules

- `feedback_pip_prefer_binary.md` (May 2026) — venv rebuild must use
  `pip install --prefer-binary --timeout 300` to avoid pip 25's
  source-build hallucinations (notably `puccinialin`).
- `.claude/rules/server-operations.md` — test env first, prod second
  per "Test before prod" HARD rule.
- `.claude/rules/python-services-architecture.md` — single Python
  service on port 8083/8084; no new ports during migration.
