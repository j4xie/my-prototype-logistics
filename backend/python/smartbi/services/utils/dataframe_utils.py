"""
DataFrame Utilities for SmartBI

Safe operations for DataFrames with:
- Duplicate column names
- Type conversions for numeric operations
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional, Union

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def safe_get_column(
    df: pd.DataFrame,
    col_name: str,
    as_numeric: bool = False
) -> pd.Series:
    """
    Safely get a column from DataFrame, handling duplicate column names.

    When a DataFrame has duplicate column names, df[col] returns a DataFrame
    instead of a Series. This function always returns a Series.

    Args:
        df: DataFrame to get column from
        col_name: Column name to retrieve
        as_numeric: If True, convert to numeric (coerce errors to NaN)

    Returns:
        The column as a pandas Series

    Raises:
        KeyError: If column not found

    Example:
        >>> df = pd.DataFrame({'A': [1,2], 'A': [3,4]})  # Duplicate columns
        >>> safe_get_column(df, 'A')  # Returns first column as Series
    """
    if col_name not in df.columns:
        raise KeyError(f"Column '{col_name}' not found in DataFrame")

    col_idx = df.columns.get_loc(col_name)

    # Handle different return types from get_loc
    if isinstance(col_idx, slice):
        # Duplicate columns - take first one
        actual_idx = col_idx.start
    elif isinstance(col_idx, np.ndarray):
        # Boolean array for duplicates
        actual_idx = np.where(col_idx)[0][0]
    elif hasattr(col_idx, '__iter__') and not isinstance(col_idx, (int, np.integer)):
        # Iterable of indices
        actual_idx = list(col_idx)[0]
    else:
        # Single integer index
        actual_idx = col_idx

    series = df.iloc[:, actual_idx]

    # Ensure it's a Series (not DataFrame)
    if isinstance(series, pd.DataFrame):
        series = series.iloc[:, 0]

    if as_numeric:
        series = pd.to_numeric(series, errors='coerce')

    return series


def safe_numeric_column(
    df: pd.DataFrame,
    col_name: str,
    fill_value: float = 0.0
) -> pd.Series:
    """
    Get a column as numeric values, safely handling duplicates and conversions.

    Args:
        df: DataFrame
        col_name: Column name
        fill_value: Value to use for NaN after conversion

    Returns:
        Numeric Series with NaN filled
    """
    series = safe_get_column(df, col_name, as_numeric=True)
    return series.fillna(fill_value)


def safe_groupby_agg(
    df: pd.DataFrame,
    group_by: List[str],
    agg_col: str,
    agg_func: str = 'sum'
) -> pd.Series:
    """
    Safely perform groupby aggregation, handling duplicate columns.

    Args:
        df: DataFrame
        group_by: Columns to group by
        agg_col: Column to aggregate
        agg_func: Aggregation function ('sum', 'mean', 'count', 'min', 'max', 'nunique')

    Returns:
        Aggregated Series with MultiIndex if multiple group_by columns
    """
    # Get the aggregation column safely
    agg_series = safe_get_column(df, agg_col, as_numeric=(agg_func != 'nunique'))

    # Create a temporary DataFrame for groupby
    temp_df = df[group_by].copy()
    temp_df['__agg_col__'] = agg_series

    grouped = temp_df.groupby(group_by)['__agg_col__']

    if agg_func == 'sum':
        return grouped.sum()
    elif agg_func == 'mean':
        return grouped.mean()
    elif agg_func == 'count':
        return grouped.count()
    elif agg_func == 'min':
        return grouped.min()
    elif agg_func == 'max':
        return grouped.max()
    elif agg_func == 'nunique':
        return grouped.nunique()
    else:
        raise ValueError(f"Unknown aggregation function: {agg_func}")


def ensure_numeric_for_formula(
    df: pd.DataFrame,
    columns: List[str]
) -> Dict[str, float]:
    """
    Get numeric values for formula calculation.

    Ensures all values are proper floats for arithmetic operations,
    avoiding "unsupported operand type(s) for -: 'str' and 'str'" errors.

    Args:
        df: DataFrame
        columns: Columns to extract and sum

    Returns:
        Dict mapping column name to float sum value
    """
    result = {}
    for col in columns:
        try:
            series = safe_get_column(df, col, as_numeric=True)
            value = series.sum()
            # Ensure it's a proper float
            result[col] = float(value) if pd.notna(value) else 0.0
        except (KeyError, TypeError, ValueError) as e:
            logger.warning(f"Could not get numeric value for column {col}: {e}")
            result[col] = 0.0

    return result


def deduplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Deduplicate column names by adding suffixes.

    Args:
        df: DataFrame with potentially duplicate column names

    Returns:
        DataFrame with unique column names (duplicates get _1, _2 suffixes)
    """
    cols = list(df.columns)
    seen = {}
    new_cols = []

    for col in cols:
        if col in seen:
            seen[col] += 1
            new_cols.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            new_cols.append(col)

    df = df.copy()
    df.columns = new_cols
    return df
