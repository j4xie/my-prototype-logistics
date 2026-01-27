from __future__ import annotations
"""
ML API

Endpoints for machine learning numerical computations.
"""
import logging
from typing import Optional, List, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.ml_service import MLService, SolveMethod

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
ml_service = MLService()


class LeastSquaresRequest(BaseModel):
    """Least squares request model"""
    matrixA: List[List[float]] = Field(
        ...,
        min_items=1,
        description="Coefficient matrix A (m x n)"
    )
    vectorB: List[float] = Field(
        ...,
        min_items=1,
        description="Target vector b (m x 1)"
    )
    regularization: float = Field(
        0.001,
        ge=0,
        le=1,
        description="Regularization parameter (lambda for ridge regression)"
    )
    method: str = Field(
        "ridge",
        description="Solving method: 'ridge', 'lstsq', or 'svd'"
    )


class LeastSquaresMetrics(BaseModel):
    """Metrics from least squares solution"""
    rmse: Optional[float] = Field(None, description="Root Mean Square Error of residuals")
    conditionNumber: Optional[float] = Field(None, description="Condition number of A^T A")
    rank: Optional[int] = Field(None, description="Rank of matrix A")
    regularization: Optional[float] = Field(None, description="Regularization used")
    singularValues: Optional[List[float]] = Field(None, description="Singular values (for lstsq/svd)")


class LeastSquaresResponse(BaseModel):
    """Least squares response model"""
    success: bool
    solution: Optional[List[float]] = Field(None, description="Solution vector x")
    metrics: Optional[LeastSquaresMetrics] = None
    method: Optional[str] = Field(None, description="Method used for solving")
    error: Optional[str] = Field(None, description="Error message if failed")


class MatrixValidationRequest(BaseModel):
    """Matrix validation request model"""
    matrixA: List[List[float]]
    vectorB: List[float]


class MatrixValidationResponse(BaseModel):
    """Matrix validation response model"""
    valid: bool
    rows: Optional[int] = None
    cols: Optional[int] = None
    rank: Optional[int] = None
    conditionNumber: Optional[float] = None
    isFullRank: Optional[bool] = None
    isOverdetermined: Optional[bool] = None
    isUnderdetermined: Optional[bool] = None
    hasNaN: Optional[bool] = None
    hasInf: Optional[bool] = None
    isWellConditioned: Optional[bool] = None
    recommendedMethod: Optional[str] = None
    error: Optional[str] = None


@router.post("/least-squares", response_model=LeastSquaresResponse)
async def solve_least_squares(request: LeastSquaresRequest):
    """
    Solve least squares problem: minimize ||Ax - b||^2

    This endpoint provides efficient numerical solution for least squares problems,
    commonly used for:
    - Linear regression
    - System identification
    - Individual efficiency decomposition from team performance data

    **Methods available:**
    - `ridge`: Ridge regression with Tikhonov regularization (default, most stable)
    - `lstsq`: Standard least squares via LAPACK (fastest for well-conditioned matrices)
    - `svd`: SVD-based pseudo-inverse (best for ill-conditioned matrices)

    **Example:**
    ```json
    {
      "matrixA": [[1, 1], [2, 1], [3, 1]],
      "vectorB": [2, 4, 5],
      "regularization": 0.001,
      "method": "ridge"
    }
    ```

    Returns the solution vector x and diagnostic metrics.
    """
    try:
        # Validate method
        valid_methods = [m.value for m in SolveMethod]
        if request.method not in valid_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid method. Valid options: {valid_methods}"
            )

        result = ml_service.solve_least_squares(
            matrix_a=request.matrixA,
            vector_b=request.vectorB,
            regularization=request.regularization,
            method=request.method
        )

        if result.get("success"):
            return LeastSquaresResponse(
                success=True,
                solution=result.get("solution"),
                metrics=LeastSquaresMetrics(**result.get("metrics", {})),
                method=result.get("method")
            )
        else:
            return LeastSquaresResponse(
                success=False,
                error=result.get("error")
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Least squares error: {e}", exc_info=True)
        return LeastSquaresResponse(success=False, error=str(e))


@router.post("/validate-matrix", response_model=MatrixValidationResponse)
async def validate_matrix(request: MatrixValidationRequest):
    """
    Validate matrix and vector for least squares solving

    Returns information about the matrix properties without actually solving.
    Useful for diagnosing numerical issues before running the full computation.

    **Diagnostics provided:**
    - Matrix dimensions and rank
    - Condition number (indicates numerical stability)
    - Whether matrix has NaN or Inf values
    - Recommended solving method
    """
    try:
        result = ml_service.validate_matrix(
            matrix_a=request.matrixA,
            vector_b=request.vectorB
        )

        return MatrixValidationResponse(**result)

    except Exception as e:
        logger.error(f"Matrix validation error: {e}", exc_info=True)
        return MatrixValidationResponse(valid=False, error=str(e))


@router.get("/methods")
async def get_methods():
    """
    Get available solving methods with descriptions
    """
    return {
        "methods": [
            {
                "id": "ridge",
                "name": "Ridge Regression",
                "description": "Tikhonov regularization. Most stable for ill-conditioned matrices.",
                "requiresRegularization": True,
                "bestFor": "General use, especially when matrix is nearly singular"
            },
            {
                "id": "lstsq",
                "name": "Least Squares (LAPACK)",
                "description": "Standard least squares via LAPACK gelsd routine.",
                "requiresRegularization": False,
                "bestFor": "Well-conditioned matrices, fastest method"
            },
            {
                "id": "svd",
                "name": "SVD Pseudo-inverse",
                "description": "SVD-based solution with optional regularization.",
                "requiresRegularization": True,
                "bestFor": "Severely ill-conditioned or rank-deficient matrices"
            }
        ]
    }


@router.post("/batch")
async def batch_solve(requests: List[LeastSquaresRequest]):
    """
    Solve multiple least squares problems in batch

    Useful for processing multiple independent systems simultaneously.
    """
    try:
        results = []
        for req in requests:
            result = ml_service.solve_least_squares(
                matrix_a=req.matrixA,
                vector_b=req.vectorB,
                regularization=req.regularization,
                method=req.method
            )
            results.append(result)

        return {
            "success": True,
            "batchResults": results,
            "totalRequests": len(requests),
            "successCount": sum(1 for r in results if r.get("success")),
            "failureCount": sum(1 for r in results if not r.get("success"))
        }

    except Exception as e:
        logger.error(f"Batch solve error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
