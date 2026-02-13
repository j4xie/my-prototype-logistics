from __future__ import annotations
"""
LinUCB API

Endpoints for LinUCB algorithm computations used in worker recommendation.
"""
import logging
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from scheduling.services.linucb_service import LinUCBService

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
linucb_service = LinUCBService()


# ============================================================================
# Request Models
# ============================================================================

class ComputeUCBRequest(BaseModel):
    """Request model for computing UCB"""
    matrixA: List[List[float]] = Field(
        ...,
        description="A matrix (n x n), accumulated feature outer products + regularization"
    )
    vectorB: List[float] = Field(
        ...,
        description="b vector (n,), accumulated reward-weighted features"
    )
    context: List[float] = Field(
        ...,
        description="Context features x (n,) for current task+worker"
    )
    alpha: float = Field(
        0.5,
        ge=0,
        le=5.0,
        description="Exploration parameter (default 0.5)"
    )


class UpdateModelRequest(BaseModel):
    """Request model for updating LinUCB model with feedback"""
    matrixA: List[List[float]] = Field(
        ...,
        description="Current A matrix"
    )
    vectorB: List[float] = Field(
        ...,
        description="Current b vector"
    )
    context: List[float] = Field(
        ...,
        description="Context features x"
    )
    reward: float = Field(
        ...,
        ge=0,
        le=2,
        description="Observed reward r (0-2, can exceed 1.0 when exceeding targets)"
    )


class BatchComputeRequest(BaseModel):
    """Request model for batch UCB computation"""
    matrixAList: List[List[List[float]]] = Field(
        ...,
        description="List of A matrices, one per worker"
    )
    vectorBList: List[List[float]] = Field(
        ...,
        description="List of b vectors, one per worker"
    )
    context: List[float] = Field(
        ...,
        description="Shared context features (task + current state)"
    )
    alpha: float = Field(
        0.5,
        ge=0,
        le=5.0,
        description="Exploration parameter (default 0.5)"
    )


class InitializeRequest(BaseModel):
    """Request model for initializing LinUCB model"""
    featureDim: int = Field(
        16,
        ge=1,
        le=256,
        description="Feature dimension (default 16)"
    )
    regularization: float = Field(
        1.0,
        gt=0,
        le=100,
        description="Regularization parameter lambda (default 1.0)"
    )


class ValidateRequest(BaseModel):
    """Request model for validating LinUCB model parameters"""
    matrixA: List[List[float]] = Field(
        ...,
        description="A matrix to validate"
    )
    vectorB: List[float] = Field(
        ...,
        description="b vector to validate"
    )


# ============================================================================
# Response Models
# ============================================================================

class ComputeUCBResponse(BaseModel):
    """Response model for UCB computation"""
    success: bool
    ucb: Optional[float] = Field(None, description="Upper Confidence Bound score")
    expectedReward: Optional[float] = Field(None, description="Expected reward (exploitation term)")
    confidenceWidth: Optional[float] = Field(None, description="Confidence width (exploration term)")
    theta: Optional[List[float]] = Field(None, description="Parameter vector")
    error: Optional[str] = Field(None, description="Error message if failed")


class UpdateModelResponse(BaseModel):
    """Response model for model update"""
    success: bool
    matrixA: Optional[List[List[float]]] = Field(None, description="Updated A matrix")
    matrixAInverse: Optional[List[List[float]]] = Field(None, description="Updated A inverse matrix")
    vectorB: Optional[List[float]] = Field(None, description="Updated b vector")
    error: Optional[str] = Field(None, description="Error message if failed")


class BatchComputeResponse(BaseModel):
    """Response model for batch UCB computation"""
    success: bool
    results: Optional[List[dict]] = Field(None, description="List of individual UCB results")
    totalWorkers: Optional[int] = Field(None, description="Total number of workers processed")
    successCount: Optional[int] = Field(None, description="Number of successful computations")
    error: Optional[str] = Field(None, description="Error message if failed")


class InitializeResponse(BaseModel):
    """Response model for model initialization"""
    success: bool
    matrixA: Optional[List[List[float]]] = Field(None, description="Initial A matrix (lambda * I)")
    matrixAInverse: Optional[List[List[float]]] = Field(None, description="Initial A inverse matrix (I / lambda)")
    vectorB: Optional[List[float]] = Field(None, description="Initial b vector (zeros)")
    featureDim: Optional[int] = Field(None, description="Feature dimension used")
    regularization: Optional[float] = Field(None, description="Regularization parameter used")
    error: Optional[str] = Field(None, description="Error message if failed")


