import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EvidenceArtifact } from './evidence-manifest';

/**
 * Toàn vẹn artifact (evidence-contract §5): hash bytes thực tế, path tương đối nằm
 * trong run root, chặn traversal/symlink escape. Checksum chỉ chứng minh integrity,
 * không phải chữ ký phê duyệt (ADR-16-02).
 */
export type IntegrityProblemKind =
  | 'UNSAFE_PATH'
  | 'SYMLINK_REJECTED'
  | 'MISSING_ARTIFACT'
  | 'SIZE_MISMATCH'
  | 'HASH_MISMATCH'
  | 'READ_ERROR';

export interface IntegrityProblem {
  path: string;
  kind: IntegrityProblemKind;
  detail: string;
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Chỉ nhận path tương đối kiểu POSIX, không `..`, không tuyệt đối, không ký tự điều khiển. */
export function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 400) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(value)) return false;
  if (value.startsWith('/') || /^[a-zA-Z]:/.test(value) || value.includes('://')) return false;
  return value.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/**
 * Resolve path trong root và xác nhận realpath không thoát ra ngoài (symlink escape).
 * Ném lỗi thay vì trả path không an toàn — caller không được đọc ngoài run root.
 */
export function resolveInsideRoot(root: string, relPath: string): string {
  if (!isSafeRelativePath(relPath)) throw new Error(`UNSAFE_PATH: ${relPath}`);
  const realRoot = fs.realpathSync(root);
  const candidate = path.resolve(realRoot, ...relPath.split('/'));
  const relative = path.relative(realRoot, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`UNSAFE_PATH: ${relPath}`);
  }
  if (!fs.existsSync(candidate)) return candidate;
  // Thư mục trung gian là symlink/junction trỏ ra ngoài cũng phải bị chặn, không chỉ file cuối.
  const realRelative = path.relative(realRoot, fs.realpathSync(candidate));
  if (fs.lstatSync(candidate).isSymbolicLink() || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error(`SYMLINK_REJECTED: ${relPath}`);
  }
  return candidate;
}

/** Hash lại bytes trên đĩa; artifact EXPIRED_UNAVAILABLE được báo unavailable, không phải lỗi. */
export function verifyArtifactsOnDisk(
  root: string,
  artifacts: readonly EvidenceArtifact[],
): { problems: IntegrityProblem[]; unavailable: string[] } {
  const problems: IntegrityProblem[] = [];
  const unavailable: string[] = [];
  for (const art of artifacts) {
    if (art.status === 'EXPIRED_UNAVAILABLE') {
      unavailable.push(art.path);
      continue;
    }
    let abs: string;
    try {
      abs = resolveInsideRoot(root, art.path);
    } catch (err) {
      const msg = (err as Error).message;
      const kind = msg.startsWith('SYMLINK') ? 'SYMLINK_REJECTED' : 'UNSAFE_PATH';
      problems.push({ path: String(art.path), kind, detail: msg });
      continue;
    }
    if (!fs.existsSync(abs)) {
      problems.push({ path: art.path, kind: 'MISSING_ARTIFACT', detail: 'file not found' });
      continue;
    }
    try {
      const bytes = fs.readFileSync(abs);
      if (bytes.length !== art.bytes) {
        problems.push({
          path: art.path,
          kind: 'SIZE_MISMATCH',
          detail: `expected ${art.bytes} bytes, got ${bytes.length}`,
        });
      } else if (sha256(bytes) !== art.sha256) {
        problems.push({ path: art.path, kind: 'HASH_MISMATCH', detail: 'sha256 differs from manifest' });
      }
    } catch (err) {
      problems.push({ path: art.path, kind: 'READ_ERROR', detail: (err as Error).message });
    }
  }
  return { problems, unavailable };
}
