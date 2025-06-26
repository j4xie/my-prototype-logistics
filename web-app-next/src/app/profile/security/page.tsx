'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Smartphone,
  Monitor,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
  Eye,
  MapPin,
  Clock,
  Wifi,
  Settings,
  X,
  AlertTriangle,
  Key,
  Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginRecord {
  id: string;
  device: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  location: string;
  ip: string;
  loginTime: string;
  status: 'success' | 'failed' | 'suspicious';
  isCurrent: boolean;
}

interface SecurityDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  lastActive: string;
  location: string;
  isCurrent: boolean;
  isVerified: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;
  passwordExpiry: boolean;
  sessionTimeout: '15' | '30' | '60' | '120' | 'never';
  allowedDevices: number;
}

// 模拟安全数据
const mockLoginRecords: LoginRecord[] = [
  {
    id: '1',
    device: 'Windows PC - Chrome',
    deviceType: 'desktop',
    location: '北京市, 中国',
    ip: '192.168.1.100',
    loginTime: '2024-01-15 14:30:25',
    status: 'success',
    isCurrent: true
  },
  {
    id: '2',
    device: 'iPhone 15 Pro - Safari',
    deviceType: 'mobile',
    location: '北京市, 中国',
    ip: '192.168.1.101',
    loginTime: '2024-01-15 09:15:10',
    status: 'success',
    isCurrent: false
  },
  {
    id: '3',
    device: 'Unknown Device - Chrome',
    deviceType: 'desktop',
    location: '上海市, 中国',
    ip: '180.101.49.11',
    loginTime: '2024-01-14 22:45:33',
    status: 'suspicious',
    isCurrent: false
  },
  {
    id: '4',
    device: 'MacBook Pro - Safari',
    deviceType: 'desktop',
    location: '北京市, 中国',
    ip: '192.168.1.102',
    loginTime: '2024-01-14 16:20:15',
    status: 'success',
    isCurrent: false
  },
  {
    id: '5',
    device: 'Android Phone - Chrome',
    deviceType: 'mobile',
    location: '广州市, 中国',
    ip: '120.232.145.78',
    loginTime: '2024-01-13 11:30:00',
    status: 'failed',
    isCurrent: false
  }
];

