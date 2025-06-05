/**
 * 物流模块Mock数据管理
 * 支持仓库管理、运输订单、车辆管理、司机管理、库存追踪
 */

export interface MockWarehouse {
  id: string
  name: string
  code: string
  type: 'main' | 'distribution' | 'temporary' | 'cold-storage'
  address: string
  city: string
  province: string
  postcode: string
  coordinates: {
    latitude: number
    longitude: number
  }
  capacity: {
    total: number // 总容量(m³)
    used: number  // 已用容量(m³)
    available: number // 可用容量(m³)
  }
  zones: {
    zoneId: string
    zoneName: string
    type: 'receiving' | 'storage' | 'picking' | 'shipping'
    capacity: number
    currentStock: number
  }[]
  facilities: string[] // 设施设备
  status: 'active' | 'maintenance' | 'suspended'
  manager: string
  contactPhone: string
  operatingHours: {
    start: string
    end: string
    timezone: string
  }
  createdAt: string
  updatedAt: string
}

export interface MockTransportOrder {
  id: string
  orderNumber: string
  type: 'inbound' | 'outbound' | 'transfer' | 'return'
  status: 'pending' | 'confirmed' | 'in-transit' | 'delivered' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  customer: {
    id: string
    name: string
    contact: string
    phone: string
  }
  origin: {
    warehouseId: string
    warehouseName: string
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  destination: {
    warehouseId?: string
    warehouseName?: string
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  cargo: {
    productId: string
    productName: string
    quantity: number
    weight: number // kg
    volume: number // m³
    value: number
    specialRequirements?: string[]
  }[]
  vehicle: {
    vehicleId: string
    vehicleNumber: string
    type: string
    driverId: string
    driverName: string
  }
  schedule: {
    plannedPickupTime: string
    actualPickupTime?: string
    plannedDeliveryTime: string
    actualDeliveryTime?: string
    estimatedDuration: number // 小时
  }
  route: {
    distance: number // km
    estimatedTime: number // 分钟
    tollFees: number
    fuelCost: number
    waypoints?: string[]
  }
  documents: {
    type: string
    number: string
    issueDate: string
    expiryDate?: string
  }[]
  tracking: {
    currentLocation?: {
      latitude: number
      longitude: number
      timestamp: string
      status: string
    }
    updates: {
      timestamp: string
      status: string
      location: string
      notes?: string
    }[]
  }
  costs: {
    transportation: number
    fuel: number
    tolls: number
    labor: number
    insurance: number
    total: number
  }
  createdAt: string
  updatedAt: string
}

export interface MockVehicle {
  id: string
  vehicleNumber: string
  type: 'truck' | 'van' | 'trailer' | 'refrigerated'
  brand: string
  model: string
  year: number
  capacity: {
    weight: number // kg
    volume: number // m³
    pallets: number
  }
  specifications: {
    length: number // m
    width: number // m
    height: number // m
    fuelType: 'diesel' | 'gasoline' | 'electric' | 'hybrid'
    fuelCapacity: number // L
  }
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-service'
  currentLocation?: {
    latitude: number
    longitude: number
    address: string
    timestamp: string
  }
  assignedDriver?: {
    driverId: string
    driverName: string
    assignedAt: string
  }
  maintenance: {
    lastService: string
    nextService: string
    mileage: number
    fuelEfficiency: number // km/L
    maintenanceRecords: {
      date: string
      type: string
      description: string
      cost: number
      serviceProvider: string
    }[]
  }
  insurance: {
    policyNumber: string
    provider: string
    coverage: number
    expiryDate: string
  }
  gps: {
    deviceId: string
    lastUpdate: string
    batteryLevel: number
    signal: 'excellent' | 'good' | 'poor' | 'no-signal'
  }
  createdAt: string
  updatedAt: string
}

export interface MockDriver {
  id: string
  employeeId: string
  name: string
  phone: string
  email: string
  status: 'active' | 'on-duty' | 'off-duty' | 'on-leave' | 'suspended'
  license: {
    number: string
    class: string
    expiryDate: string
    endorsements: string[]
  }
  experience: {
    years: number
    totalDistance: number // km
    deliveries: number
    rating: number // 1-5
  }
  currentAssignment?: {
    vehicleId: string
    vehicleNumber: string
    orderId: string
    orderNumber: string
    status: string
    assignedAt: string
  }
  schedule: {
    shiftStart: string
    shiftEnd: string
    workDays: string[]
    hoursWorkedThisWeek: number
    overtimeHours: number
  }
  performance: {
    onTimeDeliveries: number
    totalDeliveries: number
    fuelEfficiency: number
    safetyScore: number // 1-100
    customerRating: number // 1-5
  }
  certifications: {
    type: string
    issueDate: string
    expiryDate: string
    authority: string
  }[]
  emergencyContact: {
    name: string
    relationship: string
    phone: string
  }
  createdAt: string
  updatedAt: string
}

export interface MockInventoryItem {
  id: string
  productId: string
  productName: string
  sku: string
  category: string
  warehouseId: string
  warehouseName: string
  location: {
    zone: string
    aisle: string
    shelf: string
    position: string
  }
  quantity: {
    available: number
    reserved: number
    inTransit: number
    damaged: number
    total: number
  }
  unit: string
  batch: {
    batchNumber: string
    productionDate: string
    expiryDate: string
    supplier: string
  }
  valuation: {
    unitCost: number
    totalValue: number
    currency: string
  }
  movements: {
    date: string
    type: 'inbound' | 'outbound' | 'transfer' | 'adjustment'
    quantity: number
    reference: string
    operator: string
    notes?: string
  }[]
  alerts: {
    lowStock: boolean
    nearExpiry: boolean
    overstock: boolean
    damaged: boolean
  }
  lastUpdated: string
  createdAt: string
}

export interface LogisticsQuery {
  page?: number
  pageSize?: number
  search?: string
  type?: string
  status?: string
  warehouseId?: string
  driverId?: string
  vehicleId?: string
  priority?: string
  dateFrom?: string
  dateTo?: string
  city?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Mock仓库数据
 */
export const mockWarehouses: Record<string, MockWarehouse> = {
  'wh_001': {
    id: 'wh_001',
    name: '北京中央仓库',
    code: 'BJ-CENTRAL-01',
    type: 'main',
    address: '北京市朝阳区物流园区A区1号',
    city: '北京',
    province: '北京市',
    postcode: '100020',
    coordinates: {
      latitude: 39.9042,
      longitude: 116.4074
    },
    capacity: {
      total: 50000,
      used: 35000,
      available: 15000
    },
    zones: [
      {
        zoneId: 'A',
        zoneName: '收货区',
        type: 'receiving',
        capacity: 5000,
        currentStock: 3200
      },
      {
        zoneId: 'B',
        zoneName: '存储区',
        type: 'storage',
        capacity: 40000,
        currentStock: 28000
      },
      {
        zoneId: 'C',
        zoneName: '拣货区',
        type: 'picking',
        capacity: 3000,
        currentStock: 2500
      },
      {
        zoneId: 'D',
        zoneName: '发货区',
        type: 'shipping',
        capacity: 2000,
        currentStock: 1300
      }
    ],
    facilities: ['自动分拣系统', '立体货架', '叉车', '传送带', '监控系统'],
    status: 'active',
    manager: '王仓管',
    contactPhone: '010-12345678',
    operatingHours: {
      start: '06:00',
      end: '22:00',
      timezone: 'Asia/Shanghai'
    },
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: new Date().toISOString()
  },
  'wh_002': {
    id: 'wh_002',
    name: '上海配送中心',
    code: 'SH-DIST-01',
    type: 'distribution',
    address: '上海市浦东新区临港新城物流园B区',
    city: '上海',
    province: '上海市',
    postcode: '201306',
    coordinates: {
      latitude: 31.2304,
      longitude: 121.4737
    },
    capacity: {
      total: 30000,
      used: 22000,
      available: 8000
    },
    zones: [
      {
        zoneId: 'A',
        zoneName: '收货区',
        type: 'receiving',
        capacity: 3000,
        currentStock: 2100
      },
      {
        zoneId: 'B',
        zoneName: '存储区',
        type: 'storage',
        capacity: 24000,
        currentStock: 18000
      },
      {
        zoneId: 'C',
        zoneName: '发货区',
        type: 'shipping',
        capacity: 3000,
        currentStock: 1900
      }
    ],
    facilities: ['快速分拣线', '温控系统', '安防系统', '装卸平台'],
    status: 'active',
    manager: '李配送',
    contactPhone: '021-87654321',
    operatingHours: {
      start: '05:30',
      end: '23:00',
      timezone: 'Asia/Shanghai'
    },
    createdAt: '2024-02-20T09:00:00Z',
    updatedAt: new Date().toISOString()
  },
  'wh_003': {
    id: 'wh_003',
    name: '深圳冷链仓库',
    code: 'SZ-COLD-01',
    type: 'cold-storage',
    address: '深圳市宝安区物流园C区冷链中心',
    city: '深圳',
    province: '广东省',
    postcode: '518101',
    coordinates: {
      latitude: 22.5431,
      longitude: 114.0579
    },
    capacity: {
      total: 15000,
      used: 12000,
      available: 3000
    },
    zones: [
      {
        zoneId: 'COLD-A',
        zoneName: '冷冻区(-18°C)',
        type: 'storage',
        capacity: 8000,
        currentStock: 6500
      },
      {
        zoneId: 'COLD-B',
        zoneName: '冷藏区(2-8°C)',
        type: 'storage',
        capacity: 7000,
        currentStock: 5500
      }
    ],
    facilities: ['制冷系统', '温控监测', '冷链车装卸台', '温度报警系统'],
    status: 'active',
    manager: '张冷链',
    contactPhone: '0755-11223344',
    operatingHours: {
      start: '24小时',
      end: '24小时',
      timezone: 'Asia/Shanghai'
    },
    createdAt: '2024-03-10T10:00:00Z',
    updatedAt: new Date().toISOString()
  }
}

/**
 * 生成Mock运输订单数据
 */
export function generateMockTransportOrders(count: number = 25): MockTransportOrder[] {
  const orders: MockTransportOrder[] = []
  const types: MockTransportOrder['type'][] = ['inbound', 'outbound', 'transfer', 'return']
  const statuses: MockTransportOrder['status'][] = ['pending', 'confirmed', 'in-transit', 'delivered']
  const priorities: MockTransportOrder['priority'][] = ['normal', 'high', 'urgent', 'low']
  const customers = [
    { id: 'cust_001', name: '大型连锁超市A', contact: '采购经理', phone: '400-1111111' },
    { id: 'cust_002', name: '餐饮集团B', contact: '物流总监', phone: '400-2222222' },
    { id: 'cust_003', name: '食品加工厂C', contact: '供应链经理', phone: '400-3333333' },
    { id: 'cust_004', name: '电商平台D', contact: '仓储负责人', phone: '400-4444444' }
  ]
  const products = [
    { id: 'prod_001', name: '优质饲料', weight: 25, volume: 0.8, value: 625 },
    { id: 'prod_002', name: '有机肥料', weight: 50, volume: 1.2, value: 1200 },
    { id: 'prod_003', name: '营养补充剂', weight: 10, volume: 0.3, value: 450 },
    { id: 'prod_004', name: '宠物食品', weight: 15, volume: 0.5, value: 380 }
  ]

  for (let i = 1; i <= count; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const product = products[Math.floor(Math.random() * products.length)]
    const quantity = Math.floor(Math.random() * 50) + 10
    const distance = Math.floor(Math.random() * 500) + 50
    const estimatedTime = Math.floor(distance / 60 * 60) // 按60km/h估算

    const plannedPickupTime = new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000)
    const plannedDeliveryTime = new Date(plannedPickupTime.getTime() + estimatedTime * 60 * 1000)

    orders.push({
      id: `order_${String(i).padStart(3, '0')}`,
      orderNumber: `TO-2024-${String(i).padStart(4, '0')}`,
      type,
      status,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      customer,
      origin: {
        warehouseId: 'wh_001',
        warehouseName: '北京中央仓库',
        address: '北京市朝阳区物流园区A区1号',
        coordinates: { latitude: 39.9042, longitude: 116.4074 }
      },
      destination: {
        warehouseId: type === 'transfer' ? 'wh_002' : undefined,
        warehouseName: type === 'transfer' ? '上海配送中心' : undefined,
        address: type === 'transfer' ? '上海市浦东新区临港新城物流园B区' : `${customer.name}收货地址`,
        coordinates: {
          latitude: 31.2304 + (Math.random() - 0.5) * 10,
          longitude: 121.4737 + (Math.random() - 0.5) * 10
        }
      },
      cargo: [{
        productId: product.id,
        productName: product.name,
        quantity,
        weight: product.weight * quantity,
        volume: product.volume * quantity,
        value: product.value * quantity,
        specialRequirements: Math.random() > 0.7 ? ['易碎', '防潮'] : undefined
      }],
      vehicle: {
        vehicleId: `vehicle_${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`,
        vehicleNumber: `京A${String(Math.floor(Math.random() * 90000) + 10000)}`,
        type: '货车',
        driverId: `driver_${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
        driverName: ['张师傅', '李司机', '王师傅', '赵师傅'][Math.floor(Math.random() * 4)]
      },
      schedule: {
        plannedPickupTime: plannedPickupTime.toISOString(),
        actualPickupTime: status !== 'pending' ? plannedPickupTime.toISOString() : undefined,
        plannedDeliveryTime: plannedDeliveryTime.toISOString(),
        actualDeliveryTime: status === 'delivered' ? plannedDeliveryTime.toISOString() : undefined,
        estimatedDuration: Math.floor(estimatedTime / 60)
      },
      route: {
        distance,
        estimatedTime,
        tollFees: Math.floor(distance * 0.5),
        fuelCost: Math.floor(distance * 0.8),
        waypoints: Math.random() > 0.5 ? ['服务区A', '收费站B'] : undefined
      },
      documents: [
        {
          type: '运输合同',
          number: `CT-2024-${String(i).padStart(4, '0')}`,
          issueDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ],
      tracking: {
        currentLocation: status === 'in-transit' ? {
          latitude: 39.9042 + Math.random() * 2,
          longitude: 116.4074 + Math.random() * 2,
          timestamp: new Date().toISOString(),
          status: '运输中'
        } : undefined,
        updates: [
          {
            timestamp: plannedPickupTime.toISOString(),
            status: '已取货',
            location: '北京中央仓库',
            notes: '货物状态良好'
          }
        ]
      },
      costs: {
        transportation: Math.floor(distance * 2),
        fuel: Math.floor(distance * 0.8),
        tolls: Math.floor(distance * 0.5),
        labor: Math.floor(estimatedTime / 60 * 50),
        insurance: Math.floor(product.value * quantity * 0.001),
        total: 0
      },
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })

    // 计算总成本
    const order = orders[orders.length - 1]
    order.costs.total = order.costs.transportation + order.costs.fuel + order.costs.tolls + order.costs.labor + order.costs.insurance
  }

  return orders
}

/**
 * 生成Mock车辆数据
 */
export function generateMockVehicles(count: number = 10): MockVehicle[] {
  const vehicles: MockVehicle[] = []
  const types: MockVehicle['type'][] = ['truck', 'van', 'trailer', 'refrigerated']
  const brands = ['东风', '解放', '重汽', '陕汽', '福田']
  const statuses: MockVehicle['status'][] = ['available', 'in-use', 'maintenance']

  for (let i = 1; i <= count; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    const brand = brands[Math.floor(Math.random() * brands.length)]

    vehicles.push({
      id: `vehicle_${String(i).padStart(3, '0')}`,
      vehicleNumber: `京A${String(Math.floor(Math.random() * 90000) + 10000)}`,
      type,
      brand,
      model: `${brand}${type === 'truck' ? '货车' : type === 'van' ? '厢货' : type === 'trailer' ? '挂车' : '冷藏车'}`,
      year: 2020 + Math.floor(Math.random() * 4),
      capacity: {
        weight: type === 'trailer' ? 40000 : type === 'truck' ? 20000 : 5000,
        volume: type === 'trailer' ? 80 : type === 'truck' ? 40 : 15,
        pallets: type === 'trailer' ? 32 : type === 'truck' ? 16 : 6
      },
      specifications: {
        length: type === 'trailer' ? 16.5 : type === 'truck' ? 9.6 : 5.2,
        width: 2.5,
        height: type === 'van' ? 2.2 : 2.8,
        fuelType: type === 'refrigerated' ? 'diesel' : Math.random() > 0.8 ? 'electric' : 'diesel',
        fuelCapacity: type === 'trailer' ? 400 : type === 'truck' ? 200 : 80
      },
      status: statuses[Math.floor(Math.random() * statuses.length)],
      currentLocation: {
        latitude: 39.9042 + (Math.random() - 0.5) * 0.5,
        longitude: 116.4074 + (Math.random() - 0.5) * 0.5,
        address: `北京市朝阳区某某街道${Math.floor(Math.random() * 100)}号`,
        timestamp: new Date().toISOString()
      },
      assignedDriver: Math.random() > 0.3 ? {
        driverId: `driver_${String(Math.floor(Math.random() * 15) + 1).padStart(3, '0')}`,
        driverName: ['张师傅', '李司机', '王师傅', '赵师傅'][Math.floor(Math.random() * 4)],
        assignedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      } : undefined,
      maintenance: {
        lastService: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        nextService: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        mileage: Math.floor(Math.random() * 200000) + 50000,
        fuelEfficiency: Math.floor(Math.random() * 5) + 8,
        maintenanceRecords: [
          {
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            type: '定期保养',
            description: '更换机油、三滤，检查制动系统',
            cost: 1200,
            serviceProvider: '专业汽修厂'
          }
        ]
      },
      insurance: {
        policyNumber: `INS-2024-${String(i).padStart(4, '0')}`,
        provider: '中国人保',
        coverage: 500000,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      gps: {
        deviceId: `GPS-${String(i).padStart(6, '0')}`,
        lastUpdate: new Date().toISOString(),
        batteryLevel: Math.floor(Math.random() * 40) + 60,
        signal: ['excellent', 'good', 'poor'][Math.floor(Math.random() * 3)] as any
      },
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return vehicles
}

/**
 * 生成Mock司机数据
 */
export function generateMockDrivers(count: number = 15): MockDriver[] {
  const drivers: MockDriver[] = []
  const names = ['张师傅', '李司机', '王师傅', '赵师傅', '刘师傅', '陈司机', '杨师傅', '周司机', '吴师傅', '徐司机', '孙师傅', '马司机', '朱师傅', '胡司机', '郭师傅']
  const statuses: MockDriver['status'][] = ['active', 'on-duty', 'off-duty', 'on-leave']

  for (let i = 1; i <= count; i++) {
    const name = names[i - 1] || `司机${i}`
    const yearsExperience = Math.floor(Math.random() * 15) + 3

    drivers.push({
      id: `driver_${String(i).padStart(3, '0')}`,
      employeeId: `EMP-D-${String(i).padStart(4, '0')}`,
      name,
      phone: `138${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
      email: `${name.replace('师傅', '').replace('司机', '')}@company.com`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      license: {
        number: `1101${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
        class: Math.random() > 0.5 ? 'A2' : 'B2',
        expiryDate: new Date(Date.now() + (6 - Math.random() * 2) * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endorsements: ['危险品运输', '客运']
      },
      experience: {
        years: yearsExperience,
        totalDistance: yearsExperience * 80000 + Math.floor(Math.random() * 50000),
        deliveries: yearsExperience * 500 + Math.floor(Math.random() * 200),
        rating: Math.floor(Math.random() * 2) + 4 // 4-5星
      },
      currentAssignment: Math.random() > 0.4 ? {
        vehicleId: `vehicle_${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`,
        vehicleNumber: `京A${String(Math.floor(Math.random() * 90000) + 10000)}`,
        orderId: `order_${String(Math.floor(Math.random() * 25) + 1).padStart(3, '0')}`,
        orderNumber: `TO-2024-${String(Math.floor(Math.random() * 25) + 1).padStart(4, '0')}`,
        status: 'in-transit',
        assignedAt: new Date(Date.now() - Math.random() * 8 * 60 * 60 * 1000).toISOString()
      } : undefined,
      schedule: {
        shiftStart: '08:00',
        shiftEnd: '18:00',
        workDays: ['周一', '周二', '周三', '周四', '周五'],
        hoursWorkedThisWeek: Math.floor(Math.random() * 20) + 35,
        overtimeHours: Math.floor(Math.random() * 10)
      },
      performance: {
        onTimeDeliveries: Math.floor(Math.random() * 100) + 150,
        totalDeliveries: Math.floor(Math.random() * 120) + 160,
        fuelEfficiency: Math.floor(Math.random() * 3) + 85, // 85-87%
        safetyScore: Math.floor(Math.random() * 10) + 90, // 90-100
        customerRating: Math.floor(Math.random() * 10) / 10 + 4.0 // 4.0-4.9
      },
      certifications: [
        {
          type: '安全驾驶培训',
          issueDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          authority: '交通运输部'
        }
      ],
      emergencyContact: {
        name: `${name}家属`,
        relationship: '配偶',
        phone: `139${String(Math.floor(Math.random() * 90000000) + 10000000)}`
      },
      createdAt: new Date(Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  return drivers
}

// 预生成数据实例
export const mockTransportOrders = generateMockTransportOrders()
export const mockVehicles = generateMockVehicles()
export const mockDrivers = generateMockDrivers()

/**
 * 数据获取函数
 */
export function getWarehousesList(query: LogisticsQuery = {}) {
  let warehouses = Object.values(mockWarehouses)

  if (query.search) {
    warehouses = warehouses.filter(warehouse =>
      warehouse.name.includes(query.search!) ||
      warehouse.code.includes(query.search!) ||
      warehouse.city.includes(query.search!)
    )
  }

  if (query.type) {
    warehouses = warehouses.filter(warehouse => warehouse.type === query.type)
  }

  if (query.status) {
    warehouses = warehouses.filter(warehouse => warehouse.status === query.status)
  }

  if (query.city) {
    warehouses = warehouses.filter(warehouse => warehouse.city === query.city)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = warehouses.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    warehouses: warehouses.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getTransportOrdersList(query: LogisticsQuery = {}) {
  let orders = mockTransportOrders

  if (query.search) {
    orders = orders.filter(order =>
      order.orderNumber.includes(query.search!) ||
      order.customer.name.includes(query.search!) ||
      order.vehicle.driverName.includes(query.search!)
    )
  }

  if (query.type) {
    orders = orders.filter(order => order.type === query.type)
  }

  if (query.status) {
    orders = orders.filter(order => order.status === query.status)
  }

  if (query.priority) {
    orders = orders.filter(order => order.priority === query.priority)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = orders.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    orders: orders.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getVehiclesList(query: LogisticsQuery = {}) {
  let vehicles = mockVehicles

  if (query.search) {
    vehicles = vehicles.filter(vehicle =>
      vehicle.vehicleNumber.includes(query.search!) ||
      vehicle.brand.includes(query.search!) ||
      vehicle.assignedDriver?.driverName.includes(query.search!)
    )
  }

  if (query.type) {
    vehicles = vehicles.filter(vehicle => vehicle.type === query.type)
  }

  if (query.status) {
    vehicles = vehicles.filter(vehicle => vehicle.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = vehicles.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    vehicles: vehicles.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getDriversList(query: LogisticsQuery = {}) {
  let drivers = mockDrivers

  if (query.search) {
    drivers = drivers.filter(driver =>
      driver.name.includes(query.search!) ||
      driver.employeeId.includes(query.search!) ||
      driver.phone.includes(query.search!)
    )
  }

  if (query.status) {
    drivers = drivers.filter(driver => driver.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = drivers.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    drivers: drivers.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

/**
 * 物流模块统计数据
 */
export function getLogisticsOverviewStats() {
  const totalOrders = mockTransportOrders.length
  const pendingOrders = mockTransportOrders.filter(o => o.status === 'pending').length
  const inTransitOrders = mockTransportOrders.filter(o => o.status === 'in-transit').length
  const deliveredOrders = mockTransportOrders.filter(o => o.status === 'delivered').length
  const totalVehicles = mockVehicles.length
  const availableVehicles = mockVehicles.filter(v => v.status === 'available').length
  const inUseVehicles = mockVehicles.filter(v => v.status === 'in-use').length
  const totalDrivers = mockDrivers.length
  const activeDrivers = mockDrivers.filter(d => d.status === 'active' || d.status === 'on-duty').length
  const totalWarehouses = Object.keys(mockWarehouses).length

  const totalCapacity = Object.values(mockWarehouses).reduce((sum, w) => sum + w.capacity.total, 0)
  const usedCapacity = Object.values(mockWarehouses).reduce((sum, w) => sum + w.capacity.used, 0)
  const utilizationRate = Math.round((usedCapacity / totalCapacity) * 100)

  const totalRevenue = mockTransportOrders.reduce((sum, o) => sum + o.costs.total, 0)
  const avgDeliveryTime = Math.round(mockTransportOrders.reduce((sum, o) => sum + o.route.estimatedTime, 0) / totalOrders / 60)

  return {
    totalOrders,
    pendingOrders,
    inTransitOrders,
    deliveredOrders,
    deliveryRate: Math.round((deliveredOrders / totalOrders) * 100),
    totalVehicles,
    availableVehicles,
    inUseVehicles,
    vehicleUtilization: Math.round((inUseVehicles / totalVehicles) * 100),
    totalDrivers,
    activeDrivers,
    driverUtilization: Math.round((activeDrivers / totalDrivers) * 100),
    totalWarehouses,
    totalCapacity,
    usedCapacity,
    utilizationRate,
    totalRevenue,
    avgDeliveryTime,
    efficiency: Math.round(((deliveredOrders + inTransitOrders) / totalOrders) * 100)
  }
}
