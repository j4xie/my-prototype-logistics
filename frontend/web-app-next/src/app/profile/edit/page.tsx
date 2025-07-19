'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  User,
  Mail,
  Phone,
  Building,
  Save,
  RefreshCw,
  Shield,
  Bell,
  AlertCircle,
  CheckCircle2,
  Upload
} from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  company: string;
  department: string;
  position: string;
  bio: string;
  avatar: string;
  dateOfBirth: string;
  gender: string;
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
    showPhone: boolean;
  };
}

// 改进的Mock数据 - 更真实的业务场景
const mockProfile: UserProfile = {
  id: '1',
  username: 'zhangsan_2023',
  email: 'zhangsan@heiniu-agri.com',
  firstName: '张',
  lastName: '三',
  phone: '+86 138-0010-1234',
  address: '北京市朝阳区农业科技园区黑牛大厦A座2001室',
  city: '北京',
  country: '中国',
  company: '黑牛农业科技有限公司',
  department: '智能生产部',
  position: '高级农业技术工程师',
  bio: '专注于现代农业技术和智能化生产管理，负责农产品质量追溯系统的技术研发与优化。拥有5年农业科技行业经验，熟悉IoT设备集成、数据分析和质量管理体系。致力于通过技术创新提高农产品安全性和生产效率。',
  avatar: '/avatars/zhangsan.jpg',
  dateOfBirth: '1990-03-15',
  gender: 'male',
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  notifications: {
    email: true,
    sms: false,
    push: true
  },
  privacy: {
    profileVisibility: 'private',
    showEmail: false,
    showPhone: false
  }
};

// 增强的验证规则
interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
}

const validationRules: Record<string, ValidationRule> = {
  firstName: {
    required: true,
    minLength: 1,
    maxLength: 10,
    pattern: /^[\u4e00-\u9fa5a-zA-Z]+$/,
  },
  lastName: {
    required: true,
    minLength: 1,
    maxLength: 20,
    pattern: /^[\u4e00-\u9fa5a-zA-Z\s]+$/,
  },
  email: {
    required: true,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
  phone: {
    required: true,
    pattern: /^(\+86\s?)?1[3-9]\d{9}$/,
  },
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
  },
  bio: {
    maxLength: 500,
  },
};

