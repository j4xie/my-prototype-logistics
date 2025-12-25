/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.web.api;

import cn.binarywang.wx.miniapp.bean.WxMaPhoneNumberInfo;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.weixin.config.WxMaConfiguration;
import com.joolun.weixin.entity.LoginMaDTO;
import com.joolun.weixin.entity.ThirdSession;
import com.joolun.weixin.entity.WxOpenDataDTO;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.weixin.utils.ThirdSessionHolder;
import com.joolun.weixin.utils.WxMaUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 微信用户
 *
 * @author www.joolun.com
 * @date 2019-08-25 15:39:39
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/wxuser")
public class WxUserApi {

	private final WxUserService wxUserService;
	/**
	 * 小程序用户登录
	 * @param request
	 * @param loginMaDTO
	 * @return
	 */
	@PostMapping("/login")
	public AjaxResult login(HttpServletRequest request, @RequestBody LoginMaDTO loginMaDTO){
		try {
			WxUser wxUser = wxUserService.loginMa(WxMaUtil.getAppId(request),loginMaDTO.getJsCode());
			return AjaxResult.success(wxUser);
		} catch (Exception e) {
			e.printStackTrace();
			return AjaxResult.error(e.getMessage());
		}
	}

	/**
	 * 获取用户信息
	 * @param
	 * @return
	 */
	@GetMapping
	public AjaxResult get(){
		String id = ThirdSessionHolder.getThirdSession().getWxUserId();
		return AjaxResult.success(wxUserService.getById(id));
	}

	/**
	 * 保存用户信息
	 * @param wxOpenDataDTO
	 * @return
	 */
	@PostMapping
	public AjaxResult saveOrUptateWxUser(@RequestBody WxOpenDataDTO wxOpenDataDTO){
		wxOpenDataDTO.setAppId(ThirdSessionHolder.getThirdSession().getAppId());
		wxOpenDataDTO.setUserId(ThirdSessionHolder.getThirdSession().getWxUserId());
		wxOpenDataDTO.setSessionKey(ThirdSessionHolder.getThirdSession().getSessionKey());
		WxUser wxUser = wxUserService.saveOrUptateWxUser(wxOpenDataDTO);
		return AjaxResult.success(wxUser);
	}

	/**
	 * 微信一键获取手机号登录
	 * 使用微信手机号快速验证组件获取的code来获取手机号
	 * @param request
	 * @param params 包含 code (手机号授权code)
	 * @return 用户信息及手机号
	 */
	@PostMapping("/phone-login")
	public AjaxResult phoneLogin(HttpServletRequest request, @RequestBody Map<String, String> params) {
		try {
			String code = params.get("code");
			if (code == null || code.trim().isEmpty()) {
				return AjaxResult.error("手机号授权code不能为空");
			}

			// 获取当前登录用户的session
			ThirdSession thirdSession = ThirdSessionHolder.getThirdSession();
			if (thirdSession == null) {
				return AjaxResult.error("请先登录微信");
			}

			String appId = thirdSession.getAppId();
			String userId = thirdSession.getWxUserId();

			// 使用微信API获取手机号
			WxMaPhoneNumberInfo phoneInfo = WxMaConfiguration.getMaService(appId)
					.getUserService()
					.getPhoneNoInfo(code);

			if (phoneInfo == null || phoneInfo.getPhoneNumber() == null) {
				return AjaxResult.error("获取手机号失败，请重试");
			}

			String phoneNumber = phoneInfo.getPhoneNumber();

			// 更新用户手机号
			WxUser wxUser = wxUserService.getById(userId);
			if (wxUser != null) {
				wxUser.setPhone(phoneNumber);
				wxUserService.updateById(wxUser);
			}

			// 返回用户信息
			Map<String, Object> result = new HashMap<>();
			result.put("phoneNumber", phoneNumber);
			result.put("purePhoneNumber", phoneInfo.getPurePhoneNumber());
			result.put("countryCode", phoneInfo.getCountryCode());
			result.put("user", wxUser);

			log.info("微信一键登录成功: userId={}, phone={}", userId, phoneNumber);
			return AjaxResult.success(result);

		} catch (Exception e) {
			log.error("微信一键获取手机号失败", e);
			return AjaxResult.error("获取手机号失败: " + e.getMessage());
		}
	}
}
