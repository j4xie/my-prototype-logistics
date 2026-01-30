from __future__ import annotations
"""
ML Service

Machine learning utilities for numerical computation:
- Least Squares Solver (Ridge, LSTSQ, SVD methods)
"""
import logging
from typing import Any, Optional, List, Dict
from enum import Enum

import numpy as np
from scipy import linalg

logger = logging.getLogger(__name__)


class SolveMethod(str, Enum):
    """Available solving methods for least squares"""
    RIDGE = "ridge"      # Ridge regression (Tikhonov regularization)
    LSTSQ = "lstsq"      # Standard least squares via scipy.linalg.lstsq
    SVD = "svd"          # SVD-based pseudo-inverse


class MLService:
    """
    Machine Learning Service

    Provides numerical computation utilities, primarily for solving
    linear systems using least squares methods.
    """

    def __init__(self):
        self.default_regularization = 0.001
        self.default_method = SolveMethod.RIDGE

    def solve_least_squares(
        self,
        matrix_a: List[List[float]],
        vector_b: List[float],
        regularization: float = 0.001,
        method: str = "ridge"
    ) -> Dict[str, Any]:
        """
        Solve least squares problem: minimize ||Ax - b||^2

        This is the Python equivalent of the Java solveLeastSquares method,
        using scipy for more efficient and numerically stable computation.

        Args:
            matrix_a: Coefficient matrix (m x n)
            vector_b: Target vector (m x 1)
            regularization: Regularization parameter (lambda for ridge regression)
            method: Solving method ('ridge', 'lstsq', 'svd')

        Returns:
            Dictionary containing:
            - success: bool
            - solution: List[float] - The solution vector x
            - metrics: dict - Diagnostic metrics (RMSE, condition number, rank)
            - error: str (only if success=False)

        Example:
            >>> service = MLService()
            >>> result = service.solve_least_squares(
            ...     [[1, 1], [2, 1], [3, 1]],
            ...     [2, 4, 5]
            ... )
            >>> print(result['solution'])  # [1.5, 0.5]
        """
        try:
            # Convert to numpy arrays
            A = np.array(matrix_a, dtype=np.float64)
            b = np.array(vector_b, dtype=np.float64)

            # Validate dimensions
            if A.ndim != 2:
                return {
                    "success": False,
                    "error": f"Matrix A must be 2-dimensional, got {A.ndim}"
                }

            m, n = A.shape

            if len(b) != m:
                return {
                    "success": False,
                    "error": f"Dimension mismatch: A has {m} rows but b has {len(b)} elements"
                }

            if m == 0 or n == 0:
                return {
                    "success": False,
                    "error": "Matrix A cannot be empty"
                }

            # Select solving method
            solve_method = SolveMethod(method) if method in [m.value for m in SolveMethod] else self.default_method

            # Solve based on method
            if solve_method == SolveMethod.RIDGE:
                x, metrics = self._solve_ridge(A, b, regularization)
            elif solve_method == SolveMethod.LSTSQ:
                x, metrics = self._solve_lstsq(A, b)
            elif solve_method == SolveMethod.SVD:
                x, metrics = self._solve_svd(A, b, regularization)
            else:
                x, metrics = self._solve_ridge(A, b, regularization)

            # Check for invalid values
            if np.any(np.isnan(x)) or np.any(np.isinf(x)):
                logger.warning("Solution contains NaN or Inf values, applying fallback")
                # Replace invalid values with 1.0 (default efficiency)
                x = np.where(np.isnan(x) | np.isinf(x), 1.0, x)

            # Calculate RMSE
            residuals = A @ x - b
            rmse = float(np.sqrt(np.mean(residuals ** 2)))
            metrics["rmse"] = rmse

            return {
                "success": True,
                "solution": x.tolist(),
                "metrics": metrics,
                "method": solve_method.value
            }

        except Exception as e:
            logger.error(f"Least squares solving failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    def _solve_ridge(
        self,
        A: np.ndarray,
        b: np.ndarray,
        regularization: float
    ) -> tuple[np.ndarray, dict]:
        """
        Ridge regression (Tikhonov regularization)

        Solves: x = (A^T A + λI)^(-1) A^T b

        This is the same algorithm as the Java implementation but using
        scipy for matrix operations.
        """
        m, n = A.shape

        # A^T A
        AtA = A.T @ A

        # Add regularization (ridge)
        AtA += regularization * np.eye(n)

        # A^T b
        Atb = A.T @ b

        # Solve the system
        x = linalg.solve(AtA, Atb, assume_a='pos')

        # Compute metrics
        cond_number = float(np.linalg.cond(AtA))
        rank = int(np.linalg.matrix_rank(A))

        return x, {
            "conditionNumber": cond_number,
            "rank": rank,
            "regularization": regularization
        }

    def _solve_lstsq(
        self,
        A: np.ndarray,
        b: np.ndarray
    ) -> tuple[np.ndarray, dict]:
        """
        Standard least squares via scipy.linalg.lstsq

        Uses the LAPACK gelsd routine for numerical stability.
        """
        x, residuals, rank, singular_values = linalg.lstsq(A, b)

        # Compute condition number from singular values
        if len(singular_values) > 0 and singular_values[-1] > 0:
            cond_number = float(singular_values[0] / singular_values[-1])
        else:
            cond_number = float('inf')

        return x, {
            "conditionNumber": cond_number,
            "rank": int(rank),
            "singularValues": singular_values.tolist() if len(singular_values) <= 10 else singular_values[:10].tolist()
        }

    def _solve_svd(
        self,
        A: np.ndarray,
        b: np.ndarray,
        regularization: float
    ) -> tuple[np.ndarray, dict]:
        """
        SVD-based pseudo-inverse with optional regularization

        Uses truncated SVD for better numerical stability with ill-conditioned matrices.
        """
        U, s, Vh = linalg.svd(A, full_matrices=False)

        # Apply regularization (similar to ridge but in SVD space)
        # Modified singular values: s_i / (s_i^2 + λ)
        if regularization > 0:
            s_inv = s / (s ** 2 + regularization)
        else:
            # Standard pseudo-inverse with tolerance for small singular values
            tol = max(A.shape) * np.finfo(float).eps * s[0]
            s_inv = np.where(s > tol, 1 / s, 0)

        # x = V * S_inv * U^T * b
        x = Vh.T @ (s_inv * (U.T @ b))

        # Compute metrics
        if s[-1] > 0:
            cond_number = float(s[0] / s[-1])
        else:
            cond_number = float('inf')

        rank = int(np.sum(s > max(A.shape) * np.finfo(float).eps * s[0]))

        return x, {
            "conditionNumber": cond_number,
            "rank": rank,
            "regularization": regularization
        }

    def validate_matrix(
        self,
        matrix_a: List[List[float]],
        vector_b: List[float]
    ) -> Dict[str, Any]:
        """
        Validate matrix and vector for least squares solving

        Returns information about the matrix properties without solving.
        """
        try:
            A = np.array(matrix_a, dtype=np.float64)
            b = np.array(vector_b, dtype=np.float64)

            if A.ndim != 2:
                return {
                    "valid": False,
                    "error": "Matrix A must be 2-dimensional"
                }

            m, n = A.shape

            if len(b) != m:
                return {
                    "valid": False,
                    "error": f"Dimension mismatch: A({m}x{n}) vs b({len(b)})"
                }

            rank = int(np.linalg.matrix_rank(A))
            cond_number = float(np.linalg.cond(A)) if min(m, n) > 0 else float('inf')

            # Check for numerical issues
            has_nan = bool(np.any(np.isnan(A)) or np.any(np.isnan(b)))
            has_inf = bool(np.any(np.isinf(A)) or np.any(np.isinf(b)))

            # Determine if well-conditioned
            is_well_conditioned = cond_number < 1e10 and not has_nan and not has_inf

            return {
                "valid": True,
                "rows": m,
                "cols": n,
                "rank": rank,
                "conditionNumber": cond_number,
                "isFullRank": rank == min(m, n),
                "isOverdetermined": m > n,
                "isUnderdetermined": m < n,
                "hasNaN": has_nan,
                "hasInf": has_inf,
                "isWellConditioned": is_well_conditioned,
                "recommendedMethod": "ridge" if not is_well_conditioned else "lstsq"
            }

        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
