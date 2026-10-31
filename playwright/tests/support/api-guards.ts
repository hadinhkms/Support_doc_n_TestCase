import { expect, type APIResponse } from '@playwright/test';

export type JsonFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ApiSchemaContractOptions {
  expectedStatus?: number | number[];
  requiredFields?: Record<string, JsonFieldType>;
  forbiddenFields?: string[];
  requireNoSniff?: boolean;
}

export interface BolaForbiddenOptions {
  allowedStatuses?: number[];
  leakedValues?: string[];
  verifyUnchanged?: () => Promise<void>;
}

export interface MassAssignmentOptions {
  rejectedOrSuccessStatuses?: number[];
  forbiddenEchoFields?: string[];
}

export interface IdempotentApiMutationOptions {
  concurrency?: number;
  successStatuses?: number[];
  conflictOrReplayStatuses?: number[];
  maxSuccessCount?: number;
}

function getActualType(val: unknown): string {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

/**
 * Kiểm chứng hợp đồng Schema API, Content-Type và chống lộ trường nhạy cảm (OWASP API3).
 */
export async function expectApiSchemaContract(
  response: APIResponse,
  contract: ApiSchemaContractOptions = {},
): Promise<Record<string, unknown>> {
  const {
    expectedStatus = 200,
    requiredFields = {},
    forbiddenFields = ['password', 'passwordHash', 'salt', 'secret', 'resetToken'],
    requireNoSniff = false,
  } = contract;

  const statusList = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  expect(
    statusList,
    `HTTP status ${response.status()} không nằm trong tập mong đợi [${statusList.join(', ')}]`,
  ).toContain(response.status());

  const headers = response.headers();
  expect(headers['content-type'] || '', 'API phải trả về Content-Type application/json').toContain(
    'application/json',
  );
  if (requireNoSniff) {
    expect(headers['x-content-type-options'], 'Thiếu header X-Content-Type-Options: nosniff').toBe(
      'nosniff',
    );
  }

  const body = (await response.json()) as Record<string, unknown>;
  expect(body !== null && typeof body === 'object', 'Body JSON phải là một object').toBe(true);

  for (const [field, expectedType] of Object.entries(requiredFields)) {
    expect(
      Object.prototype.hasOwnProperty.call(body, field),
      `Response thiếu trường bắt buộc "${field}"`,
    ).toBe(true);
    expect(
      getActualType(body[field]),
      `Trường "${field}" phải có kiểu "${expectedType}" nhưng nhận "${getActualType(body[field])}"`,
    ).toBe(expectedType);
  }

  for (const secretKey of forbiddenFields) {
    expect(
      Object.prototype.hasOwnProperty.call(body, secretKey),
      `Data Over-Exposure: Response làm lộ trường nhạy cảm "${secretKey}"`,
    ).toBe(false);
  }

  return body;
}

/**
 * Kiểm chứng chống truy cập chéo tài nguyên BOLA/IDOR (OWASP API1) hoặc vượt quyền BFLA (OWASP API5).
 */
export async function expectBolaForbidden(
  response: APIResponse,
  options: BolaForbiddenOptions = {},
): Promise<void> {
  const { allowedStatuses = [401, 403, 404], leakedValues = [], verifyUnchanged } = options;

  expect(
    allowedStatuses,
    `BOLA/BFLA Guard: Mong đợi status thuộc [${allowedStatuses.join(', ')}] nhưng nhận ${response.status()}`,
  ).toContain(response.status());

  const rawText = await response.text();
  for (const sensitive of leakedValues) {
    if (sensitive && sensitive.trim()) {
      expect(
        rawText.includes(sensitive),
        `BOLA/IDOR Leak: Response lỗi vẫn làm rò rỉ dữ liệu của nạn nhân ("${sensitive}")`,
      ).toBe(false);
    }
  }

  if (verifyUnchanged) {
    await verifyUnchanged();
  }
}

/**
 * Kiểm chứng chống Mass Assignment / BOPLA (OWASP API3) khi bơm trường đặc quyền vào payload.
 */
export async function expectMassAssignmentIgnored(
  response: APIResponse,
  verifyPersistedSafe: () => Promise<void>,
  options: MassAssignmentOptions = {},
): Promise<void> {
  const {
    rejectedOrSuccessStatuses = [200, 201, 204, 400, 403, 422],
    forbiddenEchoFields = [],
  } = options;

  expect(
    rejectedOrSuccessStatuses,
    `Mass Assignment Guard: Status ${response.status()} không hợp lệ (không được trả 5xx)`,
  ).toContain(response.status());

  if (forbiddenEchoFields.length > 0 && (response.headers()['content-type'] || '').includes('json')) {
    const body = (await response.json()) as Record<string, unknown>;
    for (const key of forbiddenEchoFields) {
      expect(
        Object.prototype.hasOwnProperty.call(body, key),
        `Mass Assignment: Response phản chiếu trường đặc quyền cấm gán "${key}"`,
      ).toBe(false);
    }
  }

  await verifyPersistedSafe();
}

/**
 * Kiểm chứng tính bất biến (Idempotency) & chống Race Condition ở tầng API khi bắn đồng thời N request.
 */
export async function expectIdempotentApiMutation(
  sendMutation: (index: number) => Promise<APIResponse>,
  options: IdempotentApiMutationOptions = {},
): Promise<APIResponse[]> {
  const {
    concurrency = 3,
    successStatuses = [200, 201, 204],
    conflictOrReplayStatuses = [409, 422, 429],
    maxSuccessCount = 1,
  } = options;

  const responses = await Promise.all(
    Array.from({ length: concurrency }, (_, idx) => sendMutation(idx)),
  );
  const statuses = responses.map((r) => r.status());

  for (const st of statuses) {
    expect(st, `API Race Condition gây lỗi server 5xx (status=${st})`).toBeLessThan(500);
    expect(
      [...successStatuses, ...conflictOrReplayStatuses],
      `Status ${st} không thuộc tập thành công hoặc từ chối hợp lệ`,
    ).toContain(st);
  }

  const successCount = statuses.filter((s) => successStatuses.includes(s)).length;
  expect(
    successCount,
    `Idempotency vi phạm: Có ${successCount}/${concurrency} request thành công (tối đa cho phép: ${maxSuccessCount})`,
  ).toBeLessThanOrEqual(maxSuccessCount);

  return responses;
}

