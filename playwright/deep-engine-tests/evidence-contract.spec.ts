import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EvidenceArtifact {
  uri: string;
  sha256?: string;
  mimeType: string;
  bytes: number;
  status: 'ACTIVE' | 'EXPIRED_UNAVAILABLE';
  expiresAt?: string;
}

export interface EvidenceManifest {
  schemaVersion: '1.0';
  identity: {
    runId: string;
    issueId?: string;
    testId: string;
    project: string;
  };
  attempt: {
    attemptId: string;
    workerIndex: number;
    shardIndex: number;
    retryIndex: number;
  };
  source: {
    qaRevision: string;
    appBuild?: string;
    isDirty: boolean;
    diffDigest?: string;
  };
  execution: {
    argv: string[];
    cwd: string;
    startedAt: string;
    finishedAt: string;
    exitCode: number;
    matchedCount: number;
  };
  artifacts: EvidenceArtifact[];
  observables?: {
    expected: string;
    actual: string;
    assertionAnchor?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /(password|secret|token|auth_token)\s*[:=]\s*[^\s,]+/i,
  /Cookie:\s*[^;\s]+session=[^;\s]+/i,
];

const TRAVERSAL_PATTERN = /(\.\.[/\\]|[/\\]\.\.|^[/\\]|^[a-zA-Z]:)/;

/**
 * Validator thực thi hợp đồng Evidence Manifest theo ADR-16-01 và evidence-contract.md
 */
export function validateEvidenceManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }

  const m = manifest as Partial<EvidenceManifest>;

  if (m.schemaVersion !== '1.0') {
    errors.push(`Invalid schemaVersion: expected '1.0', got '${m.schemaVersion}'`);
  }

  if (!m.identity?.runId || typeof m.identity.runId !== 'string') {
    errors.push("Missing required field: 'identity.runId'");
  }
  if (!m.identity?.testId || typeof m.identity.testId !== 'string') {
    errors.push("Missing required field: 'identity.testId'");
  }
  if (!m.identity?.project || typeof m.identity.project !== 'string') {
    errors.push("Missing required field: 'identity.project'");
  }

  if (
    !m.attempt?.attemptId ||
    typeof m.attempt.workerIndex !== 'number' ||
    typeof m.attempt.shardIndex !== 'number'
  ) {
    errors.push("Missing or invalid 'attempt' block (attemptId, workerIndex, shardIndex)");
  }

  if (!m.source?.qaRevision || !/^[0-9a-f]{7,40}$/i.test(m.source.qaRevision)) {
    errors.push("Missing or invalid 'source.qaRevision' (must be 7-40 hex chars)");
  }

  if (m.execution) {
    if (m.execution.matchedCount === 0) {
      errors.push("INVALID_EMPTY_RUN: matchedCount cannot be 0 for verified test execution");
    }

    const fullCmd = (m.execution.argv ?? []).join(' ');
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(fullCmd) || pat.test(m.execution.cwd ?? '')) {
        errors.push(`SECRET_LEAK_DETECTED: Execution parameters contain sensitive tokens`);
        break;
      }
    }
  } else {
    errors.push("Missing required 'execution' block");
  }

  if (!Array.isArray(m.artifacts)) {
    errors.push("Missing 'artifacts' list");
  } else {
    for (const art of m.artifacts) {
      if (!art.uri || TRAVERSAL_PATTERN.test(art.uri)) {
        errors.push(`PATH_TRAVERSAL_DETECTED: Artifact URI '${art.uri}' escapes run root`);
      }
      if (art.expiresAt && new Date(art.expiresAt).getTime() < Date.now()) {
        if (art.status !== 'EXPIRED_UNAVAILABLE') {
          errors.push(
            `EXPIRED_ARTIFACT_VIOLATION: Artifact '${art.uri}' is past TTL but status is '${art.status}'`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Xây dựng đường dẫn namespace độc lập cho từng worker theo ADR-16-03
 */
export function buildWorkerArtifactPath(
  runId: string,
  shardIndex: number,
  workerIndex: number,
  fileName: string,
): string {
  const safeRun = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFile = path.basename(fileName);
  return `artifacts/${safeRun}/shard_${shardIndex}_worker_${workerIndex}/${safeFile}`;
}

test.describe('Phase 0 - Evidence Contract & Governance (TC-16-P0-1..3)', () => {
  const sampleRevision = '5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02';

  const validManifest: EvidenceManifest = {
    schemaVersion: '1.0',
    identity: {
      runId: 'RUN-20261102-001',
      issueId: 'ISSUE-16-P0',
      testId: 'TC-16-P0-1',
      project: 'qa-workspace',
    },
    attempt: {
      attemptId: 'ATT-001',
      workerIndex: 0,
      shardIndex: 0,
      retryIndex: 0,
    },
    source: {
      qaRevision: sampleRevision,
      appBuild: 'build-1042',
      isDirty: false,
    },
    execution: {
      argv: ['playwright', 'test', '-c', 'deep-engine.config.ts', 'evidence-contract.spec.ts'],
      cwd: 'D:/_QA_Test_Automation',
      startedAt: '2026-11-02T12:00:00Z',
      finishedAt: '2026-11-02T12:00:03Z',
      exitCode: 0,
      matchedCount: 3,
    },
    artifacts: [
      {
        uri: 'artifacts/RUN-20261102-001/shard_0_worker_0/evidence.png',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        mimeType: 'image/png',
        bytes: 14200,
        status: 'ACTIVE',
      },
    ],
    observables: {
      expected: 'Contract validated successfully',
      actual: 'Contract validated successfully',
      assertionAnchor: 'evidence-contract.spec.ts:120',
    },
  };

  test('HM-09 - TC-16-P0-01 - AC-16-P0-1: Public caller + healthy control validates schema and inventory', async () => {
    // 1. Kiểm tra validation của valid manifest
    const res = validateEvidenceManifest(validManifest);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);

    // 2. Kiểm tra tài liệu testing capability inventory trên đĩa
    const inventoryPath = path.resolve(__dirname, '../../docs/testing-capability-inventory.md');
    expect(fs.existsSync(inventoryPath)).toBe(true);

    const content = fs.readFileSync(inventoryPath, 'utf-8');
    expect(content).toContain(sampleRevision);
    expect(content).toContain('`Existing`');
    expect(content).toContain('`Partial`');
    expect(content).toContain('`Proposed`');

    // 3. Đối chiếu các file Existing trong inventory phải thực sự tồn tại
    const existingPointers = [
      'playwright/tests/support/ui-checks.ts',
      'playwright/tests/support/deep-guards.ts',
      'playwright/tests/fixtures/runtime-trap.ts',
      'tools/qa/lib/commands.js',
    ];

    for (const ptr of existingPointers) {
      const fullPath = path.resolve(__dirname, '../../', ptr);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  test('HM-09 - TC-16-P0-02 - AC-16-P0-2: Negative / failure injection detects missing fields, leaks, and traversal', async () => {
    // 1. Missing required field (runId)
    const missingRunId = JSON.parse(JSON.stringify(validManifest));
    delete missingRunId.identity.runId;
    const res1 = validateEvidenceManifest(missingRunId);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.includes('identity.runId'))).toBe(true);

    // 2. Secret leak in execution parameters
    const leakManifest = JSON.parse(JSON.stringify(validManifest));
    leakManifest.execution.argv = [
      'playwright',
      'test',
      '--token',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret',
    ];
    const res2 = validateEvidenceManifest(leakManifest);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.includes('SECRET_LEAK_DETECTED'))).toBe(true);

    // 3. Path traversal in artifact URI
    const traversalManifest = JSON.parse(JSON.stringify(validManifest));
    traversalManifest.artifacts[0].uri = '../../etc/passwd';
    const res3 = validateEvidenceManifest(traversalManifest);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.includes('PATH_TRAVERSAL_DETECTED'))).toBe(true);

    // 4. Invalid revision format
    const invalidShaManifest = JSON.parse(JSON.stringify(validManifest));
    invalidShaManifest.source.qaRevision = 'not-a-valid-sha';
    const res4 = validateEvidenceManifest(invalidShaManifest);
    expect(res4.valid).toBe(false);
    expect(res4.errors.some((e) => e.includes('source.qaRevision'))).toBe(true);
  });

  test('HM-09 - TC-16-P0-03 - AC-16-P0-3: Boundary, multi-worker namespace isolation and expired tombstone', async () => {
    // 1. Boundary: matchedCount === 0 cannot claim PASS
    const emptyRunManifest = JSON.parse(JSON.stringify(validManifest));
    emptyRunManifest.execution.matchedCount = 0;
    const resEmpty = validateEvidenceManifest(emptyRunManifest);
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.errors.some((e) => e.includes('INVALID_EMPTY_RUN'))).toBe(true);

    // 2. Namespace isolation for parallel workers
    const pathWorker0 = buildWorkerArtifactPath('RUN-001', 0, 0, 'screen.png');
    const pathWorker1 = buildWorkerArtifactPath('RUN-001', 0, 1, 'screen.png');
    expect(pathWorker0).toBe('artifacts/RUN-001/shard_0_worker_0/screen.png');
    expect(pathWorker1).toBe('artifacts/RUN-001/shard_0_worker_1/screen.png');
    expect(pathWorker0).not.toBe(pathWorker1);

    // 3. Expired artifact without tombstone is rejected; with tombstone is accepted
    const expiredBad = JSON.parse(JSON.stringify(validManifest));
    expiredBad.artifacts[0].expiresAt = '2020-01-01T00:00:00Z';
    expiredBad.artifacts[0].status = 'ACTIVE';
    const resExpiredBad = validateEvidenceManifest(expiredBad);
    expect(resExpiredBad.valid).toBe(false);
    expect(resExpiredBad.errors.some((e) => e.includes('EXPIRED_ARTIFACT_VIOLATION'))).toBe(true);

    const expiredGood = JSON.parse(JSON.stringify(validManifest));
    expiredGood.artifacts[0].expiresAt = '2020-01-01T00:00:00Z';
    expiredGood.artifacts[0].status = 'EXPIRED_UNAVAILABLE';
    const resExpiredGood = validateEvidenceManifest(expiredGood);
    expect(resExpiredGood.valid).toBe(true);
  });
});
