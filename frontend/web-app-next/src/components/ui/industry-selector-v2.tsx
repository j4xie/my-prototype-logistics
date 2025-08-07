'use client';

import { useState, useEffect } from 'react';
import { Select as BaseSelect } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { industryCategories, getAllIndustries, searchIndustries, type Industry } from '@/data/industries';
import { Search } from 'lucide-react';

interface IndustrySelectorProps {
  value?: string; // 行业代码
  onChange?: (value: string, industry: Industry | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  showSearch?: boolean; // 是否显示搜索功能
  showCategory?: boolean; // 是否按分类显示
}

/**
 * 行业选择器组件 V2 - 使用原始 Select 组件
 */
export default function IndustrySelector({
  value,
  onChange,
  placeholder = '请选择行业',
  disabled = false,
  required = false,
  className = '',
  showSearch = true,
  showCategory = true
}: IndustrySelectorProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>(value || '');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // 获取过滤后的行业列表
  const getFilteredIndustries = (): Industry[] => {
    if (searchKeyword.trim()) {
      return searchIndustries(searchKeyword);
    }

    if (selectedCategory) {
      const category = industryCategories.find(cat => cat.code === selectedCategory);
      return category?.industries || [];
    }

    return getAllIndustries();
  };

  // 当外部值改变时，同步内部状态
  useEffect(() => {
    setSelectedIndustry(value || '');
  }, [value]);

  // 处理行业选择
  const handleIndustryChange = (industryCode: string) => {
    setSelectedIndustry(industryCode);

    if (onChange) {
      const allIndustries = getAllIndustries();
      const industry = allIndustries.find(ind => ind.code === industryCode) || null;
      onChange(industryCode, industry);
    }
  };

  // 处理分类选择
  const handleCategoryChange = (categoryCode: string) => {
    setSelectedCategory(categoryCode);
    setSearchKeyword(''); // 清空搜索
    setSelectedIndustry(''); // 清空已选择的行业

    // 通知外部组件值已清空
    if (onChange) {
      onChange('', null);
    }
  };

  // 处理搜索
  const handleSearchChange = (keyword: string) => {
    setSearchKeyword(keyword);
    setSelectedCategory(''); // 清空分类选择
    setSelectedIndustry(''); // 清空已选择的行业

    // 通知外部组件值已清空
    if (onChange) {
      onChange('', null);
    }
  };

  // 获取当前选中行业的显示名称
  const getSelectedIndustryName = (): string => {
    if (!selectedIndustry) return '';

    const allIndustries = getAllIndustries();
    const industry = allIndustries.find(ind => ind.code === selectedIndustry);
    return industry ? `${industry.name} (${industry.code})` : '';
  };

  const filteredIndustries = getFilteredIndustries();

  // 转换为 Select 组件需要的选项格式
  const industryOptions = filteredIndustries.map(industry => ({
    value: industry.code,
    label: industry.name + (industry.description ? ` - ${industry.description}` : '')
  }));

  const categoryOptions = [
    { value: '', label: '全部分类' },
    ...industryCategories.map(cat => ({
      value: cat.code,
      label: cat.name
    }))
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 搜索和分类选择 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 搜索框 */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="搜索行业名称..."
              value={searchKeyword}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
              disabled={disabled}
            />
          </div>
        )}

        {/* 分类选择 */}
        {showCategory && (
          <BaseSelect
            value={selectedCategory}
            onChange={handleCategoryChange}
            options={categoryOptions}
            placeholder="选择行业分类"
            disabled={disabled || !!searchKeyword.trim()}
          />
        )}
      </div>

      {/* 行业选择 */}
      <div className="space-y-1">
        <BaseSelect
          value={selectedIndustry}
          onChange={handleIndustryChange}
          options={industryOptions}
          placeholder={industryOptions.length === 0 ? '请先选择分类或使用搜索' : placeholder}
          disabled={disabled}
          required={required}
        />
      </div>

      {/* 当前选择显示 */}
      {selectedIndustry && (
        <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded border">
          <span className="font-medium">已选择：</span>
          {getSelectedIndustryName()}
        </div>
      )}

      {/* 搜索结果提示 */}
      {searchKeyword && (
        <div className="text-xs text-gray-500">
          找到 {filteredIndustries.length} 个匹配的行业
        </div>
      )}
    </div>
  );
}