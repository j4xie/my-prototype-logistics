/**
 * Result类型 - 用于明确区分成功和失败的返回值
 *
 * 使用场景：
 * 1. 替代返回null掩盖错误原因的模式
 * 2. 函数可能有多种失败原因时
 * 3. 需要调用者显式处理错误时
 *
 * @example
 * ```typescript
 * // ❌ BAD: 返回null无法区分失败原因
 * function getUserId(): number | null {
 *   if (!user) return null;
 *   if (isNaN(userId)) return null;
 *   return userId;
 * }
 *
 * // ✅ GOOD: 使用Result类型明确错误原因
 * function getUserId(): Result<number, UserIdError> {
 *   if (!user) {
 *     return { ok: false, error: 'NO_USER' };
 *   }
 *   if (isNaN(userId)) {
 *     return { ok: false, error: 'INVALID_ID' };
 *   }
 *   return { ok: true, value: userId };
 * }
 *
 * // 使用时
 * const result = getUserId();
 * if (!result.ok) {
 *   switch (result.error) {
 *     case 'NO_USER':
 *       showError('请先登录');
 *       break;
 *     case 'INVALID_ID':
 *       showError('用户ID格式错误');
 *       break;
 *   }
 *   return;
 * }
 * const userId = result.value; // 类型安全的number
 * ```
 */

/**
 * Result类型定义
 * @template T - 成功时的值类型
 * @template E - 失败时的错误类型（默认为string）
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * 创建成功的Result
 */
export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * 创建失败的Result
 */
export function failure<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * 判断Result是否成功
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true;
}

/**
 * 判断Result是否失败
 */
export function isFailure<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}

/**
 * 从Result中获取值，如果失败则抛出错误
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Attempted to unwrap a failure result: ${JSON.stringify(result.error)}`);
}

/**
 * 从Result中获取值，如果失败则返回默认值
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * 将Promise包装为Result
 */
export async function wrapPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return success(value);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * 映射Result的值
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? success(fn(result.value)) : result;
}

/**
 * 映射Result的错误
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.ok ? result : failure(fn(result.error));
}

/**
 * 链式调用Result (flatMap)
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}
