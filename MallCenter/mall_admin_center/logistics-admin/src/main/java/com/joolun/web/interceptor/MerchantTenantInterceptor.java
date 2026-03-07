package com.joolun.web.interceptor;

import com.joolun.framework.tenant.MerchantContextHolder;
import com.joolun.web.utils.MerchantUserHelper;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.AsyncHandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 商户租户拦截器
 * 在 ThirdSessionInterceptor 之后运行，将当前用户的 merchantId 注入 MerchantContextHolder
 * 供 TenantLineInnerInterceptor 自动追加 WHERE merchant_id = ? 条件
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MerchantTenantInterceptor implements AsyncHandlerInterceptor {

    private final WxUserService wxUserService;
    private final MerchantUserHelper merchantUserHelper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 尝试从 ThirdSession 获取 merchantId
        ThirdSession session = ThirdSessionHolder.getThirdSession();
        if (session != null && session.getWxUserId() != null) {
            try {
                WxUser wxUser = wxUserService.getById(session.getWxUserId());
                if (wxUser != null) {
                    Long merchantId = merchantUserHelper.getMerchantIdFromUser(wxUser);
                    if (merchantId != null) {
                        MerchantContextHolder.setMerchantId(merchantId);
                    }
                }
            } catch (Exception e) {
                log.warn("解析租户ID失败: wxUserId={}", session.getWxUserId(), e);
            }
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // 请求结束后清理 ThreadLocal，防止线程复用时数据泄露
        MerchantContextHolder.clear();
    }
}
