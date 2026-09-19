import type { APIRequestContext } from '@playwright/test';
import { env, optionalEnv } from '../support/env';

/**
 * Helper gọi API để seed/cleanup dữ liệu.
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

  private url(pathname: string): string {
    return new URL(pathname, env.apiBaseURL).toString();
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
