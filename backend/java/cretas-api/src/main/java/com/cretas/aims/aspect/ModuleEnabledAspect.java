package com.cretas.aims.aspect;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.config.FactoryConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

/**
 * B 层模块开关检查。
 * 在 @RequireModule 标注的 Controller 方法执行前，
 * 从方法参数中提取 factoryId，调用 configService.isModuleEnabled() 检查。
 * 如果模块未启用，抛出 BusinessException (HTTP 400)。
 */
@Slf4j
@Aspect
@Component
@Order(1)
@RequiredArgsConstructor
public class ModuleEnabledAspect {

    private final FactoryConfigService configService;

    @Before("@annotation(requireModule)")
    public void checkModuleEnabled(JoinPoint joinPoint, RequireModule requireModule) {
        String moduleCode = requireModule.value();
        String factoryId = extractFactoryId(joinPoint);

        if (factoryId == null) {
            log.warn("@RequireModule({}) 无法从参数中提取 factoryId，跳过检查", moduleCode);
            return;
        }

        if (!configService.isModuleEnabled(factoryId, moduleCode)) {
            log.info("模块 {} 在工厂 {} 中未启用，拒绝访问", moduleCode, factoryId);
            throw new BusinessException(403, "模块 " + moduleCode + " 未启用")
                    .withHint("请在 [系统设置 → 工厂功能配置] 启用该模块, 或联系管理员");
        }
    }

    /**
     * 从方法参数中提取 factoryId。
     * 优先查找名为 "factoryId" 的参数（@PathVariable String factoryId），
     * 如果找不到，查找第一个 String 类型参数。
     */
    private String extractFactoryId(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        // 1. 按参数名查找 "factoryId"
        String[] paramNames = signature.getParameterNames();
        if (paramNames != null) {
            for (int i = 0; i < paramNames.length; i++) {
                if ("factoryId".equals(paramNames[i]) && args[i] instanceof String) {
                    return (String) args[i];
                }
            }
        }

        // 2. 按 @PathVariable 注解查找
        for (int i = 0; i < parameters.length; i++) {
            if (parameters[i].isAnnotationPresent(org.springframework.web.bind.annotation.PathVariable.class)
                    && parameters[i].getType() == String.class
                    && args[i] != null) {
                org.springframework.web.bind.annotation.PathVariable pv =
                        parameters[i].getAnnotation(org.springframework.web.bind.annotation.PathVariable.class);
                String pvName = pv.value().isEmpty() ? pv.name() : pv.value();
                if ("factoryId".equals(pvName) || pvName.isEmpty()) {
                    return (String) args[i];
                }
            }
        }

        return null;
    }
}
