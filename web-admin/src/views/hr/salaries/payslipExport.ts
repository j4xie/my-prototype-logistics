/**
 * 工资条 PDF 生成 — #833 H-WAGE / #844 专项扣除 follow-up.
 *
 * Client-side jsPDF (4.1.0) + SimHei subset font (/fonts/simhei-subset.ttf).
 * Reuses the pattern from SmartBIAnalysis.vue handleExportPDF (cached font fetch
 * + addFileToVFS + addFont('SimHei')).
 *
 * Pure browser PDF assembly from existing SalaryItem JSON + optional special
 * deductions list. No backend change.
 *
 * @since 2026-05-17
 */
import type { SalaryItem } from '@/api/salary';
import type { SalarySpecialDeduction, DeductionType } from '@/api/specialDeduction';

// ============= Chinese Font Loading =============
// SimHei subset is served from /fonts/simhei-subset.ttf (existing asset, also
// used by SmartBIAnalysis PDF export). Cache base64 once per page load.
let cachedChineseFont: string | null = null;

async function loadChineseFont(): Promise<string | null> {
  if (cachedChineseFont) return cachedChineseFont;
  try {
    const resp = await fetch('/fonts/simhei-subset.ttf');
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedChineseFont = btoa(binary);
    return cachedChineseFont;
  } catch {
    return null;
  }
}

// ============= Deduction Type Labels =============
const DEDUCTION_TYPE_LABEL: Record<DeductionType, string> = {
  CHILD_EDUCATION: '子女教育',
  CONTINUING_EDUCATION: '继续教育',
  SERIOUS_ILLNESS: '大病医疗',
  HOUSING_LOAN: '住房贷款利息',
  HOUSING_RENT: '住房租金',
  ELDER_SUPPORT: '赡养老人',
};

// ============= Public API =============
export interface PayslipExportInput {
  salary: SalaryItem;
  /** Optional active special deductions for this user+month (from #844). */
  deductions?: SalarySpecialDeduction[];
  /** Optional employee display name; falls back to "员工 ${userId}". */
  employeeName?: string;
  /** Optional department label; rendered only when provided. */
  department?: string;
  /** Optional factory display name; defaults to "Cretas 工厂". */
  factoryName?: string;
}

/**
 * Generate and download a payslip PDF (browser-side).
 * Returns the file name actually saved.
 */
