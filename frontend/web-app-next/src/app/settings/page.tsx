'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  PageLayout,
  Badge
} from '@/components/ui';

interface Settings {
  theme: 'light' | 'dark' | 'auto';
  language: 'zh-CN' | 'en-US';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    system: boolean;
  };
  privacy: {
    dataCollection: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  display: {
    density: 'compact' | 'normal' | 'comfortable';
    fontSize: 'small' | 'medium' | 'large';
  };
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  language: 'zh-CN',
  notifications: {
    email: true,
    sms: false,
    push: true,
    system: true,
  },
  privacy: {
    dataCollection: false,
    analytics: false,
    marketing: false,
  },
  display: {
    density: 'normal',
    fontSize: 'medium',
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('user-settings');
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // 保存到本地存储
      localStorage.setItem('user-settings', JSON.stringify(settings));

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      setMessage({ type: 'success', text: '设置保存成功' });

      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      setMessage({ type: 'error', text: '保存设置失败' });
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    if (confirm('确定要重置所有设置为默认值吗？')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('user-settings');
      setMessage({ type: 'success', text: '设置已重置为默认值' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const exportSettings = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'settings.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '设置已导出' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('导出失败:', error);
      setMessage({ type: 'error', text: '导出失败' });
    }
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          setSettings({ ...DEFAULT_SETTINGS, ...importedSettings });
          setMessage({ type: 'success', text: '设置导入成功' });
          setTimeout(() => setMessage(null), 3000);
        } catch (error) {
          console.error('导入失败:', error);
          setMessage({ type: 'error', text: '导入文件格式错误' });
          setTimeout(() => setMessage(null), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const ToggleSwitch = ({
    checked,
    onChange,
    label,
    icon
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    icon: string;
  }) => (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center space-x-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-500' : 'bg-gray-300'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );

  const OptionSelector = ({
    title,
    icon,
    options,
    value,
    onChange
  }: {
    title: string;
    icon: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  }) => (
    <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex items-center space-x-3 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="text-md font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`p-3 text-sm font-medium rounded-lg border transition-all hover:shadow-md ${
              value === option.value
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <PageLayout
        title="系统设置"
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载设置中...</p>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="系统设置"
      showBack={true}
      onBack={() => window.history.back()}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 用户信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">用户设置</h2>
              <p className="text-sm text-gray-600">管理您的偏好设置</p>
            </div>
            <Badge className="bg-green-100 text-green-800">已同步</Badge>
          </div>
        </Card>

        {/* 消息提示 */}
        {message && (
          <Card className={`mb-4 border ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="p-4 text-center">
              <p className={`${
                message.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {message.text}
              </p>
            </div>
          </Card>
        )}

        {/* 外观设置 */}
        <OptionSelector
          title="外观主题"
          icon="🎨"
          options={[
            { value: 'light', label: '浅色模式' },
            { value: 'dark', label: '深色模式' },
            { value: 'auto', label: '跟随系统' }
          ]}
          value={settings.theme}
          onChange={(value) => updateSetting('theme', value)}
        />

        {/* 语言设置 */}
        <OptionSelector
          title="语言设置"
          icon="🌐"
          options={[
            { value: 'zh-CN', label: '简体中文' },
            { value: 'en-US', label: 'English' }
          ]}
          value={settings.language}
          onChange={(value) => updateSetting('language', value)}
        />

        {/* 显示设置 */}
        <OptionSelector
          title="显示密度"
          icon="📏"
          options={[
            { value: 'compact', label: '紧凑' },
            { value: 'normal', label: '标准' },
            { value: 'comfortable', label: '舒适' }
          ]}
          value={settings.display.density}
          onChange={(value) => updateSetting('display.density', value)}
        />

        {/* 通知设置 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-xl">🔔</span>
            <h3 className="text-md font-semibold text-gray-900">通知设置</h3>
          </div>
          <div className="space-y-1">
            <ToggleSwitch
              checked={settings.notifications.email}
              onChange={(checked) => updateSetting('notifications.email', checked)}
              label="邮件通知"
              icon="📧"
            />
            <ToggleSwitch
              checked={settings.notifications.sms}
              onChange={(checked) => updateSetting('notifications.sms', checked)}
              label="短信通知"
              icon="📱"
            />
            <ToggleSwitch
              checked={settings.notifications.push}
              onChange={(checked) => updateSetting('notifications.push', checked)}
              label="推送通知"
              icon="📲"
            />
            <ToggleSwitch
              checked={settings.notifications.system}
              onChange={(checked) => updateSetting('notifications.system', checked)}
              label="系统通知"
              icon="⚡"
            />
          </div>
        </Card>

        {/* 隐私设置 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-xl">🔒</span>
            <h3 className="text-md font-semibold text-gray-900">隐私设置</h3>
          </div>
          <div className="space-y-1">
            <ToggleSwitch
              checked={settings.privacy.dataCollection}
              onChange={(checked) => updateSetting('privacy.dataCollection', checked)}
              label="数据收集"
              icon="📊"
            />
            <ToggleSwitch
              checked={settings.privacy.analytics}
              onChange={(checked) => updateSetting('privacy.analytics', checked)}
              label="使用分析"
              icon="📈"
            />
            <ToggleSwitch
              checked={settings.privacy.marketing}
              onChange={(checked) => updateSetting('privacy.marketing', checked)}
              label="营销信息"
              icon="📢"
            />
          </div>
        </Card>

        {/* 数据管理 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-xl">💾</span>
            <h3 className="text-md font-semibold text-gray-900">数据管理</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button
              onClick={exportSettings}
              variant="secondary"
              className="hover:shadow-md hover:scale-[1.03] transition-all"
            >
              <span className="mr-2">📤</span>
              导出设置
            </Button>
            <div>
              <input
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
                id="import-settings"
              />
              <Button
                onClick={() => document.getElementById('import-settings')?.click()}
                variant="secondary"
                className="w-full hover:shadow-md hover:scale-[1.03] transition-all"
              >
                <span className="mr-2">📥</span>
                导入设置
              </Button>
            </div>
          </div>

          {/* 存储信息 */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">设置数据</span>
              <span className="text-sm font-medium text-gray-900">
                {JSON.stringify(settings).length} 字节
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">存储状态</span>
              <Badge className="bg-green-100 text-green-800 text-xs">正常</Badge>
            </div>
          </div>
        </Card>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="w-full hover:shadow-md hover:scale-[1.03] transition-all"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                保存中...
              </>
            ) : (
              <>
                <span className="mr-2">💾</span>
                保存设置
              </>
            )}
          </Button>

          <Button
            onClick={resetSettings}
            variant="danger"
            className="w-full hover:shadow-md hover:scale-[1.03] transition-all"
          >
            <span className="mr-2">🔄</span>
            重置为默认设置
          </Button>
        </div>

        {/* 底部版本信息 */}
        <Card className="bg-blue-50 border-blue-200 p-4 mt-6">
          <div className="text-center">
            <div className="text-blue-800 font-medium mb-1">食品溯源系统</div>
            <div className="text-blue-600 text-sm">Version 1.0.0</div>
            <div className="text-blue-600 text-xs mt-1">© 2025 Phase-3 现代化版本</div>
          </div>
        </Card>
      </main>
    </PageLayout>
  );
}
