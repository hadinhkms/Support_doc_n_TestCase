import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env, optionalEnv } from '../support/env';

export interface ApiRequestOptions {
  token?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: unknown;
}

/**
 * Helper gọi API để seed/cleanup dữ liệu và kiểm thử hợp đồng API chuyên sâu.
 *
 * Nguyên tắc: tạo dữ liệu bằng API khi có thể, UI chỉ dùng để kiểm chứng UI.
 * Đây là contract mẫu - thay endpoint cho đúng backend thật.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private get headers(): Record<string, string> {
    const token = optionalEnv('API_TOKEN', '');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private buildHeaders(
    custom?: Record<string, string>,
    tokenOverride?: string,
  ): Record<string, string> {
    const token = tokenOverride !== undefined ? tokenOverride : optionalEnv('API_TOKEN', '');
    return {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...custom,
    };
  }

  public url(pathname: string): string {
    return new URL(pathname, env.apiBaseURL).toString();
  }

  async get(pathname: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request.get(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
    });
  }

  async post(pathname: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request.post(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
      data: options?.data,
    });
  }

  async put(pathname: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request.put(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
      data: options?.data,
    });
  }

  async patch(pathname: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request.patch(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
      data: options?.data,
    });
  }

  async delete(pathname: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request.delete(this.url(pathname), {
      headers: this.buildHeaders(options?.headers, options?.token),
      params: options?.params,
      data: options?.data,
    });
  }

  /** Cleanup idempotent cho tài nguyên bất kỳ: 2xx và 404 đều coi như đã dọn sạch. */
  async deleteIgnoreNotFound(pathname: string, token?: string): Promise<void> {
    const response = await this.delete(pathname, { token });
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`[api] Cleanup DELETE ${pathname} thất bại: ${response.status()}`);
    }
  }

  /** Tạo user để test, trả về id dùng cho cleanup. */
  async createUser(payload: { email: string; password: string; role: string }): Promise<string> {
    const response = await this.request.post(this.url('/api/users'), {
      headers: this.headers,
      data: payload,
    });
    if (!response.ok()) {
      throw new Error(
        `[api] Seed user thất bại: ${response.status()} ${response.statusText()} - ${await response.text()}`,
      );
    }
    const body = (await response.json()) as { id: string };
    return body.id;
  }

  /** Cleanup idempotent: 404 coi như đã xoá, không làm fail teardown. */
  async deleteUser(id: string): Promise<void> {
    const response = await this.request.delete(this.url(`/api/users/${id}`), {
      headers: this.headers,
    });
    if (!response.ok() && response.status() !== 404) {
      throw new Error(`[api] Cleanup user ${id} thất bại: ${response.status()}`);
    }
  }
}
