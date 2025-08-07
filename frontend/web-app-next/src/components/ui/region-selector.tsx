'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-compat';
import { provinces, getCitiesByProvince, getDistrictsByCity, type Province, type City, type District } from '@/data/regions';

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
 * 省市区三级联动选择器组件
 * 支持省份、城市、区县的级联选择
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

  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  // 当省份改变时，更新城市列表
  useEffect(() => {
    if (selectedProvince) {
      const provinceCities = getCitiesByProvince(selectedProvince);
      setCities(provinceCities);

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
      setDistricts(cityDistricts);

      // 清空区县选择
      setSelectedDistrict('');
    } else {
      setDistricts([]);
    }
  }, [selectedCity]);

  // 当外部值改变时，同步内部状态
  useEffect(() => {
    if (value) {
      setSelectedProvince(value.province || '');
      setSelectedCity(value.city || '');
      setSelectedDistrict(value.district || '');
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
      const city = cities.find(c => c.code === cityCode);

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
      const city = cities.find(c => c.code === selectedCity);
      const district = districts.find(d => d.code === districtCode);

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

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
      {/* 省份选择 */}
      <div className="space-y-1">
        <Select
          value={selectedProvince}
          onValueChange={handleProvinceChange}
          disabled={disabled}
          required={required}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder.province} />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((province) => (
              <SelectItem key={province.code} value={province.code}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 城市选择 */}
      <div className="space-y-1">
        <Select
          value={selectedCity}
          onValueChange={handleCityChange}
          disabled={disabled || !selectedProvince || cities.length === 0}
          required={required}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder.city} />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city.code} value={city.code}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 区县选择 */}
      <div className="space-y-1">
        <Select
          value={selectedDistrict}
          onValueChange={handleDistrictChange}
          disabled={disabled || !selectedCity || districts.length === 0}
          required={required}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder.district} />
          </SelectTrigger>
          <SelectContent>
            {districts.map((district) => (
              <SelectItem key={district.code} value={district.code}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
