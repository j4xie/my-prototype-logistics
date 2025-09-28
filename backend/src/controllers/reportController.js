import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createSuccessResponse
} from '../middleware/errorHandler.js';
import { safeGetFactoryId } from '../utils/factory-context-handler.js';

const prisma = new PrismaClient();

/**
 * 获取报表模板列表
 * GET /api/mobile/reports/templates
 */
export const getReportTemplates = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const { type, category, isActive = true } = req.query;

    const where = {
      OR: [
        { factoryId }, // 工厂专属模板
        { isSystem: true } // 系统模板
      ],
      ...(type && { type }),
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    };

    const templates = await prisma.reportTemplate.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' }, // 系统模板优先
        { createdAt: 'desc' }
      ],
      include: {
        creator: {
          select: {
            fullName: true
          }
        }
      }
    });

    res.json(createSuccessResponse({
      templates: templates.map(template => ({
        ...template,
        template: undefined, // 不返回具体模板内容
        hasParameters: template.parameters && Object.keys(template.parameters).length > 0
      }))
    }, '获取报表模板成功'));
  } catch (error) {
    next(error);
  }
};

/**
 * 生成Excel报表
 * POST /api/mobile/reports/generate/excel
 */
export const generateExcelReport = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      templateId,
      reportType = 'production',
      parameters = {},
      filename
    } = req.body;

    let reportData = {};
    let reportTitle = '生产报表';

    // 根据报表类型获取数据
    switch (reportType) {
      case 'production':
        reportData = await getProductionReportData(factoryId, parameters);
        reportTitle = '生产批次报表';
        break;
      case 'quality':
        reportData = await getQualityReportData(factoryId, parameters);
        reportTitle = '质量检测报表';
        break;
      case 'equipment':
        reportData = await getEquipmentReportData(factoryId, parameters);
        reportTitle = '设备监控报表';
        break;
      default:
        throw new ValidationError('不支持的报表类型');
    }

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportTitle);

    // 根据报表类型设置Excel格式
    await setupExcelFormat(worksheet, reportType, reportData, parameters);

    // 生成文件
    const reportFilename = filename || `${reportType}_report_${Date.now()}.xlsx`;
    const filepath = path.join(process.cwd(), 'temp', reportFilename);
    
    // 确保temp目录存在
    const tempDir = path.dirname(filepath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filepath);

    res.json(createSuccessResponse({
      filename: reportFilename,
      filepath: filepath,
      reportType,
      generatedAt: new Date(),
      recordCount: Array.isArray(reportData.data) ? reportData.data.length : 0
    }, 'Excel报表生成成功'));

  } catch (error) {
    next(error);
  }
};

/**
 * 生成PDF报表
 * POST /api/mobile/reports/generate/pdf
 */
export const generatePDFReport = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      templateId,
      reportType = 'production',
      parameters = {},
      filename
    } = req.body;

    let reportData = {};
    let reportTitle = '生产报表';

    // 根据报表类型获取数据
    switch (reportType) {
      case 'production':
        reportData = await getProductionReportData(factoryId, parameters);
        reportTitle = '生产批次报表';
        break;
      case 'quality':
        reportData = await getQualityReportData(factoryId, parameters);
        reportTitle = '质量检测报表';
        break;
      case 'equipment':
        reportData = await getEquipmentReportData(factoryId, parameters);
        reportTitle = '设备监控报表';
        break;
      default:
        throw new ValidationError('不支持的报表类型');
    }

    // 创建PDF文档
    const reportFilename = filename || `${reportType}_report_${Date.now()}.pdf`;
    const filepath = path.join(process.cwd(), 'temp', reportFilename);
    
    // 确保temp目录存在
    const tempDir = path.dirname(filepath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filepath));

    // 添加中文字体支持（需要字体文件）
    try {
      doc.font('fonts/NotoSansCJK-Regular.ttf');
    } catch (e) {
      // 如果没有中文字体，使用默认字体
      console.warn('中文字体文件不存在，使用默认字体');
    }

    // 生成PDF内容
    await generatePDFContent(doc, reportType, reportData, reportTitle, parameters);

    doc.end();

    res.json(createSuccessResponse({
      filename: reportFilename,
      filepath: filepath,
      reportType,
      generatedAt: new Date(),
      recordCount: Array.isArray(reportData.data) ? reportData.data.length : 0
    }, 'PDF报表生成成功'));

  } catch (error) {
    next(error);
  }
};

/**
 * 下载报表文件
 * GET /api/mobile/reports/download/:filename
 */
export const downloadReport = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(process.cwd(), 'temp', filename);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundError('报表文件不存在或已过期');
    }

    const fileExtension = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (fileExtension === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // 文件下载完成后删除临时文件
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filepath);
        } catch (e) {
          console.warn(`Failed to delete temp file: ${filepath}`);
        }
      }, 60000); // 1分钟后删除
    });

  } catch (error) {
    next(error);
  }
};