// 模拟Toast通知
const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning' = 'success') => {
  console.log(`Toast [${type}]: ${title} - ${description}`);
  // 在实际应用中，这里会使用真实的toast组件
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

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<UserProfile>(mockProfile);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // 模拟真实的数据加载过程
  useEffect(() => {
    const loadUserProfile = async () => {
      setLoading(true);
      try {
        // 模拟网络延迟和可能的错误
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

        // 99%成功率，模拟偶尔的网络问题
        if (Math.random() < 0.01) {
          throw new Error('网络连接失败');
        }

        setProfile(mockProfile);
      } catch (error) {
        console.error('加载用户资料失败:', error);
        showToast('加载失败', '无法加载用户资料，请刷新页面重试', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // 增强的表单验证
  const validateField = (field: string, value: string): string | null => {
    const rule = validationRules[field];
    if (!rule) return null;

    if (rule.required && !value.trim()) {
      return `${getFieldDisplayName(field)}不能为空`;
    }

    if (rule.minLength && value.trim().length < rule.minLength) {
      return `${getFieldDisplayName(field)}至少需要${rule.minLength}个字符`;
    }

    if (rule.maxLength && value.trim().length > rule.maxLength) {
      return `${getFieldDisplayName(field)}不能超过${rule.maxLength}个字符`;
    }

    if (rule.pattern && !rule.pattern.test(value.trim())) {
      return getPatternErrorMessage(field);
    }

    if (rule.customValidator) {
      return rule.customValidator(value);
    }

    return null;
  };

  const getFieldDisplayName = (field: string): string => {
    const names: Record<string, string> = {
      firstName: '姓氏',
      lastName: '名字',
      email: '邮箱地址',
      phone: '手机号码',
      username: '用户名',
      bio: '个人简介',
    };
    return names[field] || field;
  };

  const getPatternErrorMessage = (field: string): string => {
    const messages: Record<string, string> = {
      firstName: '姓氏只能包含中文或英文字母',
      lastName: '名字只能包含中文、英文字母或空格',
      email: '请输入正确的邮箱格式',
      phone: '请输入正确的手机号码格式',
      username: '用户名只能包含字母、数字和下划线',
    };
    return messages[field] || '格式不正确';
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    Object.keys(validationRules).forEach(field => {
      const value = profile[field as keyof UserProfile] as string;
      const error = validateField(field, value || '');
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 实时字段验证
  const validateSingleField = (field: string, value: string) => {
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({
        ...prev,
        [field]: error || ''
      }));
    }
  };

  // 模拟真实的保存过程
  const handleSave = async () => {
    if (!validateForm()) {
      showToast('验证失败', '请检查并修正表单中的错误后重试', 'error');
      return;
    }

    setSaveLoading(true);
    setSaveSuccess(false);

    try {
      // 模拟真实的API调用过程
      await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800));

      // 模拟偶尔的保存失败
      if (Math.random() < 0.05) {
        throw new Error('服务器临时不可用');
      }

      // 模拟服务器端数据处理
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };

      setProfile(updatedProfile);
      setIsDirty(false);
      setSaveSuccess(true);

      showToast('保存成功', '您的个人资料已成功更新', 'success');

      // 3秒后隐藏成功状态
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (error) {
      console.error('保存失败:', error);
      showToast('保存失败', '网络异常，请检查网络连接后重试', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));

    setIsDirty(true);
    setTouched(prev => ({ ...prev, [field]: true }));

    // 实时验证
    if (typeof value === 'string') {
      validateSingleField(field, value);
    }
  };

  const handleNestedChange = (parent: keyof UserProfile, field: string, value: any) => {
    setProfile(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value
      }
    }));
    setIsDirty(true);
  };

  // 模拟头像上传
  const handleAvatarUpload = async () => {
    setUploadingAvatar(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟上传成功
      const newAvatarUrl = `/avatars/zhangsan_${Date.now()}.jpg`;
      handleInputChange('avatar', newAvatarUrl);

      showToast('头像上传成功', '您的头像已更新', 'success');
    } catch {
      showToast('上传失败', '头像上传失败，请重试', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Loading状态优化
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">正在加载个人资料...</p>
            <p className="text-sm text-gray-500">请稍候，我们正在获取您的信息</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 增强的页面标题 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">编辑个人资料</h1>
          <p className="text-gray-500">管理您的个人信息和账户设置</p>
          {isDirty && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">您有未保存的更改</span>
            </div>
          )}
        </div>

        {/* 优化的保存按钮 */}
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">已保存</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={saveLoading || !isDirty}
            className={`flex items-center gap-2 ${
              saveSuccess ? 'bg-green-600 hover:bg-green-700' : ''
            }`}
          >
            {saveLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveLoading ? '保存中...' : saveSuccess ? '已保存' : '保存更改'}
          </Button>
        </div>
      </div>

      {/* 简化的标签页导航 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'basic', label: '基本信息', icon: User },
            { id: 'contact', label: '联系方式', icon: Mail },
            { id: 'work', label: '工作信息', icon: Building },
            { id: 'preferences', label: '偏好设置', icon: Shield }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 基本信息 */}
      {activeTab === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              个人信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 优化的头像部分 */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">
                  {profile.firstName + profile.lastName}
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                                <Button
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={handleAvatarUpload}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadingAvatar ? '上传中...' : '更换头像'}
                </Button>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>建议使用 400x400 像素的图片</p>
                  <p>支持 JPG、PNG 格式，文件大小不超过 2MB</p>
                </div>
              </div>
            </div>

            {/* 优化的基本信息表单 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">姓氏 *</label>
                <Input
                  value={profile.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
                  placeholder="请输入姓氏"
                  className={errors.firstName ? 'border-red-500 focus:border-red-500' : ''}
                />
                {errors.firstName && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.firstName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">名字 *</label>
                <Input
                  value={profile.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
                  placeholder="请输入名字"
                  className={errors.lastName ? 'border-red-500 focus:border-red-500' : ''}
                />
                {errors.lastName && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.lastName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">用户名 *</label>
                <Input
                  value={profile.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, username: true }))}
                  placeholder="请输入用户名"
                  className={errors.username ? 'border-red-500 focus:border-red-500' : ''}
                />
                {errors.username && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.username}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  用户名只能包含字母、数字和下划线，3-20个字符
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">性别</label>
                <Select
                  value={profile.gender}
                  onChange={(value) => handleInputChange('gender', value)}
                  placeholder="请选择性别"
                  options={[
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' },
                    { value: 'other', label: '其他' }
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">生日</label>
                <Input
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">语言偏好</label>
                <Select
                  value={profile.language}
                  onChange={(value) => handleInputChange('language', value)}
                  placeholder="请选择语言"
                  options={[
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'zh-TW', label: '繁体中文' },
                    { value: 'en-US', label: 'English' }
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">个人简介</label>
              <Textarea
                value={profile.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, bio: true }))}
                placeholder="介绍一下您自己，您的专业领域和工作经验..."
                className={`min-h-[120px] ${errors.bio ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <div className="flex justify-between items-center">
                {errors.bio && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span>{errors.bio}</span>
                  </div>
                )}
                <span className="text-xs text-gray-500 ml-auto">
                  {profile.bio.length}/500 字符
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 联系方式 */}
      {activeTab === 'contact' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              联系方式
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">邮箱地址 *</label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                placeholder="请输入邮箱地址"
                className={errors.email ? 'border-red-500 focus:border-red-500' : ''}
              />
              {errors.email && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">手机号码 *</label>
              <Input
                value={profile.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                placeholder="请输入手机号码"
                className={errors.phone ? 'border-red-500 focus:border-red-500' : ''}
              />
              {errors.phone && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.phone}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">详细地址</label>
              <Input
                value={profile.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="请输入详细地址"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">城市</label>
                <Input
                  value={profile.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="请输入城市"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">国家</label>
                <Select
                  value={profile.country}
                  onChange={(value) => handleInputChange('country', value)}
                  placeholder="请选择国家"
                  options={[
                    { value: '中国', label: '中国' },
                    { value: '美国', label: '美国' },
                    { value: '日本', label: '日本' },
                    { value: '韩国', label: '韩国' },
                    { value: '其他', label: '其他' }
                  ]}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工作信息 */}
      {activeTab === 'work' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              工作信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">公司名称</label>
              <Input
                value={profile.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                placeholder="请输入公司名称"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">部门</label>
                <Input
                  value={profile.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  placeholder="请输入部门"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">职位</label>
                <Input
                  value={profile.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="请输入职位"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 偏好设置 */}
      {activeTab === 'preferences' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              偏好设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 通知设置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">通知设置</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">邮件通知</p>
                      <p className="text-xs text-gray-500">接收重要更新和提醒邮件</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.notifications.email}
                    onChange={(e) => handleNestedChange('notifications', 'email', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">短信通知</p>
                      <p className="text-xs text-gray-500">接收紧急通知短信</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.notifications.sms}
                    onChange={(e) => handleNestedChange('notifications', 'sms', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">推送通知</p>
                      <p className="text-xs text-gray-500">在浏览器中接收推送通知</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.notifications.push}
                    onChange={(e) => handleNestedChange('notifications', 'push', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* 隐私设置 */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">隐私设置</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">资料可见性</label>
                  <Select
                    value={profile.privacy.profileVisibility}
                    onChange={(value) => handleNestedChange('privacy', 'profileVisibility', value)}
                    placeholder="选择可见性"
                    options={[
                      { value: 'public', label: '公开 - 所有人可见' },
                      { value: 'private', label: '私密 - 仅自己可见' },
                      { value: 'friends', label: '好友 - 仅好友可见' }
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">显示邮箱地址</p>
                    <p className="text-xs text-gray-500">允许其他用户查看您的邮箱地址</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.privacy.showEmail}
                    onChange={(e) => handleNestedChange('privacy', 'showEmail', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">显示手机号码</p>
                    <p className="text-xs text-gray-500">允许其他用户查看您的手机号码</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.privacy.showPhone}
                    onChange={(e) => handleNestedChange('privacy', 'showPhone', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
