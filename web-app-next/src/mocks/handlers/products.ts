import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'

/**
 * 产品模块 MSW Handlers
 * 解决P0问题：业务API缺失 /api/products → 405
 *
 * 基于TASK-P3-018B契约修复
 */

// 模拟产品数据
const mockProducts = [
  {
    id: 'prod_001',
    name: '有机大米',
    category: 'grains',
    price: 25.50,
    unit: 'kg',
    stock: 150,
    description: '东北优质有机大米，无农药残留',
    origin: '黑龙江省',
    status: 'active',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-12-01T10:30:00Z'
  },
  {
    id: 'prod_002',
    name: '草饲牛肉',
    category: 'meat',
    price: 88.00,
    unit: 'kg',
    stock: 45,
    description: '草原散养牛肉，肉质鲜美',
    origin: '内蒙古',
    status: 'active',
    createdAt: '2024-02-20T09:15:00Z',
    updatedAt: '2024-12-01T14:20:00Z'
  },
  {
    id: 'prod_003',
    name: '有机蔬菜礼盒',
    category: 'vegetables',
    price: 45.00,
    unit: 'box',
    stock: 80,
    description: '季节性有机蔬菜组合装',
    origin: '山东寿光',
    status: 'active',
    createdAt: '2024-03-10T07:30:00Z',
    updatedAt: '2024-12-01T16:45:00Z'
  }
]

// 模拟数据库存储（内存中）
const productsDatabase = [...mockProducts]
let nextProductId = 4

export const productsHandlers = [
  // GET /api/products - 获取产品列表
  http.get('*/api/products', async ({ request }) => {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const url = new URL(request.url)
      const page = parseInt(url.searchParams.get('page') || '1')
      const pageSize = parseInt(url.searchParams.get('pageSize') || '10')
      const category = url.searchParams.get('category')
      const status = url.searchParams.get('status') || 'active'

      // 过滤数据
      let filteredProducts = productsDatabase.filter(product => product.status === status)

      if (category) {
        filteredProducts = filteredProducts.filter(product => product.category === category)
      }

      // 分页处理
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

      console.log(`✅ Products API: Retrieved ${paginatedProducts.length} products (page ${page})`)

      return HttpResponse.json(wrapResponse(
        {
          products: paginatedProducts,
          pagination: {
            page,
            pageSize,
            total: filteredProducts.length,
            totalPages: Math.ceil(filteredProducts.length / pageSize)
          }
        },
        '产品列表获取成功'
      ))

    } catch (error) {
      console.error('Products GET error:', error)
      return HttpResponse.json(
        wrapError('产品列表获取失败', 500),
        { status: 500 }
      )
    }
  }),

  // POST /api/products - 创建新产品
  http.post('*/api/products', async ({ request }) => {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))

      const body = await request.json() as {
        name: string
        category: string
        price: number
        unit: string
        stock: number
        description?: string
        origin?: string
      }

      // 验证必填字段
      const { name, category, price, unit, stock } = body
      if (!name || !category || typeof price !== 'number' || !unit || typeof stock !== 'number') {
        return HttpResponse.json(
          wrapError('缺少必填字段或字段类型错误', 400),
          { status: 400 }
        )
      }

      // 检查产品名称是否已存在
      const existingProduct = productsDatabase.find(p => p.name === name && p.status === 'active')
      if (existingProduct) {
        return HttpResponse.json(
          wrapError('产品名称已存在', 409),
          { status: 409 }
        )
      }

      // 创建新产品
      const newProduct = {
        id: `prod_${String(nextProductId++).padStart(3, '0')}`,
        name,
        category,
        price,
        unit,
        stock,
        description: body.description || '',
        origin: body.origin || '',
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // 添加到数据库
      productsDatabase.push(newProduct)

      console.log(`✅ Products API: Created new product ${newProduct.id} - ${newProduct.name}`)

      return HttpResponse.json(
        wrapResponse(newProduct, '产品创建成功'),
        { status: 201 }
      )

    } catch (error) {
      console.error('Products POST error:', error)
      return HttpResponse.json(
        wrapError('产品创建失败', 500),
        { status: 500 }
      )
    }
  }),

  // PUT /api/products/:id - 更新产品信息
  http.put('/api/products/:id', async ({ params, request }) => {
    try {
      const { id } = params
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 150))

      const productIndex = productsDatabase.findIndex(p => p.id === id && p.status === 'active')
      if (productIndex === -1) {
        return HttpResponse.json(
          wrapError('产品不存在', 404),
          { status: 404 }
        )
      }

      const body = await request.json() as Partial<typeof mockProducts[0]>
      const existingProduct = productsDatabase[productIndex]

      // 更新产品
      const updatedProduct = {
        ...existingProduct,
        ...body,
        id: existingProduct.id, // 保持ID不变
        status: existingProduct.status, // 保持状态不变
        createdAt: existingProduct.createdAt, // 保持创建时间不变
        updatedAt: new Date().toISOString()
      }

      productsDatabase[productIndex] = updatedProduct

      console.log(`✅ Products API: Updated product ${id}`)

      return HttpResponse.json(wrapResponse(updatedProduct, '产品更新成功'))

    } catch (error) {
      console.error('Products PUT error:', error)
      return HttpResponse.json(
        wrapError('产品更新失败', 500),
        { status: 500 }
      )
    }
  }),

  // DELETE /api/products/:id - 删除产品（软删除）
  http.delete('/api/products/:id', async ({ params }) => {
    try {
      const { id } = params
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const productIndex = productsDatabase.findIndex(p => p.id === id && p.status === 'active')
      if (productIndex === -1) {
        return HttpResponse.json(
          wrapError('产品不存在', 404),
          { status: 404 }
        )
      }

      // 软删除 - 修改状态而不是删除记录
      productsDatabase[productIndex].status = 'deleted'
      productsDatabase[productIndex].updatedAt = new Date().toISOString()

      console.log(`✅ Products API: Deleted product ${id}`)

      return HttpResponse.json(
        wrapResponse({ deleted: true, id }, '产品删除成功')
      )

    } catch (error) {
      console.error('Products DELETE error:', error)
      return HttpResponse.json(
        wrapError('产品删除失败', 500),
        { status: 500 }
      )
    }
  })
]
