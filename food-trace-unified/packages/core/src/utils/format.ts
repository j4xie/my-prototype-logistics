// 格式化工具函数

// 格式化数字
export const formatNumber = (num: number, decimals: number = 2): string => {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

// 格式化货币
export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

// 格式化百分比
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化温度
export const formatTemperature = (temp: number, unit: 'C' | 'F' = 'C'): string => {
  if (unit === 'F') {
    return `${temp}°F`;
  }
  return `${temp}°C`;
};

// 格式化重量
export const formatWeight = (weight: number, unit: 'g' | 'kg' | 't' = 'kg'): string => {
  switch (unit) {
    case 'g':
      return `${weight}g`;
    case 't':
      return `${weight}t`;
    default:
      return `${weight}kg`;
  }
};

// 格式化距离
export const formatDistance = (distance: number, unit: 'm' | 'km' = 'km'): string => {
  if (unit === 'm') {
    return `${distance}m`;
  }
  return `${distance}km`;
};

// 格式化手机号
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  }
  return phone;
};

// 格式化身份证号
export const formatIdCard = (idCard: string): string => {
  if (idCard.length === 18) {
    return idCard.replace(/(\d{6})(\d{8})(\d{4})/, '$1 $2 $3');
  }
  return idCard;
};

// 格式化银行卡号
export const formatBankCard = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\D/g, '');
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
};

// 格式化用户名显示
export const formatUserName = (user: { firstName?: string; lastName?: string; username: string }): string => {
  if (user.firstName && user.lastName) {
    return `${user.lastName}${user.firstName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.lastName) {
    return user.lastName;
  }
  return user.username;
};

// 格式化地址
export const formatAddress = (address: {
  province?: string;
  city?: string;
  district?: string;
  street?: string;
}): string => {
  const parts = [address.province, address.city, address.district, address.street]
    .filter(Boolean);
  return parts.join('');
};

// 格式化组织信息
export const formatOrganization = (org: {
  name: string;
  type: string;
}): string => {
  const typeNames = {
    farm: '农场',
    processor: '加工厂',
    logistics: '物流公司',
    retailer: '零售商'
  };
  
  const typeName = typeNames[org.type as keyof typeof typeNames] || org.type;
  return `${org.name} (${typeName})`;
};

// 脱敏处理
export const maskSensitiveData = {
  // 手机号脱敏
  phone: (phone: string): string => {
    if (phone.length === 11) {
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    return phone;
  },
  
  // 身份证脱敏
  idCard: (idCard: string): string => {
    if (idCard.length === 18) {
      return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
    }
    return idCard;
  },
  
  // 邮箱脱敏
  email: (email: string): string => {
    const [local, domain] = email.split('@');
    if (local.length > 3) {
      const maskedLocal = local.slice(0, 3) + '*'.repeat(local.length - 3);
      return `${maskedLocal}@${domain}`;
    }
    return email;
  },
  
  // 银行卡脱敏
  bankCard: (cardNumber: string): string => {
    if (cardNumber.length >= 8) {
      const first4 = cardNumber.slice(0, 4);
      const last4 = cardNumber.slice(-4);
      const middle = '*'.repeat(cardNumber.length - 8);
      return `${first4}${middle}${last4}`;
    }
    return cardNumber;
  }
};

// 状态文本格式化
export const formatStatus = {
  batch: (status: string): { text: string; color: string } => {
    const statusMap = {
      active: { text: '进行中', color: 'blue' },
      processing: { text: '加工中', color: 'orange' },
      shipped: { text: '已发货', color: 'green' },
      delivered: { text: '已送达', color: 'green' },
      completed: { text: '已完成', color: 'green' },
      recalled: { text: '已召回', color: 'red' }
    };
    return statusMap[status as keyof typeof statusMap] || { text: status, color: 'gray' };
  },
  
  quality: (result: string): { text: string; color: string } => {
    const resultMap = {
      pass: { text: '合格', color: 'green' },
      fail: { text: '不合格', color: 'red' },
      warning: { text: '警告', color: 'yellow' }
    };
    return resultMap[result as keyof typeof resultMap] || { text: result, color: 'gray' };
  },
  
  user: (role: string): { text: string; color: string } => {
    const roleMap = {
      farmer: { text: '农户', color: 'green' },
      processor: { text: '加工商', color: 'blue' },
      logistics: { text: '物流商', color: 'orange' },
      retailer: { text: '零售商', color: 'purple' },
      consumer: { text: '消费者', color: 'gray' },
      admin: { text: '管理员', color: 'red' },
      inspector: { text: '检查员', color: 'yellow' }
    };
    return roleMap[role as keyof typeof roleMap] || { text: role, color: 'gray' };
  }
};