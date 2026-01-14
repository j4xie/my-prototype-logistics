#!/usr/bin/env python3
"""
Generate theme banner images using Aliyun Wanx (Tongyi Wanxiang) API
and upload to OSS.

Usage:
    python generate_theme_banners.py
"""

import os
import sys
import time
import json
import requests
import hashlib
import hmac
import base64
from datetime import datetime
from urllib.parse import quote
import uuid

# ==========================================
# Configuration
# ==========================================

# DashScope API Key - 从环境变量读取
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")

# OSS Configuration - 从环境变量读取
OSS_ACCESS_KEY_ID = os.environ.get("ALIBABA_ACCESSKEY_ID", "")
OSS_ACCESS_KEY_SECRET = os.environ.get("ALIBABA_SECRET_KEY", "")
OSS_BUCKET = "mall-products-shanghai"
OSS_ENDPOINT = "oss-cn-shanghai.aliyuncs.com"
OSS_REGION = "cn-shanghai"

# DashScope Wanx API endpoints
WANX_CREATE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
WANX_QUERY_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"

# Model to use (wanx2.0-t2i-turbo is good for e-commerce banners)
WANX_MODEL = "wanx2.0-t2i-turbo"

# Image size (wanx2.0-t2i-turbo only supports preset sizes)
# Allowed: 768*768, 576*1024, 1024*576, 1024*1024, 720*1280, 1280*720, 864*1152, 1152*864
# Using 1280*720 (closest to banner aspect ratio)
IMAGE_WIDTH = 1280
IMAGE_HEIGHT = 720

# 15 Theme Banner Prompts
THEME_PROMPTS = [
    {
        "code": "fresh_green",
        "name": "Fresh Green",
        "prompt": "E-commerce banner for fresh produce, green fresh style, fresh fruits and vegetables arranged beautifully, white background, clean and natural, high quality, professional product photography, 750x300 aspect ratio"
    },
    {
        "code": "classic_gold",
        "name": "Classic Gold",
        "prompt": "E-commerce banner for luxury gifts, golden luxurious style, elegant gift boxes with silk ribbons, black background, premium quality, sophisticated design, high-end product photography, 750x300 aspect ratio"
    },
    {
        "code": "ocean_blue",
        "name": "Ocean Blue",
        "prompt": "E-commerce banner for seafood, blue ocean style, fresh seafood on ice, ocean waves, marine theme, professional food photography, appetizing, 750x300 aspect ratio"
    },
    {
        "code": "sweet_pink",
        "name": "Sweet Pink",
        "prompt": "E-commerce banner for bakery and desserts, pink warm style, macarons and cakes arrangement, soft pastel colors, sweet and romantic, professional dessert photography, 750x300 aspect ratio"
    },
    {
        "code": "baby_warm",
        "name": "Baby Warm",
        "prompt": "E-commerce banner for baby products, warm cozy style, baby items arrangement, soft pastel colors, gentle and caring, professional product photography, family friendly, 750x300 aspect ratio"
    },
    {
        "code": "tech_blue",
        "name": "Tech Blue",
        "prompt": "E-commerce banner for digital technology products, blue tech style, electronic gadgets, futuristic design, modern and sleek, professional tech photography, 750x300 aspect ratio"
    },
    {
        "code": "dopamine_orange",
        "name": "Dopamine Orange",
        "prompt": "E-commerce banner for promotional sales, orange vibrant style, special offer tags and ribbons, energetic and exciting, sale promotion design, eye-catching colors, 750x300 aspect ratio"
    },
    {
        "code": "minimal_white",
        "name": "Minimal White",
        "prompt": "E-commerce banner for minimalist lifestyle products, white minimalist style, clean design with lots of white space, simple and elegant, modern aesthetic, 750x300 aspect ratio"
    },
    {
        "code": "tea_brown",
        "name": "Tea Brown",
        "prompt": "E-commerce banner for tea products, brown rustic style, traditional tea set arrangement, teapot and cups, zen atmosphere, cultural aesthetic, professional product photography, 750x300 aspect ratio"
    },
    {
        "code": "beauty_purple",
        "name": "Beauty Purple",
        "prompt": "E-commerce banner for cosmetics and skincare, purple elegant style, beauty products arrangement, luxurious and feminine, professional beauty photography, 750x300 aspect ratio"
    },
    {
        "code": "natural_wood",
        "name": "Natural Wood",
        "prompt": "E-commerce banner for home furniture, natural wood style, wooden furniture display, warm and cozy interior, organic materials, professional furniture photography, 750x300 aspect ratio"
    },
    {
        "code": "festival_red",
        "name": "Festival Red",
        "prompt": "E-commerce banner for festival promotions, red festive style, Chinese New Year gifts and decorations, celebration theme, traditional patterns, lucky and prosperous, 750x300 aspect ratio"
    },
    {
        "code": "dark_night",
        "name": "Dark Night",
        "prompt": "E-commerce banner for trendy fashion, black cool style, streetwear and fashion items, modern and edgy, urban aesthetic, professional fashion photography, 750x300 aspect ratio"
    },
    {
        "code": "farm_green",
        "name": "Farm Green",
        "prompt": "E-commerce banner for agricultural products, pastoral natural style, farm fresh produce, organic and natural, countryside theme, farm-to-table concept, 750x300 aspect ratio"
    },
    {
        "code": "medical_blue",
        "name": "Medical Blue",
        "prompt": "E-commerce banner for health supplements, cyan professional style, health products arrangement, medical and trustworthy, clean and clinical, professional healthcare photography, 750x300 aspect ratio"
    }
]


