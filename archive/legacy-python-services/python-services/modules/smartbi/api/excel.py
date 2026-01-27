from __future__ import annotations
"""
Excel Parsing API

Endpoints for Excel file parsing and processing.
"""
import logging
import time
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Query
from pydantic import BaseModel

from ..services.excel_parser import ExcelParser
from ..services.field_detector import FieldDetector
from ..services.data_feature_analyzer import DataFeatureAnalyzer
from ..services.field_mapping import FieldMappingService

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
excel_parser = ExcelParser()
field_detector = FieldDetector()
data_feature_analyzer = DataFeatureAnalyzer()
field_mapping_service = FieldMappingService()


class ParseMetadata(BaseModel):
    """Parse metadata model - Java compatible"""
    sheetName: Optional[str] = None
    originalColumnCount: Optional[int] = None
    sampledRowCount: Optional[int] = None
    parseTimeMs: Optional[int] = None
    hasMultiHeader: Optional[bool] = None
    headerRowCount: Optional[int] = None
    originalHeaders: Optional[List[List[str]]] = None
    detectedOrientation: Optional[str] = None
    totalRowCount: Optional[int] = None


class ParseResponse(BaseModel):
    """Excel parse response model - compatible with Java ExcelParseResponse"""
    success: bool
    errorMessage: Optional[str] = None
    uploadId: Optional[int] = None
    headers: List[str] = []
    rowCount: int = 0
    columnCount: int = 0
    fieldMappings: Optional[List[Dict]] = None
    dataFeatures: Optional[List[Dict]] = None
    previewData: Optional[List[Dict]] = None
    missingRequiredFields: Optional[List[str]] = None
    status: Optional[str] = None
    metadata: Optional[ParseMetadata] = None
    # Backward compatibility fields
    rows: List[list] = []
    direction: Optional[str] = None
    sheetNames: Optional[List[str]] = None
    currentSheet: Optional[str] = None


class SheetInfo(BaseModel):
    """Detailed information about a sheet"""
    name: str
    index: int
    rowCount: Optional[int] = None
    columnCount: Optional[int] = None
    hasData: bool = True
    previewHeaders: Optional[List[str]] = None


class SheetNamesResponse(BaseModel):
    """Sheet names response model"""
    success: bool
    sheetNames: List[str] = []
    error: Optional[str] = None


class ListSheetsResponse(BaseModel):
    """Detailed sheet listing response model"""
    success: bool
    totalSheets: int = 0
    sheets: List[SheetInfo] = []
    errorMessage: Optional[str] = None


class MultiHeaderDetectionResponse(BaseModel):
    """Multi-header detection response model"""
    success: bool
    isMultiHeader: bool = False
    recommendedHeaderRows: int = 1
    previewRows: Optional[List[list]] = None
    error: Optional[str] = None


def _perform_analysis(
    headers: List[str],
    rows: List[List[Any]],
    factory_id: Optional[str] = None
) -> tuple[List[Dict], List[Dict], List[str]]:
    """
    Perform field detection, data feature analysis, and field mapping.

    Args:
        headers: Column headers
        rows: Data rows
        factory_id: Optional factory ID for factory-specific mappings

    Returns:
        Tuple of (field_mappings, data_features, missing_required_fields)
    """
    # Analyze data features for each column
    data_features = []
    for i, header in enumerate(headers):
        column_values = [row[i] if i < len(row) else None for row in rows]
        feature = data_feature_analyzer.analyze_column(header, column_values, i)
        data_features.append(feature)

    # Map fields using the mapping service
    field_mappings_results = field_mapping_service.map_fields(
        headers,
        data_features,
        factory_id
    )

    # Convert to dictionaries for JSON response
    field_mappings = [fm.to_dict() for fm in field_mappings_results]
    data_features_dict = [df.to_dict() for df in data_features]

    # Find missing required fields
    mapped_fields = {
        fm.standard_field for fm in field_mappings_results
        if fm.standard_field is not None
    }
    missing_required = field_mapping_service.dictionary.get_missing_recommended_fields(mapped_fields)

    return field_mappings, data_features_dict, missing_required


