from __future__ import annotations
"""
Excel Parsing API

Endpoints for Excel file parsing and processing.
"""
import logging
from typing import Optional, List, Dict

from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel

from services.excel_parser import ExcelParser

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize service
excel_parser = ExcelParser()


class ParseResponse(BaseModel):
    """Excel parse response model"""
    success: bool
    headers: List[str] = []
    rows: List[list] = []
    rowCount: int = 0
    columnCount: int = 0
    direction: Optional[str] = None
    sheetNames: Optional[List[str]] = None
    currentSheet: Optional[str] = None
    error: Optional[str] = None


class SheetNamesResponse(BaseModel):
    """Sheet names response model"""
    success: bool
    sheetNames: List[str] = []
    error: Optional[str] = None


class MultiHeaderDetectionResponse(BaseModel):
    """Multi-header detection response model"""
    success: bool
    isMultiHeader: bool = False
    recommendedHeaderRows: int = 1
    previewRows: Optional[List[list]] = None
    error: Optional[str] = None


@router.post("/parse", response_model=ParseResponse)
async def parse_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None),  # Alias for Java client compatibility
    header_rows: int = Form(1),
    skip_rows: int = Form(0),
    transpose: bool = Form(False)
):
    """
    Parse Excel file and return structured data

    - **file**: Excel file (.xlsx, .xls) or CSV file
    - **sheet_name**: Sheet name to parse (default: first sheet)
    - **sheet_index**: Sheet index to parse (0-based, alternative to sheet_name)
    - **sheetIndex**: Alias for sheet_index (Java client compatibility)
    - **header_rows**: Number of header rows (1 for single, 2 for multi-level)
    - **skip_rows**: Number of rows to skip at the top
    - **transpose**: Whether to transpose the data
    """
    try:
        # Validate file type
        filename = file.filename or ""
        ext = "." + filename.split(".")[-1].lower() if "." in filename else ""

        if ext not in excel_parser.supported_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Supported: {excel_parser.supported_extensions}"
            )

        # Read file content
        content = await file.read()

        # Parse based on file type
        if ext == ".csv":
            result = excel_parser.parse_csv(content)
        else:
            # Determine sheet to parse: sheet_name takes priority, then sheet_index/sheetIndex
            # Use sheetIndex as alias for sheet_index (Java client compatibility)
            effective_index = sheet_index if sheet_index is not None else sheetIndex

            if sheet_name:
                sheet = sheet_name
            elif effective_index is not None:
                sheet = int(effective_index)  # Ensure it's an integer
            else:
                sheet = 0  # Default to first sheet

            logger.info(f"Parsing Excel sheet: {sheet} (sheet_name={sheet_name}, sheet_index={sheet_index}, sheetIndex={sheetIndex})")

            result = excel_parser.parse(
                content,
                sheet_name=sheet,
                header_rows=header_rows,
                skip_rows=skip_rows,
                transpose=transpose
            )

        return ParseResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel parse error: {e}", exc_info=True)
        return ParseResponse(success=False, error=str(e))


@router.post("/sheets", response_model=SheetNamesResponse)
async def get_sheet_names(file: UploadFile = File(...)):
    """
    Get all sheet names from an Excel file

    - **file**: Excel file (.xlsx, .xls)
    """
    try:
        content = await file.read()
        sheet_names = excel_parser.get_sheet_names(content)

        return SheetNamesResponse(
            success=True,
            sheetNames=sheet_names
        )

    except Exception as e:
        logger.error(f"Get sheet names error: {e}", exc_info=True)
        return SheetNamesResponse(success=False, error=str(e))


@router.post("/detect-header", response_model=MultiHeaderDetectionResponse)
async def detect_multi_header(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None)
):
    """
    Detect if Excel file has multi-level headers

    - **file**: Excel file (.xlsx, .xls)
    - **sheet_name**: Sheet name to analyze (default: first sheet)
    - **sheet_index**: Sheet index to analyze (0-based)
    - **sheetIndex**: Alias for sheet_index
    """
    try:
        content = await file.read()

        # Determine sheet: sheet_name takes priority
        effective_index = sheet_index if sheet_index is not None else sheetIndex
        if sheet_name:
            sheet = sheet_name
        elif effective_index is not None:
            sheet = int(effective_index)
        else:
            sheet = 0

        result = excel_parser.detect_multi_header(content, sheet)

        return MultiHeaderDetectionResponse(**result)

    except Exception as e:
        logger.error(f"Multi-header detection error: {e}", exc_info=True)
        return MultiHeaderDetectionResponse(success=False, error=str(e))


@router.post("/preview")
async def preview_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None),
    rows: int = Form(10)
):
    """
    Preview first N rows of Excel file

    - **file**: Excel file
    - **sheet_name**: Sheet name to preview
    - **sheet_index**: Sheet index to preview (0-based)
    - **sheetIndex**: Alias for sheet_index
    - **rows**: Number of rows to preview (default: 10)
    """
    try:
        content = await file.read()

        # Determine sheet: sheet_name takes priority
        effective_index = sheet_index if sheet_index is not None else sheetIndex
        if sheet_name:
            sheet = sheet_name
        elif effective_index is not None:
            sheet = int(effective_index)
        else:
            sheet = 0

        result = excel_parser.parse(content, sheet_name=sheet)

        if result.get("success"):
            preview_rows = result["rows"][:rows]
            return {
                "success": True,
                "headers": result["headers"],
                "rows": preview_rows,
                "totalRows": result["rowCount"],
                "previewedRows": len(preview_rows)
            }

        return result

    except Exception as e:
        logger.error(f"Excel preview error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
