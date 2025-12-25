package com.joolun.mall.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.joolun.mall.entity.SmsSendRecord;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 短信发送记录Mapper
 */
public interface SmsSendRecordMapper extends BaseMapper<SmsSendRecord> {

    /**
     * 分页查询发送记录
     */
    IPage<SmsSendRecord> selectPage1(IPage<SmsSendRecord> page,
                                      @Param("query") SmsSendRecord query);

    /**
     * 查询商户今日发送次数
     */
    int countTodaySendByMerchant(@Param("merchantId") Long merchantId,
                                  @Param("date") LocalDate date);

    /**
     * 查询待发送的记录
     */
    List<SmsSendRecord> selectPendingSend();

    /**
     * 更新发送状态
     */
    int updateSendStatus(@Param("id") Long id,
                         @Param("status") Integer status,
                         @Param("resultCode") String resultCode,
                         @Param("resultMessage") String resultMessage,
                         @Param("bizId") String bizId);
}
