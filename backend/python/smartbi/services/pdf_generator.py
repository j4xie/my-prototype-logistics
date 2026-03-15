"""Financial PDF Generator — Report generation with chart images and AI analysis."""
import base64
import io
import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Chart type display names (shared with ppt_generator)
from smartbi.services.ppt_generator import CHART_DISPLAY_NAMES


class FinancialPDFGenerator:
    """Generate PDF report from chart images and analysis text using reportlab."""

    def generate(self, chart_images: Dict[str, str],
                 analysis_results: Dict[str, str],
                 company_name: str = "白垩纪科技",
                 year: int = 2026,
                 period_type: str = "year",
                 start_month: int = 1, end_month: int = 12,
                 kpi_summary: Optional[Dict] = None) -> bytes:
        """Generate PDF bytes from chart images and analysis results."""
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.units import inch, cm
            from reportlab.lib.colors import HexColor
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
                Table, TableStyle, PageBreak, KeepTogether
            )
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
        except ImportError:
            raise ImportError("reportlab not installed. Run: pip install reportlab>=4.0")

        # Try to register Chinese font
        chinese_font = 'Helvetica'  # fallback
        for font_path in [
            '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
            '/System/Library/Fonts/PingFang.ttc',
        ]:
            try:
                pdfmetrics.registerFont(TTFont('ChineseFont', font_path))
                chinese_font = 'ChineseFont'
                break
            except Exception:
                continue

        # Page setup — landscape A4
        page_w, page_h = landscape(A4)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4),
            leftMargin=1.5*cm, rightMargin=1.5*cm,
            topMargin=1.5*cm, bottomMargin=1.5*cm,
        )

        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CTitle', parent=styles['Title'],
            fontName=chinese_font, fontSize=28, textColor=HexColor('#1B65A8'),
            spaceAfter=20, alignment=1,
        )
        subtitle_style = ParagraphStyle(
            'CSubtitle', parent=styles['Normal'],
            fontName=chinese_font, fontSize=14, textColor=HexColor('#6B778C'),
            spaceAfter=10, alignment=1,
        )
        heading_style = ParagraphStyle(
            'CHeading', parent=styles['Heading2'],
            fontName=chinese_font, fontSize=18, textColor=HexColor('#1B65A8'),
            spaceBefore=10, spaceAfter=8,
        )
        body_style = ParagraphStyle(
            'CBody', parent=styles['Normal'],
            fontName=chinese_font, fontSize=10, textColor=HexColor('#2C3E50'),
            leading=14, spaceAfter=6,
        )

        period_label = self._period_label(year, period_type, start_month, end_month)
        elements = []

        # --- Cover ---
        elements.append(Spacer(1, 2*inch))
        elements.append(Paragraph(company_name, title_style))
        elements.append(Paragraph("财务分析报告", ParagraphStyle(
            'ReportTitle', parent=title_style, fontSize=22,
        )))
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph(period_label, subtitle_style))
        elements.append(Paragraph(f"生成日期: {datetime.now().strftime('%Y-%m-%d')}", subtitle_style))
        elements.append(PageBreak())

        # --- KPI Summary ---
        if kpi_summary and kpi_summary.get('items'):
            elements.append(Paragraph("执行摘要", heading_style))
            kpi_items = kpi_summary['items'][:12]
            # Build KPI table (4 columns)
            kpi_rows = []
            for i in range(0, len(kpi_items), 4):
                row = []
                for j in range(4):
                    if i + j < len(kpi_items):
                        kpi = kpi_items[i + j]
                        cell_text = f"{kpi.get('label', '')}\n{kpi.get('value', '')}{kpi.get('unit', '')}"
                        row.append(cell_text)
                    else:
                        row.append("")
                kpi_rows.append(row)
            if kpi_rows:
                t = Table(kpi_rows, colWidths=[4.5*cm]*4)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), HexColor('#F8F9FA')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), HexColor('#2C3E50')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, -1), chinese_font),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#DEE2E6')),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor('#DEE2E6')),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                elements.append(t)
            elements.append(PageBreak())

        # --- Chart pages ---
        chart_order = list(CHART_DISPLAY_NAMES.keys())
        ordered_types = [ct for ct in chart_order if ct in chart_images]
        extra_types = [ct for ct in chart_images if ct not in chart_order]
        ordered_types.extend(extra_types)

        for chart_type in ordered_types:
            img_b64 = chart_images.get(chart_type, '')
            analysis = analysis_results.get(chart_type, '')
            display_name = CHART_DISPLAY_NAMES.get(chart_type, chart_type)

            chart_elements = []
            chart_elements.append(Paragraph(display_name, heading_style))

            # Chart image
            if img_b64:
                try:
                    img_data = base64.b64decode(img_b64.split(',')[-1] if ',' in img_b64 else img_b64)
                    img_stream = io.BytesIO(img_data)
                    img = RLImage(img_stream, width=20*cm, height=12*cm)
                    chart_elements.append(img)
                except Exception as e:
                    logger.warning(f"Failed to embed chart image for {chart_type}: {e}")
                    chart_elements.append(Paragraph(f"[图表加载失败: {display_name}]", body_style))
            else:
                chart_elements.append(Paragraph(f"[{display_name} — 图表截图未提供]", body_style))

            # AI Analysis
            if analysis:
                chart_elements.append(Spacer(1, 0.2*inch))
                chart_elements.append(Paragraph("AI 分析", ParagraphStyle(
                    'AnalysisTitle', parent=heading_style, fontSize=13,
                )))
                # Split into paragraphs
                for line in analysis[:2000].split('\n'):
                    line = line.strip()
                    if line:
                        chart_elements.append(Paragraph(line, body_style))

            elements.extend(chart_elements)
            elements.append(PageBreak())

        # --- Footer page ---
        elements.append(Spacer(1, 2*inch))
        elements.append(Paragraph("— 报告结束 —", ParagraphStyle(
            'Footer', parent=subtitle_style, fontSize=16,
        )))
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph(
            f"{company_name} · {period_label} · 由 SmartBI 智能生成",
            subtitle_style,
        ))

        doc.build(elements)
        return buffer.getvalue()

    def _period_label(self, year, period_type, start_month, end_month):
        if period_type == 'year':
            return f"{year}年度"
        elif period_type == 'month' and start_month == end_month:
            return f"{year}年{start_month}月"
        else:
            return f"{year}年{start_month}-{end_month}月"
