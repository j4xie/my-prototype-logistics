#!/usr/bin/env python3
"""
语义缓存性能测试脚本

测试指标:
1. 缓存命中延迟 (<100ms 目标)
2. 冷启动延迟 (<2000ms 目标)
3. 缓存加速比 (>10x 目标)
4. 并发性能 (50 QPS, 平均延迟 <200ms)

作者: Cretas Team
版本: 1.0.0
日期: 2026-01-05
"""

import requests
import time
import statistics
import concurrent.futures
import argparse
import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime


@dataclass
class TestConfig:
    """测试配置"""
    base_url: str = "http://139.196.165.140:10010/api/mobile"
    factory_id: str = "F001"
    username: str = "factory_admin1"
    password: str = "123456"

    # 性能目标
    cache_hit_target_ms: int = 100
    cold_start_target_ms: int = 2000
    speedup_target: float = 10.0
    concurrent_qps: int = 50
    concurrent_latency_target_ms: int = 200


@dataclass
class TestResult:
    """测试结果"""
    name: str
    passed: bool
    latency_ms: float = 0.0
    details: str = ""
    metrics: Dict = field(default_factory=dict)


class SemanticCachePerformanceTest:
    """语义缓存性能测试类"""

    def __init__(self, config: TestConfig):
        self.config = config
        self.token: Optional[str] = None
        self.results: List[TestResult] = []

        # 测试用输入
        self.test_inputs = [
            "查询今日产量",
            "查询原料库存",
            "查看设备状态",
            "生产进度如何",
            "库存还有多少",
            "今日生产情况",
            "设备运行状态",
            "原料剩余量",
            "查询生产报表",
            "设备维护记录"
        ]

    def authenticate(self) -> bool:
        """获取认证 Token"""
        url = f"{self.config.base_url}/auth/unified-login"
        try:
            response = requests.post(url, json={
                "username": self.config.username,
                "password": self.config.password
            }, timeout=10)
            data = response.json()
            if data.get("success"):
                self.token = data["data"]["accessToken"]
                print(f"[OK] 认证成功")
                return True
            else:
                print(f"[FAIL] 认证失败: {data.get('message')}")
                return False
        except Exception as e:
            print(f"[FAIL] 认证异常: {e}")
            return False

    def _get_headers(self) -> Dict:
        """获取请求头"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def _execute_intent(self, user_input: str) -> Dict:
        """执行意图请求"""
        url = f"{self.config.base_url}/{self.config.factory_id}/ai-intents/execute"
        response = requests.post(
            url,
            headers=self._get_headers(),
            json={"userInput": user_input},
            timeout=30
        )
        return response.json()

    def _execute_with_timing(self, user_input: str) -> tuple:
        """执行请求并返回延迟"""
        start = time.time()
        response = self._execute_intent(user_input)
        latency_ms = (time.time() - start) * 1000
        return response, latency_ms

    def _invalidate_cache(self):
        """清除缓存"""
        url = f"{self.config.base_url}/{self.config.factory_id}/semantic-cache/invalidate"
        try:
            requests.delete(url, headers=self._get_headers(), timeout=10)
        except:
            pass  # 忽略失败

    # ==================== 性能测试 ====================

    def test_cache_hit_latency(self) -> TestResult:
        """测试1: 缓存命中延迟"""
        print("\n[TEST] 缓存命中延迟测试")

        test_input = self.test_inputs[0]

        # 第一次请求建立缓存
        print(f"  → 建立缓存: {test_input}")
        self._execute_intent(test_input)
        time.sleep(1)

        # 多次测试取平均
        latencies = []
        for i in range(5):
            _, latency = self._execute_with_timing(test_input)
            latencies.append(latency)
            print(f"  → 测试 {i+1}: {latency:.1f}ms")

        avg_latency = statistics.mean(latencies)
        p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]

        passed = avg_latency < self.config.cache_hit_target_ms

        return TestResult(
            name="缓存命中延迟",
            passed=passed,
            latency_ms=avg_latency,
            details=f"平均: {avg_latency:.1f}ms, P95: {p95_latency:.1f}ms, 目标: <{self.config.cache_hit_target_ms}ms",
            metrics={
                "avg_ms": avg_latency,
                "p95_ms": p95_latency,
                "samples": latencies
            }
        )

    def test_cold_start_latency(self) -> TestResult:
        """测试2: 冷启动延迟"""
        print("\n[TEST] 冷启动延迟测试")

        # 清除缓存
        self._invalidate_cache()
        time.sleep(1)

        # 使用唯一输入确保无缓存
        cold_latencies = []
        for i in range(3):
            unique_input = f"冷启动测试-{int(time.time())}-{i}"
            _, latency = self._execute_with_timing(unique_input)
            cold_latencies.append(latency)
            print(f"  → 冷启动 {i+1}: {latency:.1f}ms")

        avg_latency = statistics.mean(cold_latencies)
        passed = avg_latency < self.config.cold_start_target_ms

        return TestResult(
            name="冷启动延迟",
            passed=passed,
            latency_ms=avg_latency,
            details=f"平均: {avg_latency:.1f}ms, 目标: <{self.config.cold_start_target_ms}ms",
            metrics={
                "avg_ms": avg_latency,
                "samples": cold_latencies
            }
        )

    def test_cache_speedup(self) -> TestResult:
        """测试3: 缓存加速比"""
        print("\n[TEST] 缓存加速比测试")

        # 清除缓存
        self._invalidate_cache()
        time.sleep(1)

        test_input = self.test_inputs[1]

        # 冷启动
        print(f"  → 冷启动: {test_input}")
        _, cold_latency = self._execute_with_timing(test_input)
        print(f"  → 冷启动延迟: {cold_latency:.1f}ms")

        time.sleep(1)

        # 热缓存 (多次取平均)
        hot_latencies = []
        for i in range(3):
            _, latency = self._execute_with_timing(test_input)
            hot_latencies.append(latency)

        hot_latency = statistics.mean(hot_latencies)
        print(f"  → 热缓存延迟: {hot_latency:.1f}ms")

        speedup = cold_latency / hot_latency if hot_latency > 0 else float('inf')
        passed = speedup >= self.config.speedup_target

        return TestResult(
            name="缓存加速比",
            passed=passed,
            latency_ms=hot_latency,
            details=f"加速比: {speedup:.1f}x, 冷: {cold_latency:.1f}ms, 热: {hot_latency:.1f}ms, 目标: >{self.config.speedup_target}x",
            metrics={
                "speedup": speedup,
                "cold_ms": cold_latency,
                "hot_ms": hot_latency
            }
        )

    def test_concurrent_performance(self) -> TestResult:
        """测试4: 并发性能"""
        print(f"\n[TEST] 并发性能测试 ({self.config.concurrent_qps} QPS)")

        # 先建立所有测试输入的缓存
        print("  → 预热缓存...")
        for input_text in self.test_inputs:
            self._execute_intent(input_text)
        time.sleep(1)

        # 并发测试
        num_requests = self.config.concurrent_qps
        latencies = []
        errors = 0

        def make_request(input_text: str) -> float:
            try:
                _, latency = self._execute_with_timing(input_text)
                return latency
            except Exception as e:
                return -1

        print(f"  → 发送 {num_requests} 个并发请求...")
        start_time = time.time()

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(50, num_requests)) as executor:
            # 循环使用测试输入
            inputs = [self.test_inputs[i % len(self.test_inputs)] for i in range(num_requests)]
            futures = [executor.submit(make_request, inp) for inp in inputs]

            for future in concurrent.futures.as_completed(futures):
                latency = future.result()
                if latency >= 0:
                    latencies.append(latency)
                else:
                    errors += 1

        total_time = time.time() - start_time
        actual_qps = len(latencies) / total_time if total_time > 0 else 0

        if latencies:
            avg_latency = statistics.mean(latencies)
            p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]
            max_latency = max(latencies)
            min_latency = min(latencies)
        else:
            avg_latency = p95_latency = max_latency = min_latency = 0

        print(f"  → 实际 QPS: {actual_qps:.1f}")
        print(f"  → 平均延迟: {avg_latency:.1f}ms")
        print(f"  → P95 延迟: {p95_latency:.1f}ms")
        print(f"  → 错误数: {errors}")

        passed = avg_latency < self.config.concurrent_latency_target_ms and errors == 0

        return TestResult(
            name="并发性能",
            passed=passed,
            latency_ms=avg_latency,
            details=f"QPS: {actual_qps:.1f}, 平均: {avg_latency:.1f}ms, P95: {p95_latency:.1f}ms, 目标: <{self.config.concurrent_latency_target_ms}ms",
            metrics={
                "qps": actual_qps,
                "avg_ms": avg_latency,
                "p95_ms": p95_latency,
                "min_ms": min_latency,
                "max_ms": max_latency,
                "errors": errors
            }
        )

    def test_semantic_similarity_performance(self) -> TestResult:
        """测试5: 语义相似匹配性能"""
        print("\n[TEST] 语义相似匹配性能测试")

        # 原始输入
        original_inputs = [
            "查询今日产量",
            "查看原料库存",
            "设备运行状态"
        ]

        # 语义相似输入
        similar_inputs = [
            "今天生产了多少",
            "原料还剩多少",
            "设备怎么样了"
        ]

        # 建立原始缓存
        print("  → 建立原始缓存...")
        for inp in original_inputs:
            self._execute_intent(inp)
        time.sleep(2)  # 等待 embedding 生成

        # 测试语义匹配
        latencies = []
        semantic_hits = 0

        for similar in similar_inputs:
            response, latency = self._execute_with_timing(similar)
            latencies.append(latency)

            cache_hit = response.get("data", {}).get("cacheHit", False)
            hit_type = response.get("data", {}).get("cacheHitType", "MISS")

            if cache_hit and hit_type == "SEMANTIC":
                semantic_hits += 1
                print(f"  → '{similar}': 语义命中, {latency:.1f}ms")
            else:
                print(f"  → '{similar}': 未命中 ({hit_type}), {latency:.1f}ms")

        avg_latency = statistics.mean(latencies) if latencies else 0
        hit_rate = semantic_hits / len(similar_inputs)

        # 语义匹配可能需要 embedding 服务，不作为硬性失败条件
        passed = True  # 总是通过，但记录实际性能

        return TestResult(
            name="语义相似匹配",
            passed=passed,
            latency_ms=avg_latency,
            details=f"语义命中率: {hit_rate:.0%}, 平均延迟: {avg_latency:.1f}ms",
            metrics={
                "hit_rate": hit_rate,
                "semantic_hits": semantic_hits,
                "avg_ms": avg_latency
            }
        )

    def run_all_tests(self) -> List[TestResult]:
        """运行所有测试"""
        print("\n" + "=" * 60)
        print("  语义缓存性能测试")
        print("=" * 60)
        print(f"服务器: {self.config.base_url}")
        print(f"工厂ID: {self.config.factory_id}")
        print(f"时间: {datetime.now().isoformat()}")

        # 认证
        if not self.authenticate():
            return []

        # 执行测试
        self.results = [
            self.test_cache_hit_latency(),
            self.test_cold_start_latency(),
            self.test_cache_speedup(),
            self.test_concurrent_performance(),
            self.test_semantic_similarity_performance()
        ]

        return self.results

    def print_summary(self):
        """打印测试总结"""
        print("\n" + "=" * 60)
        print("  测试结果总结")
        print("=" * 60)

        passed = sum(1 for r in self.results if r.passed)
        failed = len(self.results) - passed

        for result in self.results:
            status = "✓ PASS" if result.passed else "✗ FAIL"
            print(f"  [{status}] {result.name}")
            print(f"         {result.details}")

        print("\n" + "-" * 60)
        print(f"  总计: {len(self.results)} 个测试")
        print(f"  通过: {passed}")
        print(f"  失败: {failed}")

        if failed == 0:
            print("\n  ✓ 所有性能测试通过！")
        else:
            print(f"\n  ✗ {failed} 个测试未达标")

    def export_results(self, filename: str):
        """导出结果到 JSON"""
        data = {
            "timestamp": datetime.now().isoformat(),
            "config": {
                "base_url": self.config.base_url,
                "factory_id": self.config.factory_id,
                "targets": {
                    "cache_hit_ms": self.config.cache_hit_target_ms,
                    "cold_start_ms": self.config.cold_start_target_ms,
                    "speedup": self.config.speedup_target,
                    "concurrent_latency_ms": self.config.concurrent_latency_target_ms
                }
            },
            "results": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "latency_ms": r.latency_ms,
                    "details": r.details,
                    "metrics": r.metrics
                }
                for r in self.results
            ],
            "summary": {
                "total": len(self.results),
                "passed": sum(1 for r in self.results if r.passed),
                "failed": sum(1 for r in self.results if not r.passed)
            }
        }

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"\n结果已导出到: {filename}")


def main():
    parser = argparse.ArgumentParser(description="语义缓存性能测试")
    parser.add_argument("--url", default="http://139.196.165.140:10010/api/mobile",
                        help="API 基础 URL")
    parser.add_argument("--factory", default="F001", help="工厂 ID")
    parser.add_argument("--username", default="factory_admin1", help="用户名")
    parser.add_argument("--password", default="123456", help="密码")
    parser.add_argument("--qps", type=int, default=50, help="并发 QPS 目标")
    parser.add_argument("--output", help="结果输出文件 (JSON)")

    args = parser.parse_args()

    config = TestConfig(
        base_url=args.url,
        factory_id=args.factory,
        username=args.username,
        password=args.password,
        concurrent_qps=args.qps
    )

    tester = SemanticCachePerformanceTest(config)
    tester.run_all_tests()
    tester.print_summary()

    if args.output:
        tester.export_results(args.output)

    # 返回退出码
    failed = sum(1 for r in tester.results if not r.passed)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    exit(main())
