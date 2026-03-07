package com.joolun.weixin.config;

import cn.binarywang.wx.miniapp.api.WxMaService;
import cn.binarywang.wx.miniapp.api.impl.WxMaServiceImpl;
import cn.binarywang.wx.miniapp.bean.WxMaKefuMessage;
import cn.binarywang.wx.miniapp.bean.WxMaSubscribeMessage;
import cn.binarywang.wx.miniapp.config.impl.WxMaDefaultConfigImpl;
import cn.binarywang.wx.miniapp.message.WxMaMessageHandler;
import cn.binarywang.wx.miniapp.message.WxMaMessageRouter;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import me.chanjar.weixin.common.bean.result.WxMediaUploadResult;
import me.chanjar.weixin.common.error.WxErrorException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 微信小程序配置 — 支持多 AppID 动态注册
 *
 * 初始化时从 yml 加载配置（平台自有小程序）。
 * 商户授权后，通过 registerMaService() 动态注册新的 AppID。
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(WxMaProperties.class)
public class WxMaConfiguration {
	private final WxMaProperties properties;

	private static final Map<String, WxMaMessageRouter> routers = Maps.newHashMap();
	/** 改为 ConcurrentHashMap 支持运行时动态注册 */
	private static final ConcurrentHashMap<String, WxMaService> maServices = new ConcurrentHashMap<>();

	@Autowired
	public WxMaConfiguration(WxMaProperties properties) {
		this.properties = properties;
	}

	/**
	 * 根据 appId 获取 WxMaService
	 * 支持 yml 配置 + 动态注册的 appId
	 */
	public static WxMaService getMaService(String appId) {
		WxMaService wxService = maServices.get(appId);
		if (wxService == null) {
			throw new IllegalArgumentException(String.format("未找到对应appId=[%s]的配置，请核实！", appId));
		}
		return wxService;
	}

	/**
	 * 检查 appId 是否已注册
	 */
	public static boolean hasMaService(String appId) {
		return maServices.containsKey(appId);
	}

	/**
	 * 动态注册新的小程序 AppID（商户授权后调用）
	 * 使用第三方平台模式：不需要 secret，通过 component_access_token 操作
	 */
	public static void registerMaService(String appId, String componentAppId, String componentAccessToken) {
		if (maServices.containsKey(appId)) {
			log.info("AppID={} 已注册，跳过", appId);
			return;
		}

		WxMaDefaultConfigImpl config = new WxMaDefaultConfigImpl();
		config.setAppid(appId);
		// 第三方平台模式下不需要单独的 secret
		// 而是通过 component_access_token 代调用
		config.setSecret("");

		WxMaService service = new WxMaServiceImpl();
		service.setWxMaConfig(config);
		maServices.put(appId, service);

		log.info("动态注册小程序 AppID={}", appId);
	}

	/**
	 * 获取所有已注册的 AppID 列表
	 */
	public static List<String> getAllRegisteredAppIds() {
		return List.copyOf(maServices.keySet());
	}

	public static WxMaMessageRouter getRouter(String appId) {
		return routers.get(appId);
	}

	@PostConstruct
	public void init() {
		List<WxMaProperties.Config> configs = this.properties.getConfigs();
		if (configs == null) {
			log.warn("未配置小程序 AppID，跳过初始化（将依赖动态注册）");
			return;
		}

		configs.forEach(a -> {
			WxMaDefaultConfigImpl config = new WxMaDefaultConfigImpl();
			config.setAppid(a.getAppId());
			config.setSecret(a.getSecret());
			config.setToken(a.getToken());
			config.setAesKey(a.getAesKey());
			config.setMsgDataFormat(a.getMsgDataFormat());

			WxMaService service = new WxMaServiceImpl();
			service.setWxMaConfig(config);
			maServices.put(a.getAppId(), service);
			routers.put(a.getAppId(), this.newRouter(service));
		});

		log.info("从 yml 加载了 {} 个小程序配置: {}", configs.size(),
				configs.stream().map(WxMaProperties.Config::getAppId).collect(Collectors.toList()));
	}

	private WxMaMessageRouter newRouter(WxMaService service) {
		final WxMaMessageRouter router = new WxMaMessageRouter(service);
		router
				.rule().handler(logHandler).next()
				.rule().async(false).content("订阅消息").handler(subscribeMsgHandler).end()
				.rule().async(false).content("文本").handler(textHandler).end()
				.rule().async(false).content("图片").handler(picHandler).end()
				.rule().async(false).content("二维码").handler(qrcodeHandler).end();
		return router;
	}

	private final WxMaMessageHandler subscribeMsgHandler = (wxMessage, context, service, sessionManager) -> {
		service.getMsgService().sendSubscribeMsg(WxMaSubscribeMessage.builder()
				.templateId("此处更换为自己的模板id")
				.data(Lists.newArrayList(
						new WxMaSubscribeMessage.MsgData("keyword1", "339208499")))
				.toUser(wxMessage.getFromUser())
				.build());
		return null;
	};

	private final WxMaMessageHandler logHandler = (wxMessage, context, service, sessionManager) -> {
		log.info("收到消息：" + wxMessage.toString());
		service.getMsgService().sendKefuMsg(WxMaKefuMessage.newTextBuilder().content("收到信息为：" + wxMessage.toJson())
				.toUser(wxMessage.getFromUser()).build());
		return null;
	};

	private final WxMaMessageHandler textHandler = (wxMessage, context, service, sessionManager) -> {
		service.getMsgService().sendKefuMsg(WxMaKefuMessage.newTextBuilder().content("回复文本消息")
				.toUser(wxMessage.getFromUser()).build());
		return null;
	};

	private final WxMaMessageHandler picHandler = (wxMessage, context, service, sessionManager) -> {
		try {
			WxMediaUploadResult uploadResult = service.getMediaService()
					.uploadMedia("image", "png",
							ClassLoader.getSystemResourceAsStream("tmp.png"));
			service.getMsgService().sendKefuMsg(
					WxMaKefuMessage
							.newImageBuilder()
							.mediaId(uploadResult.getMediaId())
							.toUser(wxMessage.getFromUser())
							.build());
		} catch (WxErrorException e) {
			e.printStackTrace();
		}

		return null;
	};

	private final WxMaMessageHandler qrcodeHandler = (wxMessage, context, service, sessionManager) -> {
		try {
			final File file = service.getQrcodeService().createQrcode("123", 430);
			WxMediaUploadResult uploadResult = service.getMediaService().uploadMedia("image", file);
			service.getMsgService().sendKefuMsg(
					WxMaKefuMessage
							.newImageBuilder()
							.mediaId(uploadResult.getMediaId())
							.toUser(wxMessage.getFromUser())
							.build());
		} catch (WxErrorException e) {
			e.printStackTrace();
		}

		return null;
	};

}
