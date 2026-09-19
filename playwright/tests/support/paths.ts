import path from 'node:path';

/** File session sinh bởi project `setup`, tái dùng cho mọi test cần đăng nhập. */
export const STORAGE_STATE = path.resolve(__dirname, '../../.auth/user.json');
