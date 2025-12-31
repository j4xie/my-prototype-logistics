#!/usr/bin/env python3
"""
04_update_pic_urls.py - 根据产品名称匹配图片，生成UPDATE SQL

用法：
    python3 04_update_pic_urls.py
"""

import re
from collections import defaultdict

# 供应商名称 -> 图片文件夹名称 映射
SUPPLIER_FOLDER_MAP = {
    '上海恩沁食品有限公司': '恩沁冰块',
    '上海隆赢食品科技开发有限公司': '隆尚',
    '欧泰贡': '欧泰贡',
    '泰祥': '泰祥',
    '广州尚好菜食品有限公司': '尚好菜',
    '光阳蛋业': '光阳蛋',
    '上海新成格林尔食品启东有限公司': '果堡',
    '忠意产品': '忠意',
    '老佰姓': '老佰姓',
    '菌菇合作': '福善肴',
    '云南流沙黄金麻球': '麻球',
    '峰哥发的': '蔬菜',
    # 通用匹配
    '张总': '火锅食材',
    '不知道叫什么': '鸡',
}

# 产品关键词 -> 图片文件关键词 映射
PRODUCT_IMAGE_KEYWORDS = {
    # 恩沁冰块
    '5cm方冰': ['方冰', '3KG方冰'],
    '6cm高透亮冰球': ['冰球6cm', '冰球6'],
    '去棱角多功能摇冰': ['摇冰'],
    '条冰': ['条冰'],
    '颗粒碎冰': ['颗粒碎冰'],
    '2.2cm机制小方冰': ['小方冰', '5公斤小方冰'],

    # 隆尚
    '香芋丁': ['香芋丁'],
    '大芋圆': ['大芋圆'],
    '原味紫薯泥': ['紫薯泥'],
    '小芋圆': ['小芋圆'],
    '香芋条': ['香芋条'],
    '调味芋泥': ['调味芋泥'],
    '原味芋泥': ['原味芋泥'],
    '香芋弧形片': ['香芋片', '香芋方形'],
    '香芋扇形': ['香芋扇形'],
    '原味米麻薯': ['米麻薯'],

    # 欧泰贡
    '脆口鱼杂': ['鱼杂'],
    '波波脆鱼肚': ['脆鱼肚'],
    '8成欧标鱼柳': ['8成欧标鱼柳'],
    '9成欧标鱼柳': ['9成欧标鱼柳'],

    # 泰祥
    '黑椒牛肉粒': ['黑椒牛肉粒'],
    '日式粘粉猪排': ['猪排', '黄金猪排'],
    '波浪卷': ['波浪卷'],
    '蟹肉竹轮': ['蟹肉竹轮'],
    '蔬菜土豆饼': ['蔬菜土豆饼'],
    '蔬菜鱼糜饼': ['蔬菜鱼糜饼'],
    '竹轮日式关东煮': ['竹轮'],
    '香肠竹轮': ['香肠竹轮'],
    '章鱼小丸子': ['章鱼小丸子'],
    '牛肉土豆饼': ['牛肉土豆饼'],
    '胸口油': ['胸口油'],
    '耙牛肉': ['耙牛肉'],
    '小炒黄牛肉': ['小炒黄牛肉'],
    '小里脊猪排': ['猪排'],
    '粘粉鳕鱼排': ['鳕鱼棒'],

    # 尚好菜
    '饭堂豉汁蒸排骨': ['饭堂鼓汁蒸排骨', '鼓汁蒸排骨'],
    '小炒牛肉260': ['小炒牛肉260'],
    '原味火锅牛排': ['原味火锅牛排'],
    '麻辣火锅牛排': ['麻辣火锅牛排'],
    '黄金脆皮骨': ['黄金脆皮骨'],
    '蒜香小排': ['蒜香小排'],
    '蒜香小骨': ['蒜香小骨'],
    '长喜厨房嫩滑牛肉片': ['长喜嫩滑牛肉片', '嫩滑牛肉片'],
    '潮汕咸蛋黄卷': ['咸蛋黄卷'],
    '小炒鸡杂': ['小炒鸡杂'],
    '爽滑猪肉片': ['爽滑猪肉片'],
    '粒粒蒜香骨': ['粒粒蒜香骨'],
    '原味牛肉片': ['原味牛肉片'],
    '牛柳': ['牛柳'],
    '蒜香猪肋皇': ['猪肋皇'],
    '精品小炒牛肉': ['精品小炒牛肉'],
    '猪肉胶': ['猪肉胶'],
    '原味牛肉粒': ['原味牛肉粒'],
    '和味牛腩': ['和味牛腩'],
    '黑椒T骨猪扒': ['黑椒T骨'],
    '蜜汁叉烧': ['蜜汁叉烧'],

    # 光阳蛋业
    '熟咸蛋': ['咸鸭蛋'],
    '带汁卤蛋': ['茶叶蛋'],
    '优级皮蛋': ['皮蛋'],
    '二级散装皮蛋': ['皮蛋'],
    '咸蛋黄30枚': ['红心咸蛋黄'],
    '红心咸蛋黄真空装': ['红心咸蛋黄'],
    '茶叶蛋': ['茶叶蛋'],

    # 果堡冰淇淋
    '椰子冰淇淋': ['椰子冰淇淋'],
    '组合型南瓜雪泥': ['南瓜雪芭'],
    '莓的微笑': ['草莓冰淇淋'],
    '组合型柠檬雪泥': ['柠檬雪芭'],
    '组合型菠萝雪泥': ['菠萝雪芭'],
    '组合型芒果雪泥': ['芒果雪芭'],
    '组合型蜜桃雪泥': ['桃子雪芭'],
    '金色年华': ['金桔冰淇淋'],

    # 忠意
    '去骨鸭掌': ['鸭掌'],
    '锁鲜鸭胗花': ['鸭胗'],
    '活力鲜鹅肠': ['鹅肠'],
    '调理鸭肠': ['鸭肠'],
    '调理鲜鸭肠': ['鸭肠'],

    # 老佰姓大米
    '米中贵族': ['米中贵族'],
    '灰常好': ['灰常好'],
    '2号': ['老佰姓2号'],
    '鸿运当头': ['鸿运当头'],
    '绿树常青': ['绿树常青'],
    '橙心如意': ['橙心如意'],
    '1号': ['老佰姓1号'],

    # 菌菇
    '松茸复合菌': ['松茸复合菌粉'],
    '松茸鲜': ['松茸鲜'],
    '牛肝菌酱': ['牛肝菌酱'],
    '脆脆菇': ['脆脆菇'],
    '竹荪': ['竹荪'],
    '冻品黑松露': ['冻品黑松露'],
    '冻品野生松茸': ['冷冻松茸'],
    '鲜品鸡枞菌': ['鸡枞菌'],
    '冷冻野生松露片': ['黑松露片'],
    '干货鹿茸菇': ['鹿茸菇'],
    '干货羊肚菌': ['羊肚菌'],
    '菌汤包': ['菌汤包'],

    # 麻球
    '流沙黄金麻球': ['麻球'],

    # 蔬菜
    '红菠菜': ['红小菠'],
    '板蓝根青菜': ['板蓝根青菜'],
    '甜心甘蓝': ['水果牛心甘蓝'],

    # 火锅食材 (张总)
    '鱼豆腐': ['鱼豆腐'],
    '撒尿肉丸': ['牛肉丸'],
    '鱼籽福袋': ['鱼籽福袋'],
    '免浆黑鱼片': ['黑鱼片'],
    '泡泡豆干': ['泡泡豆干'],
    '无骨干冰鸡爪': ['无骨鸡爪'],
    '贡菜': ['贡菜'],
    '胖娃娃红糖糍粑': ['胖娃娃糍粑'],
    '美好包浆豆腐': ['包浆豆腐'],
    '东北原浆冻豆腐': ['冻豆腐'],
    '三全茴香小油条': ['油条'],
    '美好小酥肉': ['美好小酥肉'],
    '龙厨现切吊龙': ['吊龙'],
    '派派乐锁鲜鸭肠': ['鸭肠'],
    '越汇真有乌鸡卷': ['乌鸡卷'],
    '卓燚牛黄喉': ['牛黄喉'],
    '卓燚蒸汽水煮千层肚': ['千层肚'],
    '龙厨3系嫩滑牛肉': ['嫩牛肉'],
    '老羊头清真肥羊卷': ['老羊头羊肉卷'],
    '美鑫小凤仙老火锅底料': ['老火锅风味底料'],
    '鲜冻鸭血': ['鲜鸭血'],
    '3系双椒牛肉': ['双椒牛肉'],
    '卓燚优质水牛大叶片毛肚': ['毛肚'],
    '涛阳锁鲜鹅肠': ['鹅肠'],
    '精益鲜冻腐竹': ['腐竹'],
    '小凤鲜原味菌汤': ['菌菇锅底'],
    '老羊头清真肥牛方砖': ['肥牛方砖'],
    '李传芳黑豆花': ['黑豆花'],
    '虎皮凤爪': ['虎皮凤爪'],
    '海吉港95大颗粒虾滑': ['95虾滑'],
    '海欣火锅鱿鱼须': ['鱿鱼须'],
    '霞浦海带苗': ['海带苗'],
    '美宁牛肉午餐肉': ['牛肉午餐肉'],
    '美宁火锅午餐肉': ['美宁火锅午餐肉'],
    '美宁火腿猪肉': ['美宁火腿猪肉'],
    '美宁云腿午餐肉': ['美宁云腿午餐肉'],
    '盛华V型蟹柳': ['蟹柳'],
    '李家芝麻官火锅芝麻酱': ['李家火锅芝麻酱'],
    '黄龙火锅川粉': ['黄龙火锅川粉'],
    '纯极鱼恋花': ['鱼恋花'],
    '潮汕牛筋丸': ['牛筋丸'],
    '越汇小郡肝': ['小郡肝'],
    '响铃卷': ['响铃卷'],
    '皇家杜老爷蝴蝶面': ['皇家杜老爷蝴蝶面'],
    '小凤鲜阳光番茄': ['番茄锅底'],
    '卓燚猪黄喉': ['猪黄喉'],
    '无骨干冰鸭掌': ['无骨鸭掌'],
    '3系麻辣牛肉': ['麻辣牛肉'],
    '卓燚黑千层': ['黑千层'],
    '卓燚无底板大叶片黄牛毛肚': ['水毛肚'],
    '吉食道笋片': ['笋片'],

    # 鸡类 (不知道叫什么)
    '德沣盐田香虾': ['虾'],
    '广东黑棕鹅': ['鹅'],
    '江西土麻鸭': ['鸭'],
    '大别山老母鸡': ['大别山'],
    '正宗温氏清远鸡': ['清远鸡', '温氏'],
    '广东乳鸽': ['乳鸽'],
}


