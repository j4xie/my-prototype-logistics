from __future__ import annotations
"""
Excel Parser Service

Handles Excel file parsing with support for:
- Multi-level headers
- Data direction detection (row vs column oriented)
- Various Excel formats (.xlsx, .xls, .csv)
"""
import logging
from io import BytesIO
from typing import Any, Optional, Union, List, Dict
from enum import Enum

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class DataDirection(str, Enum):
    """Data orientation in the spreadsheet"""
    ROW_ORIENTED = "row"  # Headers in first row, data in subsequent rows
    COLUMN_ORIENTED = "column"  # Headers in first column, data in subsequent columns


class ExcelParser:
    """Excel file parser with multi-level header support"""

    def __init__(self):
        self.supported_extensions = [".xlsx", ".xls", ".csv"]

    def parse(
        self,
        file_bytes: bytes,
        sheet_name: Optional[Union[str, int]] = 0,
        header_rows: int = 1,
        skip_rows: int = 0,
        transpose: bool = False
    ) -> Dict[str, Any]:
        """
        Parse Excel file and return structured data

        Args:
            file_bytes: Raw file bytes
            sheet_name: Sheet name or index (default: first sheet)
            header_rows: Number of header rows (1 or 2 for multi-level)
            skip_rows: Number of rows to skip at the top
            transpose: Whether to transpose the data

        Returns:
            Dictionary with headers, rows, and metadata
        """
        try:
            buffer = BytesIO(file_bytes)

            # Determine header parameter
            if header_rows == 2:
                header = [0, 1]
            elif header_rows > 2:
                header = list(range(header_rows))
            else:
                header = 0

            # Read Excel file
            df = pd.read_excel(
                buffer,
                sheet_name=sheet_name,
                header=header,
                skiprows=skip_rows
            )

            # Handle multi-level columns
            if isinstance(df.columns, pd.MultiIndex):
                df = self._flatten_multi_index_columns(df)

            # Transpose if needed
            if transpose:
                df = df.T.reset_index()
                # Use first row as headers after transpose
                df.columns = df.iloc[0].tolist()
                df = df[1:]

            # Detect data direction
            direction = self._detect_data_direction(df)

            # Clean data
            df = self._clean_dataframe(df)

            # Convert to structured format
            headers = df.columns.tolist()
            rows = df.values.tolist()

            # Get sheet names
            buffer.seek(0)
            xl = pd.ExcelFile(buffer)
            sheet_names = xl.sheet_names

            return {
                "success": True,
                "headers": headers,
                "rows": rows,
                "rowCount": len(rows),
                "columnCount": len(headers),
                "direction": direction.value,
                "sheetNames": sheet_names,
                "currentSheet": sheet_name if isinstance(sheet_name, str) else sheet_names[sheet_name] if sheet_name < len(sheet_names) else sheet_names[0]
            }

        except Exception as e:
            logger.error(f"Failed to parse Excel file: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "headers": [],
                "rows": [],
                "rowCount": 0,
                "columnCount": 0
            }

    def parse_csv(
        self,
        file_bytes: bytes,
        encoding: str = "utf-8",
        delimiter: str = ","
    ) -> Dict[str, Any]:
        """Parse CSV file"""
        try:
            buffer = BytesIO(file_bytes)
            df = pd.read_csv(buffer, encoding=encoding, delimiter=delimiter)
            df = self._clean_dataframe(df)

            return {
                "success": True,
                "headers": df.columns.tolist(),
                "rows": df.values.tolist(),
                "rowCount": len(df),
                "columnCount": len(df.columns),
                "direction": self._detect_data_direction(df).value
            }
        except Exception as e:
            logger.error(f"Failed to parse CSV file: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "headers": [],
                "rows": []
            }

    def get_sheet_names(self, file_bytes: bytes) -> List[str]:
        """Get all sheet names from Excel file"""
        try:
            buffer = BytesIO(file_bytes)
            xl = pd.ExcelFile(buffer)
            return xl.sheet_names
        except Exception as e:
            logger.error(f"Failed to get sheet names: {e}")
            return []

    def detect_multi_header(self, file_bytes: bytes, sheet_name: Optional[Union[str, int]] = 0) -> Dict[str, Any]:
        """
        Detect if the Excel file has multi-level headers

        Returns:
            Dictionary with detection results and recommended header_rows
        """
        try:
            buffer = BytesIO(file_bytes)

            # Read first few rows without headers
            df_raw = pd.read_excel(buffer, sheet_name=sheet_name, header=None, nrows=5)

            # Analyze first rows for header patterns
            header_rows = 1
            is_multi_header = False

            if len(df_raw) >= 2:
                first_row = df_raw.iloc[0]
                second_row = df_raw.iloc[1]

                # Check if second row looks like a sub-header
                # Criteria: second row has many merged/empty cells or categorical values
                first_row_empty_ratio = first_row.isna().sum() / len(first_row)
                second_row_types = second_row.apply(lambda x: 'str' if isinstance(x, str) else 'num')

                # If first row has many empty cells (merged header pattern)
                # and second row has string values, likely multi-level
                if first_row_empty_ratio > 0.3 and (second_row_types == 'str').sum() > len(second_row) * 0.5:
                    is_multi_header = True
                    header_rows = 2

            return {
                "success": True,
                "isMultiHeader": is_multi_header,
                "recommendedHeaderRows": header_rows,
                "previewRows": df_raw.head(3).values.tolist()
            }

        except Exception as e:
            logger.error(f"Failed to detect multi-header: {e}")
            return {
                "success": False,
                "isMultiHeader": False,
                "recommendedHeaderRows": 1,
                "error": str(e)
            }

    def _flatten_multi_index_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Flatten multi-level column index to single level"""
        if isinstance(df.columns, pd.MultiIndex):
            # Join multi-level column names with separator
            df.columns = [
                '_'.join(str(c) for c in col if str(c) != 'nan' and str(c) != '')
                for col in df.columns.values
            ]
        return df

    def _detect_data_direction(self, df: pd.DataFrame) -> DataDirection:
        """
        Detect whether data is row-oriented or column-oriented

        Heuristics:
        - Row-oriented: First row is headers, subsequent rows are data records
        - Column-oriented: First column is headers, subsequent columns are data series
        """
        if df.empty:
            return DataDirection.ROW_ORIENTED

        # Check first column vs first row for date/time patterns
        first_col = df.iloc[:, 0] if len(df.columns) > 0 else pd.Series()
        first_row = df.iloc[0] if len(df) > 0 else pd.Series()

        # Count numeric values
        first_col_numeric = pd.to_numeric(first_col, errors='coerce').notna().sum()
        first_row_numeric = pd.to_numeric(first_row, errors='coerce').notna().sum()

        # If first column has more numeric values, likely column-oriented (time series)
        if first_col_numeric > len(first_col) * 0.7 and first_row_numeric < len(first_row) * 0.3:
            return DataDirection.COLUMN_ORIENTED

        return DataDirection.ROW_ORIENTED

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean dataframe by handling NaN and converting types"""
        # Replace NaN with None for JSON serialization
        df = df.replace({np.nan: None})

        # Convert datetime columns to ISO format strings
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].apply(
                    lambda x: x.isoformat() if pd.notna(x) else None
                )

        return df
