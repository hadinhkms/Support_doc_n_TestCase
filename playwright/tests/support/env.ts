/**
 * Đọc biến môi trường theo kiểu fail-fast.
 * Không dùng giá trị mặc định giả (vd 'replace-me') vì test sẽ chạy âm thầm
 * với dữ liệu rác và cho kết quả sai thay vì báo lỗi cấu hình.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `[config] Thiếu biến môi trường bắt buộc: ${name}\n` +
        `  -> Sao chép playwright/.env.example thành playwright/.env và điền giá trị.\n` +
        `  -> Trên CI: khai báo ${name} trong repository secrets.`,
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

export const env = {
  get baseURL(): string {
    return optionalEnv('BASE_URL', 'http://localhost:3000');
  },
  get apiBaseURL(): string {
    return optionalEnv('API_BASE_URL', this.baseURL);
  },
};
