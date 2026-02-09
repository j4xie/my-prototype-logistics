"""
Excel Services Module

This module provides Excel parsing and exporting functionality:
- ExcelParser: Full-featured Excel parser with multi-header support
- RawExporter: Raw data export (100% fidelity mode)
- SmartExcelParser: Intelligent parsing with rules + LLM

All classes are re-exported here for backward compatibility.
"""

# From parser.py (formerly excel_parser.py)
from .parser import (
    DataDirection,
    SheetInfo,
    ExcelParser,
)

# From raw_exporter.py
from .raw_exporter import (
    CellInfo,
    RowInfo,
    MergedCellInfo,
    RawSheetData,
    RawExporter,
)

# From smart_parser.py
from .smart_parser import (
    HeaderRule,
    ColumnRule,
    MetadataRule,
    ExcelParseRule,
    PROFIT_STATEMENT_RULE,
    SALES_DATA_RULE,
    GENERIC_TABLE_RULE,
    BUILTIN_RULES,
    RuleEngine,
    LLMParser,
    SmartExcelParser,
)

__all__ = [
    # parser.py
    "DataDirection",
    "SheetInfo",
    "ExcelParser",
    # raw_exporter.py
    "CellInfo",
    "RowInfo",
    "MergedCellInfo",
    "RawSheetData",
    "RawExporter",
    # smart_parser.py
    "HeaderRule",
    "ColumnRule",
    "MetadataRule",
    "ExcelParseRule",
    "PROFIT_STATEMENT_RULE",
    "SALES_DATA_RULE",
    "GENERIC_TABLE_RULE",
    "BUILTIN_RULES",
    "RuleEngine",
    "LLMParser",
    "SmartExcelParser",
]