/**
 * 创建自定义报表模板
 * POST /api/mobile/reports/templates
 */
export const createReportTemplate = async (req, res, next) => {
  try {
    const factoryId = safeGetFactoryId(req);
    const {
      name,
      type,
      category,
      template,
      parameters,
      description
    } = req.body;

    if (!name || !type || !template) {
      throw new ValidationError('报表名称、类型和模板配置为必填项');
    }

    const reportTemplate = await prisma.reportTemplate.create({
      data: {
        name,
        type,
        category: category || 'custom',
        template,
        parameters: parameters || {},
        isSystem: false,
        isActive: true,
        createdBy: req.user.id,
        factoryId,
        description
      },
      include: {
        creator: {
          select: {
            fullName: true
          }
        }
      }
    });

    res.json(createSuccessResponse(reportTemplate, '报表模板创建成功'));
  } catch (error) {
    next(error);
  }
};

// 数据获取函数
async function getProductionReportData(factoryId, parameters) {
  const { startDate, endDate, status, productType } = parameters;
  
  const where = {
    factoryId,
    ...(startDate && endDate && {
      startDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }),
    ...(status && { status }),
    ...(productType && { productType: { contains: productType } })
  };

  const [batches, summary] = await Promise.all([
    prisma.processingBatch.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        supervisor: {
          select: { fullName: true }
        },
        qualityInspections: {
          select: {
            overallResult: true,
            qualityScore: true
          }
        }
      }
    }),
    prisma.processingBatch.aggregate({
      where,
      _count: { id: true },
      _sum: { 
        targetQuantity: true,
        actualQuantity: true 
      },
      _avg: { actualQuantity: true }
    })
  ]);

  return {
    data: batches,
    summary: {
      totalBatches: summary._count.id,
      totalTargetQuantity: summary._sum.targetQuantity || 0,
      totalActualQuantity: summary._sum.actualQuantity || 0,
      avgQuantity: summary._avg.actualQuantity || 0
    }
  };
}

async function getQualityReportData(factoryId, parameters) {
  const { startDate, endDate, inspectionType, overallResult } = parameters;
  
  const where = {
    factoryId,
    ...(startDate && endDate && {
      inspectionDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }),
    ...(inspectionType && { inspectionType }),
    ...(overallResult && { overallResult })
  };

  const [inspections, summary] = await Promise.all([
    prisma.qualityInspection.findMany({
      where,
      orderBy: { inspectionDate: 'desc' },
      include: {
        batch: {
          select: {
            batchNumber: true,
            productType: true
          }
        },
        inspector: {
          select: { fullName: true }
        }
      }
    }),
    prisma.qualityInspection.aggregate({
      where,
      _count: { id: true },
      _avg: { qualityScore: true }
    })
  ]);

  const passRate = inspections.length > 0 
    ? (inspections.filter(i => i.overallResult === 'pass').length / inspections.length) * 100
    : 0;

  return {
    data: inspections,
    summary: {
      totalInspections: summary._count.id,
      avgQualityScore: summary._avg.qualityScore || 0,
      passRate: Math.round(passRate * 10) / 10
    }
  };
}

async function getEquipmentReportData(factoryId, parameters) {
  const { startDate, endDate, equipmentId, status } = parameters;
  
  const where = {
    factoryId,
    ...(startDate && endDate && {
      timestamp: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }),
    ...(equipmentId && { equipmentId }),
    ...(status && { status })
  };

  const [monitoringData, equipmentList] = await Promise.all([
    prisma.deviceMonitoringData.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        equipment: {
          select: {
            equipmentCode: true,
            equipmentName: true,
            department: true
          }
        }
      }
    }),
    prisma.factoryEquipment.findMany({
      where: { factoryId },
      select: {
        id: true,
        equipmentCode: true,
        equipmentName: true,
        status: true,
        department: true
      }
    })
  ]);

  return {
    data: monitoringData,
    equipmentList,
    summary: {
      totalRecords: monitoringData.length,
      equipmentCount: equipmentList.length,
      activeEquipment: equipmentList.filter(e => e.status === 'active').length
    }
  };
}

