'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Eye,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
  Lock,
  Globe,
  Users,
  Settings,
  Bell,
  Camera,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PrivacySettings {
  // 基础可见性设置
  profileVisibility: 'public' | 'friends' | 'private';
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showLastSeen: boolean;

  // 数据控制
  allowDataCollection: boolean;
  allowAnalytics: boolean;
  allowMarketing: boolean;
  allowThirdPartySharing: boolean;

  // 通知隐私
  showOnlineStatus: boolean;
  allowMessagePreview: boolean;
  showReadReceipts: boolean;

  // 高级设置
  twoFactorAuth: boolean;
  allowPhotoTagging: boolean;
  searchableByEmail: boolean;
  searchableByPhone: boolean;

  // 数据下载/删除
  dataRetentionPeriod: '30' | '90' | '365' | 'forever';
}

interface PrivacyOption {
  id: keyof PrivacySettings;
  title: string;
  description: string;
  icon: any;
  category: string;
  importance: 'high' | 'medium' | 'low';
  requiresConfirmation?: boolean;
}

// 隐私选项配置
const privacyOptions: PrivacyOption[] = [
  // 基础可见性
  {
    id: 'showEmail',
    title: '显示邮箱地址',
    description: '允许其他用户看到您的邮箱地址',
    icon: Mail,
    category: '基础可见性',
    importance: 'medium'
  },
  {
    id: 'showPhone',
    title: '显示手机号码',
    description: '允许其他用户看到您的手机号码',
    icon: Phone,
    category: '基础可见性',
    importance: 'high'
  },
  {
    id: 'showLocation',
    title: '显示位置信息',
    description: '在个人资料中显示您的地理位置',
    icon: MapPin,
    category: '基础可见性',
    importance: 'medium'
  },
  {
    id: 'showLastSeen',
    title: '显示最后在线时间',
    description: '让其他用户看到您最后活跃的时间',
    icon: Eye,
    category: '基础可见性',
    importance: 'low'
  },

  // 数据控制
  {
    id: 'allowDataCollection',
    title: '数据收集',
    description: '允许系统收集使用数据以改善服务',
    icon: Settings,
    category: '数据控制',
    importance: 'medium'
  },
  {
    id: 'allowAnalytics',
    title: '分析统计',
    description: '允许用于分析和统计目的的数据使用',
    icon: Info,
    category: '数据控制',
    importance: 'low'
  },
  {
    id: 'allowMarketing',
    title: '营销推广',
    description: '接收个性化的营销内容和推荐',
    icon: Bell,
    category: '数据控制',
    importance: 'low'
  },
  {
    id: 'allowThirdPartySharing',
    title: '第三方数据共享',
    description: '允许与合作伙伴共享匿名化数据',
    icon: Globe,
    category: '数据控制',
    importance: 'high',
    requiresConfirmation: true
  },

  // 通知隐私
  {
    id: 'showOnlineStatus',
    title: '在线状态',
    description: '显示您当前是否在线',
    icon: Eye,
    category: '通知隐私',
    importance: 'medium'
  },
  {
    id: 'allowMessagePreview',
    title: '消息预览',
    description: '在通知中显示消息内容预览',
    icon: Bell,
    category: '通知隐私',
    importance: 'medium'
  },
  {
    id: 'showReadReceipts',
    title: '已读回执',
    description: '让发送者知道您已阅读消息',
    icon: CheckCircle2,
    category: '通知隐私',
    importance: 'low'
  },

  // 高级设置
  {
    id: 'twoFactorAuth',
    title: '双因素认证',
    description: '为账户启用额外的安全保护',
    icon: Shield,
    category: '高级设置',
    importance: 'high'
  },
  {
    id: 'allowPhotoTagging',
    title: '照片标记',
    description: '允许其他用户在照片中标记您',
    icon: Camera,
    category: '高级设置',
    importance: 'medium'
  },
  {
    id: 'searchableByEmail',
    title: '邮箱搜索',
    description: '允许其他用户通过邮箱找到您',
    icon: Mail,
    category: '高级设置',
    importance: 'medium'
  },
  {
    id: 'searchableByPhone',
    title: '手机搜索',
    description: '允许其他用户通过手机号找到您',
    icon: Phone,
    category: '高级设置',
    importance: 'high'
  }
];

// 模拟Toast通知
const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning' = 'success') => {
  console.log(`Toast [${type}]: ${title} - ${description}`);
  if (type === 'error') {
    alert(`错误: ${title}\n${description}`);
  } else if (type === 'warning') {
    alert(`警告: ${title}\n${description}`);
  } else {
    // 显示简单的成功提示
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `✅ ${title}: ${description}`;
    successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; z-index: 9999; font-size: 14px;';
    document.body.appendChild(successMsg);
    setTimeout(() => document.body.removeChild(successMsg), 3000);
  }
};

