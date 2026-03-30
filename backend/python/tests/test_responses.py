"""
Unit tests for common/responses.py

Validates the unified API response format used across all Python FastAPI routes.
"""
import pytest

from common.responses import (
    ApiException,
    ApiResponse,
    ErrorCode,
    error_response,
    success_response,
)


# ── success_response ─────────────────────────────────────────────


class TestSuccessResponse:

    def test_default_message(self):
        result = success_response()
        assert result == {"success": True, "data": None, "message": "操作成功"}

    def test_with_data(self):
        data = {"items": [1, 2, 3], "total": 3}
        result = success_response(data=data)
        assert result["success"] is True
        assert result["data"] == data
        assert result["message"] == "操作成功"

    def test_custom_message(self):
        result = success_response(data="hello", message="Query complete")
        assert result["success"] is True
        assert result["data"] == "hello"
        assert result["message"] == "Query complete"

    def test_none_data_is_valid(self):
        result = success_response(data=None, message="No results")
        assert result["success"] is True
        assert result["data"] is None

    def test_returns_dict_not_pydantic(self):
        """success_response returns a plain dict, not an ApiResponse model."""
        result = success_response(data=42)
        assert isinstance(result, dict)
        assert "code" not in result  # success has no error code


# ── error_response ───────────────────────────────────────────────


class TestErrorResponse:

    def test_includes_error_code(self):
        result = error_response("Something broke", ErrorCode.INTERNAL_ERROR)
        assert result["success"] is False
        assert result["message"] == "Something broke"
        assert result["code"] == "INTERNAL_ERROR"
        assert result["data"] is None

    def test_default_error_code_is_internal(self):
        result = error_response("Generic error")
        assert result["code"] == "INTERNAL_ERROR"

    def test_validation_error_code(self):
        result = error_response("Bad input", ErrorCode.VALIDATION_ERROR)
        assert result["code"] == "VALIDATION_ERROR"

    def test_with_data(self):
        result = error_response(
            "Partial failure",
            ErrorCode.DATA_PROCESSING_ERROR,
            data={"failedRows": [3, 7]},
        )
        assert result["data"] == {"failedRows": [3, 7]}
        assert result["success"] is False

    def test_all_error_codes_produce_valid_responses(self):
        for code in ErrorCode:
            result = error_response(f"Error: {code.value}", code)
            assert result["success"] is False
            assert result["code"] == code.value
            assert result["message"] == f"Error: {code.value}"


# ── ErrorCode enum ───────────────────────────────────────────────


class TestErrorCode:

    def test_all_expected_codes_exist(self):
        expected = {
            "VALIDATION_ERROR",
            "NOT_FOUND",
            "AUTH_ERROR",
            "RATE_LIMIT",
            "LLM_TIMEOUT",
            "LLM_ERROR",
            "SERVICE_UNAVAILABLE",
            "DATA_PROCESSING_ERROR",
            "INTERNAL_ERROR",
        }
        actual = {code.value for code in ErrorCode}
        assert actual == expected

    def test_is_string_enum(self):
        assert isinstance(ErrorCode.NOT_FOUND, str)
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"


# ── ApiException ─────────────────────────────────────────────────


class TestApiException:

    def test_has_correct_status_code_and_message(self):
        exc = ApiException("File too large", ErrorCode.VALIDATION_ERROR, status_code=400)
        assert exc.message == "File too large"
        assert exc.code == ErrorCode.VALIDATION_ERROR
        assert exc.status_code == 400

    def test_default_status_code_is_400(self):
        exc = ApiException("Bad request")
        assert exc.status_code == 400

    def test_default_error_code_is_internal(self):
        exc = ApiException("Something went wrong")
        assert exc.code == ErrorCode.INTERNAL_ERROR

    def test_custom_status_code(self):
        exc = ApiException("Unauthorized", ErrorCode.AUTH_ERROR, status_code=401)
        assert exc.status_code == 401

    def test_is_exception_subclass(self):
        exc = ApiException("test")
        assert isinstance(exc, Exception)

    def test_str_representation(self):
        exc = ApiException("Timeout occurred", ErrorCode.LLM_TIMEOUT, status_code=504)
        assert str(exc) == "Timeout occurred"

    def test_can_be_raised_and_caught(self):
        with pytest.raises(ApiException) as exc_info:
            raise ApiException("Rate limited", ErrorCode.RATE_LIMIT, status_code=429)

        assert exc_info.value.status_code == 429
        assert exc_info.value.code == ErrorCode.RATE_LIMIT


# ── ApiResponse Pydantic model ───────────────────────────────────


class TestApiResponseModel:

    def test_success_model(self):
        resp = ApiResponse(success=True, data={"id": 1}, message="OK")
        assert resp.success is True
        assert resp.data == {"id": 1}
        assert resp.code is None

    def test_error_model(self):
        resp = ApiResponse(
            success=False, message="Not found", code="NOT_FOUND"
        )
        assert resp.success is False
        assert resp.data is None
        assert resp.code == "NOT_FOUND"

    def test_serialization_matches_java_format(self):
        resp = ApiResponse(success=True, data=[1, 2], message="OK")
        d = resp.model_dump()
        assert set(d.keys()) == {"success", "data", "message", "code"}