class ValidateResponse(BaseModel):
    """Response model for model validation"""
    valid: bool
    featureDim: Optional[int] = Field(None, description="Feature dimension")
    conditionNumber: Optional[float] = Field(None, description="Matrix condition number")
    isSymmetric: Optional[bool] = Field(None, description="Whether matrix is symmetric")
    isPositiveDefinite: Optional[bool] = Field(None, description="Whether matrix is positive definite")
    hasNaN: Optional[bool] = Field(None, description="Whether matrix contains NaN values")
    hasInf: Optional[bool] = Field(None, description="Whether matrix contains Inf values")
    isHealthy: Optional[bool] = Field(None, description="Overall model health status")
    recommendation: Optional[str] = Field(None, description="Recommendation for model state")
    error: Optional[str] = Field(None, description="Error message if validation failed")


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/compute-ucb", response_model=ComputeUCBResponse)
async def compute_ucb(request: ComputeUCBRequest):
    """
    Compute UCB for a single worker.

    UCB(a) = theta^T * x + alpha * sqrt(x^T * A^(-1) * x)

    Where:
    - theta = A^(-1) * b (parameter vector)
    - x = context features
    - alpha = exploration parameter

    **Use case:** Calculate the UCB score for a specific worker given their model
    parameters and the current task context.

    **Example:**
    ```json
    {
      "matrixA": [[1.0, 0.0], [0.0, 1.0]],
      "vectorB": [0.5, 0.3],
      "context": [1.0, 0.5],
      "alpha": 0.5
    }
    ```
    """
    try:
        matrix_a = np.array(request.matrixA, dtype=np.float64)
        vector_b = np.array(request.vectorB, dtype=np.float64)
        context = np.array(request.context, dtype=np.float64)

        result = linucb_service.compute_ucb(
            matrix_a=matrix_a,
            vector_b=vector_b,
            context=context,
            alpha=request.alpha
        )

        if result.get("success"):
            return ComputeUCBResponse(
                success=True,
                ucb=result.get("ucb"),
                expectedReward=result.get("expectedReward"),
                confidenceWidth=result.get("confidenceWidth"),
                theta=result.get("theta")
            )
        else:
            return ComputeUCBResponse(
                success=False,
                error=result.get("error")
            )

    except Exception as e:
        logger.error(f"Compute UCB error: {e}", exc_info=True)
        return ComputeUCBResponse(success=False, error=str(e))


@router.post("/update-model", response_model=UpdateModelResponse)
async def update_model(request: UpdateModelRequest):
    """
    Update LinUCB model with feedback.

    Updates the model parameters after observing a reward:
    - A_new = A + x * x^T (outer product update)
    - b_new = b + r * x (reward-weighted feature accumulation)

    **Use case:** Update a worker's model after task completion with the observed reward.

    **Example:**
    ```json
    {
      "matrixA": [[1.0, 0.0], [0.0, 1.0]],
      "vectorB": [0.0, 0.0],
      "context": [1.0, 0.5],
      "reward": 0.85
    }
    ```
    """
    try:
        matrix_a = np.array(request.matrixA, dtype=np.float64)
        vector_b = np.array(request.vectorB, dtype=np.float64)
        context = np.array(request.context, dtype=np.float64)

        result = linucb_service.update_model(
            matrix_a=matrix_a,
            vector_b=vector_b,
            context=context,
            reward=request.reward
        )

        if result.get("success"):
            return UpdateModelResponse(
                success=True,
                matrixA=result.get("matrixA"),
                matrixAInverse=result.get("matrixAInverse"),
                vectorB=result.get("vectorB")
            )
        else:
            return UpdateModelResponse(
                success=False,
                error=result.get("error")
            )

    except Exception as e:
        logger.error(f"Update model error: {e}", exc_info=True)
        return UpdateModelResponse(success=False, error=str(e))


