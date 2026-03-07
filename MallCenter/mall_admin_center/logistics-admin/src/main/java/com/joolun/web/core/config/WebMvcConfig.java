package com.joolun.web.core.config;

import com.joolun.web.core.resolver.SqlFilterArgumentResolver;
import com.joolun.web.interceptor.MerchantTenantInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * @author
 * @date
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

	private final MerchantTenantInterceptor merchantTenantInterceptor;

	/**
	 * 增加请求参数解析器，对请求中的参数注入SQL
	 * @param argumentResolvers
	 */
	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
		argumentResolvers.add(new SqlFilterArgumentResolver());
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		// 商户租户拦截器: 从 ThirdSession 提取 merchantId → MerchantContextHolder
		// 在 ThirdSessionInterceptor 之后运行（Spring 按注册顺序执行）
		registry.addInterceptor(merchantTenantInterceptor)
				.addPathPatterns("/weixin/api/**");
	}
}
