"""Phase 2B AI intent matching layer (Python side).

Provides POST /api/ai/intent/match for Java AIIntentService to call after
stages 1-4 + cache miss. Implements stages 5-8 (SEMANTIC / CLASSIFIER /
FUSION / LLM) of the intent matching pipeline.

Spec: docs/superpowers/specs/2026-04-29-phase2b-ai-intent-layer-design.md
"""
