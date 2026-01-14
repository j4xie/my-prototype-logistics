#!/usr/bin/env python3
"""
电商素材图片生成脚本
使用通义万相API生成图片，上传到OSS
"""

import os
import time
import json
import requests
import uuid
from datetime import datetime

# 配置 - 从环境变量读取
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
OSS_ACCESS_KEY_ID = os.environ.get("ALIBABA_ACCESSKEY_ID", "")
OSS_ACCESS_KEY_SECRET = os.environ.get("ALIBABA_SECRET_KEY", "")
OSS_BUCKET = "mall-products-shanghai"
OSS_ENDPOINT = "oss-cn-shanghai.aliyuncs.com"
OSS_BASE_URL = f"https://{OSS_BUCKET}.{OSS_ENDPOINT}"

# 设置API Key
os.environ["DASHSCOPE_API_KEY"] = DASHSCOPE_API_KEY

import dashscope
from dashscope import ImageSynthesis
import oss2

# 初始化OSS
auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
bucket = oss2.Bucket(auth, f"https://{OSS_ENDPOINT}", OSS_BUCKET)

# 图片配置 - 使用英文提示词
IMAGE_CONFIGS = {
    "food": [
        {
            "prompt": "Fresh fruit platter, colorful fruits including apples oranges grapes strawberries, white background, professional food photography, high quality, 4k",
            "filename": "fresh_fruit_platter"
        },
        {
            "prompt": "Fresh organic vegetables arrangement, green leafy vegetables broccoli carrots tomatoes, clean white background, healthy food photography, studio lighting",
            "filename": "organic_vegetables"
        },
        {
            "prompt": "Farm fresh produce display, natural rustic style, wooden crate with vegetables, warm natural lighting, countryside atmosphere",
            "filename": "farm_produce"
        }
    ],
    "seafood": [
        {
            "prompt": "Fresh seafood platter on ice, lobster shrimp crab fish, blue ocean background, luxury food photography, professional lighting",
            "filename": "seafood_platter"
        },
        {
            "prompt": "Fresh ocean fish display, salmon tuna, deep blue sea background, professional food photography, clean style",
            "filename": "ocean_fish"
        },
        {
            "prompt": "Fresh shellfish closeup, oysters mussels clams, ice cubes, clean white background, minimalist food photography",
            "filename": "shellfish_closeup"
        }
    ],
    "dessert": [
        {
            "prompt": "Beautiful decorated cake, strawberry cream cake, pink romantic background, bakery photography, soft lighting, dreamy atmosphere",
            "filename": "decorated_cake"
        },
        {
            "prompt": "Colorful macarons arrangement, pastel colors, elegant French dessert, pink background, feminine style photography",
            "filename": "macarons"
        },
        {
            "prompt": "Fresh baked bread and pastries, croissants rolls, warm bakery atmosphere, golden brown, cozy morning light",
            "filename": "bakery_bread"
        }
    ],
    "gift": [
        {
            "prompt": "Elegant gift box with golden ribbon bow, luxury black background, premium present, professional product photography, studio lighting",
            "filename": "luxury_gift_box"
        },
        {
            "prompt": "Premium red wine gift set, wine bottles glasses, luxury dark background, elegant sophisticated style, product photography",
            "filename": "wine_gift_set"
        },
        {
            "prompt": "Traditional tea gift box, Chinese style packaging, elegant classic design, warm earth tones, premium product photography",
            "filename": "tea_gift_box"
        }
    ],
    "promotion": [
        {
            "prompt": "Shopping sale banner background, orange red gradient, festive celebration atmosphere, abstract dynamic shapes, promotional design",
            "filename": "sale_banner_orange"
        },
        {
            "prompt": "Limited time offer background, bright yellow gold gradient, attention grabbing, burst effects, promotional banner design",
            "filename": "limited_offer_yellow"
        },
        {
            "prompt": "New product launch background, fresh mint green gradient, clean modern minimalist, soft abstract shapes, elegant banner design",
            "filename": "new_arrival_green"
        }
    ]
}

def generate_image(prompt, category, filename):
    """生成单张图片"""
    print(f"  正在生成: {filename}")
    
    try:
        response = ImageSynthesis.call(
            api_key=DASHSCOPE_API_KEY,
            model="wanx2.0-t2i-turbo",
            prompt=prompt,
            n=1,
            size="1024*1024"
        )
        
        if response.status_code == 200 and response.output:
            results = response.output.get("results", [])
            if results:
                image_url = results[0].get("url")
                if image_url:
                    return image_url
                    
        print(f"    生成失败: {response}")
        return None
        
    except Exception as e:
        print(f"    生成错误: {e}")
        return None

def download_image(url):
    """下载图片"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            return response.content
    except Exception as e:
        print(f"    下载错误: {e}")
    return None

def upload_to_oss(image_data, category, filename):
    """上传到OSS"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8]
    oss_path = f"decoration/images/{category}/{filename}_{timestamp}_{unique_id}.png"
    
    try:
        bucket.put_object(oss_path, image_data, headers={'Content-Type': 'image/png'})
        oss_url = f"{OSS_BASE_URL}/{oss_path}"
        return oss_url
    except Exception as e:
        print(f"    上传错误: {e}")
        return None

def main():
    print("=" * 60)
    print("电商素材图片生成工具")
    print("=" * 60)
    
    results = {}
    total_count = 0
    success_count = 0
    
    for category, images in IMAGE_CONFIGS.items():
        print(f"\n[{category.upper()}] 开始生成...")
        results[category] = []
        
        for img_config in images:
            total_count += 1
            prompt = img_config["prompt"]
            filename = img_config["filename"]
            
            # 生成图片
            image_url = generate_image(prompt, category, filename)
            if not image_url:
                print(f"    跳过: {filename}")
                continue
            
            # 下载图片
            print(f"    下载中...")
            image_data = download_image(image_url)
            if not image_data:
                print(f"    下载失败: {filename}")
                continue
            
            # 上传到OSS
            print(f"    上传到OSS...")
            oss_url = upload_to_oss(image_data, category, filename)
            if oss_url:
                results[category].append({
                    "filename": filename,
                    "url": oss_url,
                    "prompt": prompt
                })
                success_count += 1
                print(f"    完成: {oss_url}")
            
            # 避免API限流
            time.sleep(2)
    
    # 输出结果
    print("\n" + "=" * 60)
    print("生成结果汇总")
    print("=" * 60)
    print(f"总计: {total_count} 张, 成功: {success_count} 张")
    
    print("\n所有OSS图片URL:")
    print("-" * 60)
    
    for category, images in results.items():
        if images:
            print(f"\n{category.upper()}:")
            for img in images:
                print(f"  - {img['url']}")
    
    # 保存结果到JSON
    output_file = "/Users/jietaoxie/my-prototype-logistics/MallCenter/mall_admin_center/generated_images.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存到: {output_file}")
    
    return results

if __name__ == "__main__":
    main()
