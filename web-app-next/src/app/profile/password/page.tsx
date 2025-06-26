'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shield,
  ArrowLeft,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  bgColor: string;
  criteria: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
    noSequential: boolean;
  };
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// 密码强度检查函数
const checkPasswordStrength = (password: string): PasswordStrength => {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    noSequential: !/(.)\1\1/.test(password) && !/123|abc|qwe/i.test(password)
  };

  const passed = Object.values(criteria).filter(Boolean).length;

  let score = 0;
  let label = '';
  let color = '';
  let bgColor = '';

  if (passed === 0) {
    score = 0;
    label = '请输入密码';
    color = 'text-gray-400';
    bgColor = 'bg-gray-200';
  } else if (passed <= 2) {
    score = 1;
    label = '弱';
    color = 'text-red-600';
    bgColor = 'bg-red-200';
  } else if (passed <= 4) {
    score = 2;
    label = '中';
    color = 'text-yellow-600';
    bgColor = 'bg-yellow-200';
  } else if (passed <= 5) {
    score = 3;
    label = '强';
    color = 'text-blue-600';
    bgColor = 'bg-blue-200';
  } else {
    score = 4;
    label = '极强';
    color = 'text-green-600';
    bgColor = 'bg-green-200';
  }

  return { score, label, color, bgColor, criteria };
};

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

export default function ProfilePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>(
    checkPasswordStrength('')
  );

  // 实时更新密码强度
  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(form.newPassword));
  }, [form.newPassword]);

  // 验证表单字段
  const validateField = (field: string, value: string): string | null => {
    switch (field) {
      case 'currentPassword':
        if (!value.trim()) {
          return '请输入当前密码';
        }
        return null;

      case 'newPassword':
        if (!value.trim()) {
          return '请输入新密码';
        }
        if (value.length < 8) {
          return '密码长度至少8位字符';
        }
        if (value === form.currentPassword) {
          return '新密码不能与当前密码相同';
        }
        if (passwordStrength.score < 2) {
          return '密码强度太弱，请增强密码复杂度';
        }
        return null;

      case 'confirmPassword':
        if (!value.trim()) {
          return '请确认新密码';
        }
        if (value !== form.newPassword) {
          return '两次输入的密码不一致';
        }
        return null;

      default:
        return null;
    }
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

  // 验证整个表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    Object.keys(form).forEach(field => {
      const value = form[field as keyof PasswordForm];
      const error = validateField(field, value);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理输入变化
  const handleInputChange = (field: keyof PasswordForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));

    setIsDirty(true);
    setTouched(prev => ({ ...prev, [field]: true }));

    // 实时验证
    validateSingleField(field, value);

    // 如果是新密码变化，同时验证确认密码
    if (field === 'newPassword' && form.confirmPassword && touched.confirmPassword) {
      validateSingleField('confirmPassword', form.confirmPassword);
    }
  };

  // 切换密码显示
  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // 模拟密码修改
  const handleSave = async () => {
    if (!validateForm()) {
      showToast('验证失败', '请检查并修正表单中的错误', 'error');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      // 模拟真实的密码修改过程
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

      // 模拟偶尔的密码验证失败
      if (Math.random() < 0.1) {
        throw new Error('当前密码验证失败');
      }

      // 模拟服务器端密码更新
      setSaveSuccess(true);
      setIsDirty(false);

      // 清空表单（安全起见）
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTouched({});
      setErrors({});

      showToast('密码修改成功', '您的密码已成功更新，请妥善保管', 'success');

      // 3秒后隐藏成功状态
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (error) {
      console.error('密码修改失败:', error);
      const errorMessage = error instanceof Error ? error.message : '密码修改失败';

      if (errorMessage.includes('当前密码')) {
        setErrors(prev => ({ ...prev, currentPassword: '当前密码不正确' }));
        showToast('验证失败', '当前密码不正确，请重新输入', 'error');
      } else {
        showToast('修改失败', '网络异常，请稍后重试', 'error');
      }
    } finally {
      setSaving(false);
    }
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
            <h1 className="text-3xl font-bold tracking-tight">修改密码</h1>
            <p className="text-gray-500">更新您的账户密码以确保安全</p>
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
            disabled={saving || !isDirty || passwordStrength.score < 2}
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
            {saving ? '保存中...' : saveSuccess ? '已保存' : '保存更改'}
          </Button>
        </div>
      </div>

      {/* 安全提示 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-medium text-blue-900">密码安全提示</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 请使用至少8位字符，包含大小写字母、数字和符号</li>
                <li>• 避免使用个人信息（如姓名、生日）作为密码</li>
                <li>• 不要在多个账户中使用相同的密码</li>
                <li>• 定期更换密码以提高账户安全性</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 密码修改表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            密码修改
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 当前密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">当前密码 *</label>
            <div className="relative">
              <Input
                type={showPasswords.current ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, currentPassword: true }))}
                placeholder="请输入当前密码"
                className={`pr-10 ${errors.currentPassword ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.currentPassword}</span>
              </div>
            )}
          </div>

          {/* 新密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">新密码 *</label>
            <div className="relative">
              <Input
                type={showPasswords.new ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, newPassword: true }))}
                placeholder="请输入新密码"
                className={`pr-10 ${errors.newPassword ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.newPassword}</span>
              </div>
            )}

            {/* 密码强度指示器 */}
            {form.newPassword && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">密码强度</span>
                    <span className={`text-sm font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-2 flex-1 rounded-full ${
                          level <= passwordStrength.score
                            ? passwordStrength.bgColor
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 密码要求检查 */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-600">密码要求：</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs">
                    {[
                      { key: 'length', label: '至少8位字符' },
                      { key: 'uppercase', label: '包含大写字母' },
                      { key: 'lowercase', label: '包含小写字母' },
                      { key: 'numbers', label: '包含数字' },
                      { key: 'symbols', label: '包含符号' },
                      { key: 'noSequential', label: '无连续字符' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1">
                        {passwordStrength.criteria[key as keyof typeof passwordStrength.criteria] ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span
                          className={
                            passwordStrength.criteria[key as keyof typeof passwordStrength.criteria]
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 确认新密码 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">确认新密码 *</label>
            <div className="relative">
              <Input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                placeholder="请再次输入新密码"
                className={`pr-10 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.confirmPassword}</span>
              </div>
            )}
            {form.confirmPassword && form.newPassword && form.confirmPassword === form.newPassword && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>密码确认一致</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 其他安全措施 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            其他安全措施
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>• 密码修改后，您将需要在所有设备上重新登录</p>
            <p>• 系统会发送确认邮件到您的注册邮箱</p>
            <p>• 如果您怀疑账户被盗用，请立即联系客服</p>
            <p>• 建议启用双因素认证以提高账户安全性</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