def read_products(filepath):
    """读取产品数据"""
    products = []
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines[1:]:  # 跳过表头
        line = line.strip()
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) >= 3:
            products.append({
                'id': parts[0],
                'name': parts[1],
                'sell_point': parts[2] if len(parts) > 2 else ''
            })
    return products


def read_images(filepath):
    """读取图片路径数据"""
    images = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                # 移除行号前缀 (如果有)
                if '→' in line:
                    line = line.split('→', 1)[1]
                images.append(line)
    return images


def extract_supplier(sell_point):
    """从 sell_point 中提取供应商名称"""
    if '供应商:' in sell_point:
        return sell_point.split('供应商:')[1].strip()
    elif '供应商：' in sell_point:
        return sell_point.split('供应商：')[1].strip()
    return ''


def find_matching_images(product_name, supplier, images, folder_map):
    """根据产品名称和供应商找到匹配的图片"""
    matched = []

    # 获取供应商对应的文件夹
    folder = folder_map.get(supplier, '')

    # 优先在供应商文件夹中搜索
    priority_images = [img for img in images if folder and f'/{folder}/' in img]
    other_images = [img for img in images if folder and f'/{folder}/' not in img]

    # 搜索关键词匹配
    for keyword, image_keywords in PRODUCT_IMAGE_KEYWORDS.items():
        if keyword in product_name:
            for img_kw in image_keywords:
                # 先在供应商文件夹搜索
                for img in priority_images:
                    if img_kw in img:
                        matched.append(img)
                        if len(matched) >= 3:
                            return matched[:3]

                # 再在其他文件夹搜索
                if len(matched) < 3:
                    for img in other_images:
                        if img_kw in img:
                            matched.append(img)
                            if len(matched) >= 3:
                                return matched[:3]

    # 如果没有匹配，尝试直接用产品名中的关键词
    if not matched:
        # 提取产品名中的关键字
        name_parts = re.split(r'[/\s\(\)\（\）]+', product_name)
        for part in name_parts:
            if len(part) >= 2:  # 至少2个字符
                for img in priority_images:
                    if part in img:
                        matched.append(img)
                        if len(matched) >= 3:
                            return matched[:3]

    return matched[:3] if matched else []


