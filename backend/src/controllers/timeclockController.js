import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// 验证schema
const clockInSchema = z.object({
  workTypeId: z.string().optional(),
  locationData: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional()
  }).optional(),
  deviceInfo: z.object({
    deviceId: z.string(),
    platform: z.string(),
    model: z.string().optional(),
    osVersion: z.string().optional()
  }).optional(),
  notes: z.string().optional()
});

const clockOutSchema = z.object({
  notes: z.string().optional()
});

const breakSchema = z.object({
  notes: z.string().optional()
});

// 上班打卡
export const clockIn = async (req, res) => {
  try {
    const validation = clockInSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const { workTypeId, locationData, deviceInfo, notes } = validation.data;
    const userId = req.user.id;
    const factoryId = req.user.factoryId;
    const ipAddress = req.ip;

    // 检查是否已经打了上班卡（当天未打下班卡）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingClockIn = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'clock_in',
        clockTime: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // 检查是否有对应的下班打卡
    if (existingClockIn) {
      const clockOut = await prisma.employeeTimeClock.findFirst({
        where: {
          userId,
          clockType: 'clock_out',
          clockTime: {
            gte: existingClockIn.clockTime,
            lt: tomorrow
          }
        }
      });

      if (!clockOut) {
        return res.status(400).json({
          success: false,
          message: '您今天已经打过上班卡，请先打下班卡'
        });
      }
    }

    // 验证工作类型（如果提供）
    if (workTypeId) {
      const workType = await prisma.workType.findFirst({
        where: {
          id: workTypeId,
          factoryId,
          isActive: true
        }
      });

      if (!workType) {
        return res.status(400).json({
          success: false,
          message: '无效的工作类型'
        });
      }
    }

    // 判断打卡状态（正常、迟到等）
    const now = new Date();
    const workStartTime = new Date();
    workStartTime.setHours(8, 0, 0, 0); // 假设8点上班

    let status = 'normal';
    if (now > workStartTime) {
      const lateMinutes = Math.floor((now - workStartTime) / (1000 * 60));
      if (lateMinutes > 30) {
        status = 'late';
      }
    }

    // 创建上班打卡记录
    const clockRecord = await prisma.employeeTimeClock.create({
      data: {
        userId,
        factoryId,
        clockType: 'clock_in',
        clockTime: now,
        workTypeId,
        locationData,
        deviceInfo,
        ipAddress,
        status,
        notes
      },
      include: {
        workType: true
      }
    });

    // 创建工作时段记录
    if (workTypeId) {
      await prisma.employeeWorkSession.create({
        data: {
          userId,
          factoryId,
          workTypeId,
          sessionDate: today,
          startTime: now,
          status: 'active'
        }
      });
    }

    res.json({
      success: true,
      message: status === 'late' ? '上班打卡成功（迟到）' : '上班打卡成功',
      data: {
        id: clockRecord.id,
        clockTime: clockRecord.clockTime,
        status: clockRecord.status,
        workType: clockRecord.workType
      }
    });

  } catch (error) {
    console.error('上班打卡失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 下班打卡
export const clockOut = async (req, res) => {
  try {
    const validation = clockOutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const { notes } = validation.data;
    const userId = req.user.id;
    const factoryId = req.user.factoryId;
    const ipAddress = req.ip;

    // 检查是否有当天的上班打卡记录
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const clockIn = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'clock_in',
        clockTime: {
          gte: today,
          lt: tomorrow
        }
      },
      orderBy: {
        clockTime: 'desc'
      }
    });

    if (!clockIn) {
      return res.status(400).json({
        success: false,
        message: '请先打上班卡'
      });
    }

    // 检查是否已经打过下班卡
    const existingClockOut = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'clock_out',
        clockTime: {
          gte: clockIn.clockTime,
          lt: tomorrow
        }
      }
    });

    if (existingClockOut) {
      return res.status(400).json({
        success: false,
        message: '您今天已经打过下班卡'
      });
    }

    const now = new Date();
    const workEndTime = new Date();
    workEndTime.setHours(18, 0, 0, 0); // 假设6点下班

    // 判断是否早退
    let status = 'normal';
    if (now < workEndTime) {
      const earlyMinutes = Math.floor((workEndTime - now) / (1000 * 60));
      if (earlyMinutes > 30) {
        status = 'early';
      }
    }

    // 创建下班打卡记录
    const clockRecord = await prisma.employeeTimeClock.create({
      data: {
        userId,
        factoryId,
        clockType: 'clock_out',
        clockTime: now,
        ipAddress,
        status,
        notes
      }
    });

    // 更新工作时段记录
    const activeSession = await prisma.employeeWorkSession.findFirst({
      where: {
        userId,
        sessionDate: today,
        status: 'active'
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    if (activeSession) {
      const totalMinutes = Math.floor((now - activeSession.startTime) / (1000 * 60));
      const workMinutes = Math.max(0, totalMinutes - activeSession.breakDuration);

      await prisma.employeeWorkSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: now,
          totalMinutes: workMinutes,
          status: 'completed'
        }
      });
    }

    res.json({
      success: true,
      message: status === 'early' ? '下班打卡成功（早退）' : '下班打卡成功',
      data: {
        id: clockRecord.id,
        clockTime: clockRecord.clockTime,
        status: clockRecord.status,
        workMinutes: activeSession ? Math.floor((now - activeSession.startTime) / (1000 * 60)) - (activeSession.breakDuration || 0) : 0
      }
    });

  } catch (error) {
    console.error('下班打卡失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 开始休息
export const breakStart = async (req, res) => {
  try {
    const validation = breakSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const { notes } = validation.data;
    const userId = req.user.id;
    const factoryId = req.user.factoryId;
    const ipAddress = req.ip;

    // 检查是否已经上班打卡且未下班
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSession = await prisma.employeeWorkSession.findFirst({
      where: {
        userId,
        sessionDate: today,
        status: 'active'
      }
    });

    if (!activeSession) {
      return res.status(400).json({
        success: false,
        message: '请先上班打卡'
      });
    }

    // 检查是否已经在休息中
    const lastBreakStart = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'break_start',
        clockTime: {
          gte: today
        }
      },
      orderBy: {
        clockTime: 'desc'
      }
    });

    if (lastBreakStart) {
      const correspondingBreakEnd = await prisma.employeeTimeClock.findFirst({
        where: {
          userId,
          clockType: 'break_end',
          clockTime: {
            gte: lastBreakStart.clockTime
          }
        }
      });

      if (!correspondingBreakEnd) {
        return res.status(400).json({
          success: false,
          message: '您已经在休息中'
        });
      }
    }

    const now = new Date();

    // 创建开始休息记录
    const clockRecord = await prisma.employeeTimeClock.create({
      data: {
        userId,
        factoryId,
        clockType: 'break_start',
        clockTime: now,
        ipAddress,
        status: 'normal',
        notes
      }
    });

    res.json({
      success: true,
      message: '开始休息',
      data: {
        id: clockRecord.id,
        clockTime: clockRecord.clockTime
      }
    });

  } catch (error) {
    console.error('开始休息失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 结束休息
export const breakEnd = async (req, res) => {
  try {
    const validation = breakSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const { notes } = validation.data;
    const userId = req.user.id;
    const factoryId = req.user.factoryId;
    const ipAddress = req.ip;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 查找最近的开始休息记录
    const lastBreakStart = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'break_start',
        clockTime: {
          gte: today
        }
      },
      orderBy: {
        clockTime: 'desc'
      }
    });

    if (!lastBreakStart) {
      return res.status(400).json({
        success: false,
        message: '没有找到对应的开始休息记录'
      });
    }

    // 检查是否已经结束休息
    const correspondingBreakEnd = await prisma.employeeTimeClock.findFirst({
      where: {
        userId,
        clockType: 'break_end',
        clockTime: {
          gte: lastBreakStart.clockTime
        }
      }
    });

    if (correspondingBreakEnd) {
      return res.status(400).json({
        success: false,
        message: '您已经结束休息了'
      });
    }

    const now = new Date();
    const breakMinutes = Math.floor((now - lastBreakStart.clockTime) / (1000 * 60));

    // 创建结束休息记录
    const clockRecord = await prisma.employeeTimeClock.create({
      data: {
        userId,
        factoryId,
        clockType: 'break_end',
        clockTime: now,
        ipAddress,
        status: 'normal',
        notes
      }
    });

    // 更新工作时段的休息时长
    const activeSession = await prisma.employeeWorkSession.findFirst({
      where: {
        userId,
        sessionDate: today,
        status: 'active'
      }
    });

    if (activeSession) {
      await prisma.employeeWorkSession.update({
        where: { id: activeSession.id },
        data: {
          breakDuration: (activeSession.breakDuration || 0) + breakMinutes
        }
      });
    }

    res.json({
      success: true,
      message: '结束休息',
      data: {
        id: clockRecord.id,
        clockTime: clockRecord.clockTime,
        breakMinutes
      }
    });

  } catch (error) {
    console.error('结束休息失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取当前打卡状态
export const getClockStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 获取今天的打卡记录
    const todayClocks = await prisma.employeeTimeClock.findMany({
      where: {
        userId,
        clockTime: {
          gte: today,
          lt: tomorrow
        }
      },
      orderBy: {
        clockTime: 'asc'
      },
      include: {
        workType: true
      }
    });

    // 获取当前工作时段
    const activeSession = await prisma.employeeWorkSession.findFirst({
      where: {
        userId,
        sessionDate: today,
        status: 'active'
      },
      include: {
        workType: true
      }
    });

    // 分析当前状态
    let currentStatus = 'not_started'; // not_started, working, on_break, finished
    let canClockIn = true;
    let canClockOut = false;
    let canBreakStart = false;
    let canBreakEnd = false;

    const clockIn = todayClocks.find(c => c.clockType === 'clock_in');
    const clockOut = todayClocks.find(c => c.clockType === 'clock_out');
    const lastBreakStart = todayClocks.filter(c => c.clockType === 'break_start').pop();
    const lastBreakEnd = todayClocks.filter(c => c.clockType === 'break_end').pop();

    if (clockOut) {
      currentStatus = 'finished';
      canClockIn = true; // 可以重新上班
      canClockOut = false;
      canBreakStart = false;
      canBreakEnd = false;
    } else if (clockIn) {
      canClockIn = false;
      canClockOut = true;

      // 检查是否在休息中
      if (lastBreakStart && (!lastBreakEnd || lastBreakEnd.clockTime < lastBreakStart.clockTime)) {
        currentStatus = 'on_break';
        canBreakStart = false;
        canBreakEnd = true;
      } else {
        currentStatus = 'working';
        canBreakStart = true;
        canBreakEnd = false;
      }
    }

    // 计算今日工作时长
    let todayWorkMinutes = 0;
    if (activeSession) {
      const now = new Date();
      const endTime = activeSession.endTime || now;
      todayWorkMinutes = Math.max(0, Math.floor((endTime - activeSession.startTime) / (1000 * 60)) - (activeSession.breakDuration || 0));
    }

    res.json({
      success: true,
      data: {
        currentStatus,
        permissions: {
          canClockIn,
          canClockOut,
          canBreakStart,
          canBreakEnd
        },
        todayClocks,
        activeSession,
        todayWorkMinutes,
        summary: {
          clockInTime: clockIn?.clockTime || null,
          clockOutTime: clockOut?.clockTime || null,
          totalBreakMinutes: activeSession?.breakDuration || 0,
          workType: activeSession?.workType || null
        }
      }
    });

  } catch (error) {
    console.error('获取打卡状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取打卡历史记录
export const getClockHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 构建查询条件
    const where = {
      userId
    };

    if (startDate || endDate) {
      where.clockTime = {};
      if (startDate) {
        where.clockTime.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.clockTime.lte = end;
      }
    }

    const [records, total] = await Promise.all([
      prisma.employeeTimeClock.findMany({
        where,
        orderBy: {
          clockTime: 'desc'
        },
        skip: offset,
        take: parseInt(limit),
        include: {
          workType: true
        }
      }),
      prisma.employeeTimeClock.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('获取打卡历史失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};