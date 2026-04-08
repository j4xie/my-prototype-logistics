package com.cretas.aims.dto.inventory;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * P0-NEW-1 出库签收凭证上传请求
 * 客户原话 (2807-2840s): "手机端可以拍一下我们的出户单，对方签收的凭证"
 */
@Getter
@Setter
public class SignatureUploadRequest {
    /** 签收照片 URL 列表 (已上传至 OSS) */
    private List<String> photoUrls;
    /** 签收人姓名 */
    private String signedByName;
    /** 备注 */
    private String remark;
}
