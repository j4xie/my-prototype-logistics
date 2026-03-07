"""Generate chart assets for Cretas Pitch Deck"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np
import os

# Match PPTX color scheme — refined palette
DARK = '#111D32'
ACCENT = '#E04E63'
BLUE = '#1E3A5F'
WHITE = '#ffffff'
GRAY = '#64748B'
LIGHT_GRAY = '#F0F4F8'
LIGHT_ACCENT = '#FCE4E8'

# Chart color palette (colorblind-friendly per VIS-GUIDE)
COLORS = ['#E04E63', '#1E3A5F', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(OUT_DIR, 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

plt.rcParams['font.family'] = ['Microsoft YaHei', 'SimHei', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False


def chart_market_funnel():
    """TAM/SAM/SOM concentric circles for Slide 4"""
    fig, ax = plt.subplots(figsize=(5, 4), dpi=150)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    layers = [
        (2800, 'TAM\n~2,800 亿', '#0f3460', 0.15),
        (100, 'SAM\n~100 亿', '#2563EB', 0.6),
        (3.0, 'SOM\n3.0 亿', '#e94560', 1.0),
    ]

    radii = [3.0, 1.8, 0.8]
    for r, (val, label, color, alpha) in zip(radii, layers):
        circle = plt.Circle((0, 0), r, color=color, alpha=alpha, linewidth=2, edgecolor=color)
        ax.add_patch(circle)

    ax.text(0, 2.4, 'TAM ~2,800亿', ha='center', va='center', fontsize=11, color=WHITE, fontweight='bold')
    ax.text(0, 1.55, '中国工业软件市场', ha='center', va='center', fontsize=8, color='#cccccc')
    ax.text(0, 0.7, 'SAM ~100亿', ha='center', va='center', fontsize=11, color=WHITE, fontweight='bold')
    ax.text(0, 0.35, '食品制造 MES+AI', ha='center', va='center', fontsize=8, color='#cccccc')
    ax.text(0, -0.15, 'SOM', ha='center', va='center', fontsize=12, color=WHITE, fontweight='bold')
    ax.text(0, -0.5, '3.0亿', ha='center', va='center', fontsize=14, color=WHITE, fontweight='bold')

    ax.set_xlim(-3.8, 3.8)
    ax.set_ylim(-3.8, 3.8)
    ax.set_aspect('equal')
    ax.axis('off')

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_market_funnel.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_revenue_projection():
    """3-year revenue projection bar+line for Slide 8"""
    fig, ax = plt.subplots(figsize=(5, 3.2), dpi=150)
    fig.patch.set_facecolor('white')

    years = ['Y1\n2026-27', 'Y2\n2027-28', 'Y3\n2028-29']
    # Base case (conservative) + Upside case
    revenue_base = [110, 550, 1600]
    revenue_upside = [150, 1000, 3000]
    customers_base = [36, 130, 400]
    customers_upside = [50, 250, 700]

    x = np.arange(len(years))
    width = 0.35

    # Base case bars
    bars_base = ax.bar(x - width/2, revenue_base, width, color=ACCENT, alpha=0.85,
                       zorder=3, label='Base Case')
    # Upside bars
    bars_up = ax.bar(x + width/2, revenue_upside, width, color=BLUE, alpha=0.7,
                     zorder=3, label='Upside')

    for i in range(len(years)):
        ax.text(i - width/2, revenue_base[i] + 50, f'{revenue_base[i]}万',
                ha='center', va='bottom', fontsize=9, fontweight='bold', color=ACCENT)
        ax.text(i + width/2, revenue_upside[i] + 50, f'{revenue_upside[i]}万',
                ha='center', va='bottom', fontsize=9, fontweight='bold', color=BLUE)

    ax2 = ax.twinx()
    ax2.plot(x, customers_base, 'o-', color='#10B981', linewidth=2, markersize=7, zorder=5)
    ax2.plot(x, customers_upside, 's--', color='#10B981', linewidth=1.5, markersize=5,
             alpha=0.5, zorder=5)
    for i, c in enumerate(customers_base):
        ax2.text(i + 0.15, c + 15, f'{c}家', fontsize=8, color='#10B981', fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(years, fontsize=10)
    ax.set_ylabel('营收 (万元)', fontsize=10, color=ACCENT)
    ax2.set_ylabel('付费客户数', fontsize=10, color='#10B981')
    ax.set_ylim(0, 3800)
    ax2.set_ylim(0, 900)

    ax.spines['top'].set_visible(False)
    ax2.spines['top'].set_visible(False)
    ax.grid(axis='y', alpha=0.3, zorder=0)

    legend_elements = [
        mpatches.Patch(color=ACCENT, alpha=0.85, label='Base Case'),
        mpatches.Patch(color=BLUE, alpha=0.7, label='Upside'),
        plt.Line2D([0], [0], color='#10B981', marker='o', label='客户数 (Base)'),
    ]
    ax.legend(handles=legend_elements, loc='upper left', fontsize=8, framealpha=0.9)

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_revenue_projection.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_competition_radar():
    """Multi-dimensional radar chart for Slide 9"""
    fig, ax = plt.subplots(figsize=(5, 4), dpi=150, subplot_kw=dict(polar=True))
    fig.patch.set_facecolor('white')

    categories = ['食品专用', 'AI能力', '移动端', '性价比', '部署速度', '餐饮覆盖', 'IoT硬件', '零培训']
    N = len(categories)

    # Scores (0-10)
    cretas =    [9, 8, 9, 9, 9, 8, 7, 9]
    heilake =   [3, 4, 5, 6, 5, 0, 3, 3]
    keruyun =   [2, 2, 8, 8, 8, 8, 0, 5]
    kingdee =   [2,  1,  3,  2, 2,  0,  2, 2]

    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    angles += angles[:1]

    for scores, color, label, alpha in [
        (cretas, ACCENT, '白垩纪', 0.25),
        (heilake, BLUE, '黑湖智造', 0.08),
        (keruyun, '#10B981', '客如云', 0.08),
        (kingdee, '#F97316', '金蝶/用友', 0.05),
    ]:
        vals = scores + scores[:1]
        ax.plot(angles, vals, 'o-', linewidth=2, color=color, label=label, markersize=4)
        ax.fill(angles, vals, alpha=alpha, color=color)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, fontsize=9)
    ax.set_ylim(0, 11)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(['2', '4', '6', '8', '10'], fontsize=7, color=GRAY)
    ax.grid(True, alpha=0.3)

    ax.legend(loc='upper right', bbox_to_anchor=(1.35, 1.15), fontsize=9, framealpha=0.9)

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_competition_radar.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_fund_allocation():
    """Fund allocation horizontal stacked bar for Slide 11"""
    fig, ax = plt.subplots(figsize=(7, 1.6), dpi=150)
    fig.patch.set_facecolor(DARK)
    ax.set_facecolor(DARK)

    categories = ['产品研发  40%', '销售市场  30%', '团队扩充  20%', '运营储备  10%']
    values = [40, 30, 20, 10]
    colors = [ACCENT, '#2563EB', '#10B981', '#F97316']

    left = 0
    for val, color, cat in zip(values, colors, categories):
        bar = ax.barh(0, val, left=left, height=0.6, color=color, edgecolor='white', linewidth=1)
        ax.text(left + val/2, 0, cat, ha='center', va='center',
                fontsize=10, color=WHITE, fontweight='bold')
        left += val

    ax.set_xlim(-1, 102)
    ax.set_ylim(-0.8, 0.8)
    ax.axis('off')

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_fund_allocation.png')
    plt.savefig(path, bbox_inches='tight', facecolor=DARK, pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_timeline():
    """Milestone timeline for Slide 7"""
    fig, ax = plt.subplots(figsize=(11, 2.2), dpi=150)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    milestones = [
        ('2025 Q4', '核心后端\nPG迁移', True),
        ('2026 Q1', 'AI意图系统\n98%准确率', True),
        ('2026 Q1', 'App E2E\n50+测试通过', True),
        ('2026 Q1', '小程序商城\n上线', True),
        ('2026 Q2', '首批客户\n测试部署', True),
        ('2026 H2', '10-20家\n付费客户', False),
        ('2027 H1', 'ARR\n100-300万', False),
        ('2027 H2', 'Pre-A/A轮\n融资', False),
    ]

    x_positions = np.linspace(0.5, 10.5, len(milestones))

    # Draw timeline line
    ax.plot([0, 11], [1, 1], color=GRAY, linewidth=2, zorder=1)

    for i, (date, desc, done) in enumerate(milestones):
        x = x_positions[i]
        color = '#10B981' if done else ACCENT
        marker_color = color
        marker = 'o' if done else 's'

        # Node
        ax.plot(x, 1, marker, color=marker_color, markersize=14, zorder=3,
                markeredgecolor=WHITE, markeredgewidth=2)
        if done:
            ax.text(x, 1, '✓', ha='center', va='center', fontsize=8, color=WHITE, fontweight='bold', zorder=4)

        # Date above
        y_date = 1.6 if i % 2 == 0 else 1.5
        ax.text(x, y_date, date, ha='center', va='bottom', fontsize=8,
                color=DARK, fontweight='bold')

        # Description below
        y_desc = 0.4 if i % 2 == 0 else 0.5
        ax.text(x, y_desc, desc, ha='center', va='top', fontsize=7,
                color=DARK, linespacing=1.3)

        # Connector line
        ax.plot([x, x], [0.85, 0.6] if i % 2 == 0 else [0.85, 0.65],
                color=GRAY, linewidth=0.8, alpha=0.5, zorder=2)

    # Legend
    ax.plot([], [], 'o', color='#10B981', markersize=8, label='已完成')
    ax.plot([], [], 's', color=ACCENT, markersize=8, label='目标')
    ax.legend(loc='lower right', fontsize=8, framealpha=0.9)

    ax.set_xlim(-0.2, 11.2)
    ax.set_ylim(-0.2, 2.2)
    ax.axis('off')

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_timeline.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.05)
    plt.close()
    print(f'  Saved: {path}')


def chart_pain_points():
    """Pain point infographic icons for Slide 2"""
    fig, ax = plt.subplots(figsize=(4, 3), dpi=150)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    # Horizontal bar showing gap between current and digital
    categories = ['智能驱动', '数字化转型\n进行中', '数据孤岛\n问题', '食物损耗\n浪费率']
    values = [3.2, 62.6, 55.6, 22.7]
    colors_list = [ACCENT, '#F97316', BLUE, '#2563EB']

    y_pos = np.arange(len(categories))
    bars = ax.barh(y_pos, values, height=0.6, color=colors_list, alpha=0.85, zorder=3)

    for i, (v, cat) in enumerate(zip(values, categories)):
        ax.text(v + 1.5, i, f'{v}%', va='center', fontsize=12, fontweight='bold', color=DARK)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(categories, fontsize=10)
    ax.set_xlim(0, 80)
    ax.invert_yaxis()

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.tick_params(bottom=False, labelbottom=False)
    ax.grid(axis='x', alpha=0.2, zorder=0)

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_pain_points.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_competition_quadrant():
    """2x2 competition quadrant for Lite Slide 9"""
    fig, ax = plt.subplots(figsize=(6, 4.5), dpi=150)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    # Competitors: (x=food_specificity, y=ai_depth, name, color, size)
    competitors = [
        (8.5, 8.5, '白垩纪', ACCENT, 220),
        (4.5, 6.0, '黑湖智造', BLUE, 100),
        (7.5, 2.5, '客如云', '#10B981', 100),
        (2.5, 2.0, '金蝶/用友', '#F97316', 100),
    ]

    for x, y, name, color, s in competitors:
        ax.scatter(x, y, s=s, color=color, zorder=5, edgecolors='white', linewidths=1.5)
        offset_y = 0.55 if name == '白垩纪' else 0.45
        fontsize = 13 if name == '白垩纪' else 10
        weight = 'bold' if name == '白垩纪' else 'normal'
        ax.text(x, y + offset_y, name, ha='center', va='bottom',
                fontsize=fontsize, fontweight=weight, color=color)

    # Quadrant lines
    ax.axhline(y=5, color=GRAY, linewidth=0.8, alpha=0.4, linestyle='--')
    ax.axvline(x=5, color=GRAY, linewidth=0.8, alpha=0.4, linestyle='--')

    # Quadrant labels
    ax.text(2.5, 9.5, '通用AI工具', ha='center', fontsize=9, color=GRAY, alpha=0.6)
    ax.text(7.5, 9.5, '食品AI专家', ha='center', fontsize=9, color=ACCENT, alpha=0.8, fontweight='bold')
    ax.text(2.5, 0.5, '通用管理软件', ha='center', fontsize=9, color=GRAY, alpha=0.6)
    ax.text(7.5, 0.5, '食品垂直工具', ha='center', fontsize=9, color=GRAY, alpha=0.6)

    ax.set_xlabel('食品行业专精度  →', fontsize=11, color=DARK)
    ax.set_ylabel('AI 能力深度  →', fontsize=11, color=DARK)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10.5)
    ax.set_xticks([])
    ax.set_yticks([])

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_competition_quadrant.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


def chart_why_now():
    """Five-arrow convergence diagram — 5 catalysts → 2026 window"""
    fig, ax = plt.subplots(figsize=(8, 4), dpi=150)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    catalysts = [
        ('2025.6', '七部委政策:\n2027年80%数字化', ACCENT),
        ('2023→26', 'AI API成本\n暴降90%+', BLUE),
        ('2024', '食安事件频发\n溯源需求激增', COLORS[2]),
        ('2024→26', '连锁化率18→25%\n标准化需求', COLORS[3]),
        ('2025', '中小企业\n数字化补贴', COLORS[4]),
    ]

    n = len(catalysts)
    y_positions = np.linspace(3.2, 0.8, n)
    arrow_start_x = 0.5
    converge_x = 7.0
    converge_y = 2.0

    # Draw arrows from left to convergence point
    for i, ((year, label, color), y) in enumerate(zip(catalysts, y_positions)):
        # Arrow line
        ax.annotate('', xy=(converge_x - 0.6, converge_y),
                    xytext=(arrow_start_x + 2.8, y),
                    arrowprops=dict(arrowstyle='->', color=color, lw=2.2, connectionstyle='arc3,rad=0'))
        # Year label
        ax.text(arrow_start_x - 0.1, y, year, ha='right', va='center',
                fontsize=9, color=color, fontweight='bold')
        # Catalyst text
        ax.text(arrow_start_x + 0.1, y, label, ha='left', va='center',
                fontsize=9, color=DARK, linespacing=1.2)

    # Convergence circle
    circle = plt.Circle((converge_x, converge_y), 0.7, color=ACCENT, alpha=0.9, zorder=5)
    ax.add_patch(circle)
    ax.text(converge_x, converge_y + 0.08, '2026', ha='center', va='center',
            fontsize=14, color=WHITE, fontweight='bold', zorder=6)
    ax.text(converge_x, converge_y - 0.28, '= 窗口期', ha='center', va='center',
            fontsize=10, color=WHITE, fontweight='bold', zorder=6)

    ax.set_xlim(-0.5, 8.5)
    ax.set_ylim(0, 4.0)
    ax.set_aspect('equal')
    ax.axis('off')

    plt.tight_layout()
    path = os.path.join(ASSETS_DIR, 'chart_why_now.png')
    plt.savefig(path, bbox_inches='tight', facecolor='white', pad_inches=0.1)
    plt.close()
    print(f'  Saved: {path}')


if __name__ == '__main__':
    print('Generating chart assets...')
    chart_market_funnel()
    chart_revenue_projection()
    chart_competition_radar()
    chart_competition_quadrant()
    chart_fund_allocation()
    chart_timeline()
    chart_pain_points()
    chart_why_now()
    print(f'\nAll charts saved to: {ASSETS_DIR}')