@router.post("/batch-compute", response_model=BatchComputeResponse)
async def batch_compute(request: BatchComputeRequest):
    """
    Batch compute UCB for multiple workers.

    Computes UCB scores for multiple workers in a single request, which is more
    efficient than making N individual requests when recommending from a candidate list.

    **Use case:** Rank multiple candidate workers for a task based on their UCB scores.

    **Example:**
    ```json
    {
      "matrixAList": [
        [[1.0, 0.0], [0.0, 1.0]],
        [[1.5, 0.1], [0.1, 1.5]]
      ],
      "vectorBList": [
        [0.5, 0.3],
        [0.8, 0.4]
      ],
      "context": [1.0, 0.5],
      "alpha": 0.5
    }
    ```
    """
    try:
        context = np.array(request.context, dtype=np.float64)

        result = linucb_service.batch_compute_ucb(
            matrix_a_list=request.matrixAList,
            vector_b_list=request.vectorBList,
            context=context,
            alpha=request.alpha
        )

        if result.get("success"):
            return BatchComputeResponse(
                success=True,
                results=result.get("results"),
                totalWorkers=result.get("totalWorkers"),
                successCount=result.get("successCount")
            )
        else:
            return BatchComputeResponse(
                success=False,
                error=result.get("error")
            )

    except Exception as e:
        logger.error(f"Batch compute error: {e}", exc_info=True)
        return BatchComputeResponse(success=False, error=str(e))


@router.post("/initialize", response_model=InitializeResponse)
async def initialize(request: InitializeRequest):
    """
    Create initial LinUCB model parameters.

    Initializes a new LinUCB model with:
    - A = lambda * I (identity matrix scaled by regularization)
    - A^(-1) = I / lambda
    - b = 0 (zero vector)

    **Use case:** Initialize model parameters for a new worker.

    **Example:**
    ```json
    {
      "featureDim": 16,
      "regularization": 1.0
    }
    ```
    """
    try:
        result = linucb_service.initialize_model(
            feature_dim=request.featureDim,
            regularization=request.regularization
        )

        if result.get("success"):
            return InitializeResponse(
                success=True,
                matrixA=result.get("matrixA"),
                matrixAInverse=result.get("matrixAInverse"),
                vectorB=result.get("vectorB"),
                featureDim=result.get("featureDim"),
                regularization=result.get("regularization")
            )
        else:
            return InitializeResponse(
                success=False,
                error=result.get("error")
            )

    except Exception as e:
        logger.error(f"Initialize error: {e}", exc_info=True)
        return InitializeResponse(success=False, error=str(e))


@router.post("/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest):
    """
    Validate LinUCB model parameters.

    Checks model parameters for numerical stability and correctness:
    - Matrix dimensions and symmetry
    - Positive definiteness (required for LinUCB)
    - Condition number (numerical stability indicator)
    - Presence of NaN/Inf values

    **Use case:** Diagnose model health before using it for recommendations.

    **Example:**
    ```json
    {
      "matrixA": [[1.0, 0.0], [0.0, 1.0]],
      "vectorB": [0.5, 0.3]
    }
    ```
    """
    try:
        matrix_a = np.array(request.matrixA, dtype=np.float64)
        vector_b = np.array(request.vectorB, dtype=np.float64)

        result = linucb_service.validate_model(
            matrix_a=matrix_a,
            vector_b=vector_b
        )

        return ValidateResponse(
            valid=result.get("valid", False),
            featureDim=result.get("featureDim"),
            conditionNumber=result.get("conditionNumber"),
            isSymmetric=result.get("isSymmetric"),
            isPositiveDefinite=result.get("isPositiveDefinite"),
            hasNaN=result.get("hasNaN"),
            hasInf=result.get("hasInf"),
            isHealthy=result.get("isHealthy"),
            recommendation=result.get("recommendation"),
            error=result.get("error")
        )

    except Exception as e:
        logger.error(f"Validate error: {e}", exc_info=True)
        return ValidateResponse(valid=False, error=str(e))


@router.get("/info")
async def get_info():
    """
    Get LinUCB service information and default parameters.
    """
    return {
        "service": "LinUCB",
        "algorithm": "Linear Upper Confidence Bound",
        "formula": "UCB(a) = theta^T * x + alpha * sqrt(x^T * A^(-1) * x)",
        "defaults": {
            "alpha": 0.5,
            "featureDim": 16,
            "regularization": 1.0
        },
        "endpoints": {
            "computeUcb": "/compute-ucb",
            "updateModel": "/update-model",
            "batchCompute": "/batch-compute",
            "initialize": "/initialize",
            "validate": "/validate"
        }
    }
