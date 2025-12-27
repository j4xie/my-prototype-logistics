/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 * 注意：
 * 本软件为www.joolun.com开发研制，项目使用请保留此说明
 */
package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.GoodsSpu;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * spu商品
 *
 * @author JL
 * @date 2019-08-12 16:25:10
 */
public interface GoodsSpuMapper extends BaseMapper<GoodsSpu> {

	IPage<GoodsSpu> selectPage1(IPage<GoodsSpu> page, @Param("query") GoodsSpu goodsSpu);

	GoodsSpu selectById1(String id);

	GoodsSpu selectById2(String id);

	GoodsSpu selectById4(String id);

	GoodsSpu selectOneByShoppingCart(String id);

	/**
	 * 获取所有活跃分类（有上架商品的分类）
	 * 用于 Thompson Sampling 探索推荐
	 */
	@Select("SELECT DISTINCT category_first FROM goods_spu WHERE shelf = '1' AND category_first IS NOT NULL")
	List<String> selectDistinctCategories();

}
