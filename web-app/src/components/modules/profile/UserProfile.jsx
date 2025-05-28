import React, { useState, useEffect } from 'react';
import { 
  Badge, 
  Button,
  Input,
  Loading 
} from '@/components/ui';

/**
 * 用户档案组件 - React现代化版本
 * 严格遵循Neo Minimal iOS-Style Admin UI设计规范
 */
const UserProfile = ({ 
  userInfo = null,
  loading = false,
  editable = true,
  onSave,
  onCancel,
  onAvatarChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    bio: '',
    avatar: null
  });
  const [saving, setSaving] = useState(false);

  // 用户状态配置
  const statusConfig = {
    active: { variant: 'success', text: '活跃', color: '#52C41A' },
    inactive: { variant: 'default', text: '非活跃', color: '#9CA3AF' },
    suspended: { variant: 'error', text: '已暂停', color: '#FF4D4F' },
    pending: { variant: 'warning', text: '待审核', color: '#FA8C16' }
  };

  // 权限配置
  const permissionConfig = {
    super_admin: { variant: 'error', text: '超级管理员', color: '#FF4D4F' },
    admin: { variant: 'warning', text: '管理员', color: '#FA8C16' },
    operator: { variant: 'info', text: '操作员', color: '#1890FF' },
    viewer: { variant: 'default', text: '查看者', color: '#9CA3AF' }
  };

  useEffect(() => {
    if (userInfo) {
      setFormData({
        name: userInfo.name || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        department: userInfo.department || '',
        position: userInfo.position || '',
        bio: userInfo.bio || '',
        avatar: userInfo.avatar || null
      });
    }
  }, [userInfo]);

  const getStatusInfo = (status) => {
    return statusConfig[status] || statusConfig.inactive;
  };

  const getPermissionInfo = (permission) => {
    return permissionConfig[permission] || permissionConfig.viewer;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(formData);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // 重置表单数据
    if (userInfo) {
      setFormData({
        name: userInfo.name || '',
        email: userInfo.email || '',
        phone: userInfo.phone || '',
        department: userInfo.department || '',
        position: userInfo.position || '',
        bio: userInfo.bio || '',
        avatar: userInfo.avatar || null
      });
    }
    if (onCancel) {
      onCancel();
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const avatarUrl = event.target.result;
        handleInputChange('avatar', avatarUrl);
        if (onAvatarChange) {
          onAvatarChange(file, avatarUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-[390px] mx-auto space-y-6">
      {/* 用户头像和基本信息 - 遵循UI设计系统规则 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">个人资料</h2>
          {editable && !isEditing && (
            <Button
              variant="secondary"
              size="small"
              onClick={handleEdit}
            >
              <i className="fas fa-edit mr-1"></i>
              编辑
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-4 mb-4">
          {/* 头像 */}
          <div className="relative">
            <div className="w-16 h-16 bg-[#E6F7FF] rounded-full flex items-center justify-center overflow-hidden">
              {formData.avatar ? (
                <img 
                  src={formData.avatar} 
                  alt="用户头像" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <i className="fas fa-user text-[#1890FF] text-2xl"></i>
              )}
            </div>
            {isEditing && (
              <div className="absolute -bottom-1 -right-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="w-6 h-6 bg-[#1890FF] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#4096FF]"
                  aria-label="上传头像"
                >
                  <i className="fas fa-camera text-white text-xs"></i>
                </label>
              </div>
            )}
          </div>

          {/* 基本信息 */}
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">
              {userInfo?.name || '未知用户'}
            </h3>
            <p className="text-sm text-gray-600">
              {userInfo?.position || '未设置职位'} • {userInfo?.department || '未设置部门'}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              {userInfo?.status && (
                <Badge variant={getStatusInfo(userInfo.status).variant} size="small">
                  {getStatusInfo(userInfo.status).text}
                </Badge>
              )}
              {userInfo?.permission && (
                <Badge variant={getPermissionInfo(userInfo.permission).variant} size="small">
                  {getPermissionInfo(userInfo.permission).text}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 详细信息 - 使用grid-cols-2 gap-4布局 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">详细信息</h3>
        
        {isEditing ? (
          <div className="space-y-4">
            <Input
              label="姓名"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="请输入姓名"
              required
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="邮箱"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="请输入邮箱"
              />
              
              <Input
                label="电话"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="请输入电话"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="部门"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder="请输入部门"
              />
              
              <Input
                label="职位"
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                placeholder="请输入职位"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                个人简介
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="请输入个人简介..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent resize-none"
                maxLength={200}
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.bio.length}/200
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">姓名</div>
              <div className="font-medium">{userInfo?.name || '-'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">邮箱</div>
              <div className="font-medium">{userInfo?.email || '-'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">电话</div>
              <div className="font-medium">{userInfo?.phone || '-'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">部门</div>
              <div className="font-medium">{userInfo?.department || '-'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">职位</div>
              <div className="font-medium">{userInfo?.position || '-'}</div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600">用户ID</div>
              <div className="font-medium">{userInfo?.id || '-'}</div>
            </div>
            
            {userInfo?.bio && (
              <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                <div className="text-sm text-gray-600">个人简介</div>
                <div className="font-medium">{userInfo.bio}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 账户信息 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">账户信息</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">注册时间</div>
            <div className="font-medium">{formatTime(userInfo?.createdAt)}</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">最后登录</div>
            <div className="font-medium">{formatTime(userInfo?.lastLogin)}</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">登录次数</div>
            <div className="font-medium">{userInfo?.loginCount || 0}次</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">账户状态</div>
            <div className="font-medium">
              {userInfo?.status ? getStatusInfo(userInfo.status).text : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      {isEditing && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="secondary"
              onClick={handleCancel}
              className="w-full"
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              className="w-full"
            >
              保存
            </Button>
          </div>
        </div>
      )}

      {/* 安全设置 */}
      {!isEditing && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">安全设置</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">修改密码</span>
              <Button variant="secondary" size="small">
                <i className="fas fa-key mr-1"></i>
                修改
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">两步验证</span>
              <Badge variant={userInfo?.twoFactorEnabled ? 'success' : 'default'} size="small">
                {userInfo?.twoFactorEnabled ? '已启用' : '未启用'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">登录设备管理</span>
              <Button variant="secondary" size="small">
                <i className="fas fa-mobile-alt mr-1"></i>
                管理
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile; 