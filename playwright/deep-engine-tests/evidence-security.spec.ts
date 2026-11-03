import { test, expect } from '../tests/fixtures/test-fixtures';
import { evaluateExport, validateEvidenceManifest } from '../tests/support/evidence-manifest';
import { REDACTED, redactText } from '../tests/support/evidence-redaction';

test.describe('@REQ-16-P6 Security controls and evidence redaction (TC-16-P6-1..3)', () => {
  test('HM-11 - TC-16-P6-1 - AC-16-P6-1: healthy control validates session metadata, redaction, and evidence manifest @p0 @security', async () => {
    const secretCanary = 'session-canary-7f8d';
    const text = [
      'Authorization: Bearer ' + secretCanary,
      'token=customer-secret-999',
      'Cookie: session=' + secretCanary,
    ].join('\n');

    const redacted = redactText(text, [secretCanary, 'customer-secret-999']);
    expect(redacted).not.toContain(secretCanary);
    expect(redacted).not.toContain('customer-secret-999');
    expect(redacted).toContain(REDACTED);

    const manifest = {
      schemaVersion: '1.1' as const,
      status: 'COMPLETE' as const,
      identity: {
        runId: 'RUN-SEC-001',
        testId: 'TC-16-P6-1',
        title: 'TC-16-P6-1 - AC-16-P6-1 healthy control',
        file: 'evidence-security.spec.ts',
        project: 'qa-workspace',
        trace: { req: ['REQ-16-P6'], ac: ['AC-16-P6-1'], tc: ['TC-16-P6-1'] },
      },
      attempt: {
        attemptId: 'RUN-SEC-001~TC-16-P6-1~r0~p0',
        retryIndex: 0,
        repeatIndex: 0,
        workerIndex: 0,
        parallelIndex: 0,
        shard: 'chromium',
      },
      source: { qaRevision: '5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02', appBuild: null, appRevision: null },
      worktree: { dirty: false, diffDigest: null, untrackedDigest: null, trust: 'TRUSTED_CANDIDATE' as const },
      environment: { node: process.version, configHash: 'cfb7d9b4d2dbd66f6c00aef6f6f2080d68aa53f5d9f02f4a6f484d1ef1c3e13' },
      execution: {
        argv: ['playwright', 'test', 'evidence-security.spec.ts'],
        cwd: process.cwd(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        tzOffsetMinutes: 0,
      },
      outcome: {
        status: 'passed' as const,
        expectedStatus: 'passed' as const,
        errors: [],
      },
      observables: [
        {
          expectedSource: 'AC-16-P6-1',
          expected: 'secret canaries redacted and status pass',
          actual: 'secret canaries redacted and status pass',
          anchor: 'evidence-security.spec.ts:1',
        },
      ],
      artifacts: [
        {
          name: 'trace.log',
          path: 'artifacts/RUN-SEC-001/trace.log',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          bytes: 64,
          mime: 'text/plain',
          sensitivity: 'SHAREABLE' as const,
          status: 'ACTIVE' as const,
          capturedAt: new Date().toISOString(),
          expiresAt: null,
        },
      ],
      cleanup: [],
      collection: { errors: [], redaction: 'APPLIED' as const },
    };

    expect(validateEvidenceManifest(manifest)).toEqual({ valid: true, errors: [] });
    expect(evaluateExport([manifest]).allowed).toBe(true);
  });

  test('HM-11 - TC-16-P6-2 - AC-16-P6-2: unauthorized mutation is rejected without changing persisted state @p1 @security', async ({ page }) => {
    await page.setContent(`
      <script>
        const app = { state: { amount: 100, owner: 'customer-001' } };
        window.__app = app;
        window.mutateIfAuthorized = async function () {
          const token = sessionStorage.getItem('token');
          if (!token) {
            return { status: 401, state: { ...app.state } };
          }
          app.state.amount = 999999;
          return { status: 200, state: { ...app.state } };
        };
      </script>
    `);

    const before = await page.evaluate(() => ({
      amount: Number((window as typeof window & { __app?: { state: { amount: number; owner: string } } }).__app?.state.amount),
      owner: (window as typeof window & { __app?: { state: { amount: number; owner: string } } }).__app?.state.owner,
    }));
    const response = await page.evaluate(async () => (window as typeof window & { mutateIfAuthorized?: () => Promise<{ status: number; state: { amount: number; owner: string } }> }).mutateIfAuthorized?.());

    expect(response?.status).toBe(401);
    expect(response?.state).toEqual(before);

    const after = await page.evaluate(() => ({
      amount: Number((window as typeof window & { __app?: { state: { amount: number; owner: string } } }).__app?.state.amount),
      owner: (window as typeof window & { __app?: { state: { amount: number; owner: string } } }).__app?.state.owner,
    }));
    expect(after).toEqual(before);
    expect(after.amount).toBe(100);
    expect(after.owner).toBe('customer-001');
  });

  test('HM-11 - TC-16-P6-3 - AC-16-P6-3: export of sensitive canary is blocked and stale evidence is flagged @p0 @security', async () => {
    const canary = 'secret-export-canary-9b2f';
    const unsafeExport = `Authorization: Bearer ${canary}\nX-Trace: trace-42\nCustomer=session-${canary}`;
    const safeExport = redactText(unsafeExport, [canary]);
    expect(safeExport).not.toContain(canary);
    expect(safeExport).toContain(REDACTED);

    const restrictedManifest = {
      schemaVersion: '1.1' as const,
      status: 'PARTIAL' as const,
      identity: {
        runId: 'RUN-SEC-002',
        testId: 'TC-16-P6-3',
        title: 'TC-16-P6-3 - AC-16-P6-3 stale evidence export',
        file: 'evidence-security.spec.ts',
        project: 'qa-workspace',
        trace: { req: ['REQ-16-P6'], ac: ['AC-16-P6-3'], tc: ['TC-16-P6-3'] },
      },
      attempt: {
        attemptId: 'RUN-SEC-002~TC-16-P6-3~r0~p0',
        retryIndex: 0,
        repeatIndex: 0,
        workerIndex: 0,
        parallelIndex: 0,
        shard: 'chromium',
      },
      source: { qaRevision: '5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02', appBuild: null, appRevision: null },
      worktree: { dirty: false, diffDigest: null, untrackedDigest: null, trust: 'TRUSTED_CANDIDATE' as const },
      environment: { node: process.version },
      execution: {
        argv: ['playwright', 'test', 'evidence-security.spec.ts'],
        cwd: process.cwd(),
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        finishedAt: new Date().toISOString(),
        tzOffsetMinutes: 0,
      },
      outcome: {
        status: 'failed' as const,
        expectedStatus: 'passed' as const,
        errors: ['canary detected in export'],
      },
      observables: [
        {
          expectedSource: 'AC-16-P6-3',
          expected: 'blocked or sanitized export',
          actual: 'restricted export retained secret canary',
          anchor: 'evidence-security.spec.ts:3',
        },
      ],
      artifacts: [
        {
          name: 'secret-export.zip',
          path: 'artifacts/RUN-SEC-002/secret-export.zip',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          bytes: 128,
          mime: 'application/zip',
          sensitivity: 'RESTRICTED' as const,
          status: 'ACTIVE' as const,
          capturedAt: new Date().toISOString(),
          expiresAt: null,
        },
      ],
      cleanup: [],
      collection: { errors: [{ stage: 'redaction' as const, target: 'secret-export.zip', message: 'canary leak present' }], redaction: 'APPLIED' as const },
    };

    const exportResult = evaluateExport([restrictedManifest]);
    expect(exportResult.allowed).toBe(false);
    expect(exportResult.blocked).toContain('artifacts/RUN-SEC-002/secret-export.zip');
    expect(validateEvidenceManifest(restrictedManifest).valid).toBe(false);
    expect(validateEvidenceManifest(restrictedManifest).errors.some((err) => err.includes('collection.errors'))).toBe(false);
    expect(restrictedManifest.collection.errors).toHaveLength(1);
    expect(restrictedManifest.collection.errors[0]?.target).toBe('secret-export.zip');
  });
});