def generate_update_sql(products, images):
    """生成 UPDATE SQL"""
    sql_lines = []
    sql_lines.append("-- =====================================================")
    sql_lines.append("-- 04_update_pic_urls.sql - 更新商品图片URL")
    sql_lines.append("-- 生成时间: 自动生成")
    sql_lines.append("-- =====================================================")
    sql_lines.append("")

    matched_count = 0
    unmatched = []

    for product in products:
        supplier = extract_supplier(product['sell_point'])
        matching_images = find_matching_images(
            product['name'],
            supplier,
            images,
            SUPPLIER_FOLDER_MAP
        )

        if matching_images:
            # 转换为相对URL (去掉 /www/wwwroot/mall 前缀)
            urls = [img.replace('/www/wwwroot/mall', '') for img in matching_images]
            pic_urls = ','.join(urls)

            sql_lines.append(f"-- 产品: {product['name'][:30]}...")
            sql_lines.append(f"UPDATE goods_spu SET pic_urls = '{pic_urls}' WHERE id = '{product['id']}';")
            sql_lines.append("")
            matched_count += 1
        else:
            unmatched.append(f"{product['name']} (供应商: {supplier})")

    sql_lines.append("-- =====================================================")
    sql_lines.append(f"-- 匹配成功: {matched_count} 个产品")
    sql_lines.append(f"-- 未匹配: {len(unmatched)} 个产品")
    sql_lines.append("-- =====================================================")

    if unmatched:
        sql_lines.append("")
        sql_lines.append("-- 未匹配的产品:")
        for item in unmatched:
            sql_lines.append(f"-- {item}")

    return '\n'.join(sql_lines)


def main():
    # 读取数据
    products = read_products('/tmp/products.txt')
    images = read_images('/tmp/all_images.txt')

    print(f"读取产品: {len(products)} 个")
    print(f"读取图片: {len(images)} 个")

    # 生成 SQL
    sql_content = generate_update_sql(products, images)

    # 写入文件
    output_path = '/Users/jietaoxie/my-prototype-logistics/MallCenter/sql/product_import/04_update_pic_urls.sql'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)

    print(f"\n生成完成: {output_path}")


if __name__ == '__main__':
    main()