export default function ProfilePrivacyPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<PrivacySettings>({
    // 基础可见性 - Mock初始值（较为保守的隐私设置）
    profileVisibility: 'friends',
    showEmail: false,
    showPhone: false,
    showLocation: false,
    showLastSeen: true,

    // 数据控制 - 默认关闭敏感选项
    allowDataCollection: true,
    allowAnalytics: false,
    allowMarketing: false,
    allowThirdPartySharing: false,

    // 通知隐私
    showOnlineStatus: true,
    allowMessagePreview: true,
    showReadReceipts: true,

    // 高级设置
    twoFactorAuth: false,
    allowPhotoTagging: false,
    searchableByEmail: true,
    searchableByPhone: false,

    // 数据保留
    dataRetentionPeriod: '365'
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    show: boolean;
    setting: keyof PrivacySettings | null;
    value: boolean;
  }>({
    show: false,
    setting: null,
    value: false
  });

  // 处理设置变更
  const handleSettingChange = (
    setting: keyof PrivacySettings,
    value: string | boolean
  ) => {
    const option = privacyOptions.find(opt => opt.id === setting);

    // 如果需要确认且正在启用
    if (option?.requiresConfirmation && value === true) {
      setConfirmationDialog({
        show: true,
        setting,
        value: value as boolean
      });
      return;
    }

    // 直接更新设置
    updateSetting(setting, value);
  };

  // 更新设置
  const updateSetting = (setting: keyof PrivacySettings, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    setIsDirty(true);
  };

  // 确认对话框处理
  const handleConfirmChange = () => {
    if (confirmationDialog.setting) {
      updateSetting(confirmationDialog.setting, confirmationDialog.value);
    }
    setConfirmationDialog({ show: false, setting: null, value: false });
  };

  // 取消确认
  const handleCancelChange = () => {
    setConfirmationDialog({ show: false, setting: null, value: false });
  };

  // 保存隐私设置
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      // 模拟偶尔的保存失败
      if (Math.random() < 0.05) {
        throw new Error('网络异常');
      }

      setSaveSuccess(true);
      setIsDirty(false);

      showToast('隐私设置已保存', '您的隐私偏好已成功更新', 'success');

      // 3秒后隐藏成功状态
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (error) {
      console.error('保存失败:', error);
      showToast('保存失败', '请检查网络连接后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认设置
  const handleResetToDefault = () => {
    if (window.confirm('确定要重置为默认隐私设置吗？这将覆盖您的当前设置。')) {
      setSettings({
        profileVisibility: 'friends',
        showEmail: false,
        showPhone: false,
        showLocation: false,
        showLastSeen: true,
        allowDataCollection: true,
        allowAnalytics: false,
        allowMarketing: false,
        allowThirdPartySharing: false,
        showOnlineStatus: true,
        allowMessagePreview: true,
        showReadReceipts: true,
        twoFactorAuth: false,
        allowPhotoTagging: false,
        searchableByEmail: true,
        searchableByPhone: false,
        dataRetentionPeriod: '365'
      });
      setIsDirty(true);
      showToast('已重置', '隐私设置已重置为默认值', 'success');
    }
  };

  // 按类别分组选项
  const groupedOptions = privacyOptions.reduce((groups, option) => {
    const category = option.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(option);
    return groups;
  }, {} as Record<string, PrivacyOption[]>);

  // 渲染切换开关
  const renderSwitch = (option: PrivacyOption) => {
    const isEnabled = settings[option.id] as boolean;
    const IconComponent = option.icon;

    return (
      <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            option.importance === 'high' ? 'bg-red-100 text-red-600' :
            option.importance === 'medium' ? 'bg-yellow-100 text-yellow-600' :
            'bg-green-100 text-green-600'
          }`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900">{option.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{option.description}</p>
            {option.importance === 'high' && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span className="text-xs text-red-600">重要设置</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => handleSettingChange(option.id, !isEnabled)}
          className={`
            relative w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isEnabled ? 'bg-blue-600' : 'bg-gray-300'}
          `}
          aria-label={`${isEnabled ? '禁用' : '启用'} ${option.title}`}
        >
          <div className={`
            absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm
            ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}
          `} />
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">隐私设置</h1>
            <p className="text-gray-500">管理您的隐私偏好和数据控制选项</p>
            {isDirty && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">您有未保存的更改</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">已保存</span>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleResetToDefault}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重置默认
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`flex items-center gap-2 ${
              saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''
            }`}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? '保存中...' : saveSuccess ? '已保存' : '保存设置'}
          </Button>
        </div>
      </div>

      {/* 隐私概览 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-medium text-blue-900">隐私保护提示</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 定期检查您的隐私设置，确保符合您的期望</li>
                <li>• 重要设置变更可能影响您的账户安全</li>
                <li>• 数据控制选项影响我们如何使用您的信息</li>
                <li>• 建议启用双因素认证以提高账户安全性</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 个人资料可见性 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            个人资料可见性
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">谁可以查看您的个人资料</label>
            <select
              value={settings.profileVisibility}
              onChange={(e) => handleSettingChange('profileVisibility', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="public">所有人（公开）</option>
              <option value="friends">仅好友</option>
              <option value="private">仅自己（私密）</option>
            </select>
            <p className="text-xs text-gray-600">
              这控制着其他用户查看您个人资料信息的范围
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 隐私设置分组 */}
      {Object.entries(groupedOptions).map(([category, options]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {options.map(option => (
                <div key={option.id}>
                  {renderSwitch(option)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 数据保留期限 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            数据保留
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">数据保留期限</label>
            <select
              value={settings.dataRetentionPeriod}
              onChange={(e) => handleSettingChange('dataRetentionPeriod', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30">30天</option>
              <option value="90">90天</option>
              <option value="365">1年</option>
              <option value="forever">永久保留</option>
            </select>
            <p className="text-xs text-gray-600">
              设置您的数据在系统中保留的时间长度
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 确认对话框 */}
      {confirmationDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                确认设置变更
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                您正在启用一个重要的隐私设置。这可能会影响您的数据安全和隐私保护。
              </p>
              <p className="text-sm font-medium text-gray-900">
                确定要继续吗？
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={handleCancelChange}
                >
                  取消
                </Button>
                <Button
                  onClick={handleConfirmChange}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  确认更改
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
