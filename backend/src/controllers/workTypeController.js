import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// 验证schema
const createWorkTypeSchema = z.object({
  typeCode: z.string().min(1, '工作类型代码不能为空'),
  typeName: z.string().min(1, '工作类型名称不能为空'),
  department: z.enum(['farming', 'processing', 'logistics', 'quality', 'management']).optional(),
  description: z.string().optional(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色代码格式不正确').optional()
});

const updateWorkTypeSchema = z.object({
  typeName: z.string().min(1, '工作类型名称不能为空').optional(),
  department: z.enum(['farming', 'processing', 'logistics', 'quality', 'management']).optional(),
  description: z.string().optional(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色代码格式不正确').optional(),
  isActive: z.boolean().optional()
});

// 获取工作类型列表
export const getWorkTypes = async (req, res) => {
  try {
    const factoryId = req.user.factoryId;
    const { department, isActive } = req.query;

    // 构建查询条件
    const where = {
      factoryId
    };

    if (department) {
      where.department = department;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const workTypes = await prisma.workType.findMany({
      where,
      orderBy: [
        { department: 'asc' },
        { typeName: 'asc' }
      ],
      include: {
        _count: {
          select: {
            timeClocks: true,
            workSessions: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: workTypes
    });

  } catch (error) {
    console.error('获取工作类型失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 创建工作类型
export const createWorkType = async (req, res) => {
  try {
    const validation = createWorkTypeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const { typeCode, typeName, department, description, colorCode } = validation.data;
    const factoryId = req.user.factoryId;

    // 检查工作类型代码是否重复
    const existingType = await prisma.workType.findFirst({
      where: {
        factoryId,
        typeCode
      }
    });

    if (existingType) {
      return res.status(400).json({
        success: false,
        message: '工作类型代码已存在'
      });
    }

    // 如果没有提供颜色代码，根据部门生成默认颜色
    let defaultColorCode = colorCode;
    if (!defaultColorCode) {
      const departmentColors = {
        farming: '#10b981',     // 绿色
        processing: '#3b82f6',  // 蓝色
        logistics: '#f59e0b',   // 橙色
        quality: '#ef4444',     // 红色
        management: '#8b5cf6'   // 紫色
      };
      defaultColorCode = departmentColors[department] || '#6b7280'; // 默认灰色
    }

    const workType = await prisma.workType.create({
      data: {
        factoryId,
        typeCode,
        typeName,
        department,
        description,
        colorCode: defaultColorCode,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: '工作类型创建成功',
      data: workType
    });

  } catch (error) {
    console.error('创建工作类型失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 更新工作类型
export const updateWorkType = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateWorkTypeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const factoryId = req.user.factoryId;

    // 检查工作类型是否存在
    const existingType = await prisma.workType.findFirst({
      where: {
        id,
        factoryId
      }
    });

    if (!existingType) {
      return res.status(404).json({
        success: false,
        message: '工作类型不存在'
      });
    }

    const workType = await prisma.workType.update({
      where: { id },
      data: validation.data
    });

    res.json({
      success: true,
      message: '工作类型更新成功',
      data: workType
    });

  } catch (error) {
    console.error('更新工作类型失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 删除工作类型
export const deleteWorkType = async (req, res) => {
  try {
    const { id } = req.params;
    const factoryId = req.user.factoryId;

    // 检查工作类型是否存在
    const existingType = await prisma.workType.findFirst({
      where: {
        id,
        factoryId
      }
    });

    if (!existingType) {
      return res.status(404).json({
        success: false,
        message: '工作类型不存在'
      });
    }

    // 检查是否有关联的打卡记录或工作时段
    const [clockCount, sessionCount] = await Promise.all([
      prisma.employeeTimeClock.count({
        where: { workTypeId: id }
      }),
      prisma.employeeWorkSession.count({
        where: { workTypeId: id }
      })
    ]);

    if (clockCount > 0 || sessionCount > 0) {
      // 有关联记录，只能禁用，不能删除
      await prisma.workType.update({
        where: { id },
        data: { isActive: false }
      });

      return res.json({
        success: true,
        message: '工作类型已禁用（因为存在关联记录，无法删除）'
      });
    }

    // 没有关联记录，可以直接删除
    await prisma.workType.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: '工作类型删除成功'
    });

  } catch (error) {
    console.error('删除工作类型失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取工作类型详情
export const getWorkTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const factoryId = req.user.factoryId;

    const workType = await prisma.workType.findFirst({
      where: {
        id,
        factoryId
      },
      include: {
        _count: {
          select: {
            timeClocks: true,
            workSessions: true
          }
        }
      }
    });

    if (!workType) {
      return res.status(404).json({
        success: false,
        message: '工作类型不存在'
      });
    }

    res.json({
      success: true,
      data: workType
    });

  } catch (error) {
    console.error('获取工作类型详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 初始化默认工作类型
export const initializeDefaultWorkTypes = async (req, res) => {
  try {
    const factoryId = req.user.factoryId;

    // 检查是否已经有工作类型
    const existingCount = await prisma.workType.count({
      where: { factoryId }
    });

    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        message: '工厂已有工作类型，无需初始化'
      });
    }

    // 默认工作类型配置
    const defaultWorkTypes = [
      {
        typeCode: 'FARMING_01',
        typeName: '种植作业',
        department: 'farming',
        description: '作物种植、浇水、施肥等农业作业',
        colorCode: '#10b981'
      },
      {
        typeCode: 'FARMING_02',
        typeName: '收获作业',
        department: 'farming',
        description: '作物收获、采摘等作业',
        colorCode: '#059669'
      },
      {
        typeCode: 'PROCESSING_01',
        typeName: '食品加工',
        department: 'processing',
        description: '食品清洗、切割、包装等加工作业',
        colorCode: '#3b82f6'
      },
      {
        typeCode: 'PROCESSING_02',
        typeName: '设备维护',
        department: 'processing',
        description: '加工设备的日常维护和保养',
        colorCode: '#1d4ed8'
      },
      {
        typeCode: 'QUALITY_01',
        typeName: '质量检验',
        department: 'quality',
        description: '产品质量检验和测试',
        colorCode: '#ef4444'
      },
      {
        typeCode: 'LOGISTICS_01',
        typeName: '仓储管理',
        department: 'logistics',
        description: '货物入库、出库、盘点等仓储作业',
        colorCode: '#f59e0b'
      },
      {
        typeCode: 'LOGISTICS_02',
        typeName: '运输配送',
        department: 'logistics',
        description: '货物运输和配送作业',
        colorCode: '#d97706'
      },
      {
        typeCode: 'MANAGEMENT_01',
        typeName: '行政管理',
        department: 'management',
        description: '行政事务处理、文档管理等',
        colorCode: '#8b5cf6'
      }
    ];

    // 批量创建默认工作类型
    const createdTypes = await prisma.workType.createMany({
      data: defaultWorkTypes.map(type => ({
        ...type,
        factoryId,
        isActive: true
      }))
    });

    res.json({
      success: true,
      message: `成功初始化 ${createdTypes.count} 个默认工作类型`,
      data: { count: createdTypes.count }
    });

  } catch (error) {
    console.error('初始化默认工作类型失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};