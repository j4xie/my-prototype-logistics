import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// 验证schema
const statsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  workTypeId: z.string().optional(),
  department: z.enum(['farming', 'processing', 'logistics', 'quality', 'management']).optional()
});

// 获取日统计
export const getDailyStats = async (req, res) => {
  try {
    const validation = statsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const userId = req.user.id;
    const { startDate, endDate, workTypeId } = validation.data;

    // 默认查询最近7天
    const endDateTime = endDate ? new Date(endDate) : new Date();
    const startDateTime = startDate ? new Date(startDate) : new Date(endDateTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 设置时间范围
    startDateTime.setHours(0, 0, 0, 0);
    endDateTime.setHours(23, 59, 59, 999);

    // 构建查询条件
    const where = {
      userId,
      sessionDate: {
        gte: startDateTime,
        lte: endDateTime
      }
    };

    if (workTypeId) {
      where.workTypeId = workTypeId;
    }

    // 获取工作时段记录
    const sessions = await prisma.employeeWorkSession.findMany({
      where,
      include: {
        workType: true
      },
      orderBy: {
        sessionDate: 'desc'
      }
    });

    // 按日期分组统计
    const dailyStats = {};
    
    sessions.forEach(session => {
      const dateKey = session.sessionDate.toISOString().split('T')[0];
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          totalMinutes: 0,
          totalBreakMinutes: 0,
          workMinutes: 0,
          sessions: [],
          workTypes: {}
        };
      }

      const workMinutes = session.totalMinutes || 0;
      const breakMinutes = session.breakDuration || 0;

      dailyStats[dateKey].totalMinutes += workMinutes + breakMinutes;
      dailyStats[dateKey].totalBreakMinutes += breakMinutes;
      dailyStats[dateKey].workMinutes += workMinutes;
      dailyStats[dateKey].sessions.push(session);

      // 按工作类型统计
      const workTypeName = session.workType?.typeName || '未分类';
      if (!dailyStats[dateKey].workTypes[workTypeName]) {
        dailyStats[dateKey].workTypes[workTypeName] = {
          minutes: 0,
          count: 0,
          color: session.workType?.colorCode || '#6b7280'
        };
      }
      dailyStats[dateKey].workTypes[workTypeName].minutes += workMinutes;
      dailyStats[dateKey].workTypes[workTypeName].count += 1;
    });

    // 转换为数组并排序
    const dailyStatsArray = Object.values(dailyStats).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    // 计算总体统计
    const totalStats = {
      totalDays: dailyStatsArray.length,
      totalWorkMinutes: dailyStatsArray.reduce((sum, day) => sum + day.workMinutes, 0),
      totalBreakMinutes: dailyStatsArray.reduce((sum, day) => sum + day.totalBreakMinutes, 0),
      averageWorkMinutesPerDay: dailyStatsArray.length > 0 ? 
        Math.round(dailyStatsArray.reduce((sum, day) => sum + day.workMinutes, 0) / dailyStatsArray.length) : 0
    };

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDateTime.toISOString().split('T')[0],
          endDate: endDateTime.toISOString().split('T')[0]
        },
        totalStats,
        dailyStats: dailyStatsArray
      }
    });

  } catch (error) {
    console.error('获取日统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取周统计
export const getWeeklyStats = async (req, res) => {
  try {
    const validation = statsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const userId = req.user.id;
    const { workTypeId } = validation.data;

    // 获取最近4周的数据
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
    
    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);

    const where = {
      userId,
      sessionDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (workTypeId) {
      where.workTypeId = workTypeId;
    }

    const sessions = await prisma.employeeWorkSession.findMany({
      where,
      include: {
        workType: true
      }
    });

    // 按周分组
    const weeklyStats = {};

    sessions.forEach(session => {
      const sessionDate = new Date(session.sessionDate);
      const weekStart = getWeekStart(sessionDate);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = {
          weekStart: weekKey,
          weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          totalMinutes: 0,
          workDays: 0,
          sessions: [],
          workTypes: {}
        };
      }

      const workMinutes = session.totalMinutes || 0;
      weeklyStats[weekKey].totalMinutes += workMinutes;
      weeklyStats[weekKey].sessions.push(session);

      // 统计工作类型
      const workTypeName = session.workType?.typeName || '未分类';
      if (!weeklyStats[weekKey].workTypes[workTypeName]) {
        weeklyStats[weekKey].workTypes[workTypeName] = {
          minutes: 0,
          color: session.workType?.colorCode || '#6b7280'
        };
      }
      weeklyStats[weekKey].workTypes[workTypeName].minutes += workMinutes;
    });

    // 计算每周工作天数
    Object.keys(weeklyStats).forEach(weekKey => {
      const uniqueDates = new Set(
        weeklyStats[weekKey].sessions.map(s => s.sessionDate.toISOString().split('T')[0])
      );
      weeklyStats[weekKey].workDays = uniqueDates.size;
    });

    const weeklyStatsArray = Object.values(weeklyStats).sort((a, b) => 
      new Date(b.weekStart) - new Date(a.weekStart)
    );

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        weeklyStats: weeklyStatsArray
      }
    });

  } catch (error) {
    console.error('获取周统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取月统计
export const getMonthlyStats = async (req, res) => {
  try {
    const validation = statsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const userId = req.user.id;
    const { workTypeId } = validation.data;

    // 获取最近6个月的数据
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);

    const where = {
      userId,
      sessionDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (workTypeId) {
      where.workTypeId = workTypeId;
    }

    const sessions = await prisma.employeeWorkSession.findMany({
      where,
      include: {
        workType: true
      }
    });

    // 按月分组
    const monthlyStats = {};

    sessions.forEach(session => {
      const sessionDate = new Date(session.sessionDate);
      const monthKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month: monthKey,
          totalMinutes: 0,
          workDays: 0,
          sessions: [],
          workTypes: {}
        };
      }

      const workMinutes = session.totalMinutes || 0;
      monthlyStats[monthKey].totalMinutes += workMinutes;
      monthlyStats[monthKey].sessions.push(session);

      // 统计工作类型
      const workTypeName = session.workType?.typeName || '未分类';
      if (!monthlyStats[monthKey].workTypes[workTypeName]) {
        monthlyStats[monthKey].workTypes[workTypeName] = {
          minutes: 0,
          color: session.workType?.colorCode || '#6b7280'
        };
      }
      monthlyStats[monthKey].workTypes[workTypeName].minutes += workMinutes;
    });

    // 计算每月工作天数
    Object.keys(monthlyStats).forEach(monthKey => {
      const uniqueDates = new Set(
        monthlyStats[monthKey].sessions.map(s => s.sessionDate.toISOString().split('T')[0])
      );
      monthlyStats[monthKey].workDays = uniqueDates.size;
    });

    const monthlyStatsArray = Object.values(monthlyStats).sort((a, b) => 
      new Date(b.month + '-01') - new Date(a.month + '-01')
    );

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        monthlyStats: monthlyStatsArray
      }
    });

  } catch (error) {
    console.error('获取月统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 按工作类型统计
export const getStatsByWorkType = async (req, res) => {
  try {
    const validation = statsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: validation.error.issues
      });
    }

    const userId = req.user.id;
    const { startDate, endDate, department } = validation.data;

    // 默认查询最近30天
    const endDateTime = endDate ? new Date(endDate) : new Date();
    const startDateTime = startDate ? new Date(startDate) : new Date(endDateTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    startDateTime.setHours(0, 0, 0, 0);
    endDateTime.setHours(23, 59, 59, 999);

    const where = {
      userId,
      sessionDate: {
        gte: startDateTime,
        lte: endDateTime
      }
    };

    const sessions = await prisma.employeeWorkSession.findMany({
      where,
      include: {
        workType: true
      }
    });

    // 按工作类型分组统计
    const workTypeStats = {};

    sessions.forEach(session => {
      if (!session.workType) return;

      // 如果指定了部门，过滤不匹配的记录
      if (department && session.workType.department !== department) {
        return;
      }

      const workTypeId = session.workType.id;
      const workTypeName = session.workType.typeName;

      if (!workTypeStats[workTypeId]) {
        workTypeStats[workTypeId] = {
          workType: session.workType,
          totalMinutes: 0,
          totalSessions: 0,
          averageMinutesPerSession: 0,
          totalDays: 0,
          dates: new Set()
        };
      }

      const workMinutes = session.totalMinutes || 0;
      workTypeStats[workTypeId].totalMinutes += workMinutes;
      workTypeStats[workTypeId].totalSessions += 1;
      workTypeStats[workTypeId].dates.add(session.sessionDate.toISOString().split('T')[0]);
    });

    // 计算平均值和总天数
    Object.values(workTypeStats).forEach(stat => {
      stat.totalDays = stat.dates.size;
      stat.averageMinutesPerSession = stat.totalSessions > 0 ? 
        Math.round(stat.totalMinutes / stat.totalSessions) : 0;
      delete stat.dates; // 删除临时字段
    });

    // 转换为数组并按工作时长排序
    const workTypeStatsArray = Object.values(workTypeStats).sort((a, b) => 
      b.totalMinutes - a.totalMinutes
    );

    // 计算总计
    const totalMinutes = workTypeStatsArray.reduce((sum, stat) => sum + stat.totalMinutes, 0);

    // 添加百分比
    workTypeStatsArray.forEach(stat => {
      stat.percentage = totalMinutes > 0 ? Math.round((stat.totalMinutes / totalMinutes) * 100) : 0;
    });

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDateTime.toISOString().split('T')[0],
          endDate: endDateTime.toISOString().split('T')[0]
        },
        totalMinutes,
        workTypeStats: workTypeStatsArray
      }
    });

  } catch (error) {
    console.error('按工作类型统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 获取工作效率分析
export const getProductivityAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    const factoryId = req.user.factoryId;

    // 获取最近30天的数据
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);

    // 获取用户的工作记录
    const sessions = await prisma.employeeWorkSession.findMany({
      where: {
        userId,
        sessionDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'completed'
      },
      include: {
        workType: true
      }
    });

    // 获取同部门其他员工的平均数据用于对比
    const userDepartment = req.user.department;
    let departmentAverage = null;

    if (userDepartment) {
      const departmentUsers = await prisma.user.findMany({
        where: {
          factoryId,
          department: userDepartment,
          isActive: true,
          id: { not: userId }
        },
        select: { id: true }
      });

      if (departmentUsers.length > 0) {
        const departmentSessions = await prisma.employeeWorkSession.findMany({
          where: {
            userId: { in: departmentUsers.map(u => u.id) },
            sessionDate: {
              gte: startDate,
              lte: endDate
            },
            status: 'completed'
          }
        });

        if (departmentSessions.length > 0) {
          const avgMinutes = Math.round(
            departmentSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / departmentSessions.length
          );
          
          const uniqueDays = new Set(
            departmentSessions.map(s => s.sessionDate.toISOString().split('T')[0])
          ).size;

          departmentAverage = {
            averageSessionMinutes: avgMinutes,
            averageDailyMinutes: uniqueDays > 0 ? Math.round(
              departmentSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / uniqueDays
            ) : 0
          };
        }
      }
    }

    // 分析用户数据
    const userTotalMinutes = sessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
    const userWorkDays = new Set(sessions.map(s => s.sessionDate.toISOString().split('T')[0])).size;
    const userAverageSessionMinutes = sessions.length > 0 ? Math.round(userTotalMinutes / sessions.length) : 0;
    const userAverageDailyMinutes = userWorkDays > 0 ? Math.round(userTotalMinutes / userWorkDays) : 0;

    // 计算趋势（最近7天 vs 前7天）
    const recent7Days = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previous7Days = new Date(recent7Days.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentSessions = sessions.filter(s => s.sessionDate >= recent7Days);
    const previousSessions = sessions.filter(s => s.sessionDate >= previous7Days && s.sessionDate < recent7Days);

    const recentAvg = recentSessions.length > 0 ? 
      Math.round(recentSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / recentSessions.length) : 0;
    const previousAvg = previousSessions.length > 0 ? 
      Math.round(previousSessions.reduce((sum, s) => sum + (s.totalMinutes || 0), 0) / previousSessions.length) : 0;

    const trend = previousAvg > 0 ? Math.round(((recentAvg - previousAvg) / previousAvg) * 100) : 0;

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        userStats: {
          totalMinutes: userTotalMinutes,
          workDays: userWorkDays,
          totalSessions: sessions.length,
          averageSessionMinutes: userAverageSessionMinutes,
          averageDailyMinutes: userAverageDailyMinutes
        },
        departmentAverage,
        trend: {
          recentWeekAverage: recentAvg,
          previousWeekAverage: previousAvg,
          changePercentage: trend
        },
        performance: {
          rating: calculatePerformanceRating(userAverageDailyMinutes, departmentAverage?.averageDailyMinutes),
          suggestions: generateSuggestions(userAverageDailyMinutes, trend)
        }
      }
    });

  } catch (error) {
    console.error('获取工作效率分析失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 辅助函数：获取周开始日期（周一）
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一开始
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 辅助函数：计算绩效评级
function calculatePerformanceRating(userDaily, departmentDaily) {
  if (!departmentDaily) {
    return userDaily >= 480 ? '优秀' : userDaily >= 420 ? '良好' : userDaily >= 360 ? '一般' : '需改善';
  }

  const ratio = userDaily / departmentDaily;
  if (ratio >= 1.2) return '优秀';
  if (ratio >= 1.0) return '良好';
  if (ratio >= 0.8) return '一般';
  return '需改善';
}

// 辅助函数：生成改善建议
function generateSuggestions(userDaily, trend) {
  const suggestions = [];

  if (userDaily < 360) {
    suggestions.push('建议增加日常工作时长，提高工作效率');
  }

  if (trend < -10) {
    suggestions.push('最近工作时长呈下降趋势，建议调整工作状态');
  } else if (trend > 10) {
    suggestions.push('工作表现有所提升，继续保持');
  }

  if (suggestions.length === 0) {
    suggestions.push('工作表现稳定，建议继续保持现有状态');
  }

  return suggestions;
}