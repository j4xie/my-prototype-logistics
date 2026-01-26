package com.joolun.weixin.config;

import com.joolun.weixin.interceptor.ThirdSessionInterceptor;
import lombok.AllArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * web配置
 */
@Configuration
@AllArgsConstructor
public class WebConfig implements WebMvcConfigurer {
	private final RedisTemplate redisTemplate;

	/**
	 * 拦截器
	 * @param registry
	 */
	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		/**
		 * 进入ThirdSession拦截器
		 */
		registry.addInterceptor(new ThirdSessionInterceptor(redisTemplate))
				.addPathPatterns("/weixin/api/**")//拦截/api/**接口
				.excludePathPatterns("/weixin/api/ma/wxuser/login",
						"/weixin/api/ma/wxuser/phone-login",  // 新增: 放行手机号一键登录
						"/weixin/api/ma/orderinfo/notify-order",
						"/weixin/api/ma/orderinfo/notify-logisticsr",
						"/weixin/api/ma/orderinfo/notify-refunds",
						"/weixin/api/ma/ai/health",
						"/weixin/api/ma/ai/config",
						"/weixin/api/ma/ai/feature-config",
						"/weixin/api/ma/decoration/**",
						"/weixin/api/ma/goodscategory/**",   // 放行商品分类
						"/weixin/api/ma/goodsspu/**");//放行接口 - 登录、回调通知、健康检查、AI配置、装修配置、商品分类、商品列表
	}
}
