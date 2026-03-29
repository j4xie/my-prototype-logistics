"""
Backward-compatibility shim.

The implementation has been decomposed into the ``services.insights`` package:

- ``insights/generator.py``       -- InsightGenerator orchestrator
- ``insights/statistical.py``     -- Rule-based insights (trend, anomaly, comparison)
- ``insights/scenario_context.py``-- Scenario detection & domain context builders
- ``insights/llm_client.py``      -- LLM call infrastructure (streaming, retry)
- ``insights/prompt_builder.py``  -- Tiered prompt construction & system roles
- ``insights/data_summarizer.py`` -- DataFrame-to-text & column humanization

All public symbols are re-exported here so that existing imports of the form
``from services.insight_generator import InsightGenerator`` continue to work
without any changes to calling code.
"""
from services.insights.generator import InsightGenerator          # noqa: F401
from services.insights.statistical import InsightType, INSIGHT_TEMPLATES  # noqa: F401

__all__ = [
    "InsightGenerator",
    "InsightType",
    "INSIGHT_TEMPLATES",
]
