import { NextRequest, NextResponse } from 'next/server';

/**
 * 标准化API响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

/**
 * 产品接口
 */
interface Product {
  id: number;
  name: string;
  category: string;
  brand: string;
  sku: string;
  price: number;
  description: string;
  imageUrl: string;
  isActive: boolean;
  stockQuantity: number;
  unit: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  traceability: {
    origin: string;
    farmLocation: string;
    harvestDate: string;
    certifications: string[];
  };
}

/**
 * 分页响应接口
 */
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    category?: string;
    brand?: string;
    priceRange?: [number, number];
    inStock?: boolean;
    searchQuery?: string;
  };
}

/**
 * 创建标准化响应
 */
function createResponse<T>(
  data: T,
  success: boolean = true,
  message?: string,
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success,
    data,
    message,
    code: status,
  };

  return NextResponse.json(response, { status });
}

/**
 * 模拟响应延迟
 */
async function simulateDelay(): Promise<void> {
  const delay = parseInt(process.env.NEXT_PUBLIC_MOCK_DELAY || '300');
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Mock产品数据
 */
const mockProducts: Product[] = [
  {
    id: 1,
    name: '有机苹果',
    category: '水果',
    brand: '绿源农场',
    sku: 'APPLE-ORG-001',
    price: 12.8,
    description: '来自山东烟台的有机苹果，口感甜脆，营养丰富',
    imageUrl: '/images/products/apple-organic.jpg',
    isActive: true,
    stockQuantity: 150,
    unit: '斤',
    tags: ['有机', '新鲜', '当季'],
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    traceability: {
      origin: '山东烟台',
      farmLocation: '烟台市福山区绿源有机农场',
      harvestDate: '2024-01-08',
      certifications: ['有机认证', 'ISO9001', '绿色食品'],
    },
  },
  {
    id: 2,
    name: '黑猪肉',
    category: '肉类',
    brand: '黑土地牧场',
    sku: 'PORK-BLK-002',
    price: 68.0,
    description: '散养黑猪肉，肉质鲜美，无添加激素',
    imageUrl: '/images/products/pork-black.jpg',
    isActive: true,
    stockQuantity: 80,
    unit: '斤',
    tags: ['散养', '无添加', '优质蛋白'],
    createdAt: '2024-01-12T09:15:00Z',
    updatedAt: '2024-01-15T11:45:00Z',
    traceability: {
      origin: '黑龙江哈尔滨',
      farmLocation: '哈尔滨市双城区黑土地牧场',
      harvestDate: '2024-01-10',
      certifications: ['无公害农产品', '动物福利认证'],
    },
  },
  {
    id: 3,
    name: '有机大米',
    category: '谷物',
    brand: '稻香村',
    sku: 'RICE-ORG-003',
    price: 24.5,
    description: '东北有机大米，颗粒饱满，香味浓郁',
    imageUrl: '/images/products/rice-organic.jpg',
    isActive: true,
    stockQuantity: 200,
    unit: '袋(5斤)',
    tags: ['有机', '东北大米', '香甜'],
    createdAt: '2024-01-08T07:30:00Z',
    updatedAt: '2024-01-14T16:20:00Z',
    traceability: {
      origin: '黑龙江五常',
      farmLocation: '五常市稻香村有机农场',
      harvestDate: '2023-10-15',
      certifications: ['有机认证', '地理标志保护产品'],
    },
  },
  {
    id: 4,
    name: '草莓',
    category: '水果',
    brand: '春田农庄',
    sku: 'STRAWBERRY-004',
    price: 35.0,
    description: '温室种植草莓，甜度高，果香浓郁',
    imageUrl: '/images/products/strawberry-fresh.jpg',
    isActive: true,
    stockQuantity: 45,
    unit: '盒(500g)',
    tags: ['温室种植', '高甜度', '新鲜'],
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-15T09:30:00Z',
    traceability: {
      origin: '北京大兴',
      farmLocation: '大兴区春田温室农庄',
      harvestDate: '2024-01-13',
      certifications: ['绿色食品', '无公害农产品'],
    },
  },
  {
    id: 5,
    name: '土鸡蛋',
    category: '蛋类',
    brand: '农家乐',
    sku: 'EGG-FREE-005',
    price: 18.0,
    description: '散养土鸡蛋，蛋黄金黄，营养价值高',
    imageUrl: '/images/products/eggs-free-range.jpg',
    isActive: false, // 暂时缺货
    stockQuantity: 0,
    unit: '盒(30枚)',
    tags: ['散养', '土鸡蛋', '高营养'],
    createdAt: '2024-01-09T08:45:00Z',
    updatedAt: '2024-01-15T14:00:00Z',
    traceability: {
      origin: '河北承德',
      farmLocation: '承德市滦平县农家乐养殖场',
      harvestDate: '2024-01-12',
      certifications: ['无公害农产品'],
    },
  },
];

/**
 * 获取产品列表 API
 * GET /api/products
 */
export async function GET(request: NextRequest) {
  try {
    // 模拟网络延迟
    await simulateDelay();

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100); // 最大100条
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const inStock = searchParams.get('inStock') === 'true';
    const searchQuery = searchParams.get('search');

    // 验证分页参数
    if (page < 1 || pageSize < 1) {
      return createResponse(
        null,
        false,
        '分页参数无效',
        400
      );
    }

    // 过滤产品数据
    let filteredProducts = mockProducts;

    // 分类筛选
    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    // 品牌筛选
    if (brand) {
      filteredProducts = filteredProducts.filter(p => 
        p.brand.toLowerCase().includes(brand.toLowerCase())
      );
    }

    // 价格范围筛选
    if (minPrice !== undefined) {
      filteredProducts = filteredProducts.filter(p => p.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(p => p.price <= maxPrice);
    }

    // 库存状态筛选
    if (inStock) {
      filteredProducts = filteredProducts.filter(p => p.isActive && p.stockQuantity > 0);
    }

    // 搜索查询
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 计算分页
    const total = filteredProducts.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    // 构建响应
    const response: PaginatedResponse<Product> = {
      items: paginatedProducts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        category: category || undefined,
        brand: brand || undefined,
        priceRange: (minPrice !== undefined || maxPrice !== undefined) ? [minPrice || 0, maxPrice || Infinity] : undefined,
        inStock: inStock || undefined,
        searchQuery: searchQuery || undefined,
      },
    };

    console.log(`📦 产品列表查询: ${paginatedProducts.length}/${total} 条记录, 第${page}页`);

    return createResponse(
      response,
      true,
      `成功获取 ${paginatedProducts.length} 个产品`
    );

  } catch (error) {
    console.error('产品列表API错误:', error);
    
    return createResponse(
      null,
      false,
      '服务器内部错误',
      500
    );
  }
}

/**
 * 处理OPTIONS请求 (CORS预检)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 