// Excel格式设置函数
async function setupExcelFormat(worksheet, reportType, reportData, parameters) {
  // 设置标题
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = getReportTitle(reportType);
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // 设置生成信息
  worksheet.getCell('A2').value = `生成时间: ${new Date().toLocaleString('zh-CN')}`;
  worksheet.getCell('A3').value = `记录数量: ${Array.isArray(reportData.data) ? reportData.data.length : 0}`;

  // 根据报表类型设置表头和数据
  let startRow = 5;
  
  if (reportType === 'production') {
    // 生产报表表头
    const headers = ['批次号', '产品类型', '开始日期', '状态', '目标产量', '实际产量', '负责人'];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(startRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // 添加数据
    reportData.data.forEach((batch, index) => {
      const row = startRow + index + 1;
      worksheet.getCell(row, 1).value = batch.batchNumber;
      worksheet.getCell(row, 2).value = batch.productType;
      worksheet.getCell(row, 3).value = batch.startDate?.toLocaleDateString('zh-CN');
      worksheet.getCell(row, 4).value = getStatusText(batch.status);
      worksheet.getCell(row, 5).value = parseFloat(batch.targetQuantity || 0);
      worksheet.getCell(row, 6).value = parseFloat(batch.actualQuantity || 0);
      worksheet.getCell(row, 7).value = batch.supervisor?.fullName || '-';
    });
  } else if (reportType === 'quality') {
    // 质检报表表头
    const headers = ['批次号', '产品类型', '检测日期', '检测类型', '检测结果', '质量分数', '检测员'];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(startRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // 添加数据
    reportData.data.forEach((inspection, index) => {
      const row = startRow + index + 1;
      worksheet.getCell(row, 1).value = inspection.batch?.batchNumber || '-';
      worksheet.getCell(row, 2).value = inspection.batch?.productType || '-';
      worksheet.getCell(row, 3).value = inspection.inspectionDate?.toLocaleDateString('zh-CN');
      worksheet.getCell(row, 4).value = getInspectionTypeText(inspection.inspectionType);
      worksheet.getCell(row, 5).value = getInspectionResultText(inspection.overallResult);
      worksheet.getCell(row, 6).value = parseFloat(inspection.qualityScore || 0);
      worksheet.getCell(row, 7).value = inspection.inspector?.fullName || '-';
    });
  }

  // 设置列宽
  worksheet.columns.forEach(column => {
    column.width = 15;
  });
}

// PDF内容生成函数
async function generatePDFContent(doc, reportType, reportData, reportTitle, parameters) {
  // 添加标题
  doc.fontSize(18).text(reportTitle, { align: 'center' });
  doc.moveDown();
  
  // 添加生成信息
  doc.fontSize(10)
     .text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'left' })
     .text(`记录数量: ${Array.isArray(reportData.data) ? reportData.data.length : 0}`, { align: 'left' });
  doc.moveDown();

  // 添加摘要信息
  if (reportData.summary) {
    doc.fontSize(12).text('统计摘要:', { underline: true });
    Object.entries(reportData.summary).forEach(([key, value]) => {
      doc.fontSize(10).text(`${getSummaryLabel(key)}: ${value}`);
    });
    doc.moveDown();
  }

  // 添加数据表格（简化版）
  doc.fontSize(12).text('详细数据:', { underline: true });
  doc.fontSize(8);
  
  if (reportType === 'production' && reportData.data.length > 0) {
    reportData.data.slice(0, 50).forEach((batch, index) => { // 限制显示50条
      doc.text(`${index + 1}. ${batch.batchNumber} - ${batch.productType} - ${getStatusText(batch.status)}`);
    });
  } else if (reportType === 'quality' && reportData.data.length > 0) {
    reportData.data.slice(0, 50).forEach((inspection, index) => {
      doc.text(`${index + 1}. ${inspection.batch?.batchNumber || '-'} - ${getInspectionResultText(inspection.overallResult)} - 分数: ${inspection.qualityScore || 0}`);
    });
  }

  if (reportData.data.length > 50) {
    doc.text('...(仅显示前50条记录)');
  }
}

// 辅助函数
function getReportTitle(reportType) {
  const titles = {
    production: '生产批次报表',
    quality: '质量检测报表',
    equipment: '设备监控报表'
  };
  return titles[reportType] || '数据报表';
}

function getStatusText(status) {
  const statusMap = {
    planning: '计划中',
    in_progress: '进行中',
    quality_check: '质检中',
    completed: '已完成',
    failed: '失败'
  };
  return statusMap[status] || status;
}

function getInspectionTypeText(type) {
  const typeMap = {
    raw_material: '原料检测',
    process: '过程检测',
    final_product: '成品检测'
  };
  return typeMap[type] || type;
}

function getInspectionResultText(result) {
  const resultMap = {
    pass: '通过',
    fail: '不通过',
    conditional_pass: '有条件通过'
  };
  return resultMap[result] || result;
}

function getSummaryLabel(key) {
  const labelMap = {
    totalBatches: '总批次数',
    totalTargetQuantity: '目标总产量',
    totalActualQuantity: '实际总产量',
    avgQuantity: '平均产量',
    totalInspections: '检测总数',
    avgQualityScore: '平均质量分数',
    passRate: '通过率(%)',
    totalRecords: '监控记录数',
    equipmentCount: '设备总数',
    activeEquipment: '活跃设备数'
  };
  return labelMap[key] || key;
}

export default {
  getReportTemplates,
  generateExcelReport,
  generatePDFReport,
  downloadReport,
  createReportTemplate
};