/**
 * 商品阶梯定价 API
 */
import request from '@/utils/request'

// 获取商品的阶梯定价列表
export function listBySpuId(spuId) {
  return request({
    url: '/goods-price-tier/spu/' + spuId,
    method: 'get'
  })
}

// 保存商品的阶梯定价（先删后增）
export function saveTiers(spuId, tiers) {
  return request({
    url: '/goods-price-tier/spu/' + spuId,
    method: 'post',
    data: tiers
  })
}

// 计算指定数量的价格
export function calculatePrice(spuId, quantity) {
  return request({
    url: '/goods-price-tier/calculate',
    method: 'get',
    params: { spuId, quantity }
  })
}

// 删除商品的所有阶梯定价
export function deleteBySpuId(spuId) {
  return request({
    url: '/goods-price-tier/spu/' + spuId,
    method: 'delete'
  })
}
