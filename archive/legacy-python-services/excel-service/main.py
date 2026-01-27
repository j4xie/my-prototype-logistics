"""
Smart BI Excel 处理服务

专门处理复杂 Excel 文件（多层表头、透视表等），
返回标准化 JSON 供 Java 后端持久化。
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import logging

from services.excel_parser import ExcelParserService

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart BI Excel Service",
    description="处理复杂 Excel 文件，返回标准化数据",
    version="1.0.0"
)

# CORS 配置（允许 Java 后端调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化服务
excel_parser = ExcelParserService()


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "excel-service"}


@app.post("/api/excel/parse")
async def parse_excel(
    file: UploadFile = File(...),
    sheet_index: Optional[int] = 0,
    data_type: Optional[str] = None  # FINANCE, SALES, AUTO
):
    """
    解析 Excel 文件

    - **file**: Excel 文件 (.xlsx, .xls)
    - **sheet_index**: 工作表索引，默认 0
    - **data_type**: 数据类型，AUTO 自动检测

    返回标准化 JSON 数据
    """
    try:
        # 验证文件类型
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="不支持的文件格式，请上传 .xlsx 或 .xls 文件"
            )

        logger.info(f"开始解析 Excel: {file.filename}, sheet_index={sheet_index}")

        # 读取文件内容
        content = await file.read()

        # 解析 Excel
        result = excel_parser.parse(
            file_content=content,
            filename=file.filename,
            sheet_index=sheet_index,
            data_type=data_type
        )

        logger.info(f"解析完成: {result['rowCount']} 行数据")

        return {
            "success": True,
            "data": result,
            "message": "解析成功"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"解析 Excel 失败: {str(e)}", exc_info=True)
        return {
            "success": False,
            "data": None,
            "message": f"解析失败: {str(e)}"
        }


@app.post("/api/excel/preview")
async def preview_excel(
    file: UploadFile = File(...),
    sheet_index: Optional[int] = 0,
    max_rows: Optional[int] = 10
):
    """
    预览 Excel 文件（返回前 N 行）
    """
    try:
        content = await file.read()
        result = excel_parser.preview(
            file_content=content,
            filename=file.filename,
            sheet_index=sheet_index,
            max_rows=max_rows
        )

        return {
            "success": True,
            "data": result,
            "message": "预览成功"
        }

    except Exception as e:
        logger.error(f"预览 Excel 失败: {str(e)}", exc_info=True)
        return {
            "success": False,
            "data": None,
            "message": f"预览失败: {str(e)}"
        }


@app.get("/api/excel/sheets")
async def get_sheets(file: UploadFile = File(...)):
    """
    获取 Excel 文件中的所有工作表
    """
    try:
        content = await file.read()
        sheets = excel_parser.get_sheet_names(content)

        return {
            "success": True,
            "data": sheets,
            "message": "获取成功"
        }

    except Exception as e:
        logger.error(f"获取工作表失败: {str(e)}", exc_info=True)
        return {
            "success": False,
            "data": None,
            "message": f"获取失败: {str(e)}"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
