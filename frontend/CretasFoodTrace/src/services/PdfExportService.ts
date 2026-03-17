import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface ExportMetadata {
  batchId?: string;
  date?: string;
}

/**
 * Converts plain text / markdown-style content into HTML paragraphs.
 * Line breaks become <br> and consecutive blank lines become paragraph breaks.
 */
function contentToHtml(content: string): string {
  if (!content) return '<p style="color: #757575;">暂无分析内容</p>';

  return content
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br>';
      // Heading-like lines (starts with # or ##)
      if (/^#{1,2}\s/.test(trimmed)) {
        const level = trimmed.startsWith('## ') ? 'h3' : 'h2';
        const text = trimmed.replace(/^#{1,3}\s/, '');
        return `<${level}>${text}</${level}>`;
      }
      // Bullet lines
      if (/^[-*]\s/.test(trimmed)) {
        return `<li>${trimmed.slice(2)}</li>`;
      }
      return `<p>${trimmed}</p>`;
    })
    .join('\n');
}

function buildHtmlTemplate(
  title: string,
  content: string,
  metadata?: ExportMetadata
): string {
  const generatedAt = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const metadataRows = [
    metadata?.batchId ? `<tr><td class="meta-label">批次编号</td><td>${metadata.batchId}</td></tr>` : '',
    metadata?.date ? `<tr><td class="meta-label">分析日期</td><td>${metadata.date}</td></tr>` : '',
    `<tr><td class="meta-label">生成时间</td><td>${generatedAt}</td></tr>`,
  ]
    .filter(Boolean)
    .join('\n');

  const bodyContent = contentToHtml(content);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    /* Base reset and Chinese font stack */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
                   "WenQuanYi Micro Hei", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #212121;
      background: #ffffff;
      padding: 0 32px 48px;
    }

    /* ── Header ── */
    .report-header {
      background: linear-gradient(135deg, #7B1FA2 0%, #4A148C 100%);
      color: #ffffff;
      padding: 32px;
      margin: 0 -32px 32px;
      text-align: center;
    }
    .report-header .logo-text {
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    .report-header h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    /* ── Metadata table ── */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
      background: #F3E5F5;
      border-radius: 8px;
      overflow: hidden;
    }
    .meta-table td {
      padding: 10px 16px;
      font-size: 13px;
      border-bottom: 1px solid #E1BEE7;
    }
    .meta-table tr:last-child td { border-bottom: none; }
    .meta-label {
      width: 100px;
      color: #6A1B9A;
      font-weight: 600;
    }

    /* ── Content body ── */
    .content-section h2 {
      font-size: 17px;
      color: #4A148C;
      margin: 24px 0 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #CE93D8;
    }
    .content-section h3 {
      font-size: 15px;
      color: #6A1B9A;
      margin: 18px 0 6px;
    }
    .content-section p {
      margin-bottom: 10px;
      color: #333333;
    }
    .content-section li {
      margin-left: 20px;
      margin-bottom: 6px;
      color: #424242;
    }
    .content-section br {
      display: block;
      margin: 4px 0;
      content: "";
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #E0E0E0;
      font-size: 11px;
      color: #9E9E9E;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="report-header">
    <div class="logo-text">白垩纪食品溯源系统 · AI 智能分析</div>
    <h1>${title}</h1>
  </div>

  <!-- Metadata -->
  ${metadataRows ? `<table class="meta-table"><tbody>${metadataRows}</tbody></table>` : ''}

  <!-- Analysis content -->
  <div class="content-section">
    ${bodyContent}
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <p>本报告由白垩纪食品溯源系统 AI 自动生成 &nbsp;|&nbsp; 生成时间：${generatedAt}</p>
    <p>仅供参考，请结合实际生产情况综合判断</p>
  </div>
</body>
</html>`;
}

/**
 * Exports an AI analysis result as a PDF and opens the system share sheet.
 *
 * Dependencies: expo-print, expo-sharing (both must be installed).
 *
 * @param title    - Report title shown in the header and PDF filename
 * @param content  - Analysis text (plain text or lightweight markdown)
 * @param metadata - Optional batch/date metadata rendered in the report header table
 */
export async function exportAnalysisToPdf(
  title: string,
  content: string,
  metadata?: ExportMetadata
): Promise<void> {
  try {
    const html = buildHtmlTemplate(title, content, metadata);

    // Generate PDF file
    const { uri } = await Print.printToFileAsync({ html });

    // Check if sharing is available on this device
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('不支持', '该设备不支持文件分享功能');
      return;
    }

    // Open system share sheet so the user can save or send the PDF
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `分享 ${title}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('[PdfExportService] exportAnalysisToPdf failed:', error);
    Alert.alert('导出失败', '生成PDF时出错，请稍后重试');
    throw error;
  }
}
