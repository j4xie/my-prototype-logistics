import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_TOKEN = process.env.HF_TOKEN;

/**
 * 食品加工数据分析控制器
 */

/**
 * 调用Llama模型
 */
async function queryLlama(messages) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN未配置');
  }

  const response = await axios.post(
    HF_API_URL,
    {
      messages,
      model: "meta-llama/Llama-3.1-8B-Instruct:fireworks-ai",
      max_tokens: 1500,
      temperature: 0.7,
    },
    {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * 构建分析Prompt
 */
function buildPrompt(sectionData) {
  const sections = {
    '接收&半解冻': ['thawing_time', 'drip_loss', 'temperature'],
    '去尾': ['tail_rate', 'trim_rate', 'rework_rate'],
    '机械切片': ['thickness_sd', 'jam_rate', 'oee'],
    '清洗(倍温)': ['water_usage', 'outlet_temp', 'micro_pass_rate'],
    '沥干': ['surface_loss', 'dwell_time'],
    '深辊上浆(半成品)': ['marinade_absorption', 'ph_salinity', 'marinade_variance'],
    '包装&IQF速冻': ['sec', 'pack_pass_rate', 'cooling_time'],
    '品控&食品安全': ['ccp_pass_rate', 'audit_issues'],
    '清洗&换线': ['clean_duration', 'atp_pass_rate'],
  };

  const paramLabels = {
    'thawing_time': '解冻时间', 'drip_loss': '滴水损失率(%)', 'temperature': '温度(°C)',
    'tail_rate': '尾段率(%)', 'trim_rate': '修整率(%)', 'rework_rate': '返工率(%)',
    'thickness_sd': '厚度偏差SD(mm)', 'jam_rate': '卡机率(%)', 'oee': 'OEE(%)',
    'water_usage': '单位用水(L/kg)', 'outlet_temp': '出口温度(°C)',
    'micro_pass_rate': '微生物检测合格率(%)',
    'surface_loss': '表面失水率(%)', 'dwell_time': '停留时间(min)',
    'marinade_absorption': '腌料吸收率(%)', 'ph_salinity': 'pH/盐度',
    'marinade_variance': '腌料消耗差异(%)',
    'sec': 'sEC(kWh/kg)', 'pack_pass_rate': '包装合格率(%)',
    'cooling_time': '核心降温时间(min)',
    'ccp_pass_rate': 'CCP合格率(%)', 'audit_issues': '审计问题数(个)',
    'clean_duration': '清洁时长(min)', 'atp_pass_rate': 'ATP检测合格率(%)',
  };

  const promptParts = ["请分析以下食品加工数据（实际数据 vs 平均数据）：\n"];

  for (const [sectionName, paramKeys] of Object.entries(sections)) {
    let sectionText = `\n【${sectionName}】\n`;
    let sectionHasData = false;

    for (const paramKey of paramKeys) {
      const actualVal = (sectionData[paramKey] || '').trim();
      const avgVal = (sectionData[`avg_${paramKey}`] || '').trim();

      if (actualVal || avgVal) {
        sectionHasData = true;
        const label = paramLabels[paramKey] || paramKey;
        sectionText += `  ${label}: 实际=${actualVal || '未填'} | 平均=${avgVal || '未填'}\n`;
      }
    }

    if (sectionHasData) {
      promptParts.push(sectionText);
    }
  }

  if (promptParts.length === 1) {
    promptParts.push("\n⚠️ 未提供任何数据");
  } else {
    promptParts.push("\n请基于以上数据进行深度分析，给出专业建议。");
  }

  return promptParts.join('');
}

/**
 * 分析食品加工数据
 */
export async function analyzeFoodProcessing(req, res) {
  try {
    const { section_data } = req.body;

    if (!section_data) {
      return res.status(400).json({
        success: false,
        message: '缺少section_data参数',
      });
    }

    // 构建Prompt
    const prompt = buildPrompt(section_data);

    // 调用AI模型
    const messages = [
      {
        role: "system",
        content: `你是食品加工专家，专门分析水产加工数据。

任务：
1. 对比实际数据与平均数据，识别差异
2. 诊断问题和风险点
3. 提供具体优化建议
4. 分析成本优化空间

要求：
- 简洁专业的语言
- 具体数字和百分比对比
- 可量化的改进目标
- 中文回复

输出格式：
📊 **总体评估**
[整体评价]

🔍 **环节分析**
[逐环节分析实际vs平均差异]

⚠️ **主要问题**
1. [问题及影响]

💡 **优化建议**
1. [具体建议]

📈 **预期收益**
[预期改善]`,
      },
      {
        role: "user",
        content: prompt,
      }
    ];

    const aiAnalysis = await queryLlama(messages);

    res.json({
      success: true,
      analysis: aiAnalysis,
      message: "分析完成",
    });

  } catch (error) {
    console.error('AI分析失败:', error);
    res.status(500).json({
      success: false,
      analysis: "",
      message: `分析失败: ${error.message}`,
    });
  }
}