def create_image_task(prompt: str) -> dict:
    """
    Create an image generation task using DashScope Wanx API.
    Returns task_id for polling.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "X-DashScope-Async": "enable"
    }

    payload = {
        "model": WANX_MODEL,
        "input": {
            "prompt": prompt
        },
        "parameters": {
            "size": f"{IMAGE_WIDTH}*{IMAGE_HEIGHT}",
            "n": 1
        }
    }

    response = requests.post(
        WANX_CREATE_TASK_URL,
        headers=headers,
        json=payload,
        timeout=60
    )

    if response.status_code != 200:
        raise Exception(f"Failed to create task: {response.status_code} - {response.text}")

    result = response.json()
    if "output" not in result or "task_id" not in result["output"]:
        raise Exception(f"Invalid response: {result}")

    return result


def query_task_status(task_id: str) -> dict:
    """
    Query the status of an image generation task.
    """
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}"
    }

    url = WANX_QUERY_TASK_URL.format(task_id=task_id)
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(f"Failed to query task: {response.status_code} - {response.text}")

    return response.json()


def wait_for_task_completion(task_id: str, max_wait_seconds: int = 300) -> dict:
    """
    Poll for task completion with exponential backoff.
    """
    start_time = time.time()
    poll_interval = 5  # Start with 5 seconds

    while time.time() - start_time < max_wait_seconds:
        result = query_task_status(task_id)
        status = result.get("output", {}).get("task_status", "")

        if status == "SUCCEEDED":
            return result
        elif status == "FAILED":
            raise Exception(f"Task failed: {result}")
        elif status in ["PENDING", "RUNNING"]:
            print(f"  Task status: {status}, waiting {poll_interval}s...")
            time.sleep(poll_interval)
            poll_interval = min(poll_interval * 1.5, 30)  # Max 30 seconds
        else:
            raise Exception(f"Unknown task status: {status}")

    raise Exception(f"Task timed out after {max_wait_seconds} seconds")


def download_image(url: str) -> bytes:
    """
    Download image from URL.
    """
    response = requests.get(url, timeout=60)
    if response.status_code != 200:
        raise Exception(f"Failed to download image: {response.status_code}")
    return response.content


def sign_oss_request(method: str, bucket: str, object_key: str,
                     content_type: str, date: str, content_md5: str = "") -> str:
    """
    Generate OSS signature for PUT request.
    """
    string_to_sign = f"{method}\n{content_md5}\n{content_type}\n{date}\n/{bucket}/{object_key}"

    signature = base64.b64encode(
        hmac.new(
            OSS_ACCESS_KEY_SECRET.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha1
        ).digest()
    ).decode('utf-8')

    return signature


def upload_to_oss(image_data: bytes, object_key: str, content_type: str = "image/png") -> str:
    """
    Upload image to OSS and return the public URL.
    """
    date = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')

    signature = sign_oss_request(
        method="PUT",
        bucket=OSS_BUCKET,
        object_key=object_key,
        content_type=content_type,
        date=date
    )

    headers = {
        "Date": date,
        "Content-Type": content_type,
        "Authorization": f"OSS {OSS_ACCESS_KEY_ID}:{signature}"
    }

    url = f"https://{OSS_BUCKET}.{OSS_ENDPOINT}/{object_key}"

    response = requests.put(url, headers=headers, data=image_data, timeout=60)

    if response.status_code not in [200, 201]:
        raise Exception(f"Failed to upload to OSS: {response.status_code} - {response.text}")

    return url


def generate_and_upload_banner(theme: dict) -> dict:
    """
    Generate a banner for a theme and upload to OSS.
    Returns the result with OSS URL.
    """
    code = theme["code"]
    name = theme["name"]
    prompt = theme["prompt"]

    print(f"\n{'='*60}")
    print(f"Processing theme: {name} ({code})")
    print(f"{'='*60}")
    print(f"Prompt: {prompt[:100]}...")

    # Step 1: Create image generation task
    print("\n[1/4] Creating image generation task...")
    create_result = create_image_task(prompt)
    task_id = create_result["output"]["task_id"]
    print(f"  Task ID: {task_id}")

    # Step 2: Wait for completion
    print("\n[2/4] Waiting for image generation...")
    result = wait_for_task_completion(task_id)

    # Get the generated image URL
    image_url = result.get("output", {}).get("results", [{}])[0].get("url")
    if not image_url:
        raise Exception(f"No image URL in result: {result}")
    print(f"  Generated image URL: {image_url}")

    # Step 3: Download the image
    print("\n[3/4] Downloading image...")
    image_data = download_image(image_url)
    print(f"  Downloaded {len(image_data)} bytes")

    # Step 4: Upload to OSS
    print("\n[4/4] Uploading to OSS...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    object_key = f"themes/banners/{code}_banner_{timestamp}.png"
    oss_url = upload_to_oss(image_data, object_key)
    print(f"  OSS URL: {oss_url}")

    return {
        "code": code,
        "name": name,
        "oss_url": oss_url,
        "original_url": image_url,
        "task_id": task_id
    }


def main():
    """
    Main entry point - generate banners for all themes.
    """
    print("=" * 70)
    print("Theme Banner Generator - Using Aliyun Wanx (Tongyi Wanxiang)")
    print("=" * 70)
    print(f"\nTotal themes to process: {len(THEME_PROMPTS)}")
    print(f"Image size: {IMAGE_WIDTH}x{IMAGE_HEIGHT}")
    print(f"Model: {WANX_MODEL}")
    print(f"OSS Bucket: {OSS_BUCKET}")

    results = []
    failed = []

    for i, theme in enumerate(THEME_PROMPTS, 1):
        print(f"\n\n{'#'*70}")
        print(f"# Theme {i}/{len(THEME_PROMPTS)}: {theme['name']}")
        print(f"{'#'*70}")

        try:
            result = generate_and_upload_banner(theme)
            results.append(result)
            print(f"\n[SUCCESS] {theme['name']} - {result['oss_url']}")
        except Exception as e:
            error_msg = str(e)
            print(f"\n[FAILED] {theme['name']} - {error_msg}")
            failed.append({
                "code": theme["code"],
                "name": theme["name"],
                "error": error_msg
            })

        # Rate limiting - wait between requests to avoid API throttling
        if i < len(THEME_PROMPTS):
            print("\nWaiting 5 seconds before next request...")
            time.sleep(5)

    # Print summary
    print("\n\n")
    print("=" * 70)
    print("GENERATION COMPLETE - SUMMARY")
    print("=" * 70)

    print(f"\nSuccessfully generated: {len(results)}/{len(THEME_PROMPTS)}")
    print(f"Failed: {len(failed)}/{len(THEME_PROMPTS)}")

    if results:
        print("\n--- Generated Banner URLs ---")
        for r in results:
            print(f"\n{r['code']}:")
            print(f"  Name: {r['name']}")
            print(f"  OSS URL: {r['oss_url']}")

    if failed:
        print("\n--- Failed Themes ---")
        for f in failed:
            print(f"\n{f['code']}: {f['error']}")

    # Save results to JSON file
    output_file = os.path.join(os.path.dirname(__file__), "banner_generation_results.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "total": len(THEME_PROMPTS),
            "success": len(results),
            "failed": len(failed),
            "results": results,
            "failures": failed
        }, f, ensure_ascii=False, indent=2)
    print(f"\n\nResults saved to: {output_file}")

    return results, failed


if __name__ == "__main__":
    results, failed = main()
    sys.exit(0 if not failed else 1)
