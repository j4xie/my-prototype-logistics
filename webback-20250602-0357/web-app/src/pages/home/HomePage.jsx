import React, { useState, useEffect } from 'react';
import { 
  FluidContainer, 
  Card, 
  StatCard, 
  Badge, 
  StatusBadge,
  PageLayout,
  MobileNav 
} from '@/components/ui';

/**
 * 主页组件 - 功能模块选择
 * 优化移动端体验，使用现代化UI组件
 */
const HomePage = () => {
  const [userInfo, setUserInfo] = useState({
    name: '张三',
    role: '系统管理员',
    permission: '高级权限'
  });

  const [systemStats, setSystemStats] = useState({
    todayRecords: 32,
    pendingTasks: 8,
    activeUsers: 18,
    systemStatus: 'normal'
  });

  const [modules, setModules] = useState([
    {
      id: 'farming',
      title: '养殖管理',
      description: '动物饲养、疫苗、繁育信息管理',
      icon: 'fas fa-piggy-bank',
      color: 'primary',
      href: '/farming',
      enabled: true
    },
    {
      id: 'processing',
      title: '生产加工',
      description: '屠宰、检验、包装等加工环节管理',
      icon: 'fas fa-industry',
      color: 'success',
      href: '/processing',
      enabled: true
    },
    {
      id: 'logistics',
      title: '销售物流',
      description: '运输、配送、订单跟踪管理',
      icon: 'fas fa-truck',
      color: 'warning',
      href: '/logistics',
      enabled: true
    },
    {
      id: 'trace',
      title: '追溯查询',
      description: '产品全链路溯源和质量追踪',
      icon: 'fas fa-search',
      color: 'purple',
      href: '/trace',
      enabled: true
    }
  ]);

  useEffect(() => {
    // 加载用户数据和系统状态
    loadUserData();
    loadSystemStats();
  }, []);

  const loadUserData = async () => {
    // 模拟API调用
    try {
      // const userData = await api.getUserInfo();
      // setUserInfo(userData);
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  const loadSystemStats = async () => {
    // 模拟API调用
    try {
      // const stats = await api.getSystemStats();
      // setSystemStats(stats);
    } catch (error) {
      console.error('加载系统状态失败:', error);
    }
  };

  const handleModuleClick = (module) => {
    if (!module.enabled) {
      alert('该模块暂未开放，请联系管理员');
      return;
    }
    
    // 添加点击反馈
    const element = document.getElementById(`module-${module.id}`);
    if (element) {
      element.style.transform = 'scale(0.95)';
      setTimeout(() => {
        element.style.transform = '';
        // 导航到模块页面
        window.location.href = module.href;
      }, 150);
    }
  };

  const getColorClasses = (color) => {
    const colorMap = {
      primary: {
        bg: 'bg-[#E6F7FF]',
        text: 'text-[#1890FF]',
        border: 'border-[#1890FF]'
      },
      success: {
        bg: 'bg-[#F6FFED]',
        text: 'text-[#52C41A]',
        border: 'border-[#52C41A]'
      },
      warning: {
        bg: 'bg-[#FFF7E6]',
        text: 'text-[#FA8C16]',
        border: 'border-[#FA8C16]'
      },
      purple: {
        bg: 'bg-[#F9F0FF]',
        text: 'text-[#722ED1]',
        border: 'border-[#722ED1]'
      }
    };
    return colorMap[color] || colorMap.primary;
  };

  return (
    <PageLayout
      title="食品溯源系统"
      showBackButton={false}
      rightActions={[
        {
          icon: 'fas fa-bell',
          onClick: () => window.location.href = '/notifications',
          'aria-label': '通知'
        },
        {
          icon: 'fas fa-cog',
          onClick: () => window.location.href = '/settings',
          'aria-label': '设置'
        }
      ]}
    >
      <FluidContainer maxWidth="sm" className="space-y-4">
        {/* 用户信息卡片 */}
        <Card className="p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-[#1890FF] rounded-full flex items-center justify-center text-white text-xl">
              <i className="fas fa-user"></i>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                你好，{userInfo.name}
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{userInfo.role}</span>
                <Badge variant="primary" size="small" shape="pill">
                  {userInfo.permission}
                </Badge>
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/profile'}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              个人中心
            </button>
          </div>
        </Card>

        {/* 系统状态摘要 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <i className="fas fa-chart-line text-[#1890FF] mr-2"></i>
              系统状态
            </h2>
            <StatusBadge status={systemStats.systemStatus === 'normal' ? 'active' : 'failed'} />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              title="今日记录"
              value={systemStats.todayRecords}
              icon="fas fa-file-alt"
              color="primary"
              size="small"
            />
            <StatCard
              title="待处理任务"
              value={systemStats.pendingTasks}
              icon="fas fa-tasks"
              color="warning"
              size="small"
            />
            <StatCard
              title="在线用户"
              value={systemStats.activeUsers}
              icon="fas fa-users"
              color="success"
              size="small"
            />
          </div>
        </Card>

        {/* 功能模块选择 */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <i className="fas fa-th-large text-[#1890FF] mr-2"></i>
            功能模块
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            {modules.map((module) => {
              const colors = getColorClasses(module.color);
              return (
                <Card
                  key={module.id}
                  id={`module-${module.id}`}
                  className={`
                    p-4 text-center cursor-pointer transition-all duration-300
                    hover:shadow-md hover:scale-[1.03] active:scale-[0.98]
                    ${!module.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => handleModuleClick(module)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${module.title}模块`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleModuleClick(module);
                    }
                  }}
                >
                  <div className={`
                    w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mx-auto mb-3
                  `}>
                    <i className={`${module.icon} ${colors.text} text-xl`}></i>
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">
                    {module.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {module.description}
                  </p>
                  {!module.enabled && (
                    <div className="mt-2">
                      <i className="fas fa-lock text-gray-400 text-sm"></i>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* 快速操作区域 */}
        <Card className="p-4">
          <h3 className="text-md font-medium text-gray-900 mb-3">快速操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.location.href = '/trace/quick-search'}
              className="flex items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-qrcode text-[#1890FF] mr-2"></i>
              <span className="text-sm font-medium">扫码查询</span>
            </button>
            <button
              onClick={() => window.location.href = '/reports/daily'}
              className="flex items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-chart-bar text-[#52C41A] mr-2"></i>
              <span className="text-sm font-medium">数据报表</span>
            </button>
          </div>
        </Card>
      </FluidContainer>

      {/* 底部导航 */}
      <MobileNav
        items={[
          { icon: 'fas fa-home', label: '首页', href: '/', active: true },
          { icon: 'fas fa-search', label: '查询', href: '/trace' },
          { icon: 'fas fa-plus', label: '录入', href: '/record' },
          { icon: 'fas fa-chart-line', label: '报表', href: '/reports' },
          { icon: 'fas fa-user', label: '我的', href: '/profile' }
        ]}
      />
    </PageLayout>
  );
};

export default HomePage; 