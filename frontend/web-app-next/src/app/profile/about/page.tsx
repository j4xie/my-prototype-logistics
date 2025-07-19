'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  User,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Building,
  Award,
  Target,
  TrendingUp,
  Edit3,
  Share2,
  Download,
  ArrowLeft,
  CheckCircle,
  Users,
  Activity,
  Shield,
  Trophy,
  Zap,
  Heart,
  Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  name: string;
  title: string;
  company: string;
  department: string;
  email: string;
  phone: string;
  location: string;
  joinDate: string;
  lastActive: string;
  avatar: string;
  status: 'active' | 'away' | 'busy' | 'offline';
  bio: string;

  // 扩展信息
  experience: string;
  specialties: string[];
  certifications: string[];
  languages: string[];
}

interface UserStats {
  projectsCompleted: number;
  tasksCompleted: number;
  teamCollaborations: number;
  achievementPoints: number;
  experienceLevel: number;
  totalHours: number;
  rating: number;
  reviewCount: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: any;
  unlocked: boolean;
  unlockedDate?: string;
  category: 'productivity' | 'collaboration' | 'quality' | 'innovation';
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
}

// 模拟用户数据
const mockUserProfile: UserProfile = {
  id: 'user_001',
  name: '张三',
  title: '农业技术工程师',
  company: '黑牛农业科技有限公司',
  department: '技术研发部',
  email: 'zhangsan@heiniu-agri.com',
  phone: '+86 138-0013-8001',
  location: '北京市海淀区',
  joinDate: '2022-03-15',
  lastActive: '2025-02-02 14:30',
  avatar: '/api/placeholder/avatar/zhangsan',
  status: 'active',
  bio: '专注于智慧农业技术研发，在精准农业、物联网应用和数据分析方面有丰富经验。致力于通过技术创新推动现代农业发展。',
  experience: '5年+',
  specialties: ['精准农业', '物联网技术', '数据分析', '作物建模', '智能灌溉'],
  certifications: ['农业工程师认证', 'IoT专业认证', '数据分析师证书'],
  languages: ['中文(母语)', '英语(专业)', '日语(基础)']
};

const mockUserStats: UserStats = {
  projectsCompleted: 23,
  tasksCompleted: 156,
  teamCollaborations: 12,
  achievementPoints: 2847,
  experienceLevel: 8,
  totalHours: 1240,
  rating: 4.8,
  reviewCount: 34
};

const mockAchievements: Achievement[] = [
  {
    id: '1',
    title: '项目专家',
    description: '成功完成20个以上项目',
    icon: Trophy,
    unlocked: true,
    unlockedDate: '2024-12-15',
    category: 'productivity',
    level: 'gold'
  },
  {
    id: '2',
    title: '团队合作者',
    description: '参与10个以上团队协作项目',
    icon: Users,
    unlocked: true,
    unlockedDate: '2024-11-20',
    category: 'collaboration',
    level: 'silver'
  },
  {
    id: '3',
    title: '质量守护者',
    description: '保持95%以上的任务完成质量',
    icon: Shield,
    unlocked: true,
    unlockedDate: '2024-10-08',
    category: 'quality',
    level: 'platinum'
  },
  {
    id: '4',
    title: '创新先锋',
    description: '提出5个以上创新解决方案',
    icon: Zap,
    unlocked: true,
    unlockedDate: '2024-09-12',
    category: 'innovation',
    level: 'gold'
  },
  {
    id: '5',
    title: '高效达人',
    description: '连续30天保持高效工作',
    icon: Activity,
    unlocked: false,
    category: 'productivity',
    level: 'silver'
  },
  {
    id: '6',
    title: '知识分享者',
    description: '分享100个以上技术文档',
    icon: Heart,
    unlocked: false,
    category: 'collaboration',
    level: 'bronze'
  }
];

// 模拟Toast通知
const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning' = 'success') => {
  console.log(`Toast [${type}]: ${title} - ${description}`);
  if (type === 'error') {
    alert(`错误: ${title}\n${description}`);
  } else {
    // 显示简单的成功提示
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `✅ ${title}: ${description}`;
    successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; z-index: 9999; font-size: 14px;';
    document.body.appendChild(successMsg);
    setTimeout(() => document.body.removeChild(successMsg), 3000);
  }
};

