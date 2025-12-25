package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantReview;

import java.util.List;
import java.util.Map;

/**
 * 商户服务接口
 */
public interface MerchantService extends IService<Merchant> {

    /**
     * 分页查询商户
     */
    IPage<Merchant> page1(IPage<Merchant> page, Merchant merchant);

    /**
     * 获取商户详情
     */
    Merchant getById1(Long id);

    /**
     * 根据用户ID获取商户
     */
    Merchant getByUserId(Long userId);

    /**
     * 商户入驻申请
     */
    boolean apply(Merchant merchant);

    /**
     * 审核商户
     * @param id 商户ID
     * @param action 1通过 2拒绝
     * @param remark 备注
     * @param reviewerId 审核人ID
     * @param reviewerName 审核人姓名
     */
    boolean review(Long id, Integer action, String remark, Long reviewerId, String reviewerName);

    /**
     * 更新商户状态
     */
    boolean updateStatus(Long id, Integer status);

    /**
     * 获取商户统计数据
     */
    Map<String, Object> getStats(Long id);

    /**
     * 获取商户审核记录
     */
    List<MerchantReview> getReviewHistory(Long merchantId);

    /**
     * 获取待审核商户数量
     */
    long getPendingCount();
}