@router.post("/parse", response_model=ParseResponse)
async def parse_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None),  # Alias for Java client compatibility
    header_rows: int = Form(1),
    skip_rows: int = Form(0),
    transpose: bool = Form(False),
    analyze: bool = Query(False, description="Include field analysis in response")
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
    - **analyze**: Include field analysis (field mappings, data features) in response
    """
    start_time = time.time()

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

        # Convert rows to previewData (List[Dict]) for Java compatibility
        headers = result.get("headers", [])
        rows = result.get("rows", [])
        preview_data = []
        for row in rows[:100]:  # Limit to 100 rows for preview
            row_dict = {}
            for i, value in enumerate(row):
                if i < len(headers):
                    row_dict[headers[i]] = value
            preview_data.append(row_dict)

        # Calculate parse time
        parse_time_ms = int((time.time() - start_time) * 1000)

        # Build metadata
        metadata = ParseMetadata(
            sheetName=result.get("currentSheet"),
            originalColumnCount=result.get("columnCount"),
            sampledRowCount=min(len(rows), 100),
            parseTimeMs=parse_time_ms,
            hasMultiHeader=header_rows > 1,
            headerRowCount=header_rows,
            detectedOrientation=result.get("direction"),
            totalRowCount=result.get("rowCount", len(rows))
        )

        # Optionally perform analysis
        field_mappings = None
        data_features = None
        missing_required_fields = None

        if analyze and headers and rows:
            field_mappings, data_features, missing_required_fields = _perform_analysis(
                headers, rows, None
            )

        return ParseResponse(
            success=result.get("success", True),
            errorMessage=result.get("error"),
            headers=headers,
            rowCount=result.get("rowCount", len(rows)),
            columnCount=result.get("columnCount", len(headers)),
            previewData=preview_data,
            fieldMappings=field_mappings,
            dataFeatures=data_features,
            missingRequiredFields=missing_required_fields,
            metadata=metadata,
            status="PARSED" if not analyze else "ANALYZED",
            # Keep backward compatibility
            rows=rows,
            direction=result.get("direction"),
            sheetNames=result.get("sheetNames"),
            currentSheet=result.get("currentSheet")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel parse error: {e}", exc_info=True)
        return ParseResponse(success=False, errorMessage=str(e))


@router.post("/parse-analyze", response_model=ParseResponse)
async def parse_and_analyze(
    file: UploadFile = File(...),
    factory_id: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    sheet_index: Optional[int] = Form(None),
    sheetIndex: Optional[int] = Form(None),  # Alias for Java client compatibility
    header_rows: int = Form(1),
    skip_rows: int = Form(0),
    auto_detect_multi_header: bool = Form(True),
    auto_detect_orientation: bool = Form(True)
):
    """
    Parse Excel file with full field analysis.

    This endpoint performs:
    1. Basic parsing (like /parse)
    2. Data feature analysis (type detection, statistics)
    3. Field mapping (maps columns to standard fields)
    4. Missing field detection

    - **file**: Excel file (.xlsx, .xls) or CSV file
    - **factory_id**: Factory ID for factory-specific field mappings
    - **sheet_name**: Sheet name to parse (default: first sheet)
    - **sheet_index**: Sheet index to parse (0-based)
    - **sheetIndex**: Alias for sheet_index (Java client compatibility)
    - **header_rows**: Number of header rows (default: 1)
    - **skip_rows**: Number of rows to skip at the top
    - **auto_detect_multi_header**: Automatically detect multi-level headers
    - **auto_detect_orientation**: Automatically detect data orientation (row vs column)
    """
    start_time = time.time()

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

        # Determine sheet to parse
        effective_index = sheet_index if sheet_index is not None else sheetIndex

        if sheet_name:
            sheet = sheet_name
        elif effective_index is not None:
            sheet = int(effective_index)
        else:
            sheet = 0

        logger.info(f"Parse-analyze: sheet={sheet}, factory_id={factory_id}, auto_detect_multi_header={auto_detect_multi_header}")

        # Auto-detect multi-header if enabled
        detected_header_rows = header_rows
        if auto_detect_multi_header and ext != ".csv":
            detection_result = excel_parser.detect_multi_header(content, sheet)
            if detection_result.get("success") and detection_result.get("isMultiHeader"):
                detected_header_rows = detection_result.get("recommendedHeaderRows", header_rows)
                logger.info(f"Auto-detected multi-header: {detected_header_rows} rows")

        # Parse the file
        if ext == ".csv":
            result = excel_parser.parse_csv(content)
        else:
            result = excel_parser.parse(
                content,
                sheet_name=sheet,
                header_rows=detected_header_rows,
                skip_rows=skip_rows,
                transpose=False  # Will handle orientation separately
            )

        if not result.get("success"):
            return ParseResponse(
                success=False,
                errorMessage=result.get("error", "Parse failed"),
                status="PARSE_ERROR"
            )

        headers = result.get("headers", [])
        rows = result.get("rows", [])

        # Auto-detect orientation if enabled
        detected_orientation = result.get("direction", "row")
        if auto_detect_orientation and hasattr(excel_parser, 'detect_orientation'):
            try:
                orientation_result = excel_parser.detect_orientation(content, sheet)
                if orientation_result.get("success"):
                    detected_orientation = orientation_result.get("direction", "row")
            except Exception as e:
                logger.warning(f"Orientation detection failed: {e}")

        # Perform full analysis
        field_mappings, data_features, missing_required_fields = _perform_analysis(
            headers, rows, factory_id
        )

        # Convert rows to previewData
        preview_data = []
        for row in rows[:100]:
            row_dict = {}
            for i, value in enumerate(row):
                if i < len(headers):
                    row_dict[headers[i]] = value
            preview_data.append(row_dict)

        # Calculate parse time
        parse_time_ms = int((time.time() - start_time) * 1000)

        # Build metadata
        metadata = ParseMetadata(
            sheetName=result.get("currentSheet"),
            originalColumnCount=len(headers),
            sampledRowCount=min(len(rows), 100),
            parseTimeMs=parse_time_ms,
            hasMultiHeader=detected_header_rows > 1,
            headerRowCount=detected_header_rows,
            detectedOrientation=detected_orientation,
            totalRowCount=result.get("rowCount", len(rows))
        )

        return ParseResponse(
            success=True,
            headers=headers,
            rowCount=result.get("rowCount", len(rows)),
            columnCount=len(headers),
            previewData=preview_data,
            fieldMappings=field_mappings,
            dataFeatures=data_features,
            missingRequiredFields=missing_required_fields,
            metadata=metadata,
            status="ANALYZED",
            # Backward compatibility
            rows=rows,
            direction=detected_orientation,
            sheetNames=result.get("sheetNames"),
            currentSheet=result.get("currentSheet")
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parse-analyze error: {e}", exc_info=True)
        return ParseResponse(
            success=False,
            errorMessage=str(e),
            status="ERROR"
        )


@router.post("/list-sheets", response_model=ListSheetsResponse)
async def list_sheets_detailed(file: UploadFile = File(...)):
    """
    Get detailed information about all sheets in an Excel file.

    Returns sheet names, indices, dimensions, and preview headers.

    - **file**: Excel file (.xlsx, .xls)
    """
    try:
        # Validate file type
        filename = file.filename or ""
        ext = "." + filename.split(".")[-1].lower() if "." in filename else ""

        if ext not in [".xlsx", ".xls"]:
            raise HTTPException(
                status_code=400,
                detail="This endpoint only supports Excel files (.xlsx, .xls)"
            )

        content = await file.read()
        sheet_names = excel_parser.get_sheet_names(content)

        sheets: List[SheetInfo] = []
        for i, name in enumerate(sheet_names):
            try:
                # Parse each sheet to get dimensions
                result = excel_parser.parse(content, sheet_name=i, header_rows=1)

                sheet_info = SheetInfo(
                    name=name,
                    index=i,
                    rowCount=result.get("rowCount", 0),
                    columnCount=result.get("columnCount", 0),
                    hasData=result.get("rowCount", 0) > 0,
                    previewHeaders=result.get("headers", [])[:10]  # First 10 headers
                )
            except Exception as e:
                logger.warning(f"Failed to get info for sheet '{name}': {e}")
                sheet_info = SheetInfo(
                    name=name,
                    index=i,
                    hasData=False
                )

            sheets.append(sheet_info)

        return ListSheetsResponse(
            success=True,
            totalSheets=len(sheets),
            sheets=sheets
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List sheets error: {e}", exc_info=True)
        return ListSheetsResponse(
            success=False,
            errorMessage=str(e)
        )


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
