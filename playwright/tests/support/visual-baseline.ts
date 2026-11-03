import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256 } from './evidence-integrity';
import { diffEnv, type VisualEnvKey } from './visual-env';

/**
 * Baseline approval (PLAN-16 Phase 3, T3.3). Một baseline chỉ được tin khi có approval:
 * hash ảnh, người duyệt khác tác giả, lý do, env đã quan sát và danh sách mask có lý do.
 * Ảnh baseline CHỈ được ghi qua `approveBaseline`; file đổi sau khi duyệt (vd `--update-snapshots`)
 * hoặc env lệch đều bị chặn, không tự ghi nhận pass.
 */
export const APPROVAL_SCHEMA = 'visual-baselines/1';
export const APPROVAL_FILE = 'baselines.approved.json';

export interface MaskRule {
  selector: string;
  reason: string;
}

export interface BaselineApproval {
  sha256: string;
  bytes: number;
  approvedBy: string;
  approvedAt: string;
  reason: string;
  env: VisualEnvKey;
  masks: MaskRule[];
  /** Ứng viên đã được review: run/attempt và hash artifact evidence tạo ra nó. */
  source: { runId: string; attemptId: string; artifactSha256: string };
}

export interface ApprovalManifest {
  schemaVersion: typeof APPROVAL_SCHEMA;
  baselines: Record<string, BaselineApproval>;
}

export const approvalPathFor = (baselineFile: string) => path.join(path.dirname(baselineFile), APPROVAL_FILE);
const maskKey = (m: MaskRule) => `${m.selector}::${m.reason}`;

export function readApprovals(baselineFile: string): { manifest: ApprovalManifest | null; problems: string[] } {
  const file = approvalPathFor(baselineFile);
  if (!fs.existsSync(file)) return { manifest: null, problems: [] };
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as ApprovalManifest;
    if (manifest.schemaVersion !== APPROVAL_SCHEMA || typeof manifest.baselines !== 'object') {
      return { manifest: null, problems: [`APPROVAL_UNSUPPORTED: ${String(manifest.schemaVersion)}`] };
    }
    return { manifest, problems: [] };
  } catch (err) {
    return { manifest: null, problems: [`APPROVAL_UNREADABLE: ${(err as Error).message}`] };
  }
}

export function validateMasks(masks: readonly MaskRule[]): string[] {
  return masks
    .filter((m) => !m?.selector?.trim() || !m?.reason?.trim())
    .map((m) => `MASK_WITHOUT_REASON: '${String(m?.selector)}' needs a selector and a reason`);
}

function approvalProblems(entry: BaselineApproval): string[] {
  const problems: string[] = [];
  if (!/^[0-9a-f]{64}$/.test(entry?.sha256 ?? '')) problems.push('APPROVAL_INVALID: sha256');
  if (!entry?.approvedBy?.trim() || !entry?.reason?.trim()) problems.push('APPROVAL_INVALID: approvedBy/reason');
  if (Number.isNaN(Date.parse(entry?.approvedAt ?? ''))) problems.push('APPROVAL_INVALID: approvedAt');
  if (!entry?.env || !entry?.source?.artifactSha256) problems.push('APPROVAL_INVALID: env/source');
  if (!Array.isArray(entry?.masks)) problems.push('APPROVAL_INVALID: masks');
  else problems.push(...validateMasks(entry.masks));
  return problems;
}

/** Kiểm baseline trước (và sau) khi so ảnh. Có problem → caller phải fail, không so tiếp. */
export function checkBaseline(input: { file: string; env: VisualEnvKey; masks: readonly MaskRule[] }) {
  const name = path.basename(input.file);
  const problems = validateMasks(input.masks);
  const { manifest, problems: read } = readApprovals(input.file);
  problems.push(...read);
  const approval = manifest?.baselines[name] ?? null;
  if (!fs.existsSync(input.file)) {
    problems.push(`BASELINE_MISSING: ${name}`);
    return { problems, approval };
  }
  if (!approval) {
    problems.push(`BASELINE_UNAPPROVED: ${name} exists but has no approval`);
    return { problems, approval };
  }
  problems.push(...approvalProblems(approval));
  if (sha256(fs.readFileSync(input.file)) !== approval.sha256) {
    problems.push(`BASELINE_CHANGED: ${name} differs from the approved image`);
  }
  problems.push(...diffEnv(approval.env, input.env).map((d) => `STALE_BASELINE_ENV: ${d}`));
  const approvedMasks = new Set((approval.masks ?? []).map(maskKey));
  for (const m of input.masks) {
    if (!approvedMasks.has(maskKey(m))) problems.push(`MASK_NOT_APPROVED: '${m.selector}' (${m.reason})`);
  }
  return { problems, approval };
}

/**
 * Ghi baseline từ ứng viên đã review. Người duyệt phải khác tác giả và nêu lý do; tên người
 * duyệt là tự khai (chưa gắn danh tính) — gate thật cần chữ ký Master Authority.
 */
export function approveBaseline(input: {
  file: string;
  candidate: Buffer;
  approvedBy: string;
  author: string;
  reason: string;
  env: VisualEnvKey;
  masks: MaskRule[];
  source: BaselineApproval['source'];
}): BaselineApproval {
  const problems = validateMasks(input.masks);
  if (!input.approvedBy.trim() || input.approvedBy === input.author) problems.push('SELF_APPROVAL: approver must differ from author');
  if (!input.reason.trim()) problems.push('APPROVAL_WITHOUT_REASON');
  if (sha256(input.candidate) !== input.source.artifactSha256) problems.push('CANDIDATE_TAMPERED: bytes differ from evidence artifact');
  if (problems.length > 0) throw new Error(`APPROVAL_REJECTED: ${problems.join('; ')}`);
  fs.mkdirSync(path.dirname(input.file), { recursive: true });
  fs.writeFileSync(input.file, input.candidate);
  const { manifest } = readApprovals(input.file);
  const next: ApprovalManifest = manifest ?? { schemaVersion: APPROVAL_SCHEMA, baselines: {} };
  const entry: BaselineApproval = {
    sha256: sha256(input.candidate),
    bytes: input.candidate.length,
    approvedBy: input.approvedBy,
    approvedAt: new Date().toISOString(),
    reason: input.reason,
    env: input.env,
    masks: input.masks,
    source: input.source,
  };
  next.baselines[path.basename(input.file)] = entry;
  fs.writeFileSync(approvalPathFor(input.file), JSON.stringify(next, null, 2));
  return entry;
}
