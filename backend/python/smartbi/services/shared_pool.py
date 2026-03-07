"""
Shared bounded thread pool for SmartBI services.

Replaces scattered unbounded ThreadPoolExecutor instances with a single
bounded pool. Max 8 workers (matches server CPU count).
"""
from concurrent.futures import ThreadPoolExecutor

# Shared pool — bounded to server CPU count (8C)
shared_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="smartbi")
