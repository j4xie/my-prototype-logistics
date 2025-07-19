import { expect } from '@jest/globals';

export interface AppResponse<T = any> {
  code: number;
  message: string;
  data: T;
  success: boolean;
}

export async function expectAppSuccess<T>(
  resp: Response,
  assert: (data: T) => void,
) {
  expect(resp.status).toBe(200);
  const body = await resp.json() as AppResponse<T>;
  expect(body.success).toBe(true);
  assert(body.data);
}

export async function expectAppCreated<T>(
  resp: Response,
  assert: (data: T) => void,
) {
  expect(resp.status).toBe(201);
  const body = await resp.json() as AppResponse<T>;
  expect(body.success).toBe(true);
  assert(body.data);
}

export async function expectAppError(
  resp: Response,
  expectedStatus: number = 404
) {
  expect(resp.status).toBe(expectedStatus);
}