const mockDevices: SecurityDevice[] = [
  {
    id: '1',
    name: 'Windows PC',
    type: 'desktop',
    os: 'Windows 11',
    browser: 'Chrome 120',
    lastActive: '当前会话',
    location: '北京市',
    isCurrent: true,
    isVerified: true
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    type: 'mobile',
    os: 'iOS 17.2',
    browser: 'Safari',
    lastActive: '5小时前',
    location: '北京市',
    isCurrent: false,
    isVerified: true
  },
  {
    id: '3',
    name: 'MacBook Pro',
    type: 'desktop',
    os: 'macOS Sonoma',
    browser: 'Safari 17',
    lastActive: '1天前',
    location: '北京市',
    isCurrent: false,
    isVerified: true
  },
  {
    id: '4',
    name: 'Unknown Device',
    type: 'desktop',
    os: 'Unknown',
    browser: 'Chrome',
    lastActive: '2天前',
    location: '上海市',
    isCurrent: false,
    isVerified: false
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

export default function ProfileSecurityPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    loginNotifications: true,
    suspiciousActivityAlerts: true,
    passwordExpiry: false,
    sessionTimeout: '60',
    allowedDevices: 5
  });

  const [devices, setDevices] = useState<SecurityDevice[]>(mockDevices);
  const [loginRecords] = useState<LoginRecord[]>(mockLoginRecords);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // 处理设置变更
  const handleSettingChange = (setting: keyof SecuritySettings, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    setIsDirty(true);
  };

  // 启用双因素认证
  const handleEnable2FA = async () => {
    if (window.confirm('启用双因素认证需要手机验证。确定要继续吗？')) {
      setSaving(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        handleSettingChange('twoFactorEnabled', true);
        showToast('双因素认证已启用', '您的账户安全性已得到加强', 'success');
      } catch (_error) {
        showToast('启用失败', '请稍后重试', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  // 禁用双因素认证
  const handleDisable2FA = async () => {
    if (window.confirm('禁用双因素认证会降低账户安全性。确定要继续吗？')) {
      setSaving(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        handleSettingChange('twoFactorEnabled', false);
        showToast('双因素认证已禁用', '建议重新启用以保护账户安全', 'warning');
      } catch (_error) {
        showToast('禁用失败', '请稍后重试', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  // 移除设备
  const handleRemoveDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device?.isCurrent) {
      showToast('无法移除', '不能移除当前设备', 'error');
      return;
    }

    if (window.confirm('确定要移除此设备吗？该设备将需要重新验证才能登录。')) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        showToast('设备已移除', '设备已从您的账户中移除', 'success');
      } catch (_error) {
        showToast('移除失败', '请稍后重试', 'error');
      }
    }
  };

  // 保存安全设置
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      if (Math.random() < 0.05) {
        throw new Error('网络异常');
      }

      setSaveSuccess(true);
      setIsDirty(false);
      showToast('安全设置已保存', '您的安全配置已成功更新', 'success');
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (_error) {
      showToast('保存失败', '请检查网络连接后重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 获取设备图标
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return Smartphone;
      case 'tablet': return Smartphone;
      case 'desktop': return Monitor;
      default: return Monitor;
    }
  };

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'suspicious': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'failed': return '失败';
      case 'suspicious': return '可疑';
      default: return '未知';
    }
  };

  // 计算安全评分
  const calculateSecurityScore = () => {
    let score = 0;
    if (settings.twoFactorEnabled) score += 30;
    if (settings.loginNotifications) score += 15;
    if (settings.suspiciousActivityAlerts) score += 15;
    if (settings.passwordExpiry) score += 10;
    if (settings.sessionTimeout !== 'never') score += 10;
    if (devices.filter(d => d.isVerified).length >= 2) score += 20;
    return Math.min(score, 100);
  };

  const securityScore = calculateSecurityScore();
  const securityLevel = securityScore >= 80 ? '高' : securityScore >= 60 ? '中' : '低';

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
            <h1 className="text-3xl font-bold tracking-tight">安全设置</h1>
            <p className="text-gray-500">管理您的账户安全和设备授权</p>
            {isDirty && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">您有未保存的更改</span>
              </div>
            )}
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">已保存</span>
            </div>
          )}
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

      {/* 安全概览 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-blue-900">账户安全评分</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-blue-600">{securityScore}</span>
                    <span className="text-blue-600">/100</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    securityScore >= 80 ? 'bg-green-100 text-green-800' :
                    securityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {securityLevel}安全
                  </span>
                </div>
                <p className="text-sm text-blue-800">
                  {securityScore >= 80
                    ? '您的账户安全性很好，请继续保持。'
                    : securityScore >= 60
                    ? '您的账户安全性中等，建议启用更多安全功能。'
                    : '您的账户安全性较低，强烈建议启用双因素认证。'
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 安全设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            安全设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 双因素认证 */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <Key className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">双因素认证</h4>
                <p className="text-sm text-gray-600">为您的账户添加额外的安全保护</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${settings.twoFactorEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                {settings.twoFactorEnabled ? '已启用' : '未启用'}
              </span>
              <Button
                onClick={settings.twoFactorEnabled ? handleDisable2FA : handleEnable2FA}
                disabled={saving}
                variant={settings.twoFactorEnabled ? 'secondary' : 'primary'}
                size="small"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  settings.twoFactorEnabled ? '禁用' : '启用'
                )}
              </Button>
            </div>
          </div>

          {/* 其他安全设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">登录通知</h4>
                <p className="text-sm text-gray-600">新设备登录时发送邮件通知</p>
              </div>
              <input
                type="checkbox"
                checked={settings.loginNotifications}
                onChange={(e) => handleSettingChange('loginNotifications', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">可疑活动警报</h4>
                <p className="text-sm text-gray-600">检测到异常登录行为时发送警报</p>
              </div>
              <input
                type="checkbox"
                checked={settings.suspiciousActivityAlerts}
                onChange={(e) => handleSettingChange('suspiciousActivityAlerts', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">密码过期提醒</h4>
                <p className="text-sm text-gray-600">定期提醒更换密码</p>
              </div>
              <input
                type="checkbox"
                checked={settings.passwordExpiry}
                onChange={(e) => handleSettingChange('passwordExpiry', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">会话超时</h4>
                <p className="text-sm text-gray-600">设置自动退出时间</p>
              </div>
              <select
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', e.target.value as any)}
                className="border rounded px-3 py-1"
              >
                <option value="15">15分钟</option>
                <option value="30">30分钟</option>
                <option value="60">1小时</option>
                <option value="120">2小时</option>
                <option value="never">永不</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登录记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            登录记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loginRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded">
                    {record.deviceType === 'mobile' ? (
                      <Smartphone className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{record.device}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {record.location}
                      </span>
                      <span>{record.ip}</span>
                      <span>{record.loginTime}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {record.isCurrent && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      当前
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(record.status)}`}>
                    {getStatusText(record.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 受信任设备 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            受信任设备
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devices.map((device) => {
              const DeviceIcon = getDeviceIcon(device.type);
              return (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded">
                      <DeviceIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{device.os} • {device.browser}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {device.location}
                        </span>
                        <span>最后活动: {device.lastActive}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.isCurrent && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        当前设备
                      </span>
                    )}
                    {device.isVerified && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        已验证
                      </span>
                    )}
                    {!device.isCurrent && (
                      <Button
                        onClick={() => handleRemoveDevice(device.id)}
                        variant="secondary"
                        size="small"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