export async function exportPayslipPDF(input: PayslipExportInput): Promise<string> {
  const { salary, deductions = [], employeeName, department, factoryName } = input;

  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let yOffset = 18;

  // Register Chinese font (degrade to default Helvetica if unavailable — chars may render boxy)
  const fontBase64 = await loadChineseFont();
  const hasChinese = !!fontBase64;
  if (fontBase64) {
    doc.addFileToVFS('SimHei-subset.ttf', fontBase64);
    doc.addFont('SimHei-subset.ttf', 'SimHei', 'normal');
    doc.setFont('SimHei');
  }

  // ============= Header =============
  doc.setFontSize(16);
  const displayFactory = factoryName || 'Cretas 工厂';
  doc.text(`${displayFactory} · ${salary.yearMonth} 工资单`, pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 10;

  // Status line
  doc.setFontSize(9);
  doc.setTextColor(120);
  const statusLabel: Record<string, string> = { DRAFT: '草稿', CONFIRMED: '已确认', PAID: '已发放' };
  doc.text(
    `状态: ${statusLabel[salary.status] || salary.status}    ` +
    `生成时间: ${new Date().toLocaleString('zh-CN')}`,
    pageWidth / 2,
    yOffset,
    { align: 'center' },
  );
  doc.setTextColor(0);
  yOffset += 10;

  // ============= Employee Info Block =============
  doc.setFontSize(11);
  doc.text('员工信息', 15, yOffset);
  yOffset += 6;

  doc.setFontSize(10);
  const empLabel = employeeName ? `${employeeName} (ID: ${salary.userId})` : `员工 ID: ${salary.userId}`;
  doc.text(`姓名: ${empLabel}`, 15, yOffset);
  yOffset += 5;
  if (department) {
    doc.text(`部门: ${department}`, 15, yOffset);
    yOffset += 5;
  }
  doc.text(`工资月份: ${salary.yearMonth}`, 15, yOffset);
  yOffset += 10;

  // ============= Salary Breakdown Table =============
  doc.setFontSize(11);
  doc.text('薪资明细', 15, yOffset);
  yOffset += 6;

  // Simple two-column layout: label (left) + value right-aligned at column edge.
  const tableLeftX = 15;
  const tableRightX = pageWidth - 15;
  const lineHeight = 6.5;

  const drawRow = (label: string, value: string, bold = false) => {
    if (bold) {
      doc.setFontSize(11);
    } else {
      doc.setFontSize(10);
    }
    doc.text(label, tableLeftX, yOffset);
    doc.text(value, tableRightX, yOffset, { align: 'right' });
    yOffset += lineHeight;
  };

  const fmt = (n: number | string): string =>
    `¥${Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  drawRow('基本工资', fmt(salary.baseSalary));
  drawRow('个人社保 (10.5%)', `- ${fmt(salary.socialInsuranceEmployee)}`);
  drawRow('个人公积金 (8%)', `- ${fmt(salary.providentFundEmployee)}`);
  drawRow('应税收入', fmt(salary.taxableIncome));
  drawRow('个人所得税', `- ${fmt(salary.personalTax)}`);

  // Horizontal divider before 实发
  yOffset += 1;
  doc.setDrawColor(180);
  doc.line(tableLeftX, yOffset, tableRightX, yOffset);
  doc.setDrawColor(0);
  yOffset += 5;

  drawRow('实发金额', fmt(salary.netSalary), true);
  yOffset += 4;

  // ============= Employer-side (info-only) =============
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `单位承担: 社保 ${fmt(salary.socialInsuranceEmployer)} + ` +
    `公积金 ${fmt(salary.providentFundEmployer)} (info-only,不计入实发)`,
    tableLeftX,
    yOffset,
  );
  doc.setTextColor(0);
  yOffset += 10;

  // ============= 专项附加扣除 (from #844, optional) =============
  if (deductions.length > 0) {
    if (yOffset > 230) {
      doc.addPage();
      yOffset = 18;
      if (hasChinese) doc.setFont('SimHei');
    }

    doc.setFontSize(11);
    doc.text('个税专项附加扣除明细', tableLeftX, yOffset);
    yOffset += 6;

    let deductionTotal = 0;
    doc.setFontSize(10);
    for (const d of deductions) {
      const typeLabel = DEDUCTION_TYPE_LABEL[d.deductionType] || d.deductionType;
      const amount = Number(d.monthlyAmount);
      deductionTotal += amount;
      drawRow(`  ${typeLabel}`, fmt(amount));
    }

    yOffset += 1;
    doc.setDrawColor(180);
    doc.line(tableLeftX, yOffset, tableRightX, yOffset);
    doc.setDrawColor(0);
    yOffset += 5;

    drawRow('专项扣除合计', fmt(deductionTotal));
    yOffset += 4;

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      '注: 专项扣除已在应税收入计算中体现,此处仅供员工对账参考。',
      tableLeftX,
      yOffset,
    );
    doc.setTextColor(0);
    yOffset += 8;
  }

  // ============= Remark (if any) =============
  if (salary.remark) {
    if (yOffset > 260) {
      doc.addPage();
      yOffset = 18;
      if (hasChinese) doc.setFont('SimHei');
    }
    doc.setFontSize(10);
    doc.text('备注:', tableLeftX, yOffset);
    yOffset += 5;
    doc.setFontSize(9);
    const remarkLines = doc.splitTextToSize(salary.remark, pageWidth - 30);
    for (const line of remarkLines) {
      if (yOffset > 280) {
        doc.addPage();
        yOffset = 18;
        if (hasChinese) doc.setFont('SimHei');
      }
      doc.text(line, tableLeftX, yOffset);
      yOffset += 4.5;
    }
  }

  // ============= Footer (every page) =============
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (hasChinese) doc.setFont('SimHei');
    doc.setFontSize(8);
    doc.setTextColor(140);
    // Left: chop placeholder
    doc.text('(财务部 盖章)', 15, 285);
    // Center: page number
    doc.text(`第 ${p}/${totalPages} 页`, pageWidth / 2, 285, { align: 'center' });
    // Right: generated timestamp short
    doc.text(`生成 ${new Date().toISOString().slice(0, 10)}`, pageWidth - 15, 285, { align: 'right' });
    doc.setTextColor(0);
  }

  // ============= Save =============
  const safeFactoryPart = (factoryName || 'Cretas').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${safeFactoryPart}_工资条_${salary.yearMonth}_user${salary.userId}.pdf`;
  doc.save(fileName);
  return fileName;
}