export default function ProfileAboutPage() {
  const router = useRouter();
  const [profile] = useState<UserProfile>(mockUserProfile);
  const [stats] = useState<UserStats>(mockUserStats);
  const [achievements] = useState<Achievement[]>(mockAchievements);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟数据加载
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '在线';
      case 'away': return '离开';
      case 'busy': return '忙碌';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  const getAchievementColor = (level: string) => {
    switch (level) {
      case 'bronze': return 'text-amber-600 bg-amber-50';
      case 'silver': return 'text-gray-600 bg-gray-50';
      case 'gold': return 'text-yellow-600 bg-yellow-50';
      case 'platinum': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleShareProfile = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile.name} - 个人资料`,
          text: `查看 ${profile.name} 在黑牛农业的个人资料`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('分享成功', '个人资料链接已复制到剪贴板');
      }
    } catch (error) {
      console.error('分享失败:', error);
      showToast('分享失败', '请稍后重试', 'error');
    }
  };

  const handleExportProfile = async () => {
    try {
      setLoading(true);

      // 模拟导出过程
      await new Promise(resolve => setTimeout(resolve, 2000));

      const profileData = {
        profile,
        stats,
        achievements: achievements.filter(a => a.unlocked),
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(profileData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.name}-个人资料-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('导出成功', '个人资料已下载到本地');
    } catch (error) {
      console.error('导出失败:', error);
      showToast('导出失败', '请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const completionRate = Math.round((stats.tasksCompleted / (stats.tasksCompleted + 20)) * 100);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#1890FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600">加载个人资料中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1 hover:bg-white/20 rounded"
              aria-label="返回"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-medium">关于我</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareProfile}
              className="p-2 hover:bg-white/20 rounded"
              aria-label="分享资料"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleExportProfile}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded disabled:opacity-50"
              aria-label="导出资料"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[80px]">
        {/* 个人信息卡片 */}
        <Card className="mx-4 mb-4 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* 头像 */}
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {profile.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${getStatusColor(profile.status)} rounded-full border-2 border-white`}></div>
              </div>

              {/* 基本信息 */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(profile.status).replace('bg-', 'bg-').replace('-500', '-100')} ${getStatusColor(profile.status).replace('bg-', 'text-').replace('-500', '-600')}`}>
                    {getStatusText(profile.status)}
                  </span>
                </div>
                <p className="text-gray-600 mb-2">{profile.title}</p>
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                  <Building className="w-4 h-4" />
                  <span>{profile.company}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>入职 {profile.joinDate}</span>
                </div>
              </div>

              {/* 编辑按钮 */}
              <Button
                variant="secondary"
                size="small"
                onClick={() => router.push('/profile/edit')}
                className="flex items-center gap-1"
              >
                <Edit3 className="w-4 h-4" />
                编辑
              </Button>
            </div>

            {/* 个人简介 */}
            {profile.bio && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-700 text-sm leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 统计数据 */}
        <Card className="mx-4 mb-4 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1890FF]" />
              工作统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.projectsCompleted}</div>
                <div className="text-sm text-gray-600">完成项目</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.tasksCompleted}</div>
                <div className="text-sm text-gray-600">完成任务</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.teamCollaborations}</div>
                <div className="text-sm text-gray-600">团队协作</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.totalHours}</div>
                <div className="text-sm text-gray-600">工作小时</div>
              </div>
            </div>

            {/* 完成率进度条 */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">任务完成率</span>
                <span className="text-sm font-bold text-gray-900">{completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 成就徽章 */}
        <Card className="mx-4 mb-4 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#1890FF]" />
              成就徽章
              <span className="ml-auto text-sm font-normal text-gray-500">
                {unlockedAchievements.length}/{achievements.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((achievement) => {
                const IconComponent = achievement.icon;
                return (
                  <div
                    key={achievement.id}
                    className={`p-3 rounded-lg border transition-all duration-300 ${
                      achievement.unlocked
                        ? 'bg-white border-gray-200 hover:shadow-md'
                        : 'bg-gray-50 border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded ${getAchievementColor(achievement.level)}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      {achievement.unlocked && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <h4 className={`font-medium text-sm ${achievement.unlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                      {achievement.title}
                    </h4>
                    <p className={`text-xs mt-1 ${achievement.unlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                      {achievement.description}
                    </p>
                    {achievement.unlockedDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        解锁于 {achievement.unlockedDate}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 专业信息 */}
        <Card className="mx-4 mb-4 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#1890FF]" />
              专业信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 专业技能 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">专业技能</h4>
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* 认证证书 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">认证证书</h4>
              <div className="space-y-2">
                {profile.certifications.map((cert, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-gray-700">{cert}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 语言能力 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">语言能力</h4>
              <div className="space-y-2">
                {profile.languages.map((lang, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-700">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 联系信息 */}
        <Card className="mx-4 mb-4 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#1890FF]" />
              联系信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{profile.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{profile.phone}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">{profile.location}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-gray-700">最后活跃: {profile.lastActive}</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-[390px] mx-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push('/profile/edit')}
              className="flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              编辑资料
            </Button>
            <Button
              onClick={handleShareProfile}
              className="flex items-center justify-center gap-2 bg-[#1890FF] hover:bg-[#1678d4]"
            >
              <Share2 className="w-4 h-4" />
              分享资料
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
