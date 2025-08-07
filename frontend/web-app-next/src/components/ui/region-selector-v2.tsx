'use client';

import { useState, useEffect } from 'react';
import { Select as BaseSelect } from '@/components/ui/select';
import { provinces, getCitiesByProvince, getDistrictsByCity } from '@/data/regions';

interface RegionSelectorProps {
  value?: {
    province?: string;
    city?: string;
    district?: string;
  };
  onChange?: (value: {
    province: string;
    city: string;
    district: string;
    provinceName: string;
    cityName: string;
    districtName: string;
  }) => void;
  placeholder?: {
    province?: string;
    city?: string;
    district?: string;
  };
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * 省市区三级联动选择器组件 V2 - 使用原始 Select 组件
 */
export default function RegionSelector({
  value,
  onChange,
  placeholder = {
    province: '请选择省份',
    city: '请选择城市',
    district: '请选择区县'
  },
  disabled = false,
  required = false,
  className = ''
}: RegionSelectorProps) {
  const [selectedProvince, setSelectedProvince] = useState<string>(value?.province || '');
  const [selectedCity, setSelectedCity] = useState<string>(value?.city || '');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(value?.district || '');

  const [cities, setCities] = useState<Array<{ value: string; label: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ value: string; label: string }>>([]);

  // 当省份改变时，更新城市列表
  useEffect(() => {
    if (selectedProvince) {
      const provinceCities = getCitiesByProvince(selectedProvince);
      setCities(provinceCities.map(city => ({
        value: city.code,
        label: city.name
      })));

      // 清空城市和区县选择
      setSelectedCity('');
      setSelectedDistrict('');
      setDistricts([]);
    } else {
      setCities([]);
      setDistricts([]);
    }
  }, [selectedProvince]);

  // 当城市改变时，更新区县列表
  useEffect(() => {
    if (selectedCity) {
      const cityDistricts = getDistrictsByCity(selectedCity);
      setDistricts(cityDistricts.map(district => ({
        value: district.code,
        label: district.name
      })));

      // 清空区县选择
      setSelectedDistrict('');
    } else {
      setDistricts([]);
    }
  }, [selectedCity]);

  // 当外部值改变时，同步内部状态
  useEffect(() => {
    if (value) {
      if (value.province !== selectedProvince) {
        setSelectedProvince(value.province || '');
      }
      if (value.city !== selectedCity) {
        setSelectedCity(value.city || '');
      }
      if (value.district !== selectedDistrict) {
        setSelectedDistrict(value.district || '');
      }
    }
  }, [value]);

  // 处理省份选择
  const handleProvinceChange = (provinceCode: string) => {
    setSelectedProvince(provinceCode);

    // 如果有回调，立即调用（此时city和district为空）
    if (onChange) {
      const province = provinces.find(p => p.code === provinceCode);
      if (province) {
        onChange({
          province: provinceCode,
          city: '',
          district: '',
          provinceName: province.name,
          cityName: '',
          districtName: ''
        });
      }
    }
  };

  // 处理城市选择
  const handleCityChange = (cityCode: string) => {
    setSelectedCity(cityCode);

    // 如果有回调，立即调用（此时district为空）
    if (onChange && selectedProvince) {
      const province = provinces.find(p => p.code === selectedProvince);
      const cityList = getCitiesByProvince(selectedProvince);
      const city = cityList.find(c => c.code === cityCode);

      if (province && city) {
        onChange({
          province: selectedProvince,
          city: cityCode,
          district: '',
          provinceName: province.name,
          cityName: city.name,
          districtName: ''
        });
      }
    }
  };

  // 处理区县选择
  const handleDistrictChange = (districtCode: string) => {
    setSelectedDistrict(districtCode);

    // 如果有回调，调用完整的选择结果
    if (onChange && selectedProvince && selectedCity) {
      const province = provinces.find(p => p.code === selectedProvince);
      const cityList = getCitiesByProvince(selectedProvince);
      const city = cityList.find(c => c.code === selectedCity);
      const districtList = getDistrictsByCity(selectedCity);
      const district = districtList.find(d => d.code === districtCode);

      if (province && city && district) {
        onChange({
          province: selectedProvince,
          city: selectedCity,
          district: districtCode,
          provinceName: province.name,
          cityName: city.name,
          districtName: district.name
        });
      }
    }
  };

  // 转换省份数据为选项格式
  const provinceOptions = provinces.map(province => ({
    value: province.code,
    label: province.name
  }));

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      {/* 省份选择 */}
      <div className="space-y-1">
        <BaseSelect
          value={selectedProvince}
          onChange={handleProvinceChange}
          options={provinceOptions}
          placeholder={placeholder.province}
          disabled={disabled}
          required={required}
          className="relative z-10"
        />
      </div>

      {/* 城市选择 */}
      <div className="space-y-1">
        <BaseSelect
          value={selectedCity}
          onChange={handleCityChange}
          options={cities}
          placeholder={placeholder.city}
          disabled={disabled || !selectedProvince || cities.length === 0}
          required={required}
          className="relative z-10"
        />
      </div>

      {/* 区县选择 */}
      <div className="space-y-1">
        <BaseSelect
          value={selectedDistrict}
          onChange={handleDistrictChange}
          options={districts}
          placeholder={placeholder.district}
          disabled={disabled || !selectedCity || districts.length === 0}
          required={required}
          className="relative z-10"
        />
      </div>
    </div>
  );
}