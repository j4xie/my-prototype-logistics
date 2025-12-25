package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.MerchantNotification;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 商家通知Mapper
 */
public interface MerchantNotificationMapper extends BaseMapper<MerchantNotification> {

    /**
     * 分页查询通知
     */
    IPage<MerchantNotification> selectPage1(IPage<MerchantNotification> page,
                                            @Param("query") MerchantNotification query);

    /**
     * 查询商户的未读通知
     */
    List<MerchantNotification> selectUnreadByMerchantId(@Param("merchantId") Long merchantId);

    /**
     * 查询商户的未读通知数量
     */
    int countUnreadByMerchantId(@Param("merchantId") Long merchantId);

    /**
     * 批量标记已读
     */
    int batchMarkRead(@Param("ids") List<Long> ids);

    /**
     * 查询待发送短信的通知
     */
    List<MerchantNotification> selectPendingSms();

    /**
     * 更新短信发送状态
     */
    int updateSmsStatus(@Param("id") Long id,
                        @Param("status") Integer status,
                        @Param("result") String result);
}